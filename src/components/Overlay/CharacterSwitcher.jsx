import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Plus, X, Check, Save, Edit, Pencil, RefreshCw, User, Trash2 } from 'lucide-react';

const CharacterSwitcher = ({ activeCharacterId, activeCharacter, onSelectCharacter, isOpen, onToggle }) => {
  const [characters, setCharacters] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error'
  const [isLoadingChars, setIsLoadingChars] = useState(false);
  const [defaultCharacterId, setDefaultCharacterId] = useState(null);

  // Quick-rename: uses activeCharacter prop directly (no async dependency)
  const [isRenamingActive, setIsRenamingActive] = useState(false);
  const [quickName, setQuickName] = useState('');
  const renameInputRef = useRef(null);

  // Full form state
  const [formData, setFormData] = useState({
    name: '',
    systemPrompt: '',
    avatarType: '2d',
    aiProvider: 'gemini',
    ttsProvider: 'edge-tts',
    voiceId: 'en-US-AvaNeural'
  });

  // Fetch character list when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchCharacters();
    } else {
      // Reset state when panel closes
      setIsCreating(false);
      setEditingCharacterId(null);
      setIsRenamingActive(false);
    }
  }, [isOpen]);

  // Focus rename input immediately when it appears
  useEffect(() => {
    if (isRenamingActive && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenamingActive]);

  const fetchCharacters = async () => {
    setIsLoadingChars(true);
    try {
      const response = await axios.get('http://localhost:3001/api/system/characters');
      setCharacters(response.data);
      const defaultChar = response.data.find(char => char.is_default === 1);
      setDefaultCharacterId(defaultChar ? defaultChar.id : null);
    } catch (err) {
      console.error('Failed to load characters:', err);
    } finally {
      setIsLoadingChars(false);
    }
  };

  // ── Quick-rename: uses activeCharacter prop (always available, no fetch needed) ──
  const startRename = () => {
    // Use the name from the prop passed by App.jsx — always fresh
    setQuickName(activeCharacter?.name || '');
    setIsRenamingActive(true);
  };

  const handleQuickRename = async () => {
    const trimmed = quickName.trim();
    if (!trimmed || !activeCharacter) return;
    if (trimmed === activeCharacter.name) {
      // No change — just close
      setIsRenamingActive(false);
      return;
    }

    setSaveStatus('saving');
    try {
      const payload = {
        name: trimmed,
        systemPrompt: activeCharacter.system_prompt,
        avatarType: activeCharacter.avatar_type || '2d',
        aiProvider: activeCharacter.ai_provider || 'gemini',
        ttsProvider: activeCharacter.tts_provider || 'edge-tts',
        voiceId: activeCharacter.voice_id || 'en-US-AvaNeural',
      };

      const response = await axios.put(
        `http://localhost:3001/api/system/characters/${activeCharacter.id}`,
        payload
      );

      // Build the updated character object
      const updatedChar = {
        ...activeCharacter,
        name: response.data.name || trimmed,
      };

      // Update parent state (propagates to SubtitleBar, bubble, etc.)
      onSelectCharacter(updatedChar);

      // Also refresh the list so the profile list shows the new name
      setCharacters(prev => prev.map(c => c.id === activeCharacter.id ? updatedChar : c));

      setIsRenamingActive(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      console.error('Quick rename failed:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 2000);
    }
  };

  // ── Full form handlers ──────────────────────────────────────────────────
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.systemPrompt.trim()) return;
    setSaveStatus('saving');

    try {
      if (editingCharacterId) {
        // UPDATE existing character
        const response = await axios.put(
          `http://localhost:3001/api/system/characters/${editingCharacterId}`,
          formData
        );
        const updatedChar = {
          id: editingCharacterId,
          name: response.data.name || formData.name,
          system_prompt: response.data.systemPrompt || response.data.system_prompt || formData.systemPrompt,
          avatar_type: response.data.avatarType || response.data.avatar_type || formData.avatarType,
          avatar_path: response.data.avatarPath || response.data.avatar_path || '',
          ai_provider: response.data.aiProvider || response.data.ai_provider || formData.aiProvider,
          tts_provider: response.data.ttsProvider || response.data.tts_provider || formData.ttsProvider,
          voice_id: response.data.voiceId || response.data.voice_id || formData.voiceId,
        };
        setCharacters(prev => prev.map(c => c.id === editingCharacterId ? updatedChar : c));
        if (activeCharacterId === editingCharacterId) {
          onSelectCharacter(updatedChar);
        }
      } else {
        // CREATE new character
        const response = await axios.post(
          'http://localhost:3001/api/system/characters',
          formData
        );
        const newChar = {
          id: response.data.id,
          name: response.data.name || formData.name,
          system_prompt: response.data.systemPrompt || response.data.system_prompt || formData.systemPrompt,
          avatar_type: response.data.avatarType || response.data.avatar_type || formData.avatarType,
          avatar_path: response.data.avatarPath || response.data.avatar_path || '',
          ai_provider: response.data.aiProvider || response.data.ai_provider || formData.aiProvider,
          tts_provider: response.data.ttsProvider || response.data.tts_provider || formData.ttsProvider,
          voice_id: response.data.voiceId || response.data.voice_id || formData.voiceId,
        };
        setCharacters(prev => [...prev, newChar]);
        onSelectCharacter(newChar);
      }

      // Reset form
      setFormData({ name: '', systemPrompt: '', avatarType: '2d', aiProvider: 'gemini', ttsProvider: 'edge-tts', voiceId: 'en-US-AvaNeural' });
      setIsCreating(false);
      setEditingCharacterId(null);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      console.error('Failed to save character profile:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 2000);
    }
  };

  const setDefaultCharacter = async (id) => {
    setSaveStatus('saving');
    try {
      const response = await axios.patch(`http://localhost:3001/api/system/characters/${id}/default`);
      setCharacters(prev => prev.map(c => ({ ...c, is_default: c.id === id ? 1 : 0 })));
      setDefaultCharacterId(id);

      if (activeCharacterId === id) {
        onSelectCharacter(response.data);
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      console.error('Failed to set default character:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 2000);
    }
  };

  const cancelForm = () => {
    setIsCreating(false);
    setEditingCharacterId(null);
    setFormData({ name: '', systemPrompt: '', avatarType: '2d', aiProvider: 'gemini', ttsProvider: 'edge-tts', voiceId: 'en-US-AvaNeural' });
  };

  const handleDelete = async () => {
    if (!editingCharacterId || editingCharacterId === 1) return;
    if (!window.confirm("Are you sure you want to delete this profile? All chat history and memories for this character will be permanently deleted.")) {
      return;
    }

    setSaveStatus('saving');
    try {
      await axios.delete(`http://localhost:3001/api/system/characters/${editingCharacterId}`);
      
      // If we deleted the active character, switch to the default one.
      if (activeCharacterId === editingCharacterId) {
        const defaultChar = characters.find(c => c.is_default === 1) || characters.find(c => c.id !== editingCharacterId);
        if (defaultChar) {
          onSelectCharacter(defaultChar);
        }
      }

      // Remove from list
      setCharacters(prev => prev.filter(c => c.id !== editingCharacterId));
      
      cancelForm();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      console.error('Failed to delete character:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 2000);
    }
  };

  // ── Collapsed settings button ───────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="absolute top-3 right-3 z-50 p-2 rounded-full bg-black/30 border border-white/10 hover:bg-black/50 text-gray-300 hover:text-white transition-colors duration-200 no-drag"
        title="Open settings"
      >
        <Settings className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="absolute inset-0 bg-black/90 backdrop-blur-md rounded-2xl p-4 flex flex-col z-50 overflow-hidden no-drag text-xs">
      {/* ── Header ── */}
      <div className="flex justify-between items-center pb-2 border-b border-white/10 shrink-0">
        <h3 className="font-bold text-companion-pink uppercase tracking-wider text-xs">Companion Engine</h3>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {saveStatus === 'saved' && (
              <motion.span
                key="saved"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-green-400 text-[10px] font-bold"
              >✓ Saved</motion.span>
            )}
            {saveStatus === 'saving' && (
              <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />
              </motion.div>
            )}
            {saveStatus === 'error' && (
              <motion.span key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-400 text-[10px]">
                Failed!
              </motion.span>
            )}
          </AnimatePresence>
          <button onClick={onToggle} className="text-gray-400 hover:text-white p-1 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mt-3 pr-0.5 space-y-3 min-h-0">
        {!isCreating ? (
          <>
            {/* ── 1. Active Character Info & Quick Settings ── */}
            <div className="bg-companion-pink/10 border border-companion-pink/25 rounded-xl p-3">
              <div className="text-[9px] uppercase font-bold text-companion-pink/70 tracking-widest mb-2 flex items-center gap-1 justify-between">
                <span className="flex items-center gap-1">
                  <User className="w-2.5 h-2.5" />
                  Active Character
                </span>
                <span className="text-[8px] bg-companion-pink/20 text-companion-pink px-1.5 py-0.2 rounded font-bold capitalize">
                  {activeCharacter?.avatar_type || '2d'}
                </span>
              </div>

              <AnimatePresence mode="wait">
                {isRenamingActive ? (
                  <motion.div
                    key="rename-edit"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    className="flex gap-1.5 items-center"
                  >
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={quickName}
                      onChange={e => setQuickName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleQuickRename();
                        if (e.key === 'Escape') setIsRenamingActive(false);
                      }}
                      className="flex-1 bg-white/15 border border-companion-pink/60 rounded-lg px-3 py-1.5 text-white text-xs font-medium focus:outline-none focus:border-companion-pink focus:ring-1 focus:ring-companion-pink/30 placeholder-gray-500"
                      placeholder="Enter new name..."
                      maxLength={32}
                    />
                    <button
                      onClick={handleQuickRename}
                      disabled={saveStatus === 'saving'}
                      className="bg-companion-pink hover:bg-companion-pink/90 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 text-xs"
                    >
                      <Check className="w-3 h-3" />
                      Save
                    </button>
                    <button
                      onClick={() => setIsRenamingActive(false)}
                      className="bg-white/10 hover:bg-white/20 text-gray-300 px-2 py-1.5 rounded-lg transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="rename-display"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white font-bold text-base tracking-wide">
                        {activeCharacter?.name || 'Unknown'}
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={startRename}
                          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-companion-pink bg-white/5 hover:bg-white/10 border border-white/10 hover:border-companion-pink/40 px-2 py-1.5 rounded-lg transition-all duration-200"
                        >
                          <Pencil className="w-3 h-3" />
                          Rename
                        </button>
                        <button
                          onClick={() => {
                            if (!activeCharacter) return;
                            setEditingCharacterId(activeCharacter.id);
                            setFormData({
                              name: activeCharacter.name,
                              systemPrompt: activeCharacter.system_prompt,
                              avatarType: activeCharacter.avatar_type || '2d',
                              aiProvider: activeCharacter.ai_provider || 'gemini',
                              ttsProvider: activeCharacter.tts_provider || 'edge-tts',
                              voiceId: activeCharacter.voice_id || 'en-US-AvaNeural',
                            });
                            setIsCreating(true);
                          }}
                          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-companion-pink bg-white/5 hover:bg-white/10 border border-white/10 hover:border-companion-pink/40 px-2 py-1.5 rounded-lg transition-all duration-200"
                        >
                          <Edit className="w-3 h-3" />
                          Edit Settings
                        </button>
                      </div>
                    </div>
                    
                    {/* Active character configurations summary */}
                    <div className="mt-1 pt-2 border-t border-white/5 grid grid-cols-2 gap-y-1 gap-x-2 text-[10px] text-gray-400">
                      <div><span className="text-gray-500 font-medium">AI Engine:</span> <span className="text-white capitalize">{activeCharacter?.ai_provider}</span></div>
                      <div><span className="text-gray-500 font-medium">TTS Engine:</span> <span className="text-white capitalize">{activeCharacter?.tts_provider}</span></div>
                      <div className="col-span-2 truncate"><span className="text-gray-500 font-medium">Voice ID:</span> <span className="text-white font-mono text-[9px]">{activeCharacter?.voice_id}</span></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── 2. Profile List ── */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Profiles</span>
                <button
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-0.5 text-[10px] text-companion-blue hover:text-white transition-colors font-medium"
                >
                  <Plus className="w-3 h-3" /> New
                </button>
              </div>

              {isLoadingChars ? (
                <div className="flex justify-center py-4">
                  <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                  {characters.map(char => (
                    <div
                      key={char.id}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all duration-200 ${
                        char.id === activeCharacterId
                          ? 'bg-companion-pink/15 border-companion-pink/50 text-white'
                          : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:border-white/15 hover:text-white'
                      }`}
                    >
                      <button
                        onClick={() => { onSelectCharacter(char); onToggle(); }}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="font-bold flex items-center gap-1.5 text-xs">
                          {char.name}
                          {char.id === activeCharacterId && (
                            <Check className="w-3 h-3 text-companion-pink shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate">
                          {char.ai_provider} · {char.tts_provider}
                        </div>
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded capitalize">{char.avatar_type}</span>
                        {char.is_default === 1 ? (
                          <span className="text-[9px] bg-companion-blue/20 text-companion-blue px-1.5 py-0.5 rounded uppercase tracking-[0.08em] font-bold">Default</span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDefaultCharacter(char.id);
                            }}
                            className="text-[9px] bg-white/10 text-gray-300 hover:text-companion-pink hover:bg-white/15 px-1.5 py-0.5 rounded transition-colors"
                            title="Set as default character"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCharacterId(char.id);
                            setFormData({
                              name: char.name,
                              systemPrompt: char.system_prompt,
                              avatarType: char.avatar_type || '2d',
                              aiProvider: char.ai_provider || 'gemini',
                              ttsProvider: char.tts_provider || 'edge-tts',
                              voiceId: char.voice_id || 'en-US-AvaNeural',
                            });
                            setIsCreating(true);
                          }}
                          className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-companion-pink transition-colors"
                          title="Edit full profile"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {characters.length === 0 && !isLoadingChars && (
                    <p className="text-center text-gray-500 py-3 text-[10px]">No profiles loaded yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* ── 3. Privacy Note ── */}
            <div className="bg-white/5 border border-white/5 rounded-lg p-2.5 text-gray-400 leading-relaxed text-[10px]">
              <h4 className="font-bold text-gray-200 mb-0.5">🔒 Privacy Mode</h4>
              <p>For full offline: AI → <strong className="text-companion-blue">Ollama</strong>, TTS → <strong className="text-companion-blue">Piper</strong>.</p>
            </div>
          </>
        ) : (
          /* ── Full Create / Edit Form ── */
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div className="flex justify-between items-center pb-1 border-b border-white/5">
              <span className="font-bold text-companion-pink uppercase tracking-widest text-[9px]">
                {editingCharacterId ? '✏️ Edit Profile' : '✨ New Profile'}
              </span>
            </div>

            <div>
              <label className="block text-gray-400 font-bold mb-1 uppercase text-[9px]">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-companion-pink focus:ring-1 focus:ring-companion-pink/20"
                placeholder="e.g. Aria"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-gray-400 font-bold mb-1 uppercase text-[9px]">Personality / System Prompt</label>
              <textarea
                name="systemPrompt"
                value={formData.systemPrompt}
                onChange={handleInputChange}
                className="w-full h-20 bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-companion-pink focus:ring-1 focus:ring-companion-pink/20 resize-none leading-relaxed"
                placeholder="Persona rules, personality, speech style..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-400 font-bold mb-1 uppercase text-[9px]">Avatar</label>
                <select name="avatarType" value={formData.avatarType} onChange={handleInputChange}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-companion-pink">
                  <option value="2d" className="bg-gray-900">2D Sprites</option>
                  <option value="live2d" className="bg-gray-900">Live2D</option>
                  <option value="vrm" className="bg-gray-900">VRM 3D</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 font-bold mb-1 uppercase text-[9px]">AI Engine</label>
                <select name="aiProvider" value={formData.aiProvider} onChange={handleInputChange}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-companion-pink">
                  <option value="gemini" className="bg-gray-900">Gemini</option>
                  <option value="groq" className="bg-gray-900">Groq</option>
                  <option value="openrouter" className="bg-gray-900">OpenRouter</option>
                  <option value="ollama" className="bg-gray-900">Ollama</option>
                  <option value="lmstudio" className="bg-gray-900">LMStudio</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-400 font-bold mb-1 uppercase text-[9px]">TTS Engine</label>
                <select name="ttsProvider" value={formData.ttsProvider} onChange={handleInputChange}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-companion-pink">
                  <option value="edge-tts" className="bg-gray-900">Edge-TTS</option>
                  <option value="piper" className="bg-gray-900">Piper</option>
                  <option value="elevenlabs" className="bg-gray-900">ElevenLabs</option>
                  <option value="kokoro" className="bg-gray-900">Kokoro</option>
                  <option value="voicevox" className="bg-gray-900">VoiceVox</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 font-bold mb-1 uppercase text-[9px]">Voice ID</label>
                <input
                  type="text"
                  name="voiceId"
                  value={formData.voiceId}
                  onChange={handleInputChange}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-companion-pink"
                  placeholder="en-US-AvaNeural"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit"
                className="flex-1 bg-companion-pink hover:bg-companion-pink/90 text-white font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-xs">
                <Save className="w-3.5 h-3.5" />
                {editingCharacterId ? 'Update Profile' : 'Create Profile'}
              </button>
              {editingCharacterId && editingCharacterId !== 1 && (
                <button type="button" onClick={handleDelete}
                  className="bg-red-950/45 hover:bg-red-900/60 border border-red-900/30 hover:border-red-800/40 text-red-300 py-1.5 px-3 rounded-lg transition-colors text-xs flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              )}
              <button type="button" onClick={cancelForm}
                className="bg-white/10 hover:bg-white/20 text-gray-300 py-1.5 px-3 rounded-lg transition-colors text-xs">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CharacterSwitcher;
