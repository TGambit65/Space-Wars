import { Container, Graphics } from 'pixi.js';

/**
 * Simple top-down avatar rendered as a layered circle with a directional indicator.
 * Position is in TILE coordinates (floats). Renderer multiplies by tileSize.
 */
export class Avatar {
  constructor({ tileSize, color = 0x66ccff, label = '' } = {}) {
    this.tileSize = tileSize;
    this.color = color;
    this.label = label;
    this.x = 0;
    this.y = 0;
    this.facing = 0; // radians
    this.speed = 4.5; // tiles/sec
    this.container = new Container();
    this.container.zIndex = 1000;
    this._build();
  }

  _build() {
    const g = new Graphics();
    const r = this.tileSize * 0.42;
    // shadow
    g.ellipse(0, r * 0.55, r * 0.7, r * 0.32);
    g.fill({ color: 0x000000, alpha: 0.35 });
    // body
    g.circle(0, 0, r);
    g.fill(this.color);
    g.circle(0, 0, r);
    g.stroke({ width: 2, color: 0xffffff, alpha: 0.85 });
    // facing indicator
    g.moveTo(0, 0);
    g.lineTo(r * 1.3, 0);
    g.stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
    this.body = g;
    this.container.addChild(g);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this._sync();
  }

  setFacing(rad) {
    this.facing = rad;
    this.body.rotation = rad;
  }

  _sync() {
    this.container.position.set(this.x * this.tileSize, this.y * this.tileSize);
  }

  update() {
    this._sync();
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
