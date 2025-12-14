import React, { useState } from 'react';
import { extractWorldInfo, analyzeScript, constructPanelPrompt } from '../services/geminiService';
import { Character, Scene, AppTab, ScriptPanel, StoryboardFrame } from '../types';
import { Sparkles, ArrowRight, Save, FileText, Loader2, CheckCircle2 } from 'lucide-react';

interface ScriptTabProps {
  script: string;
  setScript: (s: string) => void;
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  setScenes: React.Dispatch<React.SetStateAction<Scene[]>>;
  setFrames: React.Dispatch<React.SetStateAction<StoryboardFrame[]>>;
  setActiveTab: (tab: AppTab) => void;
}

export const ScriptTab: React.FC<ScriptTabProps> = ({ 
  script, 
  setScript, 
  setCharacters, 
  setScenes, 
  setFrames,
  setActiveTab 
}) => {
  const [status, setStatus] = useState<'idle' | 'extracting' | 'storyboarding' | 'done'>('idle');
  const [extractedData, setExtractedData] = useState<{
    characters: Partial<Character>[], 
    scenes: Partial<Scene>[],
    panels: ScriptPanel[]
  } | null>(null);

  const handleAnalyze = async () => {
    if (!script.trim()) return;
    
    try {
      // Step 1: Extract World Info
      setStatus('extracting');
      const worldData = await extractWorldInfo(script);
      
      // Step 2: Generate Storyboard Script (using extracted characters for context)
      setStatus('storyboarding');
      // We cast Partial<Character> to Character[] for the service, as it only needs names
      const panels = await analyzeScript(script, worldData.characters as Character[]);

      setExtractedData({
        characters: worldData.characters,
        scenes: worldData.scenes,
        panels: panels
      });
      setStatus('done');

    } catch (e) {
      alert("全流程分析失败，请检查 API Key 设置或重试。");
      console.error(e);
      setStatus('idle');
    }
  };

  const handleApply = () => {
    if (!extractedData) return;
    
    // 1. Process Characters
    const newChars: Character[] = extractedData.characters.map(c => ({
        id: crypto.randomUUID(),
        name: c.name || 'Unknown',
        description: c.description || '',
        visualPrompt: c.visualPrompt || '',
        imageUrl: ''
    }));

    // 2. Process Scenes
    const newScenes: Scene[] = extractedData.scenes.map(s => ({
        id: crypto.randomUUID(),
        name: s.name || 'Unknown',
        description: s.description || '',
        visualPrompt: s.visualPrompt || '',
        imageUrl: ''
    }));

    // 3. Process Storyboard Frames
    const newFrames: StoryboardFrame[] = extractedData.panels.map(p => {
        // Try to auto-assign scenes if names match loosely
        const description = p.description || "";
        const matchedScene = newScenes.find(s => {
            const sceneName = s.name || "";
            if (!sceneName || !description) return false;
            return description.includes(sceneName) || sceneName.includes(description);
        });

        // Pre-calculate prompt so user can see it immediately
        const initialPrompt = constructPanelPrompt(
            p, 
            newChars, 
            matchedScene
        );

        return {
            ...p,
            id: crypto.randomUUID(),
            currentPrompt: initialPrompt, 
            status: 'pending',
            assignedSceneId: matchedScene?.id
        };
    });

    setCharacters(prev => [...prev, ...newChars]);
    setScenes(prev => [...prev, ...newScenes]);
    setFrames(newFrames); // Overwrite frames for a new script
    
    // Move to next step
    setActiveTab(AppTab.CHARACTERS);
  };

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Input Area */}
      <div className="flex-1 p-6 flex flex-col bg-gray-900 border-r border-gray-800">
        <div className="mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <FileText className="text-purple-500"/> 第一步：上传剧本
            </h2>
            <p className="text-gray-400 text-sm mt-1">
                AI 将一键提取角色、场景，并自动拆解生成分镜脚本。
            </p>
        </div>
        <textarea
          className="flex-1 bg-gray-950 text-gray-300 p-4 rounded-xl border border-gray-800 resize-none focus:outline-none focus:border-purple-500 font-mono text-sm leading-relaxed mb-4"
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="在此处粘贴小说章节或剧本内容..."
        />
        <button
            onClick={handleAnalyze}
            disabled={status !== 'idle' && status !== 'done' || !script}
            className={`w-full py-4 font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-lg ${
                status === 'done' 
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            {status === 'idle' && <><Sparkles /> 开始全流程智能分析</>}
            {status === 'extracting' && <><Loader2 className="animate-spin" /> 正在提取角色与场景...</>}
            {status === 'storyboarding' && <><Loader2 className="animate-spin" /> 正在生成分镜脚本...</>}
            {status === 'done' && <><CheckCircle2 /> 分析完成 - 请在右侧确认</>}
        </button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 p-6 bg-gray-950 overflow-y-auto">
        {!extractedData ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                <Sparkles size={48} className="mb-4" />
                <p>点击分析后，AI 将自动生成所有设定和分镜</p>
            </div>
        ) : (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center mb-6 bg-gray-900/50 p-4 rounded-xl border border-gray-800 backdrop-blur">
                    <div>
                        <h3 className="text-xl font-semibold text-white">分析结果概览</h3>
                        <p className="text-xs text-gray-400 mt-1">确认无误后点击保存，将自动应用所有设定。</p>
                    </div>
                    <button 
                        onClick={handleApply}
                        className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg flex items-center gap-2 transition shadow-lg shadow-green-900/20"
                    >
                        保存并进入下一步 <ArrowRight size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {/* Characters Preview */}
                    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                        <h4 className="text-purple-400 font-bold mb-3 flex items-center gap-2">
                            <UsersIcon /> 角色 ({extractedData.characters.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {extractedData.characters.map((c, i) => (
                                <span key={i} className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-200 border border-gray-700">
                                    {c.name}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Scenes Preview */}
                    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                        <h4 className="text-blue-400 font-bold mb-3 flex items-center gap-2">
                            <ImageIcon /> 场景 ({extractedData.scenes.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {extractedData.scenes.map((s, i) => (
                                <span key={i} className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-200 border border-gray-700">
                                    {s.name}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Storyboard Preview */}
                    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                        <h4 className="text-emerald-400 font-bold mb-3 flex items-center gap-2">
                            <BookOpenIcon /> 分镜脚本 ({extractedData.panels.length} 镜)
                        </h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {extractedData.panels.map((p, i) => (
                                <div key={i} className="text-sm p-2 bg-gray-950 rounded border border-gray-800/50 flex gap-3">
                                    <span className="font-mono text-gray-500 w-6 flex-shrink-0">#{p.panelNumber}</span>
                                    <span className="text-gray-300 line-clamp-1">{p.description}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

// Simple icons for local use
const UsersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const ImageIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>;
const BookOpenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;