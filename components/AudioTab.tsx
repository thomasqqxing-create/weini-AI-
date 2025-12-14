import React, { useState } from 'react';
import { Character, StoryboardFrame } from '../types';
import { generateSpeech } from '../services/geminiService';
import { Play, Download, Mic, Loader2, Music, RefreshCw } from 'lucide-react';

interface AudioTabProps {
  frames: StoryboardFrame[];
  characters: Character[];
  setFrames: React.Dispatch<React.SetStateAction<StoryboardFrame[]>>;
}

const VOICE_OPTIONS = [
    { name: 'Kore (Female, Soothing)', id: 'Kore' },
    { name: 'Puck (Male, Energetic)', id: 'Puck' },
    { name: 'Fenrir (Male, Deep)', id: 'Fenrir' },
    { name: 'Charon (Male, Deep)', id: 'Charon' },
    { name: 'Zephyr (Female, Calm)', id: 'Zephyr' },
];

export const AudioTab: React.FC<AudioTabProps> = ({ frames, characters, setFrames }) => {
    // Local state for mapping characters to voices
    const [charVoiceMap, setCharVoiceMap] = useState<Record<string, string>>({});
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [isBatchGenerating, setIsBatchGenerating] = useState(false);
    const [progress, setProgress] = useState("");

    // Filter frames that have dialogue
    const dialogueFrames = frames.filter(f => f.dialogue && f.dialogue.trim().length > 0);

    const getVoiceForFrame = (frame: StoryboardFrame) => {
        const speakerName = frame.charactersPresent?.[0];
        if (!speakerName) return 'Kore';
        
        const char = characters.find(c => c.name === speakerName);
        if (char && charVoiceMap[char.id]) {
            return charVoiceMap[char.id];
        }
        return 'Kore';
    };

    const handleVoiceChange = (charId: string, voiceId: string) => {
        setCharVoiceMap(prev => ({ ...prev, [charId]: voiceId }));
    };

    const handleGenerateAudio = async (frame: StoryboardFrame) => {
        if (!frame.dialogue) return;
        setGeneratingId(frame.id);
        
        try {
            const voice = getVoiceForFrame(frame);
            const wavUrl = await generateSpeech(frame.dialogue, voice);
            
            setFrames(prev => prev.map(f => f.id === frame.id ? { ...f, audioUrl: wavUrl } : f));
        } catch (e) {
            console.error(e);
            alert("配音生成失败，请重试");
        } finally {
            setGeneratingId(null);
        }
    };

    const handleGenerateAllAudio = async () => {
        setIsBatchGenerating(true);
        let count = 0;
        
        for (const frame of dialogueFrames) {
            // Force regeneration or skip? Usually batch skips existing. 
            // Users can manually regenerate specific ones.
            if (frame.audioUrl) continue; 
            
            count++;
            setProgress(`${count} / ${dialogueFrames.filter(f => !f.audioUrl).length}`);
            setGeneratingId(frame.id); 

            try {
                const voice = getVoiceForFrame(frame);
                const wavUrl = await generateSpeech(frame.dialogue!, voice);
                
                setFrames(prev => prev.map(f => f.id === frame.id ? { ...f, audioUrl: wavUrl } : f));
                
                // Small delay to prevent rate limiting
                await new Promise(r => setTimeout(r, 500));
            } catch (e) {
                console.error(`Failed audio for frame ${frame.panelNumber}`, e);
            }
        }
        
        setIsBatchGenerating(false);
        setGeneratingId(null);
        setProgress("");
    };

    const handlePlay = (url: string) => {
        const audio = new Audio(url);
        audio.play();
    };

    return (
        <div className="flex h-full">
            {/* Sidebar: Voice Setup */}
            <div className="w-80 border-r border-gray-800 bg-gray-900 p-6 overflow-y-auto">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Mic className="text-purple-500" /> 配音设置
                </h2>
                <div className="space-y-4">
                    {characters.map(char => (
                        <div key={char.id} className="bg-gray-950 p-4 rounded-xl border border-gray-800">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-gray-800 overflow-hidden">
                                    {char.imageUrl && <img src={char.imageUrl} className="w-full h-full object-cover"/>}
                                </div>
                                <span className="text-sm font-medium text-gray-200">{char.name}</span>
                            </div>
                            <select 
                                className="w-full bg-gray-900 border border-gray-700 text-xs text-gray-300 rounded p-2 outline-none"
                                value={charVoiceMap[char.id] || 'Kore'}
                                onChange={(e) => handleVoiceChange(char.id, e.target.value)}
                            >
                                {VOICE_OPTIONS.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                    {characters.length === 0 && (
                        <p className="text-gray-500 text-sm">暂无角色，请先创建角色。</p>
                    )}
                </div>
            </div>

            {/* Main: Dialogue List */}
            <div className="flex-1 bg-gray-950 p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-white">台词列表 ({dialogueFrames.length})</h2>
                        {dialogueFrames.length > 0 && (
                            <button 
                                onClick={handleGenerateAllAudio}
                                disabled={isBatchGenerating}
                                className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg disabled:opacity-50"
                            >
                                {isBatchGenerating ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" />
                                        生成中 {progress}
                                    </>
                                ) : (
                                    <>
                                        <Music size={16} fill="currentColor" />
                                        一键生成所有配音 (跳过已完成)
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                    
                    {dialogueFrames.map(frame => (
                        <div key={frame.id} className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex gap-6 items-center hover:border-purple-500/30 transition">
                            <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center text-gray-500 font-bold text-lg">
                                {frame.panelNumber}
                            </div>

                            <div className="flex-1">
                                <p className="text-xs text-gray-500 mb-1">
                                    {frame.charactersPresent.join(', ') || '旁白'}
                                </p>
                                <p className="text-lg text-gray-200 font-medium">
                                    “{frame.dialogue}”
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                {frame.audioUrl ? (
                                    <>
                                        <button 
                                            onClick={() => handlePlay(frame.audioUrl!)}
                                            className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center transition"
                                            title="播放"
                                        >
                                            <Play size={18} fill="currentColor" />
                                        </button>
                                        <button 
                                            onClick={() => handleGenerateAudio(frame)}
                                            disabled={generatingId === frame.id}
                                            className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center justify-center transition border border-gray-700"
                                            title="重新生成"
                                        >
                                           {generatingId === frame.id ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16} />}
                                        </button>
                                        <a 
                                            href={frame.audioUrl} 
                                            download={`dialogue_${frame.panelNumber}.wav`}
                                            className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 flex items-center justify-center transition border border-gray-700"
                                            title="下载"
                                        >
                                            <Download size={18} />
                                        </a>
                                    </>
                                ) : (
                                    <button 
                                        onClick={() => handleGenerateAudio(frame)}
                                        disabled={generatingId === frame.id || isBatchGenerating}
                                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition disabled:opacity-50"
                                    >
                                        {generatingId === frame.id ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Music size={16} />
                                        )}
                                        生成
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {dialogueFrames.length === 0 && (
                        <div className="text-center text-gray-500 mt-20">
                            暂无台词。请在剧本中包含对话。
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};