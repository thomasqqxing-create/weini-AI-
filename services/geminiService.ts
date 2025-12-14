import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { Character, Scene, ScriptPanel } from "../types";

// Helper to ensure API Key exists
const getAI = () => {
  const localKey = localStorage.getItem("gemini_api_key");
  const envKey = process.env.API_KEY;
  const key = localKey || envKey;

  if (!key) {
    throw new Error("API Key is missing. Please set it in Settings.");
  }
  return new GoogleGenAI({ apiKey: key });
};

// Retry helper for transient network/server errors
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // 1. Extract error message safely from various possible shapes
    let msg = error.message || error.toString() || '';
    
    // Check for nested error object from Google API response (e.g. { error: { code: 500, message: ... } })
    if (error.error && error.error.message) {
      msg += ' ' + error.error.message;
    }

    const status = error.status || error.response?.status || error.error?.code;

    // 2. Identify Transient Errors
    const isTransient = 
      status === 500 || 
      status === 503 || 
      status === 502 ||
      status === 504 ||
      msg.includes('Rpc failed') ||
      msg.includes('xhr error') ||
      msg.includes('fetch failed') ||
      msg.includes('NetworkError') ||
      msg.includes('Load failed') ||
      msg.includes('network timeout');

    if (retries > 0 && isTransient) {
      console.warn(`[Retry] API Error (${msg}). Retrying in ${delay}ms... (${retries} left)`);
      await new Promise(r => setTimeout(r, delay));
      return withRetry(fn, retries - 1, delay * 2); // Exponential backoff
    }
    
    // If not transient or no retries left, rethrow
    throw error;
  }
}

/**
 * Extracts characters and scenes from the script (Chinese enforced).
 */
export const extractWorldInfo = async (scriptText: string): Promise<{ characters: Partial<Character>[], scenes: Partial<Scene>[] }> => {
  const ai = getAI();
  const prompt = `
    Analyze the following fiction script.
    Identify all the MAIN characters and DISTINCT scenes/locations.
    
    **OUTPUT LANGUAGE REQUIREMENT: SIMPLIFIED CHINESE (简体中文)**.
    
    For each Character:
    - name: Character Name (Chinese).
    - description: Brief description (Chinese).
    - visualPrompt: **Extremely detailed visual description in Chinese**. 
      - Include: Hairstyle, hair color, eye shape/color, clothing details (materials, style), accessories, body type, age feel. 
      - Example: "银色长发，锐利的蓝色眼睛，穿着带有发光纹路的黑色赛博朋克战术夹克，冷酷表情，脖子上有条形码纹身".

    For each Scene:
    - name: Location Name (Chinese).
    - description: Brief description (Chinese).
    - visualPrompt: **Extremely detailed visual description in Chinese**.
      - Include: Lighting (neon, natural, dark), atmosphere, key props, architectural style.
      - Example: "破旧的废弃工厂内部，生锈的金属管道，昏暗的黄色应急灯光，地面有积水，充满压抑感".

    Script:
    ${scriptText}
  `;

  const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          characters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                visualPrompt: { type: Type.STRING },
              }
            }
          },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                visualPrompt: { type: Type.STRING },
              }
            }
          }
        }
      }
    }
  }));

  const text = response.text;
  if (!text) throw new Error("Failed to analyze script entities");

  try {
    const result = JSON.parse(text);
    return {
      characters: result.characters || [],
      scenes: result.scenes || []
    };
  } catch (e) {
    console.error("JSON parse error", e);
    throw new Error("Invalid JSON response from AI");
  }
}

/**
 * Generates an image based on a prompt.
 */
export const generateImage = async (prompt: string, aspectRatio: "1:1" | "16:9" | "9:16" | "3:4" | "4:3" = "1:1"): Promise<string> => {
  const ai = getAI();
  let lastError: any = new Error("Unknown error");
  
  // Attempt 1: Gemini 2.5 Flash Image
  try {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
        },
      },
    }), 2); // Retry twice for images

    const parts = response.candidates?.[0]?.content?.parts || [];
    
    // Check for Image
    const imagePart = parts.find(p => p.inlineData);
    if (imagePart?.inlineData) {
      return `data:image/png;base64,${imagePart.inlineData.data}`;
    }

    const textPart = parts.find(p => p.text);
    if (textPart?.text) {
        lastError = new Error(`AI Refusal: ${textPart.text.substring(0, 100)}...`);
    } else {
        lastError = new Error("API returned empty data.");
    }
  } catch (error: any) {
    console.warn("Gemini 2.5 Flash Image failed, trying fallback...", error);
    lastError = error;
  }

  // Attempt 2: Imagen 3 (Fallback)
  try {
    const response = await withRetry<any>(() => ai.models.generateImages({
        model: 'imagen-3.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            aspectRatio: aspectRatio,
            outputMimeType: 'image/jpeg'
        }
    }), 2);

    const base64 = response.generatedImages?.[0]?.image?.imageBytes;
    if (base64) {
        return `data:image/jpeg;base64,${base64}`;
    }
  } catch (error) {
     console.warn("Imagen 3 fallback failed:", error);
  }

  throw lastError || new Error("Image generation failed. Please check your API Key.");
};

/**
 * Analyzes a raw script (Chinese enforced).
 */
export const analyzeScript = async (scriptText: string, availableCharacters: Character[]): Promise<ScriptPanel[]> => {
  const ai = getAI();
  const charNames = (availableCharacters || []).map(c => c.name).join(", ");

  // Stronger prompt to ensure description is generated
  const prompt = `
    Role: Professional Cinematic Storyboard Director.
    Task: Convert the script into a sequence of highly detailed visual panels.
    
    **CRITICAL**: You MUST provide a 'visual_action' for every single panel. 
    It must be rich in visual detail, describing lighting, composition, and specific character acting.
    
    Instead of "He looks angry", say: "Close-up, high contrast lighting, Character A's face contorted in rage, veins visible, dark background."
    Instead of "They talk", say: "Over-the-shoulder shot, Character A in focus foreground, Character B blurred in background, warm sunset lighting."

    **OUTPUT LANGUAGE REQUIREMENT: SIMPLIFIED CHINESE (简体中文)**.
    
    Available Characters: ${charNames}.
    
    Output JSON Array with these exact keys:
    - panel_id (integer)
    - visual_action (String. **REQUIRED**. Detailed Visual Instruction.)
    - characters_in_shot (Array of Strings. Names from available list.)
    - dialogue_text (String. Original text.)
    - shot_type (String. E.g., "特写 (Close-up)", "中景 (Medium)", "广角 (Wide)", "荷兰角 (Dutch Angle)")

    Script:
    ${scriptText}
  `;

  const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            panel_id: { type: Type.INTEGER },
            visual_action: { type: Type.STRING },
            characters_in_shot: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            dialogue_text: { type: Type.STRING },
            shot_type: { type: Type.STRING },
          }
        }
      }
    }
  }));

  const text = response.text;
  if (!text) throw new Error("Failed to analyze script");
  
  try {
    const result = JSON.parse(text);
    if (Array.isArray(result)) {
      return result.map((p: any) => {
        // Fallback Logic: If AI fails to give a description, infer it from dialogue
        let desc = typeof p.visual_action === 'string' ? p.visual_action : "";
        const dialogue = typeof p.dialogue_text === 'string' ? p.dialogue_text : "";
        const chars = Array.isArray(p.characters_in_shot) ? p.characters_in_shot : [];
        
        if (!desc || desc.trim().length === 0 || desc === "No description generated.") {
            if (dialogue) {
                desc = `${chars.join('&') || 'Character'} saying: "${dialogue.substring(0, 15)}...". Cinematic lighting, detailed expression.`;
            } else {
                desc = "Cinematic establishing shot, detailed environment, 8k resolution.";
            }
        }

        return {
            panelNumber: typeof p.panel_id === 'number' ? p.panel_id : 0,
            description: desc,
            charactersPresent: chars,
            dialogue: dialogue,
            cameraAngle: typeof p.shot_type === 'string' ? p.shot_type : "Medium Shot",
        };
      }) as ScriptPanel[];
    }
    return [];
  } catch (e) {
    console.error("JSON parse error", e);
    throw new Error("Invalid JSON response from AI");
  }
};

/**
 * Constructs prompt for Character Concept Sheet.
 * STRICTLY ENFORCES "Model Sheet" Layout: Front/Side/Back + Grid.
 */
export const constructCharacterPrompt = (char: Partial<Character>): string => {
  return `
[Art Type] **Production Character Model Sheet (Settei)**.
[Subject] Name: ${char.name}.
[Visual DNA] ${char.visualPrompt}.
[Layout] **Horizontal Composition** on Technical Grid Background.
1. **Left**: Full body Standing pose (Front View).
2. **Center**: Full body Profile pose (Side View).
3. **Right**: Full body (Back View).
4. **Inserts**: Include 2 close-up sketches of facial expressions (Eyes/Face) and 1 detail of clothing/accessory in the corners.
[Background] White/Light Grey background with technical measurement grid lines.
[Style] Professional Anime Character Design, Flat colors, Clean lines, Reference Art, High Quality 4k.
  `.trim();
};

/**
 * Constructs prompt for scene panorama.
 */
export const constructScenePrompt = (scene: Partial<Scene>): string => {
  return `
    [Type] Wide-angle Concept Art.
    [Location] ${scene.name}.
    [Visuals] ${scene.visualPrompt}.
    [Quality] Masterpiece, Cinematic Lighting, 8k, Makoto Shinkai Style.
    [Style] Anime Background Art.
    No characters.
  `.trim();
};

export const constructSceneGridPrompt = (scene: Partial<Scene>): string => {
  return `
    [Type] 9-Panel Grid Concept Sheet.
    [Subject] Details of ${scene.name}.
    [Visuals] ${scene.visualPrompt}.
    [Content] Close-ups of props, textures, lighting, corners.
    [Style] Technical concept art.
  `.trim();
};

/**
 * Constructs the final prompt for a panel.
 * Prioritizes ACTION and COMPOSITION over generic description.
 */
export const constructPanelPrompt = (
  panel: ScriptPanel, 
  characters: Character[], 
  scene?: Scene
): string => {
  let prompt = `(Anime Style Masterpiece, 8k Resolution, Cinematic Composition). `;

  // 1. ACTION & CAMERA (Highest Priority)
  prompt += `\n[ACTION & SHOT] **${panel.cameraAngle}**. ${panel.description}. `;
  
  // 2. SCENE CONTEXT
  if (scene) {
    prompt += `\n[LOCATION] ${scene.visualPrompt} (Name: ${scene.name}). Detailed background. `;
  } else {
    prompt += `\n[LOCATION] Atmospheric background, matching the mood. `;
  }

  // 3. CHARACTER INJECTION (Strict Visuals)
  const safeCharactersPresent = Array.isArray(panel.charactersPresent) ? panel.charactersPresent : [];
  
  if (safeCharactersPresent.length > 0) {
      prompt += `\n[CHARACTERS]:`;
      safeCharactersPresent.forEach(charName => {
         // Fuzzy match character
         const charObj = characters.find(c => c.name === charName || charName.includes(c.name) || c.name.includes(charName));
         if (charObj) {
             // Inject the Character's "DNA"
             prompt += `\n- (${charName}): ${charObj.visualPrompt}`;
         } else {
             prompt += `\n- (${charName}): Generic anime character.`;
         }
      });
  }

  return prompt;
};

/**
 * Generates speech from text.
 */
export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  const ai = getAI();
  
  const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: ['AUDIO'], // Use string literal to ensure correct enum mapping
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName },
        },
      },
    },
  }), 2);

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("AI did not return audio data.");

  // Convert raw PCM to WAV for browser playback
  return pcmBase64ToWavUrl(base64Audio);
};

// --- Audio Utilities ---

function pcmBase64ToWavUrl(base64Pcm: string): string {
  const binaryString = atob(base64Pcm);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Gemini TTS output is typically 24kHz, 1 channel (mono), 16-bit PCM
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  
  const wavBytes = createWavHeader(bytes, sampleRate, numChannels, bitsPerSample);
  const blob = new Blob([wavBytes], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function createWavHeader(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): Uint8Array {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const pcmLength = pcmData.length;
    const dataSize = pcmLength;
    const fileSize = 36 + dataSize;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize, true);
    writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Combine header and data
    const wavFile = new Uint8Array(header.byteLength + pcmLength);
    wavFile.set(new Uint8Array(header), 0);
    wavFile.set(pcmData, 44);

    return wavFile;
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}