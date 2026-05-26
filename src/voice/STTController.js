import axios from 'axios';
import eventBus from '../engine/EventBus';

export default class STTController {
  constructor(onResult, onError) {
    this.onResult = onResult;
    this.onError = onError;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recognition = null;
    this.isRecording = false;

    this.initBrowserSpeechRecognition();
  }

  // Initialize browser-based Web Speech API fallback
  initBrowserSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        this.onResult(transcript);
      };

      this.recognition.onerror = (event) => {
        console.error("Browser speech recognition error:", event.error);
        if (this.onError) this.onError(event.error);
      };
    }
  }

  // Start PTT (Push to Talk) recording
  async startRecording(useLocalWhisper = true) {
    if (this.isRecording) return;
    this.isRecording = true;
    this.audioChunks = [];

    // Fallback to browser recognition if local mode is off or Whisper is missing
    if (!useLocalWhisper || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (this.recognition) {
        try {
          this.recognition.start();
        } catch (e) {
          console.warn("Browser recognition already started:", e);
        }
      } else {
        if (this.onError) this.onError("Speech recognition not supported in this environment.");
      }
      return;
    }

    // Local Whisper capture mode
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm';
      }
      this.mediaRecorder = new MediaRecorder(stream, options);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Web Audio API Analyzer for continuous level output and silence detection
      let audioContext = null;
      let analyser = null;
      let source = null;
      let volumeCheckId = null;

      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        let silenceStart = null;
        this.hasSpoken = false;

        // ── Adaptive Noise Calibration ──────────────────────────────────
        // Spend the first 600ms measuring the ambient noise floor, then set
        // the voice-detection threshold 3× above it (min 0.006 to stay sensitive).
        const CALIBRATION_MS = 600;
        let noiseSamples = [];
        let adaptiveThreshold = 0.010; // initial conservative default
        let calibrated = false;

        const silenceDuration = 900;   // 0.9s of silence ends recording (snappy)
        const minSpeechDuration = 250; // ignore ultra-short blips < 250ms
        let speechStartTime = null;
        const startTime = Date.now();
        const maxDuration = 12000;     // extended safety cap (12s)

        const checkVolume = () => {
          if (!this.isRecording) return;

          analyser.getByteTimeDomainData(dataArray);

          // RMS amplitude (more accurate than simple mean for voice detection)
          let rmsSum = 0;
          for (let i = 0; i < bufferLength; i++) {
            const s = (dataArray[i] - 128) / 128;
            rmsSum += s * s;
          }
          const rmsAmplitude = Math.sqrt(rmsSum / bufferLength);

          // Notify live level updates
          if (this.onLevelUpdate) {
            this.onLevelUpdate(rmsAmplitude);
          }
          eventBus.emit('amplitude:update', Math.min(rmsAmplitude * 2.5, 1.0));

          const elapsed = Date.now() - startTime;

          // ── Phase 1: Calibration window ──────────────────────────────
          if (!calibrated) {
            noiseSamples.push(rmsAmplitude);
            if (elapsed >= CALIBRATION_MS) {
              // Sort samples and take the 80th percentile as noise floor
              noiseSamples.sort((a, b) => a - b);
              const noiseFloor = noiseSamples[Math.floor(noiseSamples.length * 0.80)] || 0.004;
              adaptiveThreshold = Math.max(noiseFloor * 3.5, 0.006);
              console.log(`[Auto-Mic] Calibrated noise floor: ${noiseFloor.toFixed(4)}, threshold: ${adaptiveThreshold.toFixed(4)}`);
              calibrated = true;
            }
            volumeCheckId = requestAnimationFrame(checkVolume);
            return;
          }

          // ── Phase 2: Speech detection ─────────────────────────────────
          if (rmsAmplitude > adaptiveThreshold) {
            if (!this.hasSpoken) {
              speechStartTime = Date.now();
            }
            // Only mark as spoken after sustained voice (avoids click artifacts)
            if (speechStartTime && Date.now() - speechStartTime >= minSpeechDuration) {
              this.hasSpoken = true;
            }
            silenceStart = null;
          } else if (this.hasSpoken) {
            if (silenceStart === null) {
              silenceStart = Date.now();
            } else if (Date.now() - silenceStart > silenceDuration) {
              console.log("[Auto-Mic] Silence detected (0.9s), stopping recording...");
              this.stopRecording();
              return;
            }
          } else {
            // Not yet spoken: reset partial speech timer on silence
            speechStartTime = null;
          }

          // Safety guard: max duration reached
          if (elapsed > maxDuration) {
            console.log("[Auto-Mic] Safety timeout (12s), processing speech...");
            this.hasSpoken = true;
            this.stopRecording();
            return;
          }

          volumeCheckId = requestAnimationFrame(checkVolume);
        };

        volumeCheckId = requestAnimationFrame(checkVolume);
      } catch (audioErr) {
        console.warn("Could not initialize Web Audio Analyser:", audioErr.message);
      }

      this.mediaRecorder.onstop = async () => {
        // Cleanup Audio Context and Analyser
        if (volumeCheckId) {
          cancelAnimationFrame(volumeCheckId);
        }
        if (audioContext && audioContext.state !== 'closed') {
          try {
            audioContext.close();
          } catch (e) {}
        }
        if (this.onLevelUpdate) {
          this.onLevelUpdate(0);
        }
        eventBus.emit('amplitude:update', 0);

        try {
          if (!this.hasSpoken) {
            console.log("[Auto-Mic] No speech detected. Aborting transcription to save CPU.");
            stream.getTracks().forEach(track => track.stop());
            if (this.onError) {
              this.onError("No speech detected.");
            }
            return;
          }

          if (this.audioChunks.length === 0) {
            throw new Error("No audio data recorded.");
          }
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          if (audioBlob.size < 500) {
            throw new Error("Audio recording too short.");
          }

          // Convert to WAV format array buffer for backend Whisper model ingestion
          const wavBase64 = await this.convertToWavBase64(audioBlob);
          
          // Stop all track devices
          stream.getTracks().forEach(track => track.stop());

          // Send to backend STT API
          try {
            const response = await axios.post('http://localhost:3001/api/voice/stt', { audio: wavBase64 });
            if (response.data && response.data.fallback) {
              console.warn("Backend Whisper failed/fallback flagged. Swapping to browser engine.");
              // Re-trigger using browser Speech API
              this.isRecording = false;
              this.startRecording(false); // run fallback recognition
              setTimeout(() => this.stopRecording(), 4000); // stop after 4s timeout
            } else if (response.data && response.data.text) {
              this.onResult(response.data.text);
            }
          } catch (err) {
            console.error("Local Whisper API error:", err);
            if (this.recognition) {
              // IMPORTANT: reset isRecording before re-entering startRecording
              this.isRecording = false;
              this.startRecording(false);
            } else if (this.onError) {
              this.onError(err.message);
            }
          }
        } catch (err) {
          console.warn("Audio processing aborted:", err.message);
          try {
            stream.getTracks().forEach(track => track.stop());
          } catch (e) {}
          if (this.onError) {
            this.onError(err.message);
          }
        }
      };

      this.mediaRecorder.start(100);
    } catch (err) {
      console.warn("Microphone capture failed. Swapping to browser engine:", err.message);
      this.isRecording = false; // IMPORTANT: reset before re-entering
      if (this.recognition) {
        this.startRecording(false);
      } else if (this.onError) {
        this.onError(err.message);
      }
    }
  }

  // Stop recording
  stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    } else if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
  }

  // Helper: Convert audio blob to base64 WAV 16kHz mono
  async convertToWavBase64(blob) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await blob.arrayBuffer();
    let audioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (err) {
      audioContext.close();
      throw err;
    }
    
    // Resample to 16000Hz (16kHz)
    const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000);
    const bufferSource = offlineCtx.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(offlineCtx.destination);
    bufferSource.start();
    
    const resampledBuffer = await offlineCtx.startRendering();
    audioContext.close();
    const wavBuffer = this.encodeWAV(resampledBuffer.getChannelData(0), 16000);
    
    // Convert to base64 safely in chunks to avoid call stack limits
    const bytes = new Uint8Array(wavBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  // Simple WAV format encoder
  encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    /* RIFF identifier */
    this.writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + samples.length * 2, true);
    /* RIFF type */
    this.writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    this.writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, 1, true);
    /* channel count */
    view.setUint16(22, 1, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 2, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 2, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    this.writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true);

    // Write PCM samples (convert to 16-bit integers)
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return buffer;
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}
