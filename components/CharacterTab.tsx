import React, { useState, useEffect, useRef } from 'react';
import { Character } from '../types';
import { generateImage, constructCharacterPrompt } from '../services/geminiService';
import { Plus, Trash2, RefreshCw, Save, Sparkles, Users, Play, Download, Upload, Book, X, Copy } from 'lucide-react';

interface CharacterTabProps {
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
}

export const CharacterTab: React.FC<CharacterTabProps> = ({ characters, setCharacters }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [progress, setProgress] = useState("");
  const [editForm, setEditForm] = useState<Partial<Character>>({
    name: '',
    description: '',
    visualPrompt: '',
  });

  // Library State
  const [showLibrary, setShowLibrary] = useState(false);
  const [library, setLibrary] = useState<Character[]>([]);

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Library on mount
  useEffect(() => {
    try {
      const savedLib = localStorage.getItem('huanxi_char_lib');
      if (savedLib) {
        setLibrary(JSON.parse(savedLib));
      }
    } catch (e) {
      console.error("Failed to load character library", e);
    }
  }, []);

  const handleSelect = (char: Character) => {
    setSelectedId(char.id);
    setEditForm(char);
  };

  const handleCreateNew = () => {
    const newChar: Character = {
      id: crypto.randomUUID(),
      name: '新角色',
      description: '请输入中文描述...',
      visualPrompt: 'Detailed English/Chinese visual description...',
    };
    setCharacters(prev => [...prev, newChar]);
    handleSelect(newChar);
  };

  const handleDelete = (id: string) => {
    if (!confirm('确定要删除这个角色吗？')) return;
    setCharacters(prev => prev.filter(c => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleSave = () => {
    setCharacters(prev => prev.map(c => c.id === selectedId ? { ...c, ...editForm } as Character : c));
    alert("角色信息已更新。");
  };

  const handleSaveToLibrary = () => {
    if (!editForm.name) return;
    
    // Create a robust copy for the library
    const charToSave: Character = {
        id: crypto.randomUUID(), // New ID for library entry
        name: editForm.name || "未命名",
        description: editForm.description || "",
        visualPrompt: editForm.visualPrompt || "",
        imageUrl: editForm.imageUrl || "",
    };

    const newLib = [charToSave, ...library];
    setLibrary(newLib);
    localStorage.setItem('huanxi_char_lib', JSON.stringify(newLib));
    alert(`"${charToSave.name}" 已保存到角色库！下次可以随时调用。`);
  };

  const handleDeleteFromLibrary = (libId: string) => {
      if(!confirm("确定从角色库中移除吗？")) return;
      const newLib = library.filter(c => c.id !== libId);
      setLibrary(newLib);
      localStorage.setItem('huanxi_char_lib', JSON.stringify(newLib));
  };

  const handleImportFromLibrary = (libChar: Character) => {
      const newChar = { ...libChar, id: crypto.randomUUID() };
      setCharacters(prev => [...prev, newChar]);
      handleSelect(newChar);
      setShowLibrary(false);
  };

  const handleDownload = (url: string, name: string) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}_设定图.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleUploadClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedId) return;

      const reader = new FileReader();
      reader.onloadend = () => {
          const base64 = reader.result as string;
          // Update Form
          setEditForm(prev => ({ ...prev, imageUrl: base64 }));
          // Update List
          setCharacters(prev => prev.map(c => c.id === selectedId ? { ...c, imageUrl: base64 } : c));
      };
      reader.readAsDataURL(file);
      // Reset input
      e.target.value = '';
  };

  const handleGenerateDesign = async () => {
    if (!selectedId) return;
    setIsGenerating(true);
    try {
      const promptToUse = constructCharacterPrompt(editForm);
      const base64Img = await generateImage(promptToUse, "16:9");
      
      const updatedChar = { ...editForm, imageUrl: base64Img };
      setEditForm(updatedChar);
      setCharacters(prev => prev.map(c => c.id === selectedId ? { ...c, imageUrl: base64Img } : c));
    } catch (e) {
      alert("生成失败。请检查API Key。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    if (characters.length === 0) {
        alert("没有角色可生成。请先添加角色。");
        return;
    }
    if (!confirm(`将自动为 ${characters.length} 个角色生成图片。这需要一点时间。`)) return;

    setIsGeneratingAll(true);
    let count = 0;
    
    // Iterate through current list state to avoid stale closures
    for (const char of characters) {
        count++;
        setProgress(`${count} / ${characters.length}`);
        
        try {
            const promptToUse = constructCharacterPrompt(char);
            const base64Img = await generateImage(promptToUse, "16:9");
            
            // Critical: Use functional update to ensure we are modifying the latest state
            // and NOT overwriting other completed characters with old state.
            setCharacters(prevChars => 
                prevChars.map(c => c.id === char.id ? { ...c, imageUrl: base64Img } : c)
            );
            
            // If this is the currently selected character, update the form view too
            if (selectedId === char.id) {
                setEditForm(prev => ({ ...prev, imageUrl: base64Img }));
            }

            // Delay to prevent rate limiting
            await new Promise(r => setTimeout(r, 1500));
        } catch (e) {
            console.error(`Failed to generate ${char.name}`, e);
        }
    }
    
    setIsGeneratingAll(false);
    setProgress("");
    alert("所有角色生成完毕！");
  };

  return (
    <div className="flex h-full relative">
      {/* Character Library Modal */}
      {showLibrary && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-12">
              <div className="bg-gray-900 w-full max-w-5xl h-full max-h-[80vh] rounded-2xl border border-gray-700 shadow-2xl flex flex-col">
                  <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                      <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Book /> 角色库</h2>
                        <p className="text-gray-400 text-sm">存储常用角色，在不同剧本中重复使用。</p>
                      </div>
                      <button onClick={() => setShowLibrary(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><X /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 content-start">
                      {library.length === 0 ? (
                          <div className="col-span-full text-center text-gray-500 py-20">
                              暂无保存的角色。<br/>在编辑界面点击“保存到库”即可添加。
                          </div>
                      ) : (
                          library.map(libChar => (
                              <div key={libChar.id} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 group hover:border-purple-500 transition">
                                  <div className="aspect-video bg-gray-950 relative">
                                      {libChar.imageUrl ? (
                                          <img src={libChar.imageUrl} className="w-full h-full object-cover" />
                                      ) : (
                                          <div className="w-full h-full flex items-center justify-center text-gray-600">无图</div>
                                      )}
                                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                          <button 
                                            onClick={() => handleImportFromLibrary(libChar)}
                                            className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm font-bold flex items-center gap-1"
                                          >
                                              <Copy size={14} /> 引用
                                          </button>
                                          <button 
                                            onClick={() => handleDeleteFromLibrary(libChar.id)}
                                            className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-bold"
                                          >
                                              <Trash2 size={14} />
                                          </button>
                                      </div>
                                  </div>
                                  <div className="p-3">
                                      <h3 className="font-bold text-gray-200 truncate">{libChar.name}</h3>
                                      <p className="text-xs text-gray-500 truncate">{libChar.description}</p>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Sidebar List */}
      <div className="w-80 border-r border-gray-800 bg-gray-900 overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">当前剧本角色</h2>
            <div className="flex gap-2">
                <button 
                    onClick={handleCreateNew} 
                    className="p-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white transition"
                    title="新建角色"
                >
                    <Plus size={20} />
                </button>
            </div>
          </div>
          
          <button 
              onClick={handleGenerateAll}
              disabled={isGeneratingAll || characters.length === 0}
              className="w-full py-3 bg-purple-900/50 hover:bg-purple-800 text-purple-200 rounded-lg transition disabled:opacity-50 border border-purple-500/30 flex items-center justify-center gap-2 font-bold"
          >
            {isGeneratingAll ? (
                <><RefreshCw size={18} className="animate-spin"/> 正在生成 {progress}</>
            ) : (
                <><Play size={18} /> 一键生成所有角色图</>
            )}
          </button>

          <button 
            onClick={() => setShowLibrary(true)}
            className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm flex items-center justify-center gap-2 transition border border-gray-700"
          >
              <Book size={16} /> 打开常用角色库
          </button>
        </div>

        <div className="p-2 space-y-2 flex-1">
          {characters.map(char => (
            <div 
              key={char.id}
              onClick={() => handleSelect(char)}
              className={`p-3 rounded-xl cursor-pointer flex items-center gap-3 transition ${selectedId === char.id ? 'bg-gray-800 border border-purple-500/50' : 'hover:bg-gray-800/50 border border-transparent'}`}
            >
              <div className="w-12 h-12 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0 relative">
                {char.imageUrl ? (
                  <img src={char.imageUrl} className="w-full h-full object-cover" alt={char.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">?</div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-200 truncate">{char.name}</p>
                <p className="text-xs text-gray-500 truncate">{char.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 bg-gray-950 overflow-y-auto p-8">
        {selectedId ? (
          <div className="max-w-4xl mx-auto space-y-8">
            <header className="flex justify-between items-start">
              <div className="flex-1 mr-4">
                <input 
                  type="text" 
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="w-full bg-transparent text-3xl font-bold text-white border-none focus:ring-0 focus:outline-none placeholder-gray-600 mb-2"
                  placeholder="角色名称"
                />
                <p className="text-gray-400 text-sm">定义角色的外观细节，确保一致性。</p>
              </div>
              <div className="flex gap-2">
                <button 
                    onClick={handleSaveToLibrary}
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-purple-300 border border-purple-500/30 rounded-lg flex items-center gap-2 text-sm"
                    title="保存到公共库供其他剧本使用"
                >
                    <Book size={16} /> 存入角色库
                </button>
                <button 
                  onClick={() => handleDelete(selectedId)} 
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"
                >
                  <Trash2 size={20} />
                </button>
                <button 
                  onClick={handleSave} 
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2"
                >
                  <Save size={18} /> 保存修改
                </button>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">角色描述 (中文)</label>
                  <textarea 
                    value={editForm.description}
                    onChange={e => setEditForm({...editForm, description: e.target.value})}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-200 focus:border-purple-500 focus:outline-none h-24 resize-none"
                    placeholder="简单的角色背景描述..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-purple-400 mb-2">视觉提示词 (生图关键)</label>
                  <textarea 
                    value={editForm.visualPrompt}
                    onChange={e => setEditForm({...editForm, visualPrompt: e.target.value})}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-200 focus:border-purple-500 focus:outline-none h-40 resize-none font-mono text-sm"
                    placeholder="请详细描述：发型、发色、眼睛、服装细节、风格..."
                  />
                  <p className="text-xs text-gray-500 mt-2">
                     AI 会根据此内容生成图片。越详细越好。
                  </p>
                </div>

                <button 
                  onClick={handleGenerateDesign}
                  disabled={isGenerating || isGeneratingAll}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isGenerating ? <RefreshCw className="animate-spin" /> : <Sparkles />}
                  生成全套角色设定 (全身/特写/道具)
                </button>
              </div>

              <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-gray-400">预览 / 替换</label>
                    {editForm.imageUrl && (
                        <button 
                            onClick={() => handleDownload(editForm.imageUrl!, editForm.name!)}
                            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                        >
                            <Download size={14}/> 下载
                        </button>
                    )}
                 </div>
                 
                 <div className="w-full aspect-video bg-gray-900 rounded-xl border-2 border-dashed border-gray-800 flex items-center justify-center overflow-hidden relative group">
                    {editForm.imageUrl ? (
                        <img src={editForm.imageUrl} className="w-full h-full object-contain" alt="Design" />
                    ) : (
                      <div className="text-center p-6 text-gray-600">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>暂无图片</p>
                      </div>
                    )}
                    
                    {/* Overlay Buttons */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept="image/*" 
                            className="hidden"
                        />
                        <button 
                            onClick={handleUploadClick}
                            className="px-4 py-2 bg-white text-black rounded-lg font-bold flex items-center gap-2 hover:bg-gray-200"
                        >
                            <Upload size={18} /> 上传图片
                        </button>
                    </div>
                 </div>
                 <p className="text-xs text-gray-500 text-center">如果不满意AI生成的结果，可以点击图片区域上传本地图片替换。</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-600">
            <Users className="w-16 h-16 mb-4 opacity-20" />
            <p>请选择或创建一个角色</p>
          </div>
        )}
      </div>
    </div>
  );
};