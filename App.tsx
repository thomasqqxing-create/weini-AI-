import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { CharacterTab } from './components/CharacterTab';
import { SceneTab } from './components/SceneTab';
import { StoryboardTab } from './components/StoryboardTab';
import { SettingsTab } from './components/SettingsTab';
import { ScriptTab } from './components/ScriptTab';
import { AudioTab } from './components/AudioTab';
import { AppTab, Character, Scene, StoryboardFrame } from './types';

// Initial Empty State
const App: React.FC = () => {
  // Default to SCRIPT tab (Step 1)
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.SCRIPT);
  
  // App State
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [script, setScript] = useState<string>('');
  const [frames, setFrames] = useState<StoryboardFrame[]>([]);
  
  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === AppTab.SCRIPT && (
        <ScriptTab 
            script={script}
            setScript={setScript}
            setCharacters={setCharacters}
            setScenes={setScenes}
            setFrames={setFrames}
            setActiveTab={setActiveTab}
        />
      )}

      {activeTab === AppTab.CHARACTERS && (
        <CharacterTab characters={characters} setCharacters={setCharacters} />
      )}
      
      {activeTab === AppTab.SCENES && (
        <SceneTab scenes={scenes} setScenes={setScenes} />
      )}
      
      {activeTab === AppTab.STORYBOARD && (
        <StoryboardTab 
            characters={characters}
            scenes={scenes}
            script={script}
            frames={frames}
            setFrames={setFrames}
        />
      )}

      {activeTab === AppTab.AUDIO && (
        <AudioTab 
            frames={frames}
            characters={characters}
            setFrames={setFrames}
        />
      )}

      {activeTab === AppTab.SETTINGS && (
        <SettingsTab />
      )}
    </Layout>
  );
};

export default App;