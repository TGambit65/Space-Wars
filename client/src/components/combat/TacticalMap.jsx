import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';

/**
 * TacticalMap — top-down PixiJS view of the combat arena.
 *
 * Renders ship positions, headings, weapon ranges, target lock, waypoints,
 * and the escape radius. Click an enemy to target it; click empty space to
 * issue a move waypoint. Right-click clears your current waypoint.
 *
 * Props:
 *  - snapshot:   server combat snapshot { ships, arena? }
 *  - ownShipId:  ship id of the player's ship in this combat
 *  - onCommand:  function(command) — forwarded to the combat:command socket
 */
export default function TacticalMap({ snapshot, ownShipId, onCommand }) {
  const hostRef = useRef(null);
  const appRef = useRef(null);
  const layersRef = useRef(null);
  const stateRef = useRef({ snapshot: null, ownShipId: null });

  // Keep latest snapshot/ownShipId in a ref so the render loop and click
  // handler always read the most recent values without re-initializing Pixi.
  stateRef.current.snapshot = snapshot;
  stateRef.current.ownShipId = ownShipId;
  stateRef.current.onCommand = onCommand;

  // Init Pixi app once
  useEffect(() => {
    if (!hostRef.current) return;
    let destroyed = false;
    const app = new Application();
    appRef.current = app;

    app.init({
      resizeTo: hostRef.current,
      backgroundColor: 0x05080d,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    }).then(() => {
      if (destroyed) return;
      hostRef.current.appendChild(app.canvas);

      const world = new Container();
      world.sortableChildren = true;
      app.stage.addChild(world);

      const layers = {
        world,
        bg: new Graphics(),
        ranges: new Graphics(),
        waypoints: new Graphics(),
        ships: new Container(),
      };
      layers.bg.zIndex = 0;
      layers.ranges.zIndex = 5;
      layers.waypoints.zIndex = 10;
      layers.ships.zIndex = 20;
      world.addChild(layers.bg);
      world.addChild(layers.ranges);
      world.addChild(layers.waypoints);
      world.addChild(layers.ships);
      layersRef.current = layers;

      // Stage interaction (clicks)
      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;

      const screenToWorld = (sx, sy) => {
        const snap = stateRef.current.snapshot;
        const half = snap?.arena?.half || 200;
        const arenaSize = half * 2;
        const w = app.screen.width;
        const h = app.screen.height;
        const padding = 16;
        const drawSize = Math.max(50, Math.min(w, h) - padding * 2);
        const scale = drawSize / arenaSize;
        const cx = w / 2;
        const cy = h / 2;
        return {
          x: (sx - cx) / scale,
          y: (sy - cy) / scale,
          scale,
        };
      };

      const handlePointer = (event) => {
        // Ignore non-primary buttons so right-click only fires the
        // clear_waypoint handler below, not an accidental waypoint set.
        // Pixi v8 forwards the underlying PointerEvent button (0=left).
        const btn = event?.button ?? event?.data?.button ?? 0;
        if (btn !== 0) return;
        const snap = stateRef.current.snapshot;
        const ownId = stateRef.current.ownShipId;
        const cmd = stateRef.current.onCommand;
        if (!snap || !cmd) return;
        const pos = event.global;
        const wp = screenToWorld(pos.x, pos.y);

        // Clamp to arena
        const half = snap?.arena?.half || 200;
        const wx = Math.max(-half, Math.min(half, wp.x));
        const wy = Math.max(-half, Math.min(half, wp.y));

        // Hit-test ships first (15px radius in screen space)
        const pickRadius = 16 / wp.scale;
        let pickedEnemy = null;
        let pickedDist = Infinity;
        for (const s of snap.ships || []) {
          if (!s.alive || s.shipId === ownId) continue;
          const dx = s.position.x - wx;
          const dy = s.position.y - wy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < pickRadius && d < pickedDist) {
            pickedDist = d;
            pickedEnemy = s;
          }
        }
        if (pickedEnemy) {
          cmd({ type: 'select_target', target_id: pickedEnemy.shipId, subsystem: 'hull' });
        } else {
          cmd({ type: 'set_waypoint', x: wx, y: wy });
        }
      };

      app.stage.on('pointertap', handlePointer);
      app.stage.on('rightdown', () => {
        const cmd = stateRef.current.onCommand;
        if (cmd) cmd({ type: 'clear_waypoint' });
      });

      // Render loop reads stateRef each frame
      app.ticker.add(() => render(app, layersRef.current, stateRef.current));
    });

    return () => {
      destroyed = true;
      try {
        if (appRef.current) {
          appRef.current.destroy(true, { children: true });
        }
      } catch { /* noop */ }
      appRef.current = null;
      layersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={hostRef}
      className="relative w-full h-full overflow-hidden rounded border border-accent-cyan/20"
      style={{ background: '#05080d', minHeight: 280, cursor: 'crosshair' }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

// ── Render helpers ─────────────────────────────────────────────────
function render(app, layers, ctx) {
  if (!layers || !ctx.snapshot) return;
  const snap = ctx.snapshot;
  const ownId = ctx.ownShipId;
  const arenaHalf = snap?.arena?.half || 200;
  const arenaSize = arenaHalf * 2;
  const weaponRange = snap?.arena?.weaponRange || 200;
  const escapeRadius = snap?.arena?.escapeRadius || 200;

  const w = app.screen.width;
  const h = app.screen.height;
  const padding = 16;
  const drawSize = Math.max(50, Math.min(w, h) - padding * 2);
  const scale = drawSize / arenaSize;
  const cx = w / 2;
  const cy = h / 2;

  // Center the world container so (0,0) maps to screen center
  layers.world.position.set(cx, cy);
  layers.world.scale.set(scale);

  // ── Background: arena bounds, escape radius, range rings ──
  const bg = layers.bg;
  bg.clear();
  // Arena box
  bg.rect(-arenaHalf, -arenaHalf, arenaSize, arenaSize)
    .fill({ color: 0x0a1018, alpha: 1 })
    .stroke({ width: 1.5 / scale, color: 0x224466, alpha: 0.9 });
  // Faint grid (8 lines each axis)
  const step = arenaSize / 8;
  for (let i = 1; i < 8; i++) {
    const v = -arenaHalf + i * step;
    bg.moveTo(v, -arenaHalf).lineTo(v, arenaHalf);
    bg.moveTo(-arenaHalf, v).lineTo(arenaHalf, v);
  }
  bg.stroke({ width: 0.5 / scale, color: 0x1a3050, alpha: 0.6 });
  // Crosshairs at origin
  bg.moveTo(-arenaHalf, 0).lineTo(arenaHalf, 0);
  bg.moveTo(0, -arenaHalf).lineTo(0, arenaHalf);
  bg.stroke({ width: 0.5 / scale, color: 0x2a4a70, alpha: 0.8 });
  // Escape radius ring
  bg.circle(0, 0, escapeRadius)
    .stroke({ width: 1.2 / scale, color: 0xffaa33, alpha: 0.45 });

  // ── Weapon range circles ──
  const ranges = layers.ranges;
  ranges.clear();
  for (const s of snap.ships || []) {
    if (!s.alive) continue;
    const isMine = s.shipId === ownId;
    const isHostile = s.isNPC || (!isMine && !s.isNPC);
    const color = isMine ? 0x00ffff : (isHostile ? 0xff5566 : 0xaaaaaa);
    ranges.circle(s.position.x, s.position.y, weaponRange)
      .stroke({ width: 0.8 / scale, color, alpha: 0.12 });
  }

  // ── Waypoints + lock lines ──
  const wp = layers.waypoints;
  wp.clear();
  for (const s of snap.ships || []) {
    if (!s.alive) continue;
    if (s.shipId === ownId && s.waypoint) {
      // Path from ship to waypoint
      wp.moveTo(s.position.x, s.position.y).lineTo(s.waypoint.x, s.waypoint.y);
      wp.stroke({ width: 1 / scale, color: 0x00ffaa, alpha: 0.6 });
      wp.circle(s.waypoint.x, s.waypoint.y, 6 / scale)
        .stroke({ width: 1.2 / scale, color: 0x00ffaa, alpha: 0.9 });
      wp.moveTo(s.waypoint.x - 5 / scale, s.waypoint.y).lineTo(s.waypoint.x + 5 / scale, s.waypoint.y);
      wp.moveTo(s.waypoint.x, s.waypoint.y - 5 / scale).lineTo(s.waypoint.x, s.waypoint.y + 5 / scale);
      wp.stroke({ width: 1 / scale, color: 0x00ffaa, alpha: 0.9 });
    }
    // Target lock indicator (line from attacker to target)
    if (s.targetShipId) {
      const target = (snap.ships || []).find(t => t.shipId === s.targetShipId && t.alive);
      if (target) {
        const isMine = s.shipId === ownId;
        wp.moveTo(s.position.x, s.position.y).lineTo(target.position.x, target.position.y);
        wp.stroke({
          width: 0.8 / scale,
          color: isMine ? 0x00ffff : 0xff5566,
          alpha: isMine ? 0.5 : 0.35,
        });
      }
    }
  }

  // ── Ships ──
  // Rebuild ship sprites each frame (cheap for handful of ships)
  const shipsLayer = layers.ships;
  shipsLayer.removeChildren();
  for (const s of snap.ships || []) {
    const sprite = buildShipSprite(s, ownId, scale);
    sprite.position.set(s.position.x, s.position.y);
    shipsLayer.addChild(sprite);
  }
}

function buildShipSprite(s, ownId, worldScale) {
  const c = new Container();
  const g = new Graphics();
  const isMine = s.shipId === ownId;
  const dead = !s.alive;
  const color = dead
    ? 0x666666
    : isMine
      ? 0x00ffff
      : (s.isNPC ? 0xff5566 : 0xaa66ff);

  // Triangle pointing along heading. Local +X is "forward".
  const size = 12 / worldScale;
  g.rotation = 0;
  g.moveTo(size, 0);
  g.lineTo(-size * 0.7, size * 0.6);
  g.lineTo(-size * 0.4, 0);
  g.lineTo(-size * 0.7, -size * 0.6);
  g.closePath();
  g.fill({ color, alpha: dead ? 0.35 : 0.85 });
  g.stroke({ width: 1.2 / worldScale, color: 0xffffff, alpha: dead ? 0.2 : 0.7 });
  g.rotation = s.heading || 0;

  c.addChild(g);

  // Velocity vector (faint)
  if (!dead && s.velocity) {
    const vline = new Graphics();
    vline.moveTo(0, 0).lineTo(s.velocity.vx * 0.4, s.velocity.vy * 0.4);
    vline.stroke({ width: 0.8 / worldScale, color, alpha: 0.55 });
    c.addChild(vline);
  }

  // HP/Shield mini bar above ship
  if (!dead && s.stats) {
    const barW = 22 / worldScale;
    const barH = 2 / worldScale;
    const yOff = -size - 6 / worldScale;
    const bar = new Graphics();
    // Shields
    const sPct = s.stats.maxShields > 0 ? Math.max(0, Math.min(1, s.stats.shields / s.stats.maxShields)) : 0;
    bar.rect(-barW / 2, yOff, barW, barH).fill({ color: 0x111a22, alpha: 0.85 });
    bar.rect(-barW / 2, yOff, barW * sPct, barH).fill({ color: 0x3399ff, alpha: 0.95 });
    // Hull
    const hPct = s.stats.maxHull > 0 ? Math.max(0, Math.min(1, s.stats.hull / s.stats.maxHull)) : 0;
    const hY = yOff + barH + 0.5 / worldScale;
    const hullColor = hPct > 0.5 ? 0x44dd66 : hPct > 0.25 ? 0xffaa33 : 0xff4444;
    bar.rect(-barW / 2, hY, barW, barH).fill({ color: 0x111a22, alpha: 0.85 });
    bar.rect(-barW / 2, hY, barW * hPct, barH).fill({ color: hullColor, alpha: 0.95 });
    c.addChild(bar);
  }

  // Label (small text)
  const label = s.escaped
    ? 'ESC'
    : !s.alive
      ? 'KIA'
      : (s.isNPC ? (s.tier ? `${s.npcType || 'NPC'}` : (s.npcType || 'NPC')) : (s.name || (isMine ? 'YOU' : 'PLR')));
  const text = new Text({
    text: label,
    style: {
      fontFamily: 'monospace',
      fontSize: Math.max(8, 10 / worldScale),
      fill: isMine ? 0x66ffff : (s.isNPC ? 0xff8899 : 0xddccff),
      align: 'center',
    },
  });
  text.anchor.set(0.5, 0);
  text.position.set(0, 12 / worldScale);
  text.scale.set(1 / Math.max(0.5, worldScale * 1.4));
  c.addChild(text);

  return c;
}
