export class Camera2D {
  constructor({ minScale = 0.5, maxScale = 2.5 } = {}) {
    this.x = 0;
    this.y = 0;
    this.scale = 1;
    this.minScale = minScale;
    this.maxScale = maxScale;
    this.followTarget = null;
    this.viewportW = 0;
    this.viewportH = 0;
  }

  setViewport(w, h) {
    this.viewportW = w;
    this.viewportH = h;
  }

  follow(target) {
    this.followTarget = target;
  }

  centerOn(worldX, worldY) {
    this.x = worldX - this.viewportW / (2 * this.scale);
    this.y = worldY - this.viewportH / (2 * this.scale);
  }

  pan(dx, dy) {
    this.followTarget = null;
    this.x -= dx / this.scale;
    this.y -= dy / this.scale;
  }

  zoom(factor, anchorX, anchorY) {
    const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
    if (newScale === this.scale) return;
    const wx = this.x + anchorX / this.scale;
    const wy = this.y + anchorY / this.scale;
    this.scale = newScale;
    this.x = wx - anchorX / this.scale;
    this.y = wy - anchorY / this.scale;
  }

  update() {
    if (this.followTarget) {
      const tx = this.followTarget.x - this.viewportW / (2 * this.scale);
      const ty = this.followTarget.y - this.viewportH / (2 * this.scale);
      this.x += (tx - this.x) * 0.18;
      this.y += (ty - this.y) * 0.18;
    }
  }

  apply(stage) {
    stage.scale.set(this.scale);
    stage.position.set(-this.x * this.scale, -this.y * this.scale);
  }

  screenToWorld(sx, sy) {
    return { x: this.x + sx / this.scale, y: this.y + sy / this.scale };
  }
}
