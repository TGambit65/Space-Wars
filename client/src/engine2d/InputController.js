export class InputController {
  constructor(target = window) {
    this.target = target;
    this.keys = new Set();
    this.justPressed = new Set();
    this._onDown = (e) => {
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.justPressed.add(k);
      this.keys.add(k);
    };
    this._onUp = (e) => {
      this.keys.delete(e.key.toLowerCase());
    };
    this._onBlur = () => this.keys.clear();
    target.addEventListener('keydown', this._onDown);
    target.addEventListener('keyup', this._onUp);
    target.addEventListener('blur', this._onBlur);
  }

  down(k) {
    return this.keys.has(k.toLowerCase());
  }

  consumePressed(k) {
    const has = this.justPressed.has(k.toLowerCase());
    this.justPressed.delete(k.toLowerCase());
    return has;
  }

  endFrame() {
    this.justPressed.clear();
  }

  axis() {
    let x = 0;
    let y = 0;
    if (this.down('w') || this.down('arrowup')) y -= 1;
    if (this.down('s') || this.down('arrowdown')) y += 1;
    if (this.down('a') || this.down('arrowleft')) x -= 1;
    if (this.down('d') || this.down('arrowright')) x += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  destroy() {
    this.target.removeEventListener('keydown', this._onDown);
    this.target.removeEventListener('keyup', this._onUp);
    this.target.removeEventListener('blur', this._onBlur);
  }
}
