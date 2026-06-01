import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import eventBus from './engine/EventBus';
import AvatarCanvas from './components/Avatar/AvatarCanvas';
import STTController from './voice/STTController';
import TTSController from './voice/TTSController';
import DragHandle from './components/Overlay/DragHandle';
import CharacterSwitcher from './components/Overlay/CharacterSwitcher';
import SubtitleBar from './components/Chat/SubtitleBar';
import MicButton from './components/Voice/MicButton';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const UI_EMOTIONS = new Set(['idle', 'happy', 'angry', 'embarrassed', 'excited', 'sleepy', 'smug', 'shocked', 'thinking']);
const UI_EMOTION_ALIASES = {
  surprised: 'shocked',
  surprise: 'shocked',
  joyful: 'happy',
  cheerful: 'happy',
  mad: 'angry',
  annoyed: 'angry',
  curious: 'thinking',
  confused: 'thinking',
  neutral: 'idle'
};

const normalizeEmotionForUI = (emotion = 'idle') => {
  const normalized = String(emotion || '').toLowerCase().trim().replace(/[^a-z]/g, '');
  if (UI_EMOTIONS.has(normalized)) return normalized;
  return UI_EMOTION_ALIASES[normalized] || 'idle';
};

const inferReactionIntensity = (text = '', emotion = 'idle', backendIntensity = 1) => {
  const base = Number.isFinite(Number(backendIntensity)) ? Number(backendIntensity) : 1;
  const source = String(text || '');
  const exclamations = (source.match(/!/g) || []).length;
  const questions = (source.match(/\?/g) || []).length;
  const emojiBoost = (source.match(/[!?]{2,}|[☆★✨💢❤️♥️😎💡]/g) || []).length;

  let intensity = base;
  intensity += Math.min(exclamations, 5) * 0.03;
  intensity += Math.min(questions, 3) * 0.025;
  intensity += Math.min(emojiBoost, 2) * 0.04;

  if (emotion === 'sleepy') intensity -= 0.08;
  if (emotion === 'thinking') intensity -= 0.04;

  return Number(clamp(intensity, 0.55, 1.6).toFixed(2));
};

const App = () => {
  const [character, setCharacter] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle', 'listening', 'thinking', 'speaking'
  const [emotion, setEmotion] = useState('idle');
  
  // UI texts
  const [subtitleText, setSubtitleText] = useState('');
  const [isSubtitleVisible, setIsSubtitleVisible] = useState(false);
  
  // System context & Settings
  const [enableVision, setEnableVision] = useState(false);
  const [currentWindow, setCurrentWindow] = useState('');
  const [cpuUsage, setCpuUsage] = useState(0);
  const [ramUsage, setRamUsage] = useState(0);
  const [musicInfo, setMusicInfo] = useState(null);
  const [idleTime, setIdleTime] = useState(0);
  const [activeApps, setActiveApps] = useState({ browsers: [], coding: [], activeApps: [] });
  const [recentFiles, setRecentFiles] = useState([]);
  const [inputLevel, setInputLevel] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Controllers Refs
  const sttControllerRef = useRef(null);
  const ttsControllerRef = useRef(null);
  const emotionResetTimerRef = useRef(null);

  // Live refs for values used inside STT callback (avoids stale closures)
  const enableVisionRef = useRef(enableVision);
  const currentWindowRef = useRef(currentWindow);
  const cpuUsageRef = useRef(0);
  const ramUsageRef = useRef(0);
  const musicInfoRef = useRef(null);
  const idleTimeRef = useRef(0);
  const activeAppsRef = useRef({ browsers: [], coding: [], activeApps: [] });
  const recentFilesRef = useRef([]);
  const characterRef = useRef(character);

  useEffect(() => { enableVisionRef.current = enableVision; }, [enableVision]);
  useEffect(() => { currentWindowRef.current = currentWindow; }, [currentWindow]);
  useEffect(() => { cpuUsageRef.current = cpuUsage; }, [cpuUsage]);
  useEffect(() => { ramUsageRef.current = ramUsage; }, [ramUsage]);
  useEffect(() => { musicInfoRef.current = musicInfo; }, [musicInfo]);
  useEffect(() => { idleTimeRef.current = idleTime; }, [idleTime]);
  useEffect(() => { activeAppsRef.current = activeApps; }, [activeApps]);
  useEffect(() => { recentFilesRef.current = recentFiles; }, [recentFiles]);
  useEffect(() => { characterRef.current = character; }, [character]);

  // 1. Fetch initial character on mount
  useEffect(() => {
    const fetchDefaultCharacter = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:3001/api/system/characters');
        if (response.data && response.data.length > 0) {
          const defaultCharacter = response.data.find(char => char.is_default === 1) || response.data[0];
          setCharacter(defaultCharacter);
        }
      } catch (err) {
        console.error("Failed to load initial character:", err);
      }
    };
    fetchDefaultCharacter();
  }, []);

  // 2. Setup STT, TTS and Event Listeners
  useEffect(() => {
    if (!character) return;

    // Initialize TTS
    ttsControllerRef.current = new TTSController();

    // Initialize STT
    sttControllerRef.current = new STTController(
      async (transcript) => {
        const cleanTranscript = (transcript || "").trim();
        if (!cleanTranscript) {
          console.log("[App] Empty transcript received, ignoring chat trigger...");
          setStatus('idle');
          setEmotion('idle');
          return;
        }

        // Voice transcription complete, trigger LLM response
        setStatus('thinking');
        setEmotion('thinking');
        eventBus.emit('emotion:trigger', { emotion: 'thinking', intensity: 0.82 });

        try {
          const response = await axios.post('http://127.0.0.1:3001/api/chat', {
            characterId: characterRef.current.id,
            message: cleanTranscript,
            enableVision: enableVisionRef.current,
            currentWindow: currentWindowRef.current,
            cpu: cpuUsageRef.current,
            ram: ramUsageRef.current,
            music: musicInfoRef.current,
            idleTime: idleTimeRef.current,
            apps: activeAppsRef.current,
            recentFiles: recentFilesRef.current
          });

          const { text, emotion: nextEmotionRaw, intensity: backendIntensity } = response.data;
          const nextEmotion = normalizeEmotionForUI(nextEmotionRaw);
          const reactionIntensity = inferReactionIntensity(text, nextEmotion, backendIntensity);

          // Synthesize response speech (keep status as 'thinking' while compiling audio)
          setStatus('thinking');
          await ttsControllerRef.current.speak(
            text,
            characterRef.current.tts_provider,
            characterRef.current.voice_id,
            nextEmotion,
            reactionIntensity
          );
        } catch (err) {
          console.error("Failed to process transcription prompt:", err);
          setStatus('idle');
          setEmotion('idle');
        }
      },
      (error) => {
        if (error === "No speech detected.") {
          console.log("[App] Continuous mic: No speech detected in cycle.");
        } else {
          console.error("STT capture error:", error);
        }
        setStatus('idle');
      }
    );

    sttControllerRef.current.onLevelUpdate = (level) => {
      setInputLevel(level);
    };

    // EventBus voice triggers
    const unsubscribeSpeechStart = eventBus.on('speech:start', (text) => {
      if (emotionResetTimerRef.current) {
        clearTimeout(emotionResetTimerRef.current);
        emotionResetTimerRef.current = null;
      }

      // Clean speech text of action tags so subtitles match the audio output
      const cleanSub = text
        .replace(/\*[^*]+\*/g, '')
        .replace(/\([^\)]+\)/g, '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      setSubtitleText(cleanSub || "...");
      setIsSubtitleVisible(true);
    });

    const unsubscribeAudioStart = eventBus.on('speech:audio-start', ({ emotion, intensity }) => {
      setStatus('speaking');
      setEmotion(emotion);
      eventBus.emit('emotion:trigger', { emotion, intensity });
    });

    const unsubscribeSpeechEnd = eventBus.on('speech:end', () => {
      setStatus('idle');
      setIsSubtitleVisible(false);

      // Hold expression briefly to avoid robotic snap-to-idle right after audio ends
      if (emotionResetTimerRef.current) {
        clearTimeout(emotionResetTimerRef.current);
      }

      emotionResetTimerRef.current = setTimeout(() => {
        setEmotion('idle');
        eventBus.emit('emotion:trigger', { emotion: 'idle', intensity: 0.6 });
      }, 900);
    });

    return () => {
      unsubscribeSpeechStart();
      unsubscribeAudioStart();
      unsubscribeSpeechEnd();
      if (ttsControllerRef.current) ttsControllerRef.current.stop();
      if (emotionResetTimerRef.current) {
        clearTimeout(emotionResetTimerRef.current);
      }
    };
  }, [character]); // Only re-initialize when character changes; use refs for other live values

  // 2.5. Auto-listening continuous loop (Auto-Mic)
  useEffect(() => {
    if (!character || !sttControllerRef.current) return;

    let autoListenTimer = null;

    if (status === 'idle' && !isMuted) {
      // Wait 600ms after speech ends to avoid recording Aria's trailing audio echo
      autoListenTimer = setTimeout(() => {
        console.log("[App] Auto-starting continuous microphone capture...");
        setStatus('listening');
        setEmotion('idle');
        sttControllerRef.current.startRecording(true);
      }, 600);
    } else if (status !== 'listening' && status !== 'thinking' && status !== 'speaking') {
      // If we are idle and muted, make sure recording is stopped
      sttControllerRef.current.stopRecording();
    }

    return () => {
      if (autoListenTimer) clearTimeout(autoListenTimer);
    };
  }, [status, isMuted, character]);

  // 3. Electron IPC Shake listeners & window click-through boundaries
  useEffect(() => {
    // Shaking Event Hook
    const handleShaking = () => {
      if (status === 'speaking' || status === 'thinking' || !character) return;
      
      setStatus('speaking');
      setEmotion('angry');
      eventBus.emit('emotion:trigger', { emotion: 'angry', intensity: 1.45 });
      
      const shakeResponse = "It's not a physics test dummy! Fix your code without shaking!";
      ttsControllerRef.current.speak(shakeResponse, character.tts_provider, character.voice_id);
    };

    let removeShakingListener = () => {};
    let removeNotificationListener = () => {};

    if (window.electronAPI) {
      if (window.electronAPI.onWindowShaking) {
        removeShakingListener = window.electronAPI.onWindowShaking(handleShaking);
      }
      
      if (window.electronAPI.onSystemNotification) {
        removeNotificationListener = window.electronAPI.onSystemNotification(({ title, message }) => {
          console.log(`Notification [${title}]: ${message}`);
        });
      }

      return () => {
        removeShakingListener();
        removeNotificationListener();
      };
    }
  }, [character, status, isSettingsOpen]);

  // 3.5. Electron window resizing and tray Settings listeners
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.resizeWindow) {
      if (isSettingsOpen) {
        window.electronAPI.resizeWindow(400, 520);
      } else {
        window.electronAPI.resizeWindow(240, 340);
      }
    }
  }, [isSettingsOpen]);

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onOpenSettings) {
      const removeOpenSettingsListener = window.electronAPI.onOpenSettings(() => {
        setIsSettingsOpen(true);
      });
      return () => {
        removeOpenSettingsListener();
      };
    }
  }, []);

  // 4. Poll system statistics & active window title
  useEffect(() => {
    const pollSystemStatus = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:3001/api/system/status');
        if (response.data) {
          setCurrentWindow(response.data.activeWindow);
          setCpuUsage(response.data.cpu);
          setRamUsage(response.data.ram);
          setMusicInfo(response.data.music);
          setIdleTime(response.data.idleTime);
          setActiveApps(response.data.apps || { browsers: [], coding: [], activeApps: [] });
          setRecentFiles(response.data.recentFiles || []);
        }
      } catch (err) {
        console.warn("Failed to query active window status:", err.message);
      }
    };

    pollSystemStatus();
    const interval = setInterval(pollSystemStatus, 30000); // query every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // 5. Mic Mute/Unmute Toggle
  const handleToggleMute = () => {
    setIsMuted((prevMuted) => {
      const nextMuted = !prevMuted;
      if (nextMuted) {
        if (sttControllerRef.current) {
          sttControllerRef.current.stopRecording();
        }
        setStatus('idle');
        setEmotion('idle');
        setInputLevel(0);
      }
      return nextMuted;
    });
  };

  if (!character) {
    return <div className="h-screen w-screen bg-transparent" />;
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent select-none">
      {/* Drag handle for repositioning overlay */}
      <DragHandle />

      {/* Floating Settings button and Character profile manager panel */}
      <CharacterSwitcher
        activeCharacterId={character.id}
        activeCharacter={character}
        onSelectCharacter={(char) => setCharacter(char)}
        isOpen={isSettingsOpen}
        onToggle={() => setIsSettingsOpen(prev => !prev)}
      />

      {/* Main interactive desktop companion avatar */}
      <div className={`absolute bottom-0 right-0 flex h-[340px] w-[240px] items-end justify-end ${
        status === 'speaking' ? 'avatar-glow-speaking' : 'avatar-glow'
      }`}>
        <AvatarCanvas
          avatarType={character.avatar_type}
          avatarPath={character.avatar_path}
          currentEmotion={emotion}
          isSpeaking={status === 'speaking'}
          isListening={status === 'listening'}
        />
      </div>

      {/* Live subtitles for assistant speech output (temporarily disabled) */}
      {/* <SubtitleBar
        text={subtitleText}
        name={character.name}
        visible={isSubtitleVisible}
      /> */}

      {/* Microphone capture controller button bar */}
      <MicButton
        status={status}
        inputLevel={inputLevel}
        enableVision={enableVision}
        onToggleVision={() => setEnableVision(prev => !prev)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />
    </div>
  );
};

export default App;
