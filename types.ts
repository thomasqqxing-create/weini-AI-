export interface Character {
  id: string;
  name: string;
  description: string;
  visualPrompt: string; // The "DNA" of the character (Chinese/English)
  imageUrl?: string;
  defaultVoice?: string; // Voice ID for TTS
}

export interface Scene {
  id: string;
  name: string;
  description: string;
  visualPrompt: string; // The "DNA" of the environment
  imageUrl?: string; // Panorama / Main shot
  gridUrl?: string;  // 9-Grid / Multi-angle details
}

export interface ScriptPanel {
  panelNumber: number;
  description: string;
  charactersPresent: string[]; // Names of characters
  dialogue?: string;
  cameraAngle?: string;
}

export interface StoryboardFrame extends ScriptPanel {
  id: string;
  generatedImageUrl?: string;
  currentPrompt: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  assignedSceneId?: string;
  audioUrl?: string; // Generated TTS Audio
  audioStatus?: 'idle' | 'generating' | 'done' | 'error';
}

export enum AppTab {
  SCRIPT = 'SCRIPT',         // Step 1
  CHARACTERS = 'CHARACTERS', // Step 2
  SCENES = 'SCENES',         // Step 3
  STORYBOARD = 'STORYBOARD', // Step 4
  AUDIO = 'AUDIO',           // Step 5 (New)
  SETTINGS = 'SETTINGS',
}