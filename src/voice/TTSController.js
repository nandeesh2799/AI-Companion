import axios from 'axios';
import AudioAmplitude from './AudioAmplitude';
import eventBus from '../engine/EventBus';

export default class TTSController {
  constructor() {
    this.audioElement = new Audio();
    this.amplitudeAnalyzer = new AudioAmplitude();
    this.isPlaying = false;
    this.safetyTimeout = null;
    this.currentText = '';
    this.currentVoiceId = '';
    
    // Configure CORS so Web Audio can inspect amplitudes
    this.audioElement.crossOrigin = "anonymous";
    
    this.audioElement.onended = () => {
      this.clearSafetyTimeout();
      this.isPlaying = false;
      this.amplitudeAnalyzer.disconnect();
      eventBus.emit('speech:end');
      // Reset mouth back to closed state
      eventBus.emit('amplitude:update', 0);
    };

    this.audioElement.onerror = (e) => {
      if (this._audioErrorHandled) return;
      this._audioErrorHandled = true;
      console.warn("HTML5 audio playback error, falling back to browser synthesis...", e);
      this.clearSafetyTimeout();
      this.amplitudeAnalyzer.disconnect();
      this.speakBrowserFallback(this.currentText, this.currentVoiceId);
    };
  }

  clearSafetyTimeout() {
    if (this.safetyTimeout) {
      clearTimeout(this.safetyTimeout);
      this.safetyTimeout = null;
    }
  }

  // Clean action expressions from speech text (shared helper)
  cleanSpeechText(text) {
    return text
      .replace(/\*\*[^*]+\*\*/g, '') // remove **bold** actions
      .replace(/\*[^*]+\*/g, '')     // remove *italic* actions
      .replace(/\([^)]+\)/g, '')     // remove (parenthetical) actions
      .replace(/\[[^\]]+\]/g, '')    // remove [bracket] tags
      .replace(/\*/g, '')            // strip any remaining stray asterisks
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Speak using configured backend provider or Web Speech API fallback
  async speak(text, provider = 'edge-tts', voiceId = 'en-US-AnaNeural') {
    this.stop();
    this.isPlaying = true;
    this.currentText = text;
    this.currentVoiceId = voiceId;
    this._audioErrorHandled = false; // guard against double onerror + fallback
    
    // Emit cleaned text to UI — no asterisk expressions in subtitles or chat bubble
    const cleanedForDisplay = this.cleanSpeechText(text);
    eventBus.emit('speech:start', cleanedForDisplay || text);

    // Set safety timeout to guarantee lock release in case of any silent failures
    const safetyDuration = Math.max(8000, text.length * 80); // 80ms per char, min 8s
    this.safetyTimeout = setTimeout(() => {
      console.warn("[TTSController] Safety playback timeout reached. Force unlocking...");
      this.stop();
    }, safetyDuration);

    try {
      // Request audio compilation from Express Backend
      const response = await axios.post('http://localhost:3001/api/voice/tts', {
        text: text,
        ttsProvider: provider,
        voiceId: voiceId
      });

      if (!this.isPlaying) return; // stopped while waiting for backend

      if (response.data && response.data.fallback) {
        console.warn("TTS Backend fallback flagged. Running browser synthesis.");
        this.speakBrowserFallback(text, voiceId);
      } else if (response.data && response.data.audioUrl) {
        // Play local WAV output served from Express backend
        const audioSource = `http://localhost:3001${response.data.audioUrl}?t=${Date.now()}`;
        this.audioElement.src = audioSource;
        
        // Resume AudioContext if suspended (browser autoplay policy)
        try {
          if (this.amplitudeAnalyzer.audioContext && this.amplitudeAnalyzer.audioContext.state === 'suspended') {
            await this.amplitudeAnalyzer.audioContext.resume();
          }
        } catch (e) {}

        // Connect to Web Audio Analyser node to drive mouth viseme sync
        this.audioElement.play().then(() => {
          this.amplitudeAnalyzer.connectAudioElement(this.audioElement);
        }).catch(err => {
          console.warn("Audio play failed. Retrying with browser fallback:", err.message);
          if (!this._audioErrorHandled) {
            this._audioErrorHandled = true;
            this.speakBrowserFallback(text, voiceId);
          }
        });
      }
    } catch (err) {
      console.error("TTS API error, attempting browser fallback:", err);
      if (this.isPlaying && !this._audioErrorHandled) {
        this._audioErrorHandled = true;
        this.speakBrowserFallback(text, voiceId);
      }
    }
  }

  // Speak browser-native fallback using Web Speech API
  speakBrowserFallback(text, voiceId) {
    // If not playing anymore (e.g. stopped during backend call), abort
    if (!this.isPlaying) return;

    if (!window.speechSynthesis) {
      this.clearSafetyTimeout();
      this.isPlaying = false;
      eventBus.emit('speech:end');
      return;
    }

    // Clean speech text of action tags for browser synthesis
    const cleanedText = this.cleanSpeechText(text);

    const finalSpeechText = cleanedText || "...";

    const utterance = new SpeechSynthesisUtterance(finalSpeechText);
    
    // Attempt to match voice ID
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => v.name.includes(voiceId) || v.lang.startsWith('en'));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    // Since speechSynthesis does not easily pipe into AudioContext nodes,
    // we mock visual mouth movement values periodically using a timer while it plays
    let mouthMockTimer = null;
    utterance.onstart = () => {
      mouthMockTimer = setInterval(() => {
        // Random speaking amplitude between 0.1 and 0.8
        const mockAmp = 0.1 + Math.random() * 0.7;
        eventBus.emit('amplitude:update', mockAmp);
      }, 90);
    };

    utterance.onend = () => {
      this.clearSafetyTimeout();
      this.isPlaying = false;
      if (mouthMockTimer) clearInterval(mouthMockTimer);
      eventBus.emit('amplitude:update', 0);
      eventBus.emit('speech:end');
    };

    utterance.onerror = (e) => {
      console.error("Browser speech synthesis failed:", e);
      this.clearSafetyTimeout();
      this.isPlaying = false;
      if (mouthMockTimer) clearInterval(mouthMockTimer);
      eventBus.emit('amplitude:update', 0);
      eventBus.emit('speech:end');
    };

    window.speechSynthesis.speak(utterance);
  }

  stop() {
    this.clearSafetyTimeout();
    if (this.isPlaying) {
      this.isPlaying = false;
      this._audioErrorHandled = true; // prevent any pending callbacks from re-firing
      this.audioElement.pause();
      this.audioElement.src = '';
      this.amplitudeAnalyzer.disconnect();
      
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      
      eventBus.emit('speech:end');
      eventBus.emit('amplitude:update', 0);
    }
  }
}
