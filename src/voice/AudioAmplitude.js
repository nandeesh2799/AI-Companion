import eventBus from '../engine/EventBus';

export default class AudioAmplitude {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.animationFrameId = null;
    // Track which audio element owns the current source node to avoid re-creating it
    this._connectedElement = null;
  }

  // Initialize analyser node connected to HTML audio element
  connectAudioElement(audioElement) {
    // If already connected to this same element, just restart polling
    if (this._connectedElement === audioElement && this.audioContext && this.audioContext.state !== 'closed') {
      this.startPolling();
      return;
    }

    this.disconnect();

    try {
      // Create or reuse AudioContext
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      // createMediaElementSource can only be called ONCE per element across its lifetime.
      // We guard this with a WeakMap flag on the element itself.
      if (!audioElement._audioSourceNode) {
        this.source = this.audioContext.createMediaElementSource(audioElement);
        // Cache the source node on the element so we can reconnect it later
        audioElement._audioSourceNode = this.source;
      } else {
        this.source = audioElement._audioSourceNode;
      }

      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      this._connectedElement = audioElement;

      this.startPolling();
    } catch (err) {
      console.warn("AudioContext initialization failed (likely user interaction policy):", err);
    }
  }

  startPolling() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const poll = () => {
      if (!this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);

      // Calculate root-mean-square (RMS) volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);

      // Normalize volume to 0.0 - 1.0 range
      const normalized = Math.min(rms / 128.0, 1.0);

      // Emit amplitude update to EventBus
      eventBus.emit('amplitude:update', normalized);

      this.animationFrameId = requestAnimationFrame(poll);
    };

    poll();
  }

  disconnect() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    // Don't disconnect/destroy the source node — it's cached on the element and must persist
    // Just stop the analyser polling and disconnect analyser from destination
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch (e) {}
      this.analyser = null;
    }
    // Don't close AudioContext between plays — reuse it
    this._connectedElement = null;
  }

  // Full cleanup (called on component unmount)
  destroy() {
    this.disconnect();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
