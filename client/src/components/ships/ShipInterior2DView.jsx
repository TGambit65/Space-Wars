import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { ArrowLeft, Loader, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { Camera2D } from '../../engine2d/Camera';
import { InputController } from '../../engine2d/InputController';
import { Avatar } from '../../engine2d/Avatar';
import { TileGridRenderer, parseColor } from '../../engine2d/TileGridRenderer';
import { buildPassabilityMap, moveWithCollision, findNearestInteractable } from '../../engine2d/Pathing';
import { colonies as coloniesApi } from '../../services/api';

function useFlash() {
  const [msg, setMsg] = useState(null);
  const show = useCallback((text, kind = 'info') => {
    setMsg({ text, kind });
    setTimeout(() => setMsg((m) => (m && m.text === text ? null : m)), 3000);
  }, []);
  return {
    msg,
    success: (t) => show(t, 'success'),
    error: (t) => show(t, 'error'),
    info: (t) => show(t, 'info'),
  };
}

const TILE_SIZE = 32;

export default function ShipInterior2DView({ user, mode: propMode }) {
  const { shipId } = useParams();
  const navigate = useNavigate();
  const toast = useFlash();
  const hostRef = useRef(null);
  const appRef = useRef(null);
  const stateRef = useRef({});
  const [interior, setInterior] = useState(null);
  const [deckIndex, setDeckIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredInteractable, setHoveredInteractable] = useState(null);
  const [lootedTiles, setLootedTiles] = useState(new Set());

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

      const interactablesLayer = new Container();
      interactablesLayer.zIndex = 200;
      world.addChild(interactablesLayer);

      const avatar = new Avatar({ tileSize: TILE_SIZE, color: 0xffaa44 });
      world.addChild(avatar.container);

      stateRef.current = {
        app, world, camera, input, tileRenderer, interactablesLayer, avatar,
        passability: null, gridW: 0, gridH: 0, interactables: [],
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
        const a = s.input.axis();
        if (a.x !== 0 || a.y !== 0) {
          const speed = s.avatar.speed * dt;
          const moved = moveWithCollision(
            s.passability, s.gridW, s.gridH,
            s.avatar.x, s.avatar.y, a.x * speed, a.y * speed, 0.32,
          );
          s.avatar.setPosition(moved.x, moved.y);
          s.avatar.setFacing(Math.atan2(a.y, a.x));
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

  // Apply current deck
  useEffect(() => {
    const s = stateRef.current;
    if (!s.app || !interior) return;
    const deck = interior.decks[deckIndex];
    if (!deck) return;
    const { width, height, tiles } = deck;
    const tileMeta = interior.tile_meta;
    s.gridW = width;
    s.gridH = height;

    // Convert tile array (chars) to grid using meta colors
    const renderMeta = {};
    for (const [k, v] of Object.entries(tileMeta)) {
      renderMeta[k] = { color: v.color, passable: v.passable };
    }
    s.tileRenderer.setGrid(tiles, renderMeta);

    // Interactables layer
    s.interactablesLayer.removeChildren();
    s.interactables = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ch = tiles[y][x];
        const meta = tileMeta[ch];
        if (!meta || !meta.interactable) continue;
        const lootKey = `${deck.id}:${x}:${y}`;
        if (ch === 'L' && lootedTiles.has(lootKey)) continue;
        const g = new Graphics();
        const cx = x * TILE_SIZE + TILE_SIZE / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2;
        g.circle(cx, cy, TILE_SIZE * 0.42);
        g.stroke({ width: 2, color: 0xffd166, alpha: 0.85 });
        s.interactablesLayer.addChild(g);
        s.interactables.push({
          x, y, char: ch, meta, label: meta.label, action: meta.action, lootKey,
        });
      }
    }

    // Passability
    s.passability = buildPassabilityMap({
      width, height, tileGrid: tiles, tileMeta: renderMeta,
    });

    // Place avatar at first passable interior tile or center
    if (!s._lastDeckId || s._lastDeckId !== deck.id) {
      // Try to spawn near stairs of opposite direction or at center
      let spawned = false;
      const spawnTarget = s._spawnTarget;
      if (spawnTarget) {
        s.avatar.setPosition(spawnTarget.x + 0.5, spawnTarget.y + 0.5);
        spawned = true;
        s._spawnTarget = null;
      }
      if (!spawned) {
        // Find first '.' tile
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
  }, [interior, deckIndex, lootedTiles]);

  // E-key interactions
  const handleAction = useCallback((it) => {
    if (!it) return;
    const s = stateRef.current;
    switch (it.action) {
      case 'leave_ship':
        navigate('/ships');
        break;
      case 'deck_up':
        if (deckIndex > 0) {
          // spawn next to a 'down' stair on the deck above
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
        const key = `${deck.id}:${it.x}:${it.y}`;
        setLootedTiles((prev) => new Set(prev).add(key));
        toast.success('Found salvage!');
        break;
      }
      default:
        toast.info(it.label || 'Interacted');
    }
  }, [deckIndex, interior, navigate, toast]);

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

        {hoveredInteractable && (
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
