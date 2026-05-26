export default class BreathingMotion {
  constructor(amplitude = 3, periodMs = 3000) {
    this.amplitude = amplitude;
    this.periodMs = periodMs;
    this.startTime = Date.now();
  }

  // Get current Y-offset and scale factor
  getTransform() {
    const elapsed = Date.now() - this.startTime;
    const theta = (elapsed / this.periodMs) * 2.0 * Math.PI;
    
    const yOffset = Math.sin(theta) * this.amplitude;
    // Scale slightly peaks at the inhalation stage (highest Y position)
    const scaleFactor = 1.0 + (Math.sin(theta) + 1.0) * 0.0025; // 1.0 to 1.005

    return { yOffset, scaleFactor };
  }
}
