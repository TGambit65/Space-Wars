import { Container, Graphics } from 'pixi.js';

/**
 * Renders a static tile grid as a single Graphics object (efficient).
 * Re-render only when tileGrid identity changes.
 */
export class TileGridRenderer {
  constructor({ tileSize }) {
    this.tileSize = tileSize;
    this.container = new Container();
    this.container.zIndex = 0;
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
    this._lastGrid = null;
  }

  setGrid(tileGrid, terrainMeta, fallback = '#222') {
    if (tileGrid === this._lastGrid) return;
    this._lastGrid = tileGrid;
    const g = this.gfx;
    g.clear();
    if (!tileGrid || tileGrid.length === 0) return;
    const ts = this.tileSize;
    const h = tileGrid.length;
    const w = tileGrid[0].length;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = tileGrid[y][x];
        const meta = terrainMeta?.[t];
        const color = parseColor(meta?.color || fallback);
        g.rect(x * ts, y * ts, ts, ts);
        g.fill(color);
      }
    }
    // Faint grid lines for spatial reading
    for (let y = 0; y <= h; y++) {
      g.moveTo(0, y * ts);
      g.lineTo(w * ts, y * ts);
    }
    for (let x = 0; x <= w; x++) {
      g.moveTo(x * ts, 0);
      g.lineTo(x * ts, h * ts);
    }
    g.stroke({ width: 0.5, color: 0x000000, alpha: 0.18 });
  }
}

export function parseColor(c) {
  if (typeof c === 'number') return c;
  if (typeof c !== 'string') return 0x222222;
  if (c.startsWith('#')) return parseInt(c.slice(1), 16);
  return 0x222222;
}
