export default class MouthSync {
  constructor(debounceMs = 80, silenceThresholdMs = 150) {
    this.debounceMs = debounceMs;
    this.silenceThresholdMs = silenceThresholdMs;
    
    this.lastMouthState = 'mouth_closed';
    this.lastStateTime = Date.now();
    this.lastSpeechTime = Date.now();
  }

  // Returns the appropriate mouth shape state based on audio amplitude (0.0 - 1.0)
  getMouthState(amplitude) {
    const now = Date.now();
    let targetState = 'mouth_closed';

    if (amplitude >= 0.5) {
      targetState = 'mouth_a';
    } else if (amplitude >= 0.2) {
      targetState = 'mouth_i';
    } else if (amplitude >= 0.05) {
      targetState = 'mouth_u';
    }

    if (targetState !== 'mouth_closed') {
      this.lastSpeechTime = now;
    }

    // If silent for longer than threshold, force closed state
    if (now - this.lastSpeechTime > this.silenceThresholdMs) {
      this.lastMouthState = 'mouth_closed';
      return 'mouth_closed';
    }

    // Apply debounce delay to avoid rapid state flip-flopping (jitter)
    if (targetState !== this.lastMouthState && (now - this.lastStateTime > this.debounceMs)) {
      this.lastMouthState = targetState;
      this.lastStateTime = now;
    }

    return this.lastMouthState;
  }
}
