import React, { useState, useEffect } from 'react';
import { Save, Trash2, Key, CheckCircle, AlertCircle } from 'lucide-react';

export const SettingsTab: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'deleted'>('idle');

  useEffect(() => {
    const key = localStorage.getItem('gemini_api_key');
    if (key) {
      setSavedKey(key);
      setApiKey(key);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) return;
    localStorage.setItem('gemini_api_key', apiKey.trim());
    setSavedKey(apiKey.trim());
    setStatus('success');
    setTimeout(() => setStatus('idle'), 3000);
  };

  const handleDelete = () => {
    localStorage.removeItem('gemini_api_key');
    setSavedKey('');
    setApiKey('');
    setStatus('deleted');
    setTimeout(() => setStatus('idle'), 3000);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-gray-950">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-purple-600/20 rounded-xl">
            <Key className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">API 配置</h2>
            <p className="text-gray-400 text-sm">管理您的 Gemini API 密钥</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Gemini API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 focus:outline-none font-mono text-sm"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition"
            >
              <Save size={18} /> 保存配置
            </button>
            {savedKey && (
              <button
                onClick={handleDelete}
                className="px-4 py-2.5 bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 rounded-lg transition"
                title="删除密钥"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>

          {/* Status Messages */}
          {status === 'success' && (
            <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 p-3 rounded-lg border border-green-400/20">
              <CheckCircle size={16} /> 密钥已保存，您可以开始使用了！
            </div>
          )}
          {status === 'deleted' && (
            <div className="flex items-center gap-2 text-orange-400 text-sm bg-orange-400/10 p-3 rounded-lg border border-orange-400/20">
              <AlertCircle size={16} /> 密钥已删除。
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-800 text-xs text-gray-500 space-y-2">
            <p>说明：</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>您的 API Key 仅存储在本地浏览器中 (LocalStorage)。</li>
              <li>我们需要使用 <strong>Gemini 1.5 Pro/Flash</strong> 或更高级模型。</li>
              <li>请确保您的 Google Cloud 项目已开通相关权限。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};