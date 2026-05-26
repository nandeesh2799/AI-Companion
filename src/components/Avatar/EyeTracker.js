export default class EyeTracker {
  constructor(lerpFactor = 0.05, maxOffset = 5, activeRadius = 600) {
    this.lerpFactor = lerpFactor;
    this.maxOffset = maxOffset;
    this.activeRadius = activeRadius;
    
    this.currentOffset = { x: 0, y: 0 };
    this.targetOffset = { x: 0, y: 0 };
  }

  // Update target based on cursor position relative to avatar center
  updateCursor(cursorX, cursorY, avatarCenterX, avatarCenterY) {
    const dx = cursorX - avatarCenterX;
    const dy = cursorY - avatarCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > this.activeRadius) {
      // Outside radius, return eyes to center
      this.targetOffset = { x: 0, y: 0 };
    } else {
      // Calculate angle and apply offset
      const angle = Math.atan2(dy, dx);
      // Map distance ratio to offset intensity
      const intensity = Math.min(distance / this.activeRadius, 1.0) * this.maxOffset;
      this.targetOffset = {
        x: Math.cos(angle) * intensity,
        y: Math.sin(angle) * intensity
      };
    }
  }

  // Perform smooth transition lerp
  tick() {
    this.currentOffset.x += (this.targetOffset.x - this.currentOffset.x) * this.lerpFactor;
    this.currentOffset.y += (this.targetOffset.y - this.currentOffset.y) * this.lerpFactor;
    return this.currentOffset;
  }
}
