import React from 'react';
import { AppTab } from '../types';
import { BookOpen, Users, Image as ImageIcon, Settings, FileText, Mic } from 'lucide-react';

interface LayoutProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activeTab, setActiveTab, children }) => {
  const navItems = [
    { id: AppTab.SCRIPT, label: '1. 剧本上传', icon: FileText },
    { id: AppTab.CHARACTERS, label: '2. 角色设定', icon: Users },
    { id: AppTab.SCENES, label: '3. 场景设定', icon: ImageIcon },
    { id: AppTab.STORYBOARD, label: '4. 分镜生成', icon: BookOpen },
    { id: AppTab.AUDIO, label: '5. 配音生成', icon: Mic },
    { id: AppTab.SETTINGS, label: '设置', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-950 text-white font-sans">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-300">
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-gray-800">
          <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-lg flex items-center justify-center font-bold text-white">
            欢
          </div>
          <span className="hidden lg:block ml-3 font-bold text-xl tracking-tight">欢玺AI短剧工厂</span>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group text-left ${
                activeTab === item.id
                  ? 'bg-purple-600/20 text-purple-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <item.icon className={`w-6 h-6 flex-shrink-0 ${activeTab === item.id ? 'stroke-purple-400' : ''}`} />
              <span className="hidden lg:block ml-3 font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="hidden lg:block text-xs text-gray-500 text-center">
            Powered by Gemini
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
};