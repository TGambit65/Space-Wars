import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { colonies as coloniesApi, buildings as buildingsApi, groundCombatApi } from '../../services/api';
import { TERRAIN_COLORS, isBuildable } from '../../utils/terrainGenerator';
import { useNotifications } from '../../contexts/NotificationContext';
import SurfaceToolbar from './SurfaceToolbar';
import { ArrowLeft, Sparkles, MapPin, RotateCcw, Blocks, Shield, Swords, Share2, Eye, Cloud, CloudOff, CheckCircle, Gift, ClipboardCopy } from 'lucide-react';

const TILE_SIZE = 20;

const BUILDING_CATEGORY_COLORS = {
  extraction: 0xf59e0b,
  infrastructure: 0x3b82f6,
  manufacturing: 0xeab308,
  defense: 0xef4444,
};

const ANOMALY_COLORS = {
  meteorite_debris: 0xff8844,
  smuggler_cache: 0xffcc00,
  alien_flora: 0x44ff88,
  mineral_vein: 0xcc88ff,
  escape_pod: 0x00ccff,
};

const COLOR_PRESETS = ['#cc4444', '#44cc44', '#4444cc', '#cccc44', '#cc44cc', '#44cccc', '#ff8844', '#8844ff', '#ffffff', '#444444'];

const BLOCK_COLORS = {
  wall:            0x8899aa,
  reinforced_wall: 0x667788,
  floor:           0x556655,
  window:          0x88bbdd,
  door:            0x886644,
  lamp:            0xffee88,
  antenna:         0x99aacc,
  turret_mount:    0xcc4444,
  barricade:       0x998855,
  storage_crate:   0x887766,
  road:            0x666655,
  path:            0x998866,
};

const WEATHER_MAP = {
  Terran: 'rain', Oceanic: 'rain', Jungle: 'rain',
  Desert: 'sandstorm', Barren: 'sandstorm',
  Volcanic: 'ash',
  Arctic: 'snow', Ice: 'snow',
  'Gas Giant': 'lightning',
  'Crystal World': 'sparkle', Crystalline: 'sparkle',
  'Tomb World': 'mist', Toxic: 'mist',
};

const CONSTRUCTION_DURATION_MS = 30000;

function ColonySurface({ user, readOnly = false }) {
  const { colonyId } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const layersRef = useRef({});
  const cameraRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 });

  const [surfaceData, setSurfaceData] = useState(null);
  const [buildingTypes, setBuildingTypes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTool, setSelectedTool] = useState(null);
  const [hoverTile, setHoverTile] = useState(null);
  const [buildMode, setBuildMode] = useState(false);
  const [selectedBlockType, setSelectedBlockType] = useState(null);
  const [selectedBlockColor, setSelectedBlockColor] = useState(null);
  const [showGarrison, setShowGarrison] = useState(false);
  const [garrison, setGarrison] = useState([]);
  const [defensePolicy, setDefensePolicy] = useState('hold_the_line');
  const [trainingUnit, setTrainingUnit] = useState(null);
  const [weatherEnabled, setWeatherEnabled] = useState(true);
  const [dailyQuests, setDailyQuests] = useState([]);
  const [showQuests, setShowQuests] = useState(false);
  const [shareTooltip, setShareTooltip] = useState(false);
  const notifications = useNotifications();

  // Load data
  const loadSurface = useCallback(async () => {
    try {
      const surfaceEndpoint = readOnly
        ? coloniesApi.getPublicSurface(colonyId)
        : coloniesApi.getSurface(colonyId);
      const [surfaceRes, typesRes] = await Promise.all([
        surfaceEndpoint,
        buildingsApi.getTypes(),
      ]);
      const data = surfaceRes.data.data || surfaceRes.data;
      setSurfaceData(data);

      const types = typesRes.data.data || typesRes.data;
      // Convert array or object to keyed object
      const typesObj = {};
      if (Array.isArray(types)) {
        for (const t of types) typesObj[t.building_type] = t;
      } else {
        Object.assign(typesObj, types);
      }
      setBuildingTypes(typesObj);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load surface');
    } finally {
      setLoading(false);
    }
  }, [colonyId, readOnly]);

  useEffect(() => { loadSurface(); }, [loadSurface]);

  // Load garrison data
  const loadGarrison = useCallback(async () => {
    if (!colonyId) return;
    try {
      const res = await groundCombatApi.getGarrison(colonyId);
      setGarrison(res.data.data || []);
    } catch (err) {
      // Silently fail — garrison panel is optional
    }
  }, [colonyId]);

  useEffect(() => {
    if (showGarrison) loadGarrison();
  }, [showGarrison, loadGarrison]);

  useEffect(() => {
    if (surfaceData?.colony?.defender_policy) {
      setDefensePolicy(surfaceData.colony.defender_policy);
    }
  }, [surfaceData?.colony?.defender_policy]);

  // Load daily quests
  const loadDailyQuests = useCallback(async () => {
    if (readOnly) return;
    try {
      const res = await coloniesApi.getDailyQuests();
      const data = res.data.data || res.data;
      setDailyQuests(Array.isArray(data) ? data : data.quests || []);
    } catch (err) {
      // Silently fail - daily quests are optional
    }
  }, [readOnly]);

  useEffect(() => {
    if (!readOnly) loadDailyQuests();
  }, [readOnly, loadDailyQuests]);

  const handleTrainUnit = async (unitType) => {
    setTrainingUnit(unitType);
    try {
      await groundCombatApi.trainUnit(colonyId, unitType);
      notifications.addNotification('success', `Training ${unitType.replace(/_/g, ' ')} started`);
      await loadGarrison();
    } catch (err) {
      notifications.addNotification('error', err.response?.data?.message || 'Failed to train unit');
    } finally {
      setTrainingUnit(null);
    }
  };

  const handleDisbandUnit = async (unitId) => {
    try {
      await groundCombatApi.disbandUnit(colonyId, unitId);
      notifications.addNotification('info', 'Unit disbanded');
      await loadGarrison();
    } catch (err) {
      notifications.addNotification('error', err.response?.data?.message || 'Failed to disband');
    }
  };

  const handleSetPolicy = async (policy) => {
    try {
      await groundCombatApi.setDefensePolicy(colonyId, policy);
      setDefensePolicy(policy);
      notifications.addNotification('success', `Defense policy set to ${policy.replace(/_/g, ' ')}`);
    } catch (err) {
      notifications.addNotification('error', err.response?.data?.message || 'Failed to set policy');
    }
  };

  // Initialize PixiJS app
  useEffect(() => {
    if (!containerRef.current || !surfaceData?.terrain) return;

    let destroyed = false;
    const app = new Application();

    (async () => {
      await app.init({
        resizeTo: containerRef.current,
        background: 0x0a0a1e,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (destroyed) { app.destroy(true, true); return; }

      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      // Create layer containers
      const worldContainer = new Container();
      const terrainLayer = new Container();
      const depositLayer = new Container();
      const blockLayer = new Container();
      const buildingLayer = new Container();
      const constructionLayer = new Container();
      const anomalyLayer = new Container();
      const gridOverlay = new Container();
      const ghostLayer = new Container();
      const weatherLayer = new Container();

      worldContainer.addChild(terrainLayer, depositLayer, blockLayer, buildingLayer, constructionLayer, anomalyLayer, gridOverlay, ghostLayer, weatherLayer);
      app.stage.addChild(worldContainer);

      layersRef.current = { worldContainer, terrainLayer, depositLayer, blockLayer, buildingLayer, constructionLayer, anomalyLayer, gridOverlay, ghostLayer, weatherLayer };

      // Center camera
      const gridW = surfaceData.width * TILE_SIZE;
      const gridH = surfaceData.height * TILE_SIZE;
      cameraRef.current.x = (app.screen.width - gridW) / 2;
      cameraRef.current.y = (app.screen.height - gridH) / 2;

      renderTerrain(terrainLayer, surfaceData.terrain, surfaceData.width, surfaceData.height);
      renderDeposits(depositLayer, surfaceData.deposits);
      renderBlocks(blockLayer, surfaceData.customBlocks || []);
      renderBuildings(buildingLayer, surfaceData.buildings || []);
      renderConstructionOverlays(constructionLayer, surfaceData.buildings || []);
      renderAnomalies(anomalyLayer, surfaceData.anomalies || []);
      renderGridOverlay(gridOverlay, surfaceData.width, surfaceData.height);

      // Initialize weather particles
      const weatherType = WEATHER_MAP[surfaceData.planet_type] || null;
      const weatherTicker = renderWeather(app, weatherLayer, weatherType, surfaceData.width * TILE_SIZE, surfaceData.height * TILE_SIZE);

      updateCamera();

      // Anomaly pulse animation + construction blink
      app.ticker.add(() => {
        if (destroyed) return;
        const t = Date.now() / 600;
        anomalyLayer.children.forEach(child => {
          if (child._isAnomaly) {
            child.alpha = 0.6 + 0.4 * Math.sin(t);
          }
        });
        // Blink construction overlays
        constructionLayer.children.forEach(child => {
          if (child._isConstruction) {
            child.alpha = 0.3 + 0.3 * Math.sin(t * 2);
          }
        });
      });

      if (weatherTicker) {
        app.ticker.add(weatherTicker);
      }
    })();

    return () => {
      destroyed = true;
      if (appRef.current) {
        appRef.current.destroy(true, true);
        appRef.current = null;
      }
    };
  }, [surfaceData?.terrain]); // only re-init on terrain change

  // Update buildings/anomalies/blocks when data changes (without recreating app)
  useEffect(() => {
    if (!appRef.current || !surfaceData || !layersRef.current.buildingLayer) return;
    const { buildingLayer, anomalyLayer, depositLayer, blockLayer, constructionLayer } = layersRef.current;
    buildingLayer.removeChildren();
    anomalyLayer.removeChildren();
    depositLayer.removeChildren();
    blockLayer.removeChildren();
    constructionLayer.removeChildren();
    renderBlocks(blockLayer, surfaceData.customBlocks || []);
    renderBuildings(buildingLayer, surfaceData.buildings || []);
    renderConstructionOverlays(constructionLayer, surfaceData.buildings || []);
    renderAnomalies(anomalyLayer, surfaceData.anomalies || []);
    renderDeposits(depositLayer, surfaceData.deposits || []);
  }, [surfaceData?.buildings, surfaceData?.anomalies, surfaceData?.deposits, surfaceData?.customBlocks]);

  // Render functions
  function renderTerrain(layer, terrain, width, height) {
    const g = new Graphics();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const type = terrain[y][x];
        const color = TERRAIN_COLORS[type] || '#333333';
        g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        g.fill(color);
      }
    }
    layer.addChild(g);
  }

  function renderDeposits(layer, deposits) {
    if (!deposits) return;
    const DEPOSIT_COLORS = {
      rich_ore: 0xff8844,
      crystal_vein: 0xcc66ff,
      fertile_soil: 0x66cc44,
      thermal_vent: 0xff4422,
    };
    for (const d of deposits) {
      const g = new Graphics();
      g.circle(d.grid_x * TILE_SIZE + TILE_SIZE / 2, d.grid_y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 3);
      g.fill({ color: DEPOSIT_COLORS[d.resource_type] || 0xffffff, alpha: 0.6 });
      g.stroke({ color: DEPOSIT_COLORS[d.resource_type] || 0xffffff, alpha: 0.9, width: 1 });
      layer.addChild(g);
    }
  }

  function renderBlocks(layer, blocks) {
    for (const b of blocks) {
      const baseColor = b.color ? parseInt(b.color.replace('#', ''), 16) : (BLOCK_COLORS[b.block_type] || 0x888888);
      const g = new Graphics();
      g.rect(b.grid_x * TILE_SIZE + 1, b.grid_y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      g.fill({ color: baseColor, alpha: 0.6 });
      g.stroke({ color: baseColor, width: 1, alpha: 0.9 });

      // Block type indicator
      if (b.block_type === 'road') {
        // Center line for road
        g.rect(b.grid_x * TILE_SIZE + TILE_SIZE / 2 - 1, b.grid_y * TILE_SIZE + 2, 2, TILE_SIZE - 4);
        g.fill({ color: 0xaaaa88, alpha: 0.5 });
        g.rect(b.grid_x * TILE_SIZE + 2, b.grid_y * TILE_SIZE + TILE_SIZE / 2 - 1, TILE_SIZE - 4, 2);
        g.fill({ color: 0xaaaa88, alpha: 0.5 });
      } else if (b.block_type === 'path') {
        // Dotted pattern for path
        for (let di = 0; di < 3; di++) {
          const dotX = b.grid_x * TILE_SIZE + 4 + di * 6;
          const dotY = b.grid_y * TILE_SIZE + TILE_SIZE / 2;
          g.circle(dotX, dotY, 1.5);
          g.fill({ color: 0xccbb99, alpha: 0.6 });
        }
      } else if (b.block_type === 'door') {
        g.rect(b.grid_x * TILE_SIZE + 4, b.grid_y * TILE_SIZE + TILE_SIZE / 2 - 1, TILE_SIZE - 8, 2);
        g.fill({ color: 0xffffff, alpha: 0.5 });
      } else if (b.block_type === 'lamp') {
        g.circle(b.grid_x * TILE_SIZE + TILE_SIZE / 2, b.grid_y * TILE_SIZE + TILE_SIZE / 2, 3);
        g.fill({ color: 0xffff88, alpha: 0.8 });
      } else if (b.block_type === 'turret_mount') {
        g.circle(b.grid_x * TILE_SIZE + TILE_SIZE / 2, b.grid_y * TILE_SIZE + TILE_SIZE / 2, 4);
        g.fill({ color: 0xff4444, alpha: 0.7 });
      }

      g.eventMode = 'static';
      g.cursor = 'pointer';
      g.on('rightclick', () => handleBlockRightClick(b));
      layer.addChild(g);
    }
  }

  function renderBuildings(layer, buildings) {
    for (const b of buildings) {
      if (b.grid_x === null || b.grid_y === null) continue;
      const fp = b.footprint || { w: 1, h: 1 };
      const catColor = BUILDING_CATEGORY_COLORS[b.config?.category] || 0x888888;
      const condition = b.condition || 1;

      const g = new Graphics();
      // Building body
      g.rect(b.grid_x * TILE_SIZE + 1, b.grid_y * TILE_SIZE + 1, fp.w * TILE_SIZE - 2, fp.h * TILE_SIZE - 2);
      g.fill({ color: catColor, alpha: 0.3 + condition * 0.4 });
      g.stroke({ color: catColor, width: condition < 0.5 ? 1 : 2, alpha: 0.8 });

      // Damage overlay
      if (condition < 0.75) {
        g.rect(b.grid_x * TILE_SIZE + 1, b.grid_y * TILE_SIZE + 1, fp.w * TILE_SIZE - 2, fp.h * TILE_SIZE - 2);
        g.fill({ color: 0xff0000, alpha: (1 - condition) * 0.3 });
      }

      layer.addChild(g);

      // Building label
      const label = new Text({
        text: (b.config?.name || b.building_type).substring(0, 6),
        style: new TextStyle({
          fontSize: 8,
          fill: 0xffffff,
          fontFamily: 'monospace',
        }),
      });
      label.x = b.grid_x * TILE_SIZE + 2;
      label.y = b.grid_y * TILE_SIZE + 2;
      layer.addChild(label);

      // Adjacency indicator
      if (b.cached_multiplier && b.cached_multiplier > 1.0) {
        const bonus = new Text({
          text: `x${b.cached_multiplier.toFixed(2)}`,
          style: new TextStyle({
            fontSize: 7,
            fill: 0x00ff88,
            fontFamily: 'monospace',
          }),
        });
        bonus.x = b.grid_x * TILE_SIZE + 2;
        bonus.y = b.grid_y * TILE_SIZE + fp.h * TILE_SIZE - 10;
        layer.addChild(bonus);
      }
    }
  }

  function renderAnomalies(layer, anomalies) {
    for (const a of anomalies) {
      const color = ANOMALY_COLORS[a.anomaly_type] || 0xffffff;
      const g = new Graphics();
      // Diamond shape
      const cx = a.grid_x * TILE_SIZE + TILE_SIZE / 2;
      const cy = a.grid_y * TILE_SIZE + TILE_SIZE / 2;
      const s = TILE_SIZE / 3;
      g.moveTo(cx, cy - s);
      g.lineTo(cx + s, cy);
      g.lineTo(cx, cy + s);
      g.lineTo(cx - s, cy);
      g.closePath();
      g.fill({ color, alpha: 0.8 });
      g.stroke({ color: 0xffffff, width: 1, alpha: 0.6 });
      g._isAnomaly = true;
      g.eventMode = 'static';
      g.cursor = 'pointer';
      g.on('pointerdown', () => handleAnomalyClick(a));
      layer.addChild(g);
    }
  }

  function renderGridOverlay(layer, width, height) {
    const g = new Graphics();
    for (let x = 0; x <= width; x++) {
      g.moveTo(x * TILE_SIZE, 0);
      g.lineTo(x * TILE_SIZE, height * TILE_SIZE);
    }
    for (let y = 0; y <= height; y++) {
      g.moveTo(0, y * TILE_SIZE);
      g.lineTo(width * TILE_SIZE, y * TILE_SIZE);
    }
    g.stroke({ color: 0xffffff, alpha: 0.08, width: 0.5 });
    layer.addChild(g);
  }

  function renderConstructionOverlays(layer, buildings) {
    const now = Date.now();
    for (const b of buildings) {
      if (b.grid_x === null || b.grid_y === null) continue;
      if (!b.placed_at) continue;
      const placedTime = new Date(b.placed_at).getTime();
      if (now - placedTime > CONSTRUCTION_DURATION_MS) continue;

      const fp = b.footprint || { w: 1, h: 1 };
      const px = b.grid_x * TILE_SIZE;
      const py = b.grid_y * TILE_SIZE;
      const pw = fp.w * TILE_SIZE;
      const ph = fp.h * TILE_SIZE;

      // Striped yellow/black overlay
      const g = new Graphics();
      const stripeWidth = 4;
      for (let s = -pw; s < pw + ph; s += stripeWidth * 2) {
        g.moveTo(px + Math.max(0, s), py + Math.max(0, -s));
        g.lineTo(px + Math.min(pw, s + stripeWidth * 2), py + Math.min(ph, -s + stripeWidth * 2));
      }
      g.stroke({ color: 0xffcc00, alpha: 0.3, width: stripeWidth });

      // Semi-transparent overlay
      g.rect(px + 1, py + 1, pw - 2, ph - 2);
      g.fill({ color: 0x000000, alpha: 0.2 });
      g._isConstruction = true;
      layer.addChild(g);

      // "BUILDING..." label
      const label = new Text({
        text: 'BUILDING...',
        style: new TextStyle({
          fontSize: 7,
          fill: 0xffcc00,
          fontFamily: 'monospace',
          fontWeight: 'bold',
        }),
      });
      label.x = px + 2;
      label.y = py + ph / 2 - 4;
      label._isConstruction = true;
      layer.addChild(label);
    }
  }

  function renderWeather(app, layer, weatherType, gridWidth, gridHeight) {
    if (!weatherType) return null;

    const particles = [];
    const particleCount = weatherType === 'lightning' ? 1 : 80;

    for (let i = 0; i < particleCount; i++) {
      const g = new Graphics();
      const px = Math.random() * gridWidth;
      const py = Math.random() * gridHeight;

      switch (weatherType) {
        case 'rain': {
          g.moveTo(0, 0);
          g.lineTo(-3, 8);
          g.stroke({ color: 0x6688cc, alpha: 0.3, width: 1 });
          break;
        }
        case 'sandstorm': {
          g.moveTo(0, 0);
          g.lineTo(6, 0);
          g.stroke({ color: 0xccaa66, alpha: 0.25, width: 1 });
          break;
        }
        case 'ash': {
          g.circle(0, 0, 1.5);
          g.fill({ color: 0x888888, alpha: 0.3 });
          break;
        }
        case 'snow': {
          g.circle(0, 0, 1.5);
          g.fill({ color: 0xddddff, alpha: 0.4 });
          break;
        }
        case 'sparkle': {
          g.circle(0, 0, 1);
          g.fill({ color: 0xffffff, alpha: 0.5 });
          break;
        }
        case 'mist': {
          g.circle(0, 0, 8 + Math.random() * 8);
          g.fill({ color: 0x8899aa, alpha: 0.08 });
          break;
        }
        case 'lightning': {
          g.rect(0, 0, gridWidth, gridHeight);
          g.fill({ color: 0xffffff, alpha: 0 });
          break;
        }
        default:
          break;
      }

      g.x = px;
      g.y = py;
      layer.addChild(g);
      particles.push({
        gfx: g,
        x: px,
        y: py,
        speedX: weatherType === 'sandstorm' ? (1 + Math.random() * 2) : (weatherType === 'rain' ? -0.5 : 0),
        speedY: weatherType === 'rain' ? (2 + Math.random()) : (weatherType === 'snow' ? (0.3 + Math.random() * 0.5) : (weatherType === 'ash' ? (0.5 + Math.random() * 0.5) : 0)),
        phase: Math.random() * Math.PI * 2,
      });
    }

    let flashTimer = 0;

    return (delta) => {
      if (!layer.visible) return;

      if (weatherType === 'lightning') {
        flashTimer -= delta;
        if (flashTimer <= 0) {
          const p = particles[0];
          if (p) {
            p.gfx.clear();
            p.gfx.rect(0, 0, gridWidth, gridHeight);
            p.gfx.fill({ color: 0xccccff, alpha: 0.15 });
            setTimeout(() => {
              if (p.gfx) {
                p.gfx.clear();
                p.gfx.rect(0, 0, gridWidth, gridHeight);
                p.gfx.fill({ color: 0xffffff, alpha: 0 });
              }
            }, 80);
          }
          flashTimer = 180 + Math.random() * 300; // frames between flashes
        }
        return;
      }

      if (weatherType === 'sparkle') {
        for (const p of particles) {
          p.phase += 0.03;
          p.gfx.alpha = 0.1 + 0.5 * Math.abs(Math.sin(p.phase));
          // Occasionally relocate
          if (Math.random() < 0.005) {
            p.gfx.x = Math.random() * gridWidth;
            p.gfx.y = Math.random() * gridHeight;
          }
        }
        return;
      }

      if (weatherType === 'mist') {
        for (const p of particles) {
          p.x += 0.15;
          p.phase += 0.005;
          p.gfx.x = p.x;
          p.gfx.alpha = 0.04 + 0.06 * Math.sin(p.phase);
          if (p.x > gridWidth + 20) {
            p.x = -20;
            p.gfx.x = p.x;
          }
        }
        return;
      }

      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.y > gridHeight) { p.y = -10; p.x = Math.random() * gridWidth; }
        if (p.x > gridWidth) { p.x = -10; }
        if (p.x < -10) { p.x = gridWidth; }
        p.gfx.x = p.x;
        p.gfx.y = p.y;
      }
    };
  }

  function updateCamera() {
    if (!layersRef.current.worldContainer) return;
    const { x, y, scale } = cameraRef.current;
    layersRef.current.worldContainer.x = x;
    layersRef.current.worldContainer.y = y;
    layersRef.current.worldContainer.scale.set(scale);
  }

  // Pre-compute occupied tile set for O(1) overlap checks during mousemove
  const occupiedTiles = useMemo(() => {
    const set = new Set();
    for (const b of (surfaceData?.buildings || [])) {
      if (b.grid_x === null) continue;
      const bfp = b.footprint || { w: 1, h: 1 };
      for (let dy = 0; dy < bfp.h; dy++) {
        for (let dx = 0; dx < bfp.w; dx++) {
          set.add(`${b.grid_x + dx},${b.grid_y + dy}`);
        }
      }
    }
    return set;
  }, [surfaceData?.buildings]);

  function tileOverlapsBuilding(tx, ty) {
    return occupiedTiles.has(`${tx},${ty}`);
  }

  // Ghost footprint rendering (buildings and blocks)
  useEffect(() => {
    if (!appRef.current || !layersRef.current.ghostLayer || !surfaceData?.terrain) return;
    const ghostLayer = layersRef.current.ghostLayer;
    ghostLayer.removeChildren();

    if (hoverTile === null) return;

    const gx = hoverTile.x;
    const gy = hoverTile.y;

    // Block placement ghost
    if (buildMode && selectedBlockType) {
      let valid = true;
      if (gx < 0 || gx >= surfaceData.width || gy < 0 || gy >= surfaceData.height) valid = false;
      else if (!isBuildable(surfaceData.terrain[gy]?.[gx])) valid = false;
      else {
        for (const b of (surfaceData.customBlocks || [])) {
          if (b.grid_x === gx && b.grid_y === gy) { valid = false; break; }
        }
        if (valid && selectedBlockType !== 'floor') {
          valid = !tileOverlapsBuilding(gx, gy);
        }
      }

      const color = selectedBlockColor ? parseInt(selectedBlockColor.replace('#', ''), 16) : (BLOCK_COLORS[selectedBlockType] || 0x888888);
      const g = new Graphics();
      g.rect(gx * TILE_SIZE, gy * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      g.fill({ color: valid ? color : 0xff0000, alpha: 0.35 });
      g.stroke({ color: valid ? 0x00ff00 : 0xff0000, width: 2, alpha: 0.7 });
      ghostLayer.addChild(g);
      return;
    }

    // Building placement ghost
    if (!selectedTool) return;

    const fp = selectedTool.footprint || { w: 1, h: 1 };

    let valid = true;
    for (let dy = 0; dy < fp.h && valid; dy++) {
      for (let dx = 0; dx < fp.w && valid; dx++) {
        const tx = gx + dx;
        const ty = gy + dy;
        if (tx >= surfaceData.width || ty >= surfaceData.height) { valid = false; break; }
        if (!isBuildable(surfaceData.terrain[ty]?.[tx])) { valid = false; break; }
        if (tileOverlapsBuilding(tx, ty)) { valid = false; break; }
      }
    }

    const g = new Graphics();
    g.rect(gx * TILE_SIZE, gy * TILE_SIZE, fp.w * TILE_SIZE, fp.h * TILE_SIZE);
    g.fill({ color: valid ? 0x00ff00 : 0xff0000, alpha: 0.25 });
    g.stroke({ color: valid ? 0x00ff00 : 0xff0000, width: 2, alpha: 0.7 });
    ghostLayer.addChild(g);
  }, [selectedTool, selectedBlockType, selectedBlockColor, buildMode, hoverTile, surfaceData]);

  // Mouse handlers
  const handleMouseDown = useCallback((e) => {
    if (e.button === 2 || e.button === 1) { // right or middle click = pan
      e.preventDefault();
      dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, camStartX: cameraRef.current.x, camStartY: cameraRef.current.y };
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (dragRef.current.dragging) {
      cameraRef.current.x = dragRef.current.camStartX + (e.clientX - dragRef.current.startX);
      cameraRef.current.y = dragRef.current.camStartY + (e.clientY - dragRef.current.startY);
      updateCamera();
    }

    // Update hover tile
    if (!appRef.current || !surfaceData) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cam = cameraRef.current;
    const worldX = (e.clientX - rect.left - cam.x) / cam.scale;
    const worldY = (e.clientY - rect.top - cam.y) / cam.scale;
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    if (tileX >= 0 && tileX < surfaceData.width && tileY >= 0 && tileY < surfaceData.height) {
      setHoverTile({ x: tileX, y: tileY });
    } else {
      setHoverTile(null);
    }
  }, [surfaceData]);

  const handleMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const cam = cameraRef.current;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.3, Math.min(5, cam.scale * delta));

    // Zoom toward cursor
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    cam.x = mx - (mx - cam.x) * (newScale / cam.scale);
    cam.y = my - (my - cam.y) * (newScale / cam.scale);
    cam.scale = newScale;
    updateCamera();
  }, []);

  const handleClick = useCallback(async (e) => {
    if (dragRef.current.dragging) return;
    if (!hoverTile || !surfaceData) return;

    // Block placement mode
    if (buildMode && selectedBlockType) {
      try {
        const data = { block_type: selectedBlockType, grid_x: hoverTile.x, grid_y: hoverTile.y };
        if (selectedBlockColor) data.color = selectedBlockColor;
        await coloniesApi.placeBlock(colonyId, data);
        notify('Block placed!', 'success');
        await loadSurface();
        loadDailyQuests();
      } catch (err) {
        notify(err.response?.data?.message || 'Block placement failed', 'error');
      }
      return;
    }

    // Building placement mode
    if (!selectedTool) return;
    const buildingType = selectedTool.building_id ? selectedTool.building_type : selectedTool.key;
    if (!buildingType) return;

    try {
      await coloniesApi.placeBuilding(colonyId, buildingType, hoverTile.x, hoverTile.y);
      notify('Building placed!', 'success');
      setSelectedTool(null);
      await loadSurface();
      loadDailyQuests();
    } catch (err) {
      notify(err.response?.data?.message || 'Placement failed', 'error');
    }
  }, [selectedTool, selectedBlockType, selectedBlockColor, buildMode, hoverTile, surfaceData, colonyId, loadSurface]);

  // Block right-click removal handler
  const handleBlockRightClick = useCallback(async (block) => {
    if (!buildMode) return;
    try {
      await coloniesApi.removeBlock(colonyId, block.block_id);
      notify('Block removed', 'info');
      await loadSurface();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to remove block', 'error');
    }
  }, [buildMode, colonyId, loadSurface]);

  // Anomaly click handler
  const handleAnomalyClick = useCallback(async (anomaly) => {
    try {
      const res = await coloniesApi.claimAnomaly(colonyId, anomaly.anomaly_id);
      const data = res.data.data || res.data;
      notify(`Claimed ${anomaly.anomaly_type}: ${data.description}`, 'success');
      await loadSurface();
      loadDailyQuests();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to claim anomaly', 'error');
    }
  }, [colonyId, loadSurface]);

  // Initialize surface
  const handleInitialize = async () => {
    try {
      setLoading(true);
      await coloniesApi.initializeSurface(colonyId);
      notify('Surface initialized! Rearrange your buildings for adjacency bonuses.', 'success');
      await loadSurface();
    } catch (err) {
      notify(err.response?.data?.message || 'Initialization failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Repair all
  const handleRepairAll = async () => {
    try {
      const res = await coloniesApi.repairBuildings(colonyId, { all: true });
      const data = res.data.data || res.data;
      notify(`Repaired ${data.repaired} buildings for ${data.total_cost} credits`, 'success');
      await loadSurface();
    } catch (err) {
      notify(err.response?.data?.message || 'Repair failed', 'error');
    }
  };

  // Select tool handlers
  const handleSelectTool = (bldg) => {
    const fp = surfaceData ? getFootprint(bldg.key || bldg.building_type) : { w: 1, h: 1 };
    setSelectedTool({ ...bldg, footprint: fp });
  };

  const handleSelectUnplaced = (bldg) => {
    setSelectedTool({ ...bldg });
  };

  function getFootprint(buildingType) {
    return surfaceData?.buildingFootprints?.[buildingType] || { w: 1, h: 1 };
  }

  function notify(message, type = 'info') {
    if (type === 'success') notifications.success(message);
    else if (type === 'error') notifications.error(message);
    else notifications.info(message);
  }

  const damagedCount = surfaceData?.buildings?.filter(b => b.condition < 1.0).length || 0;

  // Weather toggle
  useEffect(() => {
    if (layersRef.current.weatherLayer) {
      layersRef.current.weatherLayer.visible = weatherEnabled;
    }
  }, [weatherEnabled]);

  // Daily quest claim handler
  const handleClaimQuest = async (questId) => {
    try {
      await coloniesApi.claimDailyQuest(questId);
      notifications.success('Quest reward claimed!');
      await loadDailyQuests();
    } catch (err) {
      notifications.error(err.response?.data?.message || 'Failed to claim quest');
    }
  };

  // Share public URL
  const handleShare = () => {
    const publicUrl = `${window.location.origin}/colony/${colonyId}/surface/public`;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setShareTooltip(true);
      setTimeout(() => setShareTooltip(false), 2000);
    }).catch(() => {
      // Fallback - just show notification
      notifications.info(`Public URL: ${publicUrl}`);
    });
  };

  // Context menu prevention
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e) => e.preventDefault();
    el.addEventListener('contextmenu', prevent);
    return () => el.removeEventListener('contextmenu', prevent);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-accent-red">{error}</p>
        <button onClick={() => navigate('/colonies')} className="btn btn-secondary">Back to Colonies</button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" style={{ minHeight: '100vh' }}>
      {/* Read-only banner */}
      {readOnly && surfaceData?.colony && (
        <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
          <div className="flex items-center justify-center gap-2 bg-space-900/90 border-b border-accent-cyan/20 px-4 py-2 backdrop-blur-sm">
            <Eye className="w-4 h-4 text-accent-cyan" />
            <span className="text-sm text-gray-300">
              Viewing <span className="text-white font-medium">{surfaceData.colony.owner || 'Unknown'}</span>'s Colony
              — <span className="text-accent-cyan font-medium">{surfaceData.colony.name}</span>
            </span>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className={`absolute ${readOnly ? 'top-12' : 'top-2'} left-60 right-2 z-10 flex items-center gap-3 pointer-events-auto`}>
        <button
          onClick={() => navigate(readOnly ? '/colony-leaderboard' : '/colonies')}
          className="bg-space-900/90 border border-space-600/30 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors backdrop-blur-sm"
        >
          <ArrowLeft className="w-4 h-4" /> {readOnly ? 'Leaderboard' : 'Colonies'}
        </button>
        {surfaceData?.colony && (
          <div className="bg-space-900/90 border border-space-600/30 rounded-lg px-3 py-1.5 backdrop-blur-sm">
            <span className="text-sm font-bold text-white">{surfaceData.colony.name}</span>
            <span className="text-xs text-gray-400 ml-2">
              {surfaceData.planet_type} — {surfaceData.width}x{surfaceData.height}
            </span>
          </div>
        )}
        {hoverTile && surfaceData?.terrain && (
          <div className="bg-space-900/90 border border-space-600/30 rounded-lg px-3 py-1.5 backdrop-blur-sm">
            <span className="text-xs text-gray-400">
              <MapPin className="w-3 h-3 inline mr-1" />
              ({hoverTile.x}, {hoverTile.y}) — {surfaceData.terrain[hoverTile.y]?.[hoverTile.x]}
            </span>
          </div>
        )}
        {/* Weather toggle */}
        <button
          onClick={() => setWeatherEnabled(!weatherEnabled)}
          className={`bg-space-900/90 border rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 transition-colors backdrop-blur-sm ${
            weatherEnabled
              ? 'border-blue-500/40 text-blue-400'
              : 'border-space-600/30 text-gray-500'
          }`}
          title={weatherEnabled ? 'Hide weather' : 'Show weather'}
        >
          {weatherEnabled ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
          Weather
        </button>
        {!readOnly && selectedTool && (
          <button
            onClick={() => setSelectedTool(null)}
            className="bg-accent-red/20 border border-accent-red/50 rounded-lg px-3 py-1.5 text-xs text-accent-red hover:bg-accent-red/30 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Cancel
          </button>
        )}
        {!readOnly && !surfaceData?.needs_initialization && (
          <button
            onClick={() => { setBuildMode(!buildMode); setSelectedTool(null); setSelectedBlockType(null); }}
            className={`bg-space-900/90 border rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 transition-colors backdrop-blur-sm ${
              buildMode
                ? 'border-accent-cyan/50 text-accent-cyan bg-accent-cyan/10'
                : 'border-space-600/30 text-gray-300 hover:text-white'
            }`}
          >
            <Blocks className="w-3 h-3" /> {buildMode ? 'Exit Build' : 'Build Mode'}
          </button>
        )}
        {!readOnly && !surfaceData?.needs_initialization && (
          <button
            onClick={() => { setShowGarrison(!showGarrison); setBuildMode(false); }}
            className={`bg-space-900/90 border rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 transition-colors backdrop-blur-sm ${
              showGarrison
                ? 'border-orange-500/50 text-orange-400 bg-orange-500/10'
                : 'border-space-600/30 text-gray-300 hover:text-white'
            }`}
          >
            <Shield className="w-3 h-3" /> Garrison
          </button>
        )}
        {!readOnly && !surfaceData?.needs_initialization && (
          <button
            onClick={() => setShowQuests(!showQuests)}
            className={`bg-space-900/90 border rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 transition-colors backdrop-blur-sm ${
              showQuests
                ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10'
                : 'border-space-600/30 text-gray-300 hover:text-white'
            }`}
          >
            <Gift className="w-3 h-3" /> Quests
          </button>
        )}
        {/* Share button (only in owned view) */}
        {!readOnly && !surfaceData?.needs_initialization && (
          <div className="relative">
            <button
              onClick={handleShare}
              className="bg-space-900/90 border border-space-600/30 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 text-gray-300 hover:text-white transition-colors backdrop-blur-sm"
            >
              <Share2 className="w-3 h-3" /> Share
            </button>
            {shareTooltip && (
              <div className="absolute top-full mt-1 left-0 bg-accent-cyan/20 border border-accent-cyan/40 rounded px-2 py-1 text-[10px] text-accent-cyan whitespace-nowrap">
                <ClipboardCopy className="w-3 h-3 inline mr-1" /> Link copied!
              </div>
            )}
          </div>
        )}
        {surfaceData?.combat_active && (
          <span className="bg-red-900/50 border border-red-500/50 rounded-lg px-3 py-1.5 text-xs text-red-400 flex items-center gap-1">
            <Swords className="w-3 h-3" /> Combat Active
          </span>
        )}
      </div>

      {/* Toolbar */}
      {!readOnly && !surfaceData?.needs_initialization && !buildMode && (
        <SurfaceToolbar
          buildings={buildingTypes}
          unplaced={surfaceData?.unplaced}
          selectedTool={selectedTool}
          onSelectTool={handleSelectTool}
          onSelectUnplaced={handleSelectUnplaced}
          onRepairAll={handleRepairAll}
          damagedCount={damagedCount}
        />
      )}

      {/* Block Palette (Build Mode) */}
      {!readOnly && !surfaceData?.needs_initialization && buildMode && (
        <div className="absolute left-2 top-2 bottom-2 w-56 flex flex-col gap-2 pointer-events-auto z-10">
          <div className="bg-space-900/95 border border-accent-cyan/30 rounded-lg p-2 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-accent-cyan mb-1">Block Palette</h3>
            <div className="space-y-0.5">
              {surfaceData?.blockTypes && Object.entries(surfaceData.blockTypes).map(([key, bt]) => (
                <button
                  key={key}
                  onClick={() => setSelectedBlockType(selectedBlockType === key ? null : key)}
                  className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                    selectedBlockType === key
                      ? 'bg-accent-cyan/20 border border-accent-cyan/50 text-white'
                      : 'bg-space-800/50 hover:bg-space-700 text-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{key.replace(/_/g, ' ')}</span>
                    <span className="text-gray-500">{bt.cost}cr</span>
                  </div>
                  <div className="text-gray-500 text-[10px]">
                    HP: {bt.hp}
                    {bt.blocks_movement && ' | Blocks movement'}
                    {bt.half_cover && ' | Half cover'}
                    {bt.enables_turret && ' | Turret'}
                    {bt.light_radius && ` | Light: ${bt.light_radius}`}
                    {bt.sensor_range && ` | Sensor: ${bt.sensor_range}`}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div className="bg-space-900/95 border border-space-600/30 rounded-lg p-2 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-gray-400 mb-1">Color</h3>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedBlockColor(null)}
                className={`w-6 h-6 rounded border ${!selectedBlockColor ? 'border-white' : 'border-space-600'}`}
                style={{ background: 'linear-gradient(135deg, #666 50%, #888 50%)' }}
                title="Default"
              />
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedBlockColor(selectedBlockColor === c ? null : c)}
                  className={`w-6 h-6 rounded border ${selectedBlockColor === c ? 'border-white' : 'border-space-600'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Block count */}
          {surfaceData?.blockCap !== undefined && (
            <div className="bg-space-900/95 border border-space-600/30 rounded-lg p-2 backdrop-blur-sm text-xs text-gray-400">
              Blocks: {surfaceData.customBlocks?.length || 0} / {surfaceData.blockCap}
            </div>
          )}

          <div className="text-[10px] text-gray-500 px-1">
            Left-click to place, right-click to remove
          </div>
        </div>
      )}

      {/* Initialization prompt */}
      {!readOnly && surfaceData?.needs_initialization && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-auto">
          <div className="bg-space-900/95 border border-accent-cyan/30 rounded-xl p-8 max-w-md text-center backdrop-blur-sm">
            <Sparkles className="w-12 h-12 text-accent-cyan mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Initialize Colony Surface</h2>
            <p className="text-gray-400 text-sm mb-4">
              Transform your colony into a visual surface grid. Existing buildings will be auto-placed
              on the terrain. You can rearrange them afterward — first relocation is free!
            </p>
            <button
              onClick={handleInitialize}
              className="btn btn-primary px-6 py-2"
            >
              Initialize Surface
            </button>
          </div>
        </div>
      )}

      {/* Garrison Panel */}
      {!readOnly && showGarrison && !surfaceData?.needs_initialization && (
        <div className="absolute right-2 top-2 bottom-2 w-64 flex flex-col gap-2 pointer-events-auto z-10 overflow-y-auto">
          <div className="bg-space-900/95 border border-orange-500/30 rounded-lg p-3 backdrop-blur-sm">
            <h3 className="text-sm font-bold text-orange-400 mb-2 flex items-center gap-1">
              <Shield className="w-4 h-4" /> Garrison ({garrison.length}/50)
            </h3>

            {/* Defense Policy */}
            <div className="mb-3">
              <label className="text-[10px] text-gray-400 block mb-1">Defense Policy</label>
              <select
                value={defensePolicy}
                onChange={(e) => handleSetPolicy(e.target.value)}
                className="w-full bg-space-800 border border-space-600/30 rounded text-xs px-2 py-1 text-white"
              >
                <option value="hold_the_line">Hold the Line</option>
                <option value="aggressive">Aggressive</option>
                <option value="fallback_to_center">Fallback to Center</option>
                <option value="guerrilla">Guerrilla</option>
              </select>
            </div>

            {/* Train Unit */}
            <div className="mb-3">
              <label className="text-[10px] text-gray-400 block mb-1">Train Unit</label>
              <div className="space-y-1">
                {[
                  { key: 'militia', cost: 100, hp: 50, label: 'Militia' },
                  { key: 'marines', cost: 300, hp: 100, label: 'Marines' },
                  { key: 'heavy_armor', cost: 800, hp: 300, label: 'Heavy Armor' },
                  { key: 'mech', cost: 2000, hp: 500, label: 'Mech' },
                  { key: 'spec_ops', cost: 1500, hp: 80, label: 'Spec Ops' }
                ].map(ut => (
                  <button
                    key={ut.key}
                    onClick={() => handleTrainUnit(ut.key)}
                    disabled={trainingUnit === ut.key || surfaceData?.combat_active}
                    className="w-full text-left px-2 py-1 rounded text-xs bg-space-800/50 hover:bg-space-700 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex justify-between">
                      <span>{ut.label}</span>
                      <span className="text-gray-500">{ut.cost}cr</span>
                    </div>
                    <div className="text-[10px] text-gray-500">HP: {ut.hp}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Unit List */}
            {garrison.length > 0 && (
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Units</label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {garrison.map(u => (
                    <div key={u.unit_id} className="flex items-center justify-between text-xs p-1 bg-space-800/30 rounded">
                      <div>
                        <span className={u.is_trained ? 'text-green-400' : 'text-yellow-400'}>
                          {u.unit_type.replace(/_/g, ' ')}
                        </span>
                        {!u.is_trained && (
                          <span className="text-[10px] text-gray-500 ml-1">
                            Training: {Math.ceil(u.training_remaining_ms / 1000)}s
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">{u.hp_remaining}/{u.hp_max}</span>
                        <button
                          onClick={() => handleDisbandUnit(u.unit_id)}
                          className="text-red-400/50 hover:text-red-400 text-[10px]"
                          title="Disband"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Daily Quests Panel */}
      {!readOnly && showQuests && (
        <div className="absolute right-2 bottom-4 w-64 pointer-events-auto z-10">
          <div className="bg-space-900/95 border border-yellow-500/30 rounded-lg p-3 backdrop-blur-sm">
            <h3 className="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-1">
              <Gift className="w-4 h-4" /> Daily Quests
            </h3>
            {dailyQuests.length === 0 ? (
              <p className="text-xs text-gray-500">No active quests available.</p>
            ) : (
              <div className="space-y-2">
                {dailyQuests.map(quest => {
                  const progress = quest.current || 0;
                  const target = quest.target || 1;
                  const pct = Math.min((progress / target) * 100, 100);
                  const isComplete = progress >= target;
                  const isClaimed = quest.claimed || quest.status === 'claimed';

                  return (
                    <div key={quest.quest_id || quest.id} className="bg-space-800/50 rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white font-medium">{quest.title || quest.description}</span>
                        {isClaimed && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
                      </div>
                      {quest.description && quest.title && (
                        <p className="text-[10px] text-gray-500 mb-1">{quest.description}</p>
                      )}
                      {/* Progress bar */}
                      <div className="h-1.5 bg-space-700 rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            background: isClaimed ? '#4ade80' : isComplete ? '#facc15' : '#3b82f6',
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">{progress}/{target}</span>
                        {quest.reward && (
                          <span className="text-[10px] text-yellow-400">{quest.reward}</span>
                        )}
                      </div>
                      {isComplete && !isClaimed && (
                        <button
                          onClick={() => handleClaimQuest(quest.quest_id || quest.id)}
                          className="w-full mt-1 bg-yellow-500/20 border border-yellow-500/40 rounded px-2 py-1 text-[10px] text-yellow-400 hover:bg-yellow-500/30 transition-colors font-medium"
                        >
                          Claim Reward
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PixiJS canvas container */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '100vh', cursor: selectedTool ? 'crosshair' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
      />

    </div>
  );
}

export default ColonySurface;
