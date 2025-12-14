import React from 'react';
import { Character, Scene, StoryboardFrame } from '../types';
import { constructPanelPrompt, generateImage } from '../services/geminiService';
import { Play, Download, Edit2, RefreshCw, MapPin, Image as ImageIcon, CheckSquare, Square } from 'lucide-react';

interface StoryboardTabProps {
  characters: Character[];
  scenes: Scene[];
  script: string;
  frames: StoryboardFrame[];
  setFrames: React.Dispatch<React.SetStateAction<StoryboardFrame[]>>;
}

export const StoryboardTab: React.FC<StoryboardTabProps> = ({
  characters,
  scenes,
  frames,
  setFrames
}) => {
  
  const generateFrame = async (frame: StoryboardFrame) => {
    setFrames(prev => prev.map(f => f.id === frame.id ? { ...f, status: 'generating' } : f));

    try {
      // FIX: Always reconstruct the prompt based on CURRENT state (scene binding, characters)
      // This ensures that if the user changed the scene dropdown, it IS included in the new generation.
      const assignedScene = scenes.find(s => s.id === frame.assignedSceneId);
      const promptToUse = constructPanelPrompt(frame, characters, assignedScene);

      const imageUrl = await generateImage(promptToUse, "16:9");

      setFrames(prev => prev.map(f => f.id === frame.id ? {
        ...f,
        status: 'done',
        generatedImageUrl: imageUrl,
        currentPrompt: promptToUse // Save the prompt we actually used
      } : f));

    } catch (e) {
      setFrames(prev => prev.map(f => f.id === frame.id ? { ...f, status: 'error' } : f));
      console.error(e);
      alert(`生成失败 (Frame ${frame.panelNumber}): 请重试`);
    }
  };

  const handleGenerateAll = async () => {
    if(!confirm(`即将批量生成 ${frames.filter(f => !f.generatedImageUrl).length} 个未完成的分镜，是否继续？`)) return;

    for (const frame of frames) {
        // Only generate if not already done (to save tokens), or forcing? 
        // Logic: Generate 'Pending' or 'Error' frames, skip 'Done' unless user explicitly clicks individual regenerate
        if (!frame.generatedImageUrl || frame.status === 'error') {
            await generateFrame(frame);
            // Delay to prevent rate limits
            await new Promise(r => setTimeout(r, 2000));
        }
    }
  };

  // Helper to reconstruct prompt immediately when dependencies change (visual feedback only)
  // The actual generation now uses the strict reconstruction in generateFrame
  const updateFrameData = (
      frameId: string, 
      updates: Partial<StoryboardFrame>
  ) => {
      setFrames(prev => prev.map(f => {
          if (f.id !== frameId) return f;
          
          const updatedFrame = { ...f, ...updates };
          
          // Optional: We can update the preview prompt here too, but generateFrame handles the real logic
          const scene = scenes.find(s => s.id === updatedFrame.assignedSceneId);
          const newPrompt = constructPanelPrompt(updatedFrame, characters, scene);

          return { ...updatedFrame, currentPrompt: newPrompt };
      }));
  };

  const handleAssignScene = (frameId: string, sceneId: string) => {
    updateFrameData(frameId, { assignedSceneId: sceneId });
  };

  const updateFramePromptManual = (frameId: string, newPrompt: string) => {
      setFrames(prev => prev.map(f => f.id === frameId ? { ...f, currentPrompt: newPrompt } : f));
  };

  const toggleCharacterInFrame = (frameId: string, charName: string) => {
      const frame = frames.find(f => f.id === frameId);
      if (!frame) return;

      const currentList = frame.charactersPresent || [];
      const newList = currentList.includes(charName)
          ? currentList.filter(c => c !== charName)
          : [...currentList, charName];
      
      updateFrameData(frameId, { charactersPresent: newList });
  };

  const handleDownload = (url: string, id: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `storyboard_panel_${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-full flex-col">
       {/* Header */}
       <div className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-white">4. 分镜生成</h2>
              <span className="text-sm text-gray-400">
                  {frames.length > 0 ? `${frames.length} 个分镜` : '暂无数据'}
              </span>
          </div>
          
          <div className="flex gap-3">
             {frames.length > 0 && (
                <button 
                    onClick={handleGenerateAll}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg"
                >
                    <Play size={16} fill="currentColor" /> 生成所有未完成画面
                </button>
             )}
          </div>
       </div>

      {/* List */}
      <div className="flex-1 bg-gray-950 overflow-y-auto p-8">
        <div className="space-y-12 max-w-6xl mx-auto">
            {frames.map((frame) => (
                <div key={frame.id} className="flex gap-6 items-start group">
                    <div className="w-16 flex-shrink-0 flex flex-col items-center pt-4">
                        <span className="text-3xl font-black text-gray-800">#{frame.panelNumber}</span>
                    </div>

                    <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-lg">
                        {/* Control Panel */}
                        <div className="p-5 border-b border-gray-800 flex flex-col md:flex-row gap-6 bg-gray-900">
                           <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 rounded bg-gray-800 text-xs text-gray-400 border border-gray-700">{frame.cameraAngle}</span>
                                </div>
                                <p className="text-gray-200 text-lg leading-relaxed">{frame.description}</p>
                                {frame.dialogue && (
                                    <div className="bg-black/30 p-3 rounded-lg border-l-4 border-purple-500">
                                        <p className="text-gray-400 italic">"{frame.dialogue}"</p>
                                    </div>
                                )}
                           </div>
                           
                           {/* Right Settings Column */}
                           <div className="w-full md:w-64 flex-shrink-0 space-y-4">
                                {/* Scene Selector */}
                                <div>
                                    <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">绑定场景</label>
                                    <div className="relative">
                                        <select 
                                            className="w-full bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg p-2 appearance-none focus:border-purple-500 outline-none"
                                            value={frame.assignedSceneId || ""}
                                            onChange={(e) => handleAssignScene(frame.id, e.target.value)}
                                        >
                                            <option value="">(未指定场景 - 自动背景)</option>
                                            {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        <MapPin size={14} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Character Checklist */}
                                <div>
                                    <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">出场人物 (点击切换)</label>
                                    <div className="bg-gray-950 p-2 rounded-lg border border-gray-800 max-h-32 overflow-y-auto space-y-1">
                                        {characters.map(char => {
                                            const isPresent = (frame.charactersPresent || []).includes(char.name);
                                            return (
                                                <div 
                                                    key={char.id} 
                                                    onClick={() => toggleCharacterInFrame(frame.id, char.name)}
                                                    className={`flex items-center gap-2 text-xs p-1.5 rounded cursor-pointer select-none transition ${isPresent ? 'bg-purple-900/30 text-purple-200' : 'text-gray-500 hover:bg-gray-800'}`}
                                                >
                                                    {isPresent ? <CheckSquare size={14} /> : <Square size={14} />}
                                                    <span className="truncate">{char.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                           </div>
                        </div>

                        {/* Image Canvas */}
                        <div className="relative w-full aspect-video bg-black flex items-center justify-center group-hover:bg-gray-950 transition-colors">
                            {frame.status === 'generating' && (
                                <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm flex items-center justify-center flex-col">
                                    <RefreshCw className="animate-spin text-purple-500 mb-4" size={40} />
                                    <span className="text-sm text-purple-300 font-bold">正在绘制...</span>
                                </div>
                            )}
                            
                            {frame.generatedImageUrl ? (
                                <img src={frame.generatedImageUrl} className="w-full h-full object-contain" alt="Panel" />
                            ) : (
                                <div className="text-gray-600 flex flex-col items-center">
                                    <ImageIcon size={32} className="mb-2 opacity-50" />
                                    <span className="text-sm">点击生成按钮开始绘制</span>
                                </div>
                            )}

                            {/* Hover Actions */}
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition duration-200 flex gap-2">
                                {frame.generatedImageUrl && (
                                    <button 
                                        onClick={() => handleDownload(frame.generatedImageUrl!, frame.panelNumber)}
                                        className="p-2 bg-black/70 hover:bg-gray-700 text-white rounded-lg backdrop-blur-md shadow-xl border border-white/10"
                                        title="下载"
                                    >
                                        <Download size={16} />
                                    </button>
                                )}
                                <button 
                                    onClick={() => generateFrame(frame)}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg backdrop-blur-md transition flex items-center gap-2 text-sm font-bold shadow-xl"
                                >
                                    <RefreshCw size={14} /> {frame.generatedImageUrl ? "重绘" : "生成"}
                                </button>
                            </div>
                        </div>

                        {/* Prompt Debugger */}
                        <div className="p-3 bg-gray-950 border-t border-gray-800">
                             <div className="group/details">
                                 <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 select-none">
                                    <Edit2 size={12} />
                                    <span className="font-bold uppercase tracking-wider">实时提示词 (自动更新，点击重绘生效)</span>
                                 </div>
                                 <div>
                                    <textarea 
                                        className="w-full bg-gray-900 text-xs text-gray-400 p-3 rounded-lg border border-gray-800 focus:border-purple-500 focus:outline-none h-20 resize-none font-mono"
                                        value={frame.currentPrompt}
                                        readOnly
                                        placeholder="提示词将根据上方设置自动生成..."
                                    />
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};