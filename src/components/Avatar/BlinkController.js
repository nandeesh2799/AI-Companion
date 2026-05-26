export default class BlinkController {
  constructor(onBlinkStateChange) {
    this.onBlinkStateChange = onBlinkStateChange;
    this.timer = null;
    this.isActive = false;
  }

  start() {
    this.isActive = true;
    this.scheduleNextBlink();
  }

  stop() {
    this.isActive = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  scheduleNextBlink() {
    if (!this.isActive) return;

    const delay = Math.random() * 4000 + 2000; // 2000ms - 6000ms
    this.timer = setTimeout(() => {
      this.executeBlinkSequence(() => {
        // Occasionally double blink
        if (Math.random() < 0.15) {
          setTimeout(() => {
            this.executeBlinkSequence(() => this.scheduleNextBlink());
          }, 150);
        } else {
          this.scheduleNextBlink();
        }
      });
    }, delay);
  }

  executeBlinkSequence(callback) {
    // Sequence: Idle -> blink_1 (half) -> blink_2 (closed) -> blink_1 (half) -> Idle
    const frames = ['blink_1', 'blink_2', 'blink_1', 'idle'];
    let idx = 0;

    const nextFrame = () => {
      if (idx >= frames.length) {
        if (callback) callback();
        return;
      }
      this.onBlinkStateChange(frames[idx]);
      idx++;
      setTimeout(nextFrame, 40); // 40ms per frame, total blink duration ~160ms
    };

    nextFrame();
  }
}
