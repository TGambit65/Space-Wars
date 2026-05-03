import { Container, Graphics } from 'pixi.js';

/**
 * Cheap particle weather overlay. Positions are in screen-space (renders above world).
 */
export class WeatherOverlay {
  constructor({ width, height, type = 'none', intensity = 0.5, color = '#ffffff' }) {
    this.container = new Container();
    this.container.zIndex = 5000;
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
    this.type = type;
    this.intensity = intensity;
    this.color = color;
    this.width = width;
    this.height = height;
    this.particles = [];
    this._spawn();
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
  }

  setWeather(type, intensity, color) {
    this.type = type;
    this.intensity = intensity ?? this.intensity;
    this.color = color || this.color;
    this._spawn();
  }

  _spawn() {
    const counts = { rain: 220, snow: 140, sandstorm: 180, ash: 160, dust: 100, mist: 60, sparkle: 80, lightning: 30, none: 0 };
    const n = Math.floor((counts[this.type] ?? 0) * this.intensity);
    this.particles = new Array(n).fill(0).map(() => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: 0,
      vy: 0,
      life: Math.random(),
    }));
  }

  update(dt) {
    if (this.type === 'none' || this.particles.length === 0) {
      this.gfx.clear();
      return;
    }
    const g = this.gfx;
    g.clear();
    const col = parseInt(this.color.replace('#', ''), 16);
    for (const p of this.particles) {
      switch (this.type) {
        case 'rain':
          p.vy = 600;
          p.vx = -120;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.y > this.height) { p.y = -10; p.x = Math.random() * this.width; }
          if (p.x < 0) p.x = this.width;
          g.moveTo(p.x, p.y);
          g.lineTo(p.x - 4, p.y + 12);
          g.stroke({ width: 1, color: col, alpha: 0.5 });
          break;
        case 'snow':
          p.vy = 50 + (p.life * 30);
          p.vx = Math.sin(p.y * 0.01 + p.life * 6) * 20;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.y > this.height) { p.y = -10; p.x = Math.random() * this.width; }
          g.circle(p.x, p.y, 1.5);
          g.fill({ color: col, alpha: 0.85 });
          break;
        case 'sandstorm':
        case 'dust':
          p.vx = 240;
          p.x += p.vx * dt;
          if (p.x > this.width) { p.x = -20; p.y = Math.random() * this.height; }
          g.rect(p.x, p.y, 6, 1);
          g.fill({ color: col, alpha: 0.4 });
          break;
        case 'ash':
          p.vy = 30;
          p.vx = -40;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.y > this.height || p.x < 0) { p.y = -10; p.x = Math.random() * this.width; }
          g.circle(p.x, p.y, 1);
          g.fill({ color: col, alpha: 0.6 });
          break;
        case 'mist':
          p.x += Math.sin(p.life * 4) * 0.3;
          g.circle(p.x, p.y, 14);
          g.fill({ color: col, alpha: 0.05 });
          break;
        case 'sparkle': {
          p.life += dt * 0.8;
          const a = (Math.sin(p.life * 6) + 1) / 2;
          g.circle(p.x, p.y, 2);
          g.fill({ color: col, alpha: a * 0.8 });
          break;
        }
        case 'lightning':
          if (Math.random() < 0.0025) {
            g.rect(0, 0, this.width, this.height);
            g.fill({ color: col, alpha: 0.18 });
          }
          break;
        default:
          break;
      }
    }
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}

/**
 * Day/night tint overlay. Cycle is configurable; default 4-min full cycle.
 */
export class DayNightOverlay {
  constructor({ width, height, cycleMs = 240000, startHour = 12 }) {
    this.container = new Container();
    this.container.zIndex = 4500;
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
    this.width = width;
    this.height = height;
    this.cycleMs = cycleMs;
    this.t0 = performance.now() - (startHour / 24) * cycleMs;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
  }

  /** Returns hour in 0..24 */
  getHour() {
    const elapsed = (performance.now() - this.t0) % this.cycleMs;
    return (elapsed / this.cycleMs) * 24;
  }

  update() {
    const hour = this.getHour();
    const g = this.gfx;
    g.clear();
    // Sun curve: brightest at noon (12), darkest at midnight (0/24)
    const t = Math.cos(((hour - 12) / 24) * Math.PI * 2) * 0.5 + 0.5; // 1 = noon, 0 = midnight
    let color;
    let alpha;
    if (hour < 5 || hour > 21) {
      color = 0x0a1430;
      alpha = 0.55 - t * 0.4;
    } else if (hour < 7) {
      color = 0xff8a55;
      alpha = 0.25;
    } else if (hour > 18) {
      color = 0xff7a3a;
      alpha = 0.30;
    } else {
      color = 0xffffff;
      alpha = 0;
    }
    if (alpha > 0.01) {
      g.rect(0, 0, this.width, this.height);
      g.fill({ color, alpha });
    }
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
