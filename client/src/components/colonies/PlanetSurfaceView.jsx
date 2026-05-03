import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { ArrowLeft, Sun, Cloud, Loader, Sparkles, AlertTriangle, Undo2 } from 'lucide-react';
import { Camera2D } from '../../engine2d/Camera';
import { InputController } from '../../engine2d/InputController';
import { Avatar } from '../../engine2d/Avatar';
import { TileGridRenderer, parseColor } from '../../engine2d/TileGridRenderer';
import { WeatherOverlay, DayNightOverlay } from '../../engine2d/WeatherOverlay';
import {
  buildPassabilityMap, isPassable, moveWithCollision, findNearestInteractable,
} from '../../engine2d/Pathing';
import { colonies as coloniesApi, buildings as buildingsApi } from '../../services/api';
import SurfaceToolbar from './SurfaceToolbar';

const UNDO_WINDOW_MS = 10_000;
const RIGHT_CLICK_DRAG_THRESHOLD = 5; // px

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

// ----- Static client-side metadata mirrors of server config -----
const TERRAIN_META = {
  plains:        { color: '#4a7c59', passable: true,  label: 'Plains' },
  rocky:         { color: '#7c6e5a', passable: true,  label: 'Rocky' },
  water:         { color: '#3a6b8c', passable: false, label: 'Water' },
  lava:          { color: '#c44d2e', passable: false, label: 'Lava' },
  ice:           { color: '#a8c8d8', passable: true,  label: 'Ice' },
  sand:          { color: '#c4a94d', passable: true,  label: 'Sand' },
  highland:      { color: '#5a5a5a', passable: true,  label: 'Highland' },
  crystal:       { color: '#8a4d9e', passable: true,  label: 'Crystal' },
  swamp:         { color: '#4a5c3a', passable: true,  label: 'Swamp' },
  volcanic_vent: { color: '#e06030', passable: false, label: 'Volcanic Vent' },
  landing_zone:  { color: '#2a4a6a', passable: true,  label: 'Landing Zone' },
  metal_grating: { color: '#7a8a8a', passable: true,  label: 'Grating' },
  open_sky:      { color: '#1a3050', passable: false, label: 'Open Sky' },
};

const DEPOSIT_META = {
  rich_ore:     { color: '#ff8844', label: 'Rich Ore' },
  crystal_vein: { color: '#cc66ff', label: 'Crystal Vein' },
  fertile_soil: { color: '#66cc44', label: 'Fertile Soil' },
  thermal_vent: { color: '#ff4422', label: 'Thermal Vent' },
};

const WEATHER_BY_PLANET = {
  Terran:      { type: 'rain',      intensity: 0.3, color: '#8888cc' },
  Oceanic:     { type: 'rain',      intensity: 0.6, color: '#6688aa' },
  Desert:      { type: 'sandstorm', intensity: 0.4, color: '#c4a44d' },
  Volcanic:    { type: 'ash',       intensity: 0.5, color: '#444444' },
  Arctic:      { type: 'snow',      intensity: 0.5, color: '#ffffff' },
  Ice:         { type: 'snow',      intensity: 0.7, color: '#ddeeff' },
  Jungle:      { type: 'rain',      intensity: 0.5, color: '#66aa88' },
  Barren:      { type: 'dust',      intensity: 0.2, color: '#aa9977' },
  'Gas Giant': { type: 'lightning', intensity: 0.3, color: '#aaccff' },
  Crystalline: { type: 'sparkle',   intensity: 0.4, color: '#cc88ff' },
  Toxic:       { type: 'mist',      intensity: 0.5, color: '#556655' },
};

const TILE_SIZE = 32;

export default function PlanetSurfaceView({ user, readOnly = false }) {
  const { colonyId } = useParams();
  const navigate = useNavigate();
  const toast = useFlash();
  const hostRef = useRef(null);
  const appRef = useRef(null);
  const stateRef = useRef({}); // engine state container
  const [surface, setSurface] = useState(null);
  const [buildingsCatalog, setBuildingsCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [hoveredTile, setHoveredTile] = useState(null);
  const [hoveredInteractable, setHoveredInteractable] = useState(null);
  const [hour, setHour] = useState(12);
  const [error, setError] = useState(null);
  const [tool, setTool] = useState({ kind: 'none' }); // {kind:'building'|'block'|'remove'|'none', payload}
  const [lastPlaced, setLastPlaced] = useState(null); // { kind: 'building'|'block', id, ts }
  const [, setUndoTick] = useState(0);
  const selectedToolRef = useRef(selectedTool);
  const toolRef = useRef(tool);
  const surfaceRef = useRef(surface);
  useEffect(() => { selectedToolRef.current = selectedTool; }, [selectedTool]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { surfaceRef.current = surface; }, [surface]);

  // Re-render every second while an undo entry is active so the button hides on expiry
  useEffect(() => {
    if (!lastPlaced) return undefined;
    const id = setInterval(() => {
      if (Date.now() - lastPlaced.ts > UNDO_WINDOW_MS) {
        setLastPlaced(null);
      } else {
        setUndoTick((t) => t + 1);
      }
    }, 500);
    return () => clearInterval(id);
  }, [lastPlaced]);

  const undoRemainingMs = lastPlaced ? Math.max(0, UNDO_WINDOW_MS - (Date.now() - lastPlaced.ts)) : 0;
  const canUndo = !!lastPlaced && undoRemainingMs > 0;

  const fetchSurface = useCallback(() => (
    readOnly ? coloniesApi.getPublicSurface(colonyId) : coloniesApi.getSurface(colonyId)
  ), [colonyId, readOnly]);

  const reload = useCallback(async () => {
    try {
      const res = await fetchSurface();
      setSurface(res.data?.data || res.data);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  }, [fetchSurface]);

  // Load surface + building catalog
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchSurface(), buildingsApi.getTypes()])
      .then(([surf, types]) => {
        if (!alive) return;
        setSurface(surf.data?.data || surf.data);
        setBuildingsCatalog(types.data?.data || types.data);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.response?.data?.message || e.message);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [colonyId]);

  // Initialize PixiJS app once
  useEffect(() => {
    if (!hostRef.current) return;
    let destroyed = false;
    const app = new Application();
    appRef.current = app;
    const initPromise = app.init({
      resizeTo: hostRef.current,
      backgroundColor: 0x0a0e1a,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    }).then(() => {
      if (destroyed) return;
      hostRef.current.appendChild(app.canvas);
      const world = new Container();
      world.sortableChildren = true;
      app.stage.addChild(world);

      const camera = new Camera2D();
      camera.setViewport(app.screen.width, app.screen.height);
      const input = new InputController(window);
      const tileRenderer = new TileGridRenderer({ tileSize: TILE_SIZE });
      world.addChild(tileRenderer.container);

      const overlay = new Container();
      overlay.zIndex = 100;
      world.addChild(overlay);

      const interactablesLayer = new Container();
      interactablesLayer.zIndex = 200;
      world.addChild(interactablesLayer);

      const buildingsLayer = new Container();
      buildingsLayer.zIndex = 300;
      world.addChild(buildingsLayer);

      const blocksLayer = new Container();
      blocksLayer.zIndex = 250;
      world.addChild(blocksLayer);

      const ghostLayer = new Container();
      ghostLayer.zIndex = 800;
      world.addChild(ghostLayer);

      const avatar = new Avatar({ tileSize: TILE_SIZE, color: 0x66ccff });
      world.addChild(avatar.container);

      const dayNight = new DayNightOverlay({ width: app.screen.width, height: app.screen.height });
      app.stage.addChild(dayNight.container);
      const weather = new WeatherOverlay({ width: app.screen.width, height: app.screen.height });
      app.stage.addChild(weather.container);

      stateRef.current = {
        app, world, camera, input, tileRenderer, overlay, interactablesLayer,
        buildingsLayer, blocksLayer, ghostLayer, avatar, dayNight, weather,
        passability: null, gridW: 0, gridH: 0,
      };

      // Mouse handlers
      const onWheel = (e) => {
        e.preventDefault();
        const rect = app.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        camera.zoom(e.deltaY < 0 ? 1.12 : 0.89, mx, my);
      };
      const onMove = (e) => {
        const rect = app.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const wp = camera.screenToWorld(mx, my);
        const gx = Math.floor(wp.x / TILE_SIZE);
        const gy = Math.floor(wp.y / TILE_SIZE);
        setHoveredTile({ x: gx, y: gy });
      };
      const onDown = (e) => {
        if (e.button === 2) {
          stateRef.current.dragging = { x: e.clientX, y: e.clientY };
          // Independent ref read by the right-click delete handler. Not cleared
          // on mouseup so handler ordering can't lose the value.
          stateRef.current.rightDrag = { moved: 0 };
        }
      };
      const onUp = () => { stateRef.current.dragging = null; };
      const onDrag = (e) => {
        const d = stateRef.current.dragging;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        const rd = stateRef.current.rightDrag;
        if (rd) rd.moved += Math.abs(dx) + Math.abs(dy);
        if (!rd || rd.moved > RIGHT_CLICK_DRAG_THRESHOLD) {
          camera.pan(dx, dy);
        }
        d.x = e.clientX;
        d.y = e.clientY;
      };
      const onContext = (e) => e.preventDefault();
      app.canvas.addEventListener('wheel', onWheel, { passive: false });
      app.canvas.addEventListener('mousemove', onMove);
      app.canvas.addEventListener('mousedown', onDown);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('mousemove', onDrag);
      app.canvas.addEventListener('contextmenu', onContext);

      const onResize = () => {
        camera.setViewport(app.screen.width, app.screen.height);
        dayNight.resize(app.screen.width, app.screen.height);
        weather.resize(app.screen.width, app.screen.height);
      };
      window.addEventListener('resize', onResize);

      let last = performance.now();
      app.ticker.add(() => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const s = stateRef.current;
        if (!s.passability) return;
        // Avatar movement
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
        s.weather.update(dt);
        s.dayNight.update();
        setHour(s.dayNight.getHour());
        s.input.endFrame();

        // Update interactable hover (anomalies)
        const anomalies = s.anomalies || [];
        const near = findNearestInteractable(
          anomalies.map((an) => ({ ...an, x: an.grid_x, y: an.grid_y })),
          s.avatar.x, s.avatar.y, 1.8,
        );
        setHoveredInteractable(near?.item || null);
      });

      stateRef.current._cleanup = () => {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('mousemove', onDrag);
        app.canvas.removeEventListener('wheel', onWheel);
        app.canvas.removeEventListener('mousemove', onMove);
        app.canvas.removeEventListener('mousedown', onDown);
        app.canvas.removeEventListener('contextmenu', onContext);
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

  // Apply surface data to scene
  useEffect(() => {
    const s = stateRef.current;
    if (!s.app || !surface || surface.needs_initialization) return;
    const w = surface.width;
    const h = surface.height;
    s.gridW = w;
    s.gridH = h;
    s.tileRenderer.setGrid(surface.terrain, TERRAIN_META);

    // Deposits
    s.overlay.removeChildren();
    for (const d of (surface.deposits || [])) {
      const meta = DEPOSIT_META[d.resource_type || d.type] || { color: '#ffffff' };
      const g = new Graphics();
      g.circle(d.grid_x * TILE_SIZE + TILE_SIZE / 2, d.grid_y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.18);
      g.fill({ color: parseColor(meta.color), alpha: 0.9 });
      g.stroke({ width: 2, color: 0x000000, alpha: 0.4 });
      s.overlay.addChild(g);
    }

    // Anomalies
    s.interactablesLayer.removeChildren();
    s.anomalies = surface.anomalies || [];
    for (const an of s.anomalies) {
      const g = new Graphics();
      const cx = an.grid_x * TILE_SIZE + TILE_SIZE / 2;
      const cy = an.grid_y * TILE_SIZE + TILE_SIZE / 2;
      g.circle(cx, cy, TILE_SIZE * 0.42);
      g.stroke({ width: 3, color: 0xffd166, alpha: 0.9 });
      g.circle(cx, cy, TILE_SIZE * 0.22);
      g.fill({ color: 0xffd166, alpha: 0.7 });
      s.interactablesLayer.addChild(g);
    }

    // Buildings
    s.buildingsLayer.removeChildren();
    for (const b of (surface.buildings || [])) {
      const fp = b.footprint || surface.buildingFootprints?.[b.building_type] || { w: 1, h: 1 };
      const g = new Graphics();
      const dmg = b.condition != null ? b.condition : 1;
      const baseColor = dmg < 0.5 ? 0xb04030 : dmg < 0.85 ? 0xb09030 : 0x4a90d9;
      g.rect(b.grid_x * TILE_SIZE + 2, b.grid_y * TILE_SIZE + 2, fp.w * TILE_SIZE - 4, fp.h * TILE_SIZE - 4);
      g.fill({ color: baseColor, alpha: 0.75 });
      g.stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
      const label = new Text({
        text: (b.config?.name || b.building_type || '').slice(0, 14),
        style: { fontSize: 10, fill: 0xffffff, fontWeight: 'bold' },
      });
      label.position.set(b.grid_x * TILE_SIZE + 4, b.grid_y * TILE_SIZE + 4);
      const c = new Container();
      c.addChild(g);
      c.addChild(label);
      c.eventMode = 'static';
      c.cursor = 'pointer';
      s.buildingsLayer.addChild(c);
    }

    // Custom blocks
    s.blocksLayer.removeChildren();
    for (const blk of (surface.customBlocks || [])) {
      const meta = surface.blockTypes?.[blk.block_type];
      const color = meta?.blocks_movement ? 0xa0a0a0 : 0x707070;
      const g = new Graphics();
      g.rect(blk.grid_x * TILE_SIZE + 6, blk.grid_y * TILE_SIZE + 6, TILE_SIZE - 12, TILE_SIZE - 12);
      g.fill({ color, alpha: 0.7 });
      s.blocksLayer.addChild(g);
    }

    // Passability map
    s.passability = buildPassabilityMap({
      width: w, height: h,
      tileGrid: surface.terrain, tileMeta: TERRAIN_META,
      buildings: (surface.buildings || []).map((b) => ({
        ...b, footprint: b.footprint || surface.buildingFootprints?.[b.building_type] || { w: 1, h: 1 },
      })),
      blocks: surface.customBlocks || [],
      blockMeta: surface.blockTypes || {},
    });

    // Place avatar at landing_zone or center
    if (!s._avatarPlaced) {
      let placed = false;
      for (let y = 0; y < h && !placed; y++) {
        for (let x = 0; x < w && !placed; x++) {
          if (surface.terrain[y][x] === 'landing_zone') {
            s.avatar.setPosition(x + 0.5, y + 0.5);
            placed = true;
          }
        }
      }
      if (!placed) s.avatar.setPosition(w / 2, h / 2);
      s.camera.centerOn(s.avatar.x * TILE_SIZE, s.avatar.y * TILE_SIZE);
      s._avatarPlaced = true;
    }

    // Weather — prefer server payload, fallback to client constant
    const profile = surface.weather || WEATHER_BY_PLANET[surface.planet_type] || { type: 'none', intensity: 0, color: '#ffffff' };
    s.weather.setWeather(profile.type, profile.intensity, profile.color);

    // Server-driven day/night: align overlay clock to server time so all clients agree
    if (typeof surface.timeOfDay === 'number') {
      s.dayNight.t0 = performance.now() - (surface.timeOfDay / 24) * s.dayNight.cycleMs;
    }
  }, [surface]);

  // Helper: find a placed building whose footprint covers (gx, gy)
  const findBuildingAt = useCallback((gx, gy) => {
    const surf = surfaceRef.current;
    if (!surf) return null;
    return (surf.buildings || []).find((bb) => {
      if (bb.grid_x == null || bb.grid_y == null) return false;
      const fp = bb.footprint || surf.buildingFootprints?.[bb.building_type] || { w: 1, h: 1 };
      return gx >= bb.grid_x && gx < bb.grid_x + fp.w
          && gy >= bb.grid_y && gy < bb.grid_y + fp.h;
    }) || null;
  }, []);

  const findBlockAt = useCallback((gx, gy) => {
    const surf = surfaceRef.current;
    if (!surf) return null;
    return (surf.customBlocks || []).find((b) => b.grid_x === gx && b.grid_y === gy) || null;
  }, []);

  // Tile click → place building/block, remove block, or move/pick-up building
  useEffect(() => {
    const s = stateRef.current;
    if (!s.app || readOnly) return;
    const tileFromEvent = (e) => {
      const rect = s.app.canvas.getBoundingClientRect();
      const wp = s.camera.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      return { gx: Math.floor(wp.x / TILE_SIZE), gy: Math.floor(wp.y / TILE_SIZE) };
    };

    const onClick = async (e) => {
      if (e.button !== 0) return;
      const { gx, gy } = tileFromEvent(e);
      const sel = selectedToolRef.current;
      const t = toolRef.current;
      try {
        if (t.kind === 'remove') {
          const blk = findBlockAt(gx, gy);
          const bld = findBuildingAt(gx, gy);
          if (blk) {
            await coloniesApi.removeBlock(colonyId, blk.block_id);
            toast.success('Block removed');
            await reload();
          } else if (bld) {
            if (window.confirm(`Demolish ${bld.config?.name || bld.building_type}? This cannot be undone.`)) {
              await buildingsApi.demolish(bld.building_id);
              toast.success('Building demolished');
              setLastPlaced((lp) => (lp && lp.kind === 'building' && lp.id === bld.building_id ? null : lp));
              await reload();
            }
          } else {
            toast.info('Nothing here to remove');
          }
          return;
        }
        if (t.kind === 'block' && t.payload) {
          const res = await coloniesApi.placeBlock(colonyId, { block_type: t.payload, grid_x: gx, grid_y: gy });
          const blockId = res?.data?.data?.block_id || res?.data?.data?.block?.block_id;
          toast.success(`${t.payload} placed`);
          if (blockId) setLastPlaced({ kind: 'block', id: blockId, ts: Date.now() });
          await reload();
          return;
        }
        if (sel?.building_id) {
          const res = await coloniesApi.moveBuilding(colonyId, sel.building_id, gx, gy);
          const bid = res?.data?.data?.building?.building_id || sel.building_id;
          toast.success('Building placed');
          setLastPlaced({ kind: 'building', id: bid, ts: Date.now() });
          await reload();
          setSelectedTool(null);
          return;
        }
        if (sel?.key) {
          const res = await coloniesApi.placeBuilding(colonyId, sel.key, gx, gy);
          const bid = res?.data?.data?.building_id;
          toast.success(`${sel.name} placed`);
          if (bid) setLastPlaced({ kind: 'building', id: bid, ts: Date.now() });
          await reload();
          setSelectedTool(null);
          return;
        }
        // No tool active: clicking a placed building picks it up so it can be moved
        const bld = findBuildingAt(gx, gy);
        if (bld) {
          const fp = bld.footprint || surfaceRef.current?.buildingFootprints?.[bld.building_type] || { w: 1, h: 1 };
          setSelectedTool({
            building_id: bld.building_id,
            building_type: bld.building_type,
            footprint: fp,
            name: bld.config?.name || bld.building_type,
          });
          toast.info('Click a tile to relocate, or press Esc to cancel');
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Action failed');
      }
    };

    const onAuxUp = async (e) => {
      // Right-click (no drag) → remove. Read movement from a dedicated ref so
      // the global pan-mouseup handler can't race-clear it.
      if (e.button !== 2) return;
      const rd = s.rightDrag;
      s.rightDrag = null;
      const moved = rd ? rd.moved : 0;
      if (moved > RIGHT_CLICK_DRAG_THRESHOLD) return;
      const { gx, gy } = tileFromEvent(e);
      try {
        const blk = findBlockAt(gx, gy);
        const bld = findBuildingAt(gx, gy);
        if (blk) {
          await coloniesApi.removeBlock(colonyId, blk.block_id);
          toast.success('Block removed');
          await reload();
        } else if (bld) {
          if (window.confirm(`Demolish ${bld.config?.name || bld.building_type}? This cannot be undone.`)) {
            await buildingsApi.demolish(bld.building_id);
            toast.success('Building demolished');
            setLastPlaced((lp) => (lp && lp.kind === 'building' && lp.id === bld.building_id ? null : lp));
            await reload();
          }
        } else {
          toast.info('Nothing here to remove');
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Remove failed');
      }
    };

    s.app.canvas.addEventListener('click', onClick);
    s.app.canvas.addEventListener('mouseup', onAuxUp);
    return () => {
      s.app.canvas.removeEventListener('click', onClick);
      s.app.canvas.removeEventListener('mouseup', onAuxUp);
    };
  }, [colonyId, reload, readOnly, toast, findBuildingAt, findBlockAt]);

  // Undo handler — works for buildings (server endpoint) and blocks (remove).
  const undoLast = useCallback(async () => {
    if (!lastPlaced) return;
    if (Date.now() - lastPlaced.ts > UNDO_WINDOW_MS) {
      setLastPlaced(null);
      toast.info('Undo window expired');
      return;
    }
    try {
      if (lastPlaced.kind === 'building') {
        await coloniesApi.undoPlacement(colonyId, lastPlaced.id);
        toast.success('Placement undone');
      } else {
        await coloniesApi.removeBlock(colonyId, lastPlaced.id);
        toast.success('Block removed');
      }
      setLastPlaced(null);
      await reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Undo failed');
    }
  }, [lastPlaced, colonyId, reload, toast]);

  // Keyboard: Ctrl/Cmd+Z → undo, Esc → clear active tool
  useEffect(() => {
    const onKey = (e) => {
      if (readOnly) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoLast();
        return;
      }
      if (e.key === 'Escape') {
        setSelectedTool(null);
        setTool({ kind: 'none' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undoLast, readOnly]);

  // Footprint / block ghost preview that follows the hovered tile
  useEffect(() => {
    const s = stateRef.current;
    if (!s.ghostLayer) return;
    s.ghostLayer.removeChildren();
    if (!hoveredTile || readOnly || !surface) return;
    let fp = null;
    let valid = true;
    if (selectedTool?.key) {
      fp = surface.buildingFootprints?.[selectedTool.key] || { w: selectedTool.footprintW || 1, h: selectedTool.footprintH || 1 };
    } else if (selectedTool?.building_id) {
      fp = selectedTool.footprint || { w: 1, h: 1 };
    } else if (tool.kind === 'block') {
      fp = { w: 1, h: 1 };
    } else if (tool.kind === 'remove') {
      fp = { w: 1, h: 1 };
    }
    if (!fp) return;
    if (s.passability) {
      for (let dy = 0; dy < fp.h; dy++) {
        for (let dx = 0; dx < fp.w; dx++) {
          if (!isPassable(s.passability, s.gridW, s.gridH, hoveredTile.x + dx, hoveredTile.y + dy)) {
            valid = false;
          }
        }
      }
    }
    if (tool.kind === 'remove') {
      const hasBlock = (surface.customBlocks || []).some((b) => b.grid_x === hoveredTile.x && b.grid_y === hoveredTile.y);
      const hasBuilding = (surface.buildings || []).some((bb) => {
        if (bb.grid_x == null || bb.grid_y == null) return false;
        const bfp = bb.footprint || surface.buildingFootprints?.[bb.building_type] || { w: 1, h: 1 };
        return hoveredTile.x >= bb.grid_x && hoveredTile.x < bb.grid_x + bfp.w
            && hoveredTile.y >= bb.grid_y && hoveredTile.y < bb.grid_y + bfp.h;
      });
      valid = hasBlock || hasBuilding;
    }
    const g = new Graphics();
    g.rect(hoveredTile.x * TILE_SIZE, hoveredTile.y * TILE_SIZE, fp.w * TILE_SIZE, fp.h * TILE_SIZE);
    g.fill({ color: valid ? 0x44ff88 : 0xff4444, alpha: 0.28 });
    g.stroke({ width: 2, color: valid ? 0x44ff88 : 0xff4444, alpha: 0.85 });
    s.ghostLayer.addChild(g);
  }, [hoveredTile, selectedTool, tool, surface, readOnly]);

  // Compute adjacency bonus hint for whatever's at the hovered tile
  const adjacencyHint = (() => {
    if (!hoveredTile || !surface?.adjacencyBonuses) return null;
    const b = (surface.buildings || []).find((bb) => {
      const fp = bb.footprint || surface.buildingFootprints?.[bb.building_type] || { w: 1, h: 1 };
      return hoveredTile.x >= bb.grid_x && hoveredTile.x < bb.grid_x + fp.w
          && hoveredTile.y >= bb.grid_y && hoveredTile.y < bb.grid_y + fp.h;
    });
    if (!b) return null;
    const rules = surface.adjacencyBonuses[b.building_type];
    if (!rules) return null;
    const parts = Object.entries(rules).map(([k, v]) => `${k}: ×${v}`).join(' • ');
    return `${b.config?.name || b.building_type} bonuses → ${parts}`;
  })();

  // E key — claim anomaly
  useEffect(() => {
    const onKey = async (e) => {
      if (e.key.toLowerCase() !== 'e') return;
      if (!hoveredInteractable) return;
      try {
        await coloniesApi.claimAnomaly(colonyId, hoveredInteractable.anomaly_id);
        toast.success('Anomaly claimed!');
        await reload();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Claim failed');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hoveredInteractable, colonyId, reload, toast]);

  const initSurface = async () => {
    setInitializing(true);
    try {
      await coloniesApi.initializeSurface(colonyId);
      toast.success('Surface initialized');
      await reload();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Initialization failed');
    } finally {
      setInitializing(false);
    }
  };

  const repairAll = async () => {
    try {
      await coloniesApi.repairBuildings(colonyId, { all: true });
      toast.success('Buildings repaired');
      await reload();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Repair failed');
    }
  };

  const damagedCount = (surface?.buildings || []).filter((b) => (b.condition ?? 1) < 1).length;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-space-950">
        <div className="flex items-center gap-2 text-gray-400"><Loader className="w-5 h-5 animate-spin" /> Loading surface...</div>
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

  return (
    <div className="h-screen flex flex-col bg-space-950 text-white relative">
      <div className="flex items-center justify-between px-3 py-2 border-b border-space-700 bg-space-900/80 z-20">
        <button onClick={() => navigate('/colonies')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Colonies
        </button>
        <div className="text-sm">
          <span className="font-semibold">{surface?.colony?.name || 'Surface'}</span>
          <span className="text-gray-500 ml-2">{surface?.planet_type}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {hour < 6 || hour > 18
            ? <span className="flex items-center gap-1"><Cloud className="w-3 h-3" /> Night {Math.floor(hour)}h</span>
            : <span className="flex items-center gap-1"><Sun className="w-3 h-3" /> Day {Math.floor(hour)}h</span>}
        </div>
      </div>

      <div ref={hostRef} className="flex-1 relative overflow-hidden">
        {surface?.needs_initialization && (
          <div className="absolute inset-0 bg-space-950/90 flex items-center justify-center z-30">
            <div className="bg-space-900 border border-accent-cyan/40 rounded-lg p-6 max-w-md text-center">
              <Sparkles className="w-8 h-8 mx-auto mb-3 text-accent-cyan" />
              <h3 className="text-lg font-bold mb-2">Initialize Surface</h3>
              <p className="text-sm text-gray-400 mb-4">Generate the 2D surface map for this colony. Existing buildings will be auto-placed.</p>
              <button
                onClick={initSurface}
                disabled={initializing}
                className="px-4 py-2 rounded bg-accent-cyan text-space-950 font-semibold hover:bg-accent-cyan/80 disabled:opacity-50"
              >
                {initializing ? 'Initializing...' : 'Initialize'}
              </button>
            </div>
          </div>
        )}

        {!readOnly && surface && !surface.needs_initialization && buildingsCatalog && (
          <>
            <SurfaceToolbar
              buildings={buildingsCatalog}
              unplaced={surface.unplaced || []}
              selectedTool={selectedTool}
              onSelectTool={(t) => { setSelectedTool(t); setTool({ kind: 'none' }); }}
              onSelectUnplaced={(t) => { setSelectedTool(t); setTool({ kind: 'none' }); }}
              onRepairAll={repairAll}
              damagedCount={damagedCount}
            />
            {/* Block palette — bottom-left */}
            <div className="absolute left-2 bottom-2 bg-space-900/95 border border-space-700 rounded-lg p-2 z-10 max-w-[14rem]">
              <h3 className="text-xs font-bold text-gray-300 mb-1">Blocks ({(surface.customBlocks || []).length}/{surface.blockCap || '∞'})</h3>
              <div className="grid grid-cols-3 gap-1">
                {Object.entries(surface.blockTypes || {}).map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => { setTool({ kind: 'block', payload: key }); setSelectedTool(null); }}
                    title={`${key} — ${meta.cost}cr • ${meta.hp}hp`}
                    className={`px-1 py-1 text-[10px] rounded border ${
                      tool.kind === 'block' && tool.payload === key
                        ? 'bg-accent-cyan/20 border-accent-cyan text-accent-cyan'
                        : 'bg-space-800 border-space-600 text-gray-400 hover:text-white'
                    }`}
                  >{key}</button>
                ))}
              </div>
              <button
                onClick={() => { setTool(tool.kind === 'remove' ? { kind: 'none' } : { kind: 'remove' }); setSelectedTool(null); }}
                className={`mt-1 w-full px-2 py-1 text-[10px] rounded border ${
                  tool.kind === 'remove'
                    ? 'bg-red-900/40 border-red-500 text-red-200'
                    : 'bg-space-800 border-space-600 text-gray-400 hover:text-white'
                }`}
              >Remove tool</button>
            </div>
          </>
        )}

        {hoveredInteractable && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-space-900/90 border border-accent-yellow/50 rounded px-3 py-2 text-xs text-accent-yellow z-10">
            Press <kbd className="px-1 bg-space-700 rounded">E</kbd> to claim {hoveredInteractable.type?.replace(/_/g, ' ')}
          </div>
        )}

        {toast.msg && (
          <div className={`absolute top-12 left-1/2 -translate-x-1/2 px-3 py-2 rounded text-xs z-30 border ${
            toast.msg.kind === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-emerald-200'
            : toast.msg.kind === 'error' ? 'bg-red-900/90 border-red-500 text-red-200'
            : 'bg-space-900/90 border-space-600 text-gray-200'
          }`}>{toast.msg.text}</div>
        )}

        <div className="absolute bottom-2 right-2 text-[10px] text-gray-500 bg-space-900/70 px-2 py-1 rounded">
          WASD move • Right-drag pan • Wheel zoom • Right-click delete • Ctrl+Z undo • Esc cancel • E interact
        </div>

        {!readOnly && canUndo && (
          <button
            onClick={undoLast}
            className="absolute top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded bg-amber-900/90 border border-amber-500 text-amber-100 text-xs hover:bg-amber-800/90 z-30"
            title="Undo last placement (Ctrl+Z)"
          >
            <Undo2 className="w-3 h-3" />
            Undo {lastPlaced.kind} ({Math.ceil(undoRemainingMs / 1000)}s)
          </button>
        )}

        {!readOnly && selectedTool?.building_id && (
          <div className="absolute top-12 left-2 bg-space-900/95 border border-accent-orange/50 rounded px-2 py-1 text-[10px] text-accent-orange z-10">
            Moving: {selectedTool.name || selectedTool.building_type} — click a tile (Esc cancel)
          </div>
        )}

        {hoveredTile && (
          <div className="absolute top-12 right-2 bg-space-900/85 border border-space-700 rounded px-2 py-1 text-[10px] text-gray-300 max-w-xs text-right">
            <div>
              ({hoveredTile.x}, {hoveredTile.y})
              {surface?.terrain?.[hoveredTile.y]?.[hoveredTile.x] && (
                <span className="ml-1 text-gray-400">{TERRAIN_META[surface.terrain[hoveredTile.y][hoveredTile.x]]?.label}</span>
              )}
            </div>
            {adjacencyHint && <div className="text-accent-cyan mt-0.5">{adjacencyHint}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
