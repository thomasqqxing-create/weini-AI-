import React, { useState } from 'react';
import { Scene } from '../types';
import { generateImage, constructScenePrompt, constructSceneGridPrompt } from '../services/geminiService';
import { Plus, Trash2, RefreshCw, Save, Image as ImageIcon, Play, Grid3X3, Download, Layers } from 'lucide-react';

interface SceneTabProps {
  scenes: Scene[];
  setScenes: React.Dispatch<React.SetStateAction<Scene[]>>;
}

export const SceneTab: React.FC<SceneTabProps> = ({ scenes, setScenes }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [progress, setProgress] = useState("");
  const [editForm, setEditForm] = useState<Partial<Scene>>({
    name: '',
    description: '',
    visualPrompt: '',
  });

  const handleSelect = (scene: Scene) => {
    setSelectedId(scene.id);
    setEditForm(scene);
  };

  const handleCreateNew = () => {
    const newScene: Scene = {
      id: crypto.randomUUID(),
      name: '新场景',
      description: '夜晚的赛博朋克街道...',
      visualPrompt: '赛博朋克街道，霓虹灯，下雨，潮湿的路面，高耸的摩天大楼...',
    };
    setScenes([...scenes, newScene]);
    handleSelect(newScene);
  };

  const handleDelete = (id: string) => {
    if (!confirm('确定要删除这个场景吗？')) return;
    setScenes(scenes.filter(s => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleSave = () => {
    setScenes(scenes.map(s => s.id === selectedId ? { ...s, ...editForm } as Scene : s));
    alert("场景已保存！");
  };

  const handleDownload = (url: string, name: string, suffix: string) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}_${suffix}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleGenerateFullSet = async () => {
    if (!selectedId) return;
    setIsGenerating(true);
    
    try {
        // 1. Generate Panorama (16:9)
        const panoramaPrompt = constructScenePrompt(editForm);
        const panoramaImg = await generateImage(panoramaPrompt, "16:9");

        // 2. Generate Grid (1:1) - Wait a bit to be polite
        await new Promise(r => setTimeout(r, 500));
        
        const gridPrompt = constructSceneGridPrompt(editForm);
        const gridImg = await generateImage(gridPrompt, "1:1");

        const updatedScene = { 
            ...editForm, 
            imageUrl: panoramaImg,
            gridUrl: gridImg
        };
        
        setEditForm(updatedScene);
        setScenes(prev => prev.map(s => s.id === selectedId ? { ...s, imageUrl: panoramaImg, gridUrl: gridImg } : s));

    } catch (e) {
        alert("生成失败，请稍后重试。");
        console.error(e);
    } finally {
        setIsGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    if (scenes.length === 0) return;
    if (!confirm(`将为 ${scenes.length} 个场景自动生成【全套概念图】，耗时较长。是否继续？`)) return;

    setIsGeneratingAll(true);
    let count = 0;
    
    for (const scene of scenes) {
        count++;
        setProgress(`${count}/${scenes.length}`);
        try {
            // Panorama
            const panPrompt = constructScenePrompt(scene);
            const panImg = await generateImage(panPrompt, "16:9");
            
            await new Promise(r => setTimeout(r, 1000));

            // Grid
            const gridPrompt = constructSceneGridPrompt(scene);
            const gridImg = await generateImage(gridPrompt, "1:1");
            
            setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, imageUrl: panImg, gridUrl: gridImg } : s));
            
            if (selectedId === scene.id) {
                setEditForm(prev => ({ ...prev, imageUrl: panImg, gridUrl: gridImg }));
            }
            
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
            console.error(`Failed to generate for ${scene.name}`, e);
        }
    }
    
    setIsGeneratingAll(false);
    setProgress("");
    alert("批量场景生成完成！");
  };

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="w-80 border-r border-gray-800 bg-gray-900 overflow-y-auto">
        <div className="p-4 flex justify-between items-center border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-lg font-semibold text-white">场景列表</h2>
          <div className="flex gap-2">
            <button 
                onClick={handleGenerateAll}
                disabled={isGeneratingAll || scenes.length === 0}
                className="p-2 bg-blue-900/50 hover:bg-blue-800 text-blue-200 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                title="一键生成所有场景全套"
            >
               {isGeneratingAll ? (
                   <>
                    <RefreshCw size={20} className="animate-spin"/>
                    <span className="text-xs font-mono">{progress}</span>
                   </>
               ) : <Play size={20} />}
            </button>
            <button 
                onClick={handleCreateNew} 
                className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition"
            >
                <Plus size={20} />
            </button>
          </div>
        </div>
        <div className="p-2 space-y-2">
          {scenes.map(scene => (
            <div 
              key={scene.id}
              onClick={() => handleSelect(scene)}
              className={`p-3 rounded-xl cursor-pointer flex items-center gap-3 transition ${selectedId === scene.id ? 'bg-gray-800 border border-blue-500/50' : 'hover:bg-gray-800/50 border border-transparent'}`}
            >
              <div className="w-16 h-10 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                {scene.imageUrl ? (
                  <img src={scene.imageUrl} className="w-full h-full object-cover" alt={scene.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">?</div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-200 truncate">{scene.name}</p>
              </div>
            </div>
          ))}
          {scenes.length === 0 && (
            <div className="text-center p-8 text-gray-500 text-sm">
              暂无场景。
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 bg-gray-950 overflow-y-auto p-8">
        {selectedId ? (
          <div className="max-w-4xl mx-auto space-y-8">
            <header className="flex justify-between items-start">
              <div>
                <input 
                  type="text" 
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="bg-transparent text-3xl font-bold text-white border-none focus:ring-0 focus:outline-none placeholder-gray-600"
                  placeholder="场景名称"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleDelete(selectedId)} 
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"
                  title="删除场景"
                >
                  <Trash2 size={20} />
                </button>
                <button 
                  onClick={handleSave} 
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2"
                >
                  <Save size={18} /> 保存
                </button>
              </div>
            </header>

            <div className="grid grid-cols-1 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-blue-400 mb-2">环境视觉提示词</label>
                  <textarea 
                    value={editForm.visualPrompt}
                    onChange={e => setEditForm({...editForm, visualPrompt: e.target.value})}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-200 focus:border-blue-500 focus:outline-none h-24 resize-none font-mono text-sm"
                    placeholder="描述环境细节。例如：凌乱的高中教室，阳光明媚的下午，空气中的粉笔灰，木制课桌。"
                  />
                </div>

                <div className="flex gap-4">
                    <button 
                    onClick={handleGenerateFullSet}
                    disabled={isGenerating || isGeneratingAll}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                    {isGenerating ? <RefreshCw className="animate-spin" /> : <Layers />}
                    生成全套场景概念图 (全景 + 细节)
                    </button>
                </div>
              </div>

              {/* Images Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Panorama Slot */}
                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-gray-400">全景图 (Panorama)</label>
                        {editForm.imageUrl && (
                            <button onClick={() => handleDownload(editForm.imageUrl!, editForm.name!, "全景")} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Download size={14}/> 下载</button>
                        )}
                      </div>
                      <div className="w-full aspect-video bg-gray-900 rounded-xl border-2 border-dashed border-gray-800 flex items-center justify-center overflow-hidden">
                        {editForm.imageUrl ? (
                            <img src={editForm.imageUrl} className="w-full h-full object-cover" alt="Panorama" />
                        ) : (
                            <div className="text-center p-4">
                                <ImageIcon className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                                <p className="text-xs text-gray-500">暂无全景</p>
                            </div>
                        )}
                      </div>
                  </div>

                  {/* Grid Slot */}
                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-gray-400">9宫格细节 (Grid)</label>
                        {editForm.gridUrl && (
                            <button onClick={() => handleDownload(editForm.gridUrl!, editForm.name!, "细节")} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Download size={14}/> 下载</button>
                        )}
                      </div>
                      <div className="w-full aspect-square bg-gray-900 rounded-xl border-2 border-dashed border-gray-800 flex items-center justify-center overflow-hidden">
                        {editForm.gridUrl ? (
                            <img src={editForm.gridUrl} className="w-full h-full object-cover" alt="Grid" />
                        ) : (
                            <div className="text-center p-4">
                                <Grid3X3 className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                                <p className="text-xs text-gray-500">暂无细节图</p>
                            </div>
                        )}
                      </div>
                  </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-600">
             <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-xl">请选择一个场景进行编辑。</p>
          </div>
        )}
      </div>
    </div>
  );
};