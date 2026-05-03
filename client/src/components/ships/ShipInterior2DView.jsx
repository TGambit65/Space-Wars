import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Application, Container, Graphics } from 'pixi.js';
import { ArrowLeft, Loader, AlertTriangle, Heart, Flame } from 'lucide-react';
import { Camera2D } from '../../engine2d/Camera';
import { InputController } from '../../engine2d/InputController';
import { Avatar } from '../../engine2d/Avatar';
import { TileGridRenderer } from '../../engine2d/TileGridRenderer';
import { buildPassabilityMap, moveWithCollision, findNearestInteractable } from '../../engine2d/Pathing';
import { colonies as coloniesApi } from '../../services/api';

function useFlash() {
  const [msg, setMsg] = useState(null);
  const show = useCallback((text, kind = 'info') => {
    const id = Date.now() + Math.random();
    setMsg({ text, kind, id });
    setTimeout(() => setMsg((m) => (m && m.id === id ? null : m)), 3000);
  }, []);
  return {
    msg,
    success: (t) => show(t, 'success'),
    error: (t) => show(t, 'error'),
    info: (t) => show(t, 'info'),
  };
}

const TILE_SIZE = 32;
const MAX_HP = 100;
const FIRE_DPS = 18;        // hp lost per second standing on fire
const BREACH_PULL_TILES = 4; // breaches pull when within this radius
const BREACH_PULL_STRENGTH = 2.2; // tiles/sec at adjacent distance

// Species → tint for crew NPCs.
const SPECIES_COLORS = {
  Human: 0x88c0ff, Vexian: 0xc878ff, Krynn: 0x86e08a, Zorath: 0xffb86b,
  Sylphi: 0xff9ec4, Grox: 0xb08c64, Nexari: 0x66e0d4, Threll: 0xd06a6a,
  'Worker Bot': 0xbfbfbf, 'Combat Droid': 0xff6464, 'Science Unit': 0x9ecaff,
  Crystallid: 0xb6f3ff, 'Void Walker': 0x6a4fb8,
};

export default function ShipInterior2DView({ user, mode: propMode }) {
  const { shipId } = useParams();
  const navigate = useNavigate();
  const toast = useFlash();
  const hostRef = useRef(null);
  const appRef = useRef(null);
  const stateRef = useRef({});
  const [interior, setInterior] = useState(null);
  const [crewList, setCrewList] = useState([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredInteractable, setHoveredInteractable] = useState(null);
  const [hp, setHp] = useState(MAX_HP);
  const hpRef = useRef(MAX_HP);
  const [dead, setDead] = useState(false);
  const deadRef = useRef(false);

  const isDerelict = propMode === 'derelict' || (typeof window !== 'undefined' && window.location.pathname.includes('/derelict'));
  const mode = isDerelict ? 'derelict' : 'normal';

  // Load interior
  useEffect(() => {
    let alive = true;
    setLoading(true);
    coloniesApi.getShipInterior(shipId, mode)
      .then((res) => {
        if (!alive) return;
        setInterior(res.data?.data || res.data);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.response?.data?.message || e.message);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [shipId, mode]);

  // Load on-board crew (only for owned ships in normal mode)
  useEffect(() => {
    if (mode !== 'normal') { setCrewList([]); return; }
    let alive = true;
    coloniesApi.getShipOnBoardCrew(shipId)
      .then((res) => {
        if (!alive) return;
        setCrewList(res.data?.data?.crew || []);
      })
      .catch(() => { if (alive) setCrewList([]); });
    return () => { alive = false; };
  }, [shipId, mode]);

  // Init Pixi app
  useEffect(() => {
    if (!hostRef.current) return;
    let destroyed = false;
    const app = new Application();
    appRef.current = app;
    const initPromise = app.init({
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

      const camera = new Camera2D({ minScale: 0.6, maxScale: 2.5 });
      camera.setViewport(app.screen.width, app.screen.height);
      const input = new InputController(window);
      const tileRenderer = new TileGridRenderer({ tileSize: TILE_SIZE });
      world.addChild(tileRenderer.container);

      const hazardLayer = new Container();
      hazardLayer.zIndex = 150;
      world.addChild(hazardLayer);

      const interactablesLayer = new Container();
      interactablesLayer.zIndex = 200;
      world.addChild(interactablesLayer);

      const npcLayer = new Container();
      npcLayer.zIndex = 500;
      world.addChild(npcLayer);

      const avatar = new Avatar({ tileSize: TILE_SIZE, color: 0xffaa44 });
      world.addChild(avatar.container);

      stateRef.current = {
        app, world, camera, input, tileRenderer, hazardLayer, interactablesLayer,
        npcLayer, avatar,
        passability: null, gridW: 0, gridH: 0,
        interactables: [], hazards: [], airlocks: [],
        npcs: [], hazardTime: 0,
      };

      const onWheel = (e) => {
        e.preventDefault();
        const rect = app.canvas.getBoundingClientRect();
        camera.zoom(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - rect.left, e.clientY - rect.top);
      };
      const onResize = () => camera.setViewport(app.screen.width, app.screen.height);
      app.canvas.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('resize', onResize);

      let last = performance.now();
      app.ticker.add(() => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const s = stateRef.current;
        if (!s.passability) return;

        // -- Player movement (disabled when dead)
        if (!deadRef.current) {
          const a = s.input.axis();
          let vx = a.x;
          let vy = a.y;
          // Vacuum breach pulls the player toward the nearest airlock.
          if (s.airlocks.length > 0) {
            for (const b of s.hazards) {
              if (b.kind !== 'breach') continue;
              const dx = b.x + 0.5 - s.avatar.x;
              const dy = b.y + 0.5 - s.avatar.y;
              const dist = Math.hypot(dx, dy);
              if (dist < BREACH_PULL_TILES && dist > 0.001) {
                // Pull direction is toward nearest airlock from the player.
                let nearestAirlock = s.airlocks[0];
                let nearestD2 = Infinity;
                for (const al of s.airlocks) {
                  const d2 = (al.x - s.avatar.x) ** 2 + (al.y - s.avatar.y) ** 2;
                  if (d2 < nearestD2) { nearestD2 = d2; nearestAirlock = al; }
                }
                const pdx = nearestAirlock.x - s.avatar.x;
                const pdy = nearestAirlock.y - s.avatar.y;
                const pd = Math.hypot(pdx, pdy) || 1;
                const falloff = 1 - dist / BREACH_PULL_TILES;
                const pull = BREACH_PULL_STRENGTH * falloff;
                vx += (pdx / pd) * pull / s.avatar.speed;
                vy += (pdy / pd) * pull / s.avatar.speed;
              }
            }
          }
          if (vx !== 0 || vy !== 0) {
            const speed = s.avatar.speed * dt;
            const moved = moveWithCollision(
              s.passability, s.gridW, s.gridH,
              s.avatar.x, s.avatar.y, vx * speed, vy * speed, 0.32,
            );
            s.avatar.setPosition(moved.x, moved.y);
            if (Math.abs(vx) + Math.abs(vy) > 0.01) {
              s.avatar.setFacing(Math.atan2(vy, vx));
            }
          }

          // -- Fire damage (any fire tile within the player's body radius)
          let onFire = false;
          for (const h of s.hazards) {
            if (h.kind !== 'fire') continue;
            const dx = (h.x + 0.5) - s.avatar.x;
            const dy = (h.y + 0.5) - s.avatar.y;
            if (dx * dx + dy * dy < 0.55 * 0.55) { onFire = true; break; }
          }
          if (onFire) {
            hpRef.current = Math.max(0, hpRef.current - FIRE_DPS * dt);
            setHp(Math.ceil(hpRef.current));
            if (hpRef.current <= 0 && !deadRef.current) {
              deadRef.current = true;
              setDead(true);
            }
          }
        }

        // -- NPC wandering
        for (const npc of s.npcs) {
          npc.cooldown -= dt;
          if (npc.cooldown <= 0 || (npc.tx === null)) {
            // Pick a new random nearby destination on a passable tile.
            for (let attempt = 0; attempt < 8; attempt++) {
              const tx = Math.floor(npc.x + (Math.random() - 0.5) * 8);
              const ty = Math.floor(npc.y + (Math.random() - 0.5) * 8);
              if (tx < 0 || ty < 0 || tx >= s.gridW || ty >= s.gridH) continue;
              if (s.passability[ty * s.gridW + tx]) {
                npc.tx = tx + 0.5;
                npc.ty = ty + 0.5;
                npc.cooldown = 1.5 + Math.random() * 3.5;
                break;
              }
            }
          }
          if (npc.tx !== null) {
            const dx = npc.tx - npc.x;
            const dy = npc.ty - npc.y;
            const d = Math.hypot(dx, dy);
            if (d < 0.05) { npc.tx = null; }
            else {
              const step = Math.min(d, npc.speed * dt);
              const nx = npc.x + (dx / d) * step;
              const ny = npc.y + (dy / d) * step;
              const moved = moveWithCollision(
                s.passability, s.gridW, s.gridH,
                npc.x, npc.y, nx - npc.x, ny - npc.y, 0.28,
              );
              npc.x = moved.x;
              npc.y = moved.y;
              npc.facing = Math.atan2(dy, dx);
            }
          }
          npc.gfx.position.set(npc.x * TILE_SIZE, npc.y * TILE_SIZE);
          npc.gfx.rotation = npc.facing;
        }

        // -- Hazard pulse animation
        s.hazardTime += dt;
        const pulse = 0.6 + 0.4 * Math.sin(s.hazardTime * 6);
        if (s.hazardLayer.children.length > 0) {
          for (let i = 0; i < s.hazardLayer.children.length; i++) {
            const c = s.hazardLayer.children[i];
            if (c._isFire) c.alpha = pulse;
          }
        }

        s.camera.follow(s.avatar.container);
        s.camera.update();
        s.camera.apply(s.world);
        s.input.endFrame();
        const near = findNearestInteractable(s.interactables, s.avatar.x, s.avatar.y, 1.6);
        setHoveredInteractable(near?.item || null);
      });

      stateRef.current._cleanup = () => {
        window.removeEventListener('resize', onResize);
        app.canvas.removeEventListener('wheel', onWheel);
        input.destroy();
      };
    });

    return () => {
      destroyed = true;
      initPromise.finally(() => {
        const cleanup = stateRef.current?._cleanup;
        if (cleanup) cleanup();
        try { app.destroy(true, { children: true }); } catch (_) {}
        appRef.current = null;
        stateRef.current = {};
      });
    };
  }, []);

  // Apply current deck whenever interior, deckIndex, or crew list changes.
  useEffect(() => {
    const s = stateRef.current;
    if (!s.app || !interior) return;
    const deck = interior.decks[deckIndex];
    if (!deck) return;
    const { width, height, tiles } = deck;
    const tileMeta = interior.tile_meta;
    s.gridW = width;
    s.gridH = height;

    const renderMeta = {};
    for (const [k, v] of Object.entries(tileMeta)) {
      renderMeta[k] = { color: v.color, passable: v.passable };
    }
    s.tileRenderer.setGrid(tiles, renderMeta);

    // Reset layers
    s.interactablesLayer.removeChildren();
    s.hazardLayer.removeChildren();
    s.npcLayer.removeChildren();
    s.interactables = [];
    s.hazards = [];
    s.airlocks = [];
    s.npcs = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ch = tiles[y][x];
        const meta = tileMeta[ch];
        if (!meta) continue;
        const cx = x * TILE_SIZE + TILE_SIZE / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2;

        if (meta.hazard === 'fire') {
          const g = new Graphics();
          g.circle(cx, cy, TILE_SIZE * 0.42);
          g.fill({ color: 0xff6a1f, alpha: 0.85 });
          g.circle(cx, cy, TILE_SIZE * 0.22);
          g.fill({ color: 0xffe27a, alpha: 0.95 });
          g._isFire = true;
          s.hazardLayer.addChild(g);
          s.hazards.push({ kind: 'fire', x, y });
        } else if (meta.hazard === 'breach') {
          const g = new Graphics();
          g.circle(cx, cy, TILE_SIZE * 0.5);
          g.fill({ color: 0x000814, alpha: 0.95 });
          // Swirling indicator ring
          g.circle(cx, cy, TILE_SIZE * 0.36);
          g.stroke({ width: 2, color: 0x66aaff, alpha: 0.7 });
          s.hazardLayer.addChild(g);
          s.hazards.push({ kind: 'breach', x, y });
        }
        if (meta.action === 'leave_ship') {
          s.airlocks.push({ x: x + 0.5, y: y + 0.5 });
        }
        if (meta.interactable) {
          const g = new Graphics();
          g.circle(cx, cy, TILE_SIZE * 0.42);
          g.stroke({ width: 2, color: 0xffd166, alpha: 0.85 });
          s.interactablesLayer.addChild(g);
          s.interactables.push({
            x, y, char: ch, meta, label: meta.label, action: meta.action,
            deckId: deck.id,
          });
        }
      }
    }

    // Spawn NPC crew members on this deck (normal mode only)
    if (mode === 'normal' && crewList.length > 0) {
      // Pick a passable spawn tile for each crew member.
      const passable = [];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (tiles[y][x] === '.') passable.push({ x, y });
        }
      }
      for (let i = 0; i < crewList.length && passable.length > 0; i++) {
        const member = crewList[i];
        const spot = passable[(i * 7919) % passable.length];
        const tint = SPECIES_COLORS[member.species] || 0xaaaaaa;
        const g = new Graphics();
        const r = TILE_SIZE * 0.32;
        g.ellipse(0, r * 0.55, r * 0.6, r * 0.28);
        g.fill({ color: 0x000000, alpha: 0.35 });
        g.circle(0, 0, r);
        g.fill(tint);
        g.circle(0, 0, r);
        g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.7 });
        g.moveTo(0, 0);
        g.lineTo(r * 1.1, 0);
        g.stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
        g.position.set((spot.x + 0.5) * TILE_SIZE, (spot.y + 0.5) * TILE_SIZE);
        s.npcLayer.addChild(g);
        s.npcs.push({
          x: spot.x + 0.5,
          y: spot.y + 0.5,
          tx: null, ty: null,
          facing: 0,
          speed: 1.4 + Math.random() * 0.6,
          cooldown: Math.random() * 2,
          gfx: g,
          name: member.name,
        });
      }
    }

    s.passability = buildPassabilityMap({
      width, height, tileGrid: tiles, tileMeta: renderMeta,
    });

    if (!s._lastDeckId || s._lastDeckId !== deck.id) {
      let spawned = false;
      const spawnTarget = s._spawnTarget;
      if (spawnTarget) {
        s.avatar.setPosition(spawnTarget.x + 0.5, spawnTarget.y + 0.5);
        spawned = true;
        s._spawnTarget = null;
      }
      if (!spawned) {
        outer: for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (tiles[y][x] === '.') {
              s.avatar.setPosition(x + 0.5, y + 0.5);
              spawned = true;
              break outer;
            }
          }
        }
      }
      s.camera.centerOn(s.avatar.x * TILE_SIZE, s.avatar.y * TILE_SIZE);
      s._lastDeckId = deck.id;
    }
  }, [interior, deckIndex, crewList, mode]);

  // Death: navigate back to /ships after a brief pause.
  useEffect(() => {
    if (!dead) return;
    toast.error('You succumbed to the hazards aboard the derelict');
    const t = setTimeout(() => navigate('/ships'), 2200);
    return () => clearTimeout(t);
  }, [dead, navigate, toast]);

  // E-key interactions
  const handleAction = useCallback(async (it) => {
    if (!it || deadRef.current) return;
    const s = stateRef.current;
    switch (it.action) {
      case 'leave_ship':
        navigate('/ships');
        break;
      case 'deck_up':
        if (deckIndex > 0) {
          const upper = interior.decks[deckIndex - 1];
          const target = findCharOnDeck(upper, 's');
          s._spawnTarget = target || { x: it.x, y: it.y };
          setDeckIndex((i) => Math.max(0, i - 1));
        } else {
          toast.info('Top deck reached');
        }
        break;
      case 'deck_down':
        if (deckIndex < interior.decks.length - 1) {
          const lower = interior.decks[deckIndex + 1];
          const target = findCharOnDeck(lower, 'u');
          s._spawnTarget = target || { x: it.x, y: it.y };
          setDeckIndex((i) => Math.min(interior.decks.length - 1, i + 1));
        } else {
          toast.info('Lowest deck reached');
        }
        break;
      case 'open_navigation':
        navigate('/map');
        break;
      case 'open_repair':
        navigate('/ships');
        break;
      case 'open_crew':
        navigate('/crew');
        break;
      case 'open_combat':
        navigate('/combat');
        break;
      case 'open_status':
        toast.info('Reactor stable');
        break;
      case 'loot_crate': {
        const deck = interior.decks[deckIndex];
        try {
          const res = await coloniesApi.lootShipCrate(shipId, deck.id, it.x, it.y);
          const award = res.data?.data?.award;
          // Re-fetch the interior so the looted crate disappears server-side too.
          const refreshed = await coloniesApi.getShipInterior(shipId, mode);
          setInterior(refreshed.data?.data || refreshed.data);
          if (award) {
            toast.success(`Looted: ${award.label}`);
          } else {
            toast.success('Crate looted');
          }
        } catch (e) {
          toast.error(e.response?.data?.message || 'Could not loot crate');
        }
        break;
      }
      default:
        toast.info(it.label || 'Interacted');
    }
  }, [deckIndex, interior, navigate, toast, shipId, mode]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() === 'e' && hoveredInteractable) {
        handleAction(hoveredInteractable);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hoveredInteractable, handleAction]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-space-950">
        <Loader className="w-5 h-5 animate-spin text-gray-400 mr-2" /> Loading interior...
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-space-950 text-accent-red">
        <AlertTriangle className="w-5 h-5 mr-2" /> {error}
      </div>
    );
  }

  const deck = interior?.decks?.[deckIndex];
  const hpPct = Math.max(0, Math.min(100, (hp / MAX_HP) * 100));

  return (
    <div className="h-screen flex flex-col bg-space-950 text-white relative">
      <div className="flex items-center justify-between px-3 py-2 border-b border-space-700 bg-space-900/80 z-20">
        <button onClick={() => navigate('/ships')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Ships
        </button>
        <div className="text-sm">
          <span className="font-semibold">{interior?.ship_name}</span>
          <span className="text-gray-500 ml-2">{interior?.ship_type}</span>
          {mode === 'derelict' && <span className="ml-2 text-accent-red">DERELICT</span>}
        </div>
        <div className="text-xs text-gray-400">{deck?.name}</div>
      </div>

      <div ref={hostRef} className="flex-1 relative overflow-hidden">
        {/* Deck navigation */}
        {interior && interior.decks.length > 1 && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
            {interior.decks.map((d, i) => (
              <button
                key={d.id}
                onClick={() => { stateRef.current._spawnTarget = null; stateRef.current._lastDeckId = null; setDeckIndex(i); }}
                className={`px-2 py-1 rounded text-xs font-medium border ${
                  i === deckIndex
                    ? 'bg-accent-cyan/20 border-accent-cyan text-accent-cyan'
                    : 'bg-space-900/80 border-space-700 text-gray-400 hover:text-white'
                }`}
              >
                {i === deckIndex ? '●' : '○'} {d.name}
              </button>
            ))}
          </div>
        )}

        {/* HP bar (derelict mode only) */}
        {mode === 'derelict' && (
          <div className="absolute top-2 left-2 z-10 bg-space-900/80 border border-space-700 rounded px-3 py-2 w-56">
            <div className="flex items-center gap-2 text-xs mb-1">
              <Heart className="w-3.5 h-3.5 text-accent-red" />
              <span className="text-gray-300">Suit Integrity</span>
              <span className="ml-auto text-gray-400">{Math.ceil(hp)} / {MAX_HP}</span>
            </div>
            <div className="h-2 bg-space-800 rounded overflow-hidden">
              <div
                className={`h-full transition-all ${hpPct < 30 ? 'bg-accent-red' : hpPct < 60 ? 'bg-accent-yellow' : 'bg-emerald-500'}`}
                style={{ width: `${hpPct}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-gray-500 flex items-center gap-1">
              <Flame className="w-3 h-3 text-accent-red" /> Avoid fire & hull breaches
            </div>
          </div>
        )}

        {/* Crew counter (normal mode) */}
        {mode === 'normal' && crewList.length > 0 && (
          <div className="absolute top-2 left-2 z-10 bg-space-900/80 border border-space-700 rounded px-3 py-1.5 text-xs text-gray-300">
            Crew aboard: <span className="text-white font-semibold">{crewList.length}</span>
          </div>
        )}

        {hoveredInteractable && !dead && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-space-900/90 border border-accent-yellow/50 rounded px-3 py-2 text-xs text-accent-yellow z-10">
            Press <kbd className="px-1 bg-space-700 rounded">E</kbd> to {hoveredInteractable.label || 'use'}
          </div>
        )}

        <div className="absolute bottom-2 right-2 text-[10px] text-gray-500 bg-space-900/70 px-2 py-1 rounded">
          WASD to move • Wheel to zoom • E to interact
        </div>

        {toast.msg && (
          <div className={`absolute top-12 left-1/2 -translate-x-1/2 px-3 py-2 rounded text-xs z-30 border ${
            toast.msg.kind === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-emerald-200'
            : toast.msg.kind === 'error' ? 'bg-red-900/90 border-red-500 text-red-200'
            : 'bg-space-900/90 border-space-600 text-gray-200'
          }`}>{toast.msg.text}</div>
        )}

        {dead && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40">
            <div className="text-center">
              <div className="text-2xl text-accent-red font-bold mb-2">SUIT FAILURE</div>
              <div className="text-sm text-gray-300">Returning to ship list…</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function findCharOnDeck(deck, ch) {
  if (!deck) return null;
  for (let y = 0; y < deck.height; y++) {
    for (let x = 0; x < deck.width; x++) {
      if (deck.tiles[y][x] === ch) return { x, y };
    }
  }
  return null;
}
