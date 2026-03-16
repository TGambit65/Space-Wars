import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Application, Container, Graphics, Text as PixiText } from 'pixi.js';
import { groundCombatApi } from '../../services/api';

const TILE_SIZE = 24;

const TERRAIN_COLORS = {
  plains: 0x4a7c59, rocky: 0x7c6e5a, water: 0x3a6b8c, lava: 0xc44d2e,
  ice: 0xa8c8d8, sand: 0xc4a94d, highland: 0x5a5a5a, crystal: 0x8a4d9e,
  swamp: 0x4a5c3a, volcanic_vent: 0xe06030, landing_zone: 0x2a4a6a,
  metal_grating: 0x7a8a8a, open_sky: 0x1a3050
};

const UNIT_COLORS = {
  attacker: { active: 0xff4444, destroyed: 0x661111 },
  defender: { active: 0x44aaff, destroyed: 0x113366 }
};

const UNIT_TYPE_ICONS = {
  militia: 'M', marines: 'R', heavy_armor: 'H', mech: 'X', spec_ops: 'S'
};

export default function GroundCombatView({ user }) {
  const { instanceId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const appRef = useRef(null);

  const [combatState, setCombatState] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [orders, setOrders] = useState([]);
  const [turnLog, setTurnLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Layers
  const terrainLayerRef = useRef(null);
  const buildingLayerRef = useRef(null);
  const unitLayerRef = useRef(null);
  const overlayLayerRef = useRef(null);

  const fetchCombatState = useCallback(async () => {
    try {
      const res = await groundCombatApi.getCombatState(instanceId);
      setCombatState(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load combat state');
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    fetchCombatState();
  }, [fetchCombatState]);

  // Initialize PixiJS
  useEffect(() => {
    if (!canvasRef.current || !combatState?.terrain) return;

    const { width, height } = combatState.terrain;
    const pixelWidth = width * TILE_SIZE;
    const pixelHeight = height * TILE_SIZE;

    let app;
    let destroyed = false;

    (async () => {
      app = new Application();
      await app.init({
        width: Math.min(pixelWidth, 960),
        height: Math.min(pixelHeight, 640),
        backgroundColor: 0x0a0a1a,
        canvas: canvasRef.current
      });

      if (destroyed) { app.destroy(true, true); return; }
      appRef.current = app;

      // Create scrollable stage container
      const stage = new Container();
      app.stage.addChild(stage);

      const terrainLayer = new Container();
      const buildingLayer = new Container();
      const unitLayer = new Container();
      const overlayLayer = new Container();

      stage.addChild(terrainLayer);
      stage.addChild(buildingLayer);
      stage.addChild(unitLayer);
      stage.addChild(overlayLayer);

      terrainLayerRef.current = terrainLayer;
      buildingLayerRef.current = buildingLayer;
      unitLayerRef.current = unitLayer;
      overlayLayerRef.current = overlayLayer;

      // Render terrain
      renderTerrain(terrainLayer, combatState.terrain.grid, width, height);
      renderBuildings(buildingLayer, combatState.buildings);
      renderBlocks(buildingLayer, combatState.blocks);
      renderUnits(unitLayer, combatState.units);

      // Pan with drag
      let dragging = false;
      let dragStart = { x: 0, y: 0 };
      let stageStart = { x: 0, y: 0 };

      app.stage.eventMode = 'static';
      app.stage.hitArea = { contains: () => true };

      app.stage.on('pointerdown', (e) => {
        dragging = true;
        dragStart = { x: e.global.x, y: e.global.y };
        stageStart = { x: stage.x, y: stage.y };
      });
      app.stage.on('pointermove', (e) => {
        if (!dragging) return;
        stage.x = stageStart.x + (e.global.x - dragStart.x);
        stage.y = stageStart.y + (e.global.y - dragStart.y);
      });
      app.stage.on('pointerup', () => { dragging = false; });
      app.stage.on('pointerupoutside', () => { dragging = false; });
    })();

    return () => {
      destroyed = true;
      if (app) app.destroy(true, true);
      appRef.current = null;
    };
  }, [combatState?.terrain]);

  // Re-render units when state changes
  useEffect(() => {
    if (!unitLayerRef.current || !combatState?.units) return;
    unitLayerRef.current.removeChildren();
    renderUnits(unitLayerRef.current, combatState.units);
  }, [combatState?.units, selectedUnit]);

  // Re-render overlay when selection changes
  useEffect(() => {
    if (!overlayLayerRef.current || !combatState) return;
    overlayLayerRef.current.removeChildren();
    if (selectedUnit) {
      renderMovementRange(overlayLayerRef.current, selectedUnit, combatState);
    }
  }, [selectedUnit, combatState]);

  function renderTerrain(layer, grid, width, height) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const terrain = grid[y][x];
        const color = TERRAIN_COLORS[terrain] || 0x333333;
        const g = new Graphics();
        g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        g.fill(color);
        g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        g.stroke({ width: 0.5, color: 0x222222 });
        layer.addChild(g);
      }
    }
  }

  function renderBuildings(layer, buildings) {
    if (!buildings) return;
    for (const b of buildings) {
      const fp = b.footprint || { w: 1, h: 1 };
      const g = new Graphics();
      g.rect(b.grid_x * TILE_SIZE, b.grid_y * TILE_SIZE, fp.w * TILE_SIZE, fp.h * TILE_SIZE);
      g.fill({ color: 0x336699, alpha: 0.6 });
      g.rect(b.grid_x * TILE_SIZE, b.grid_y * TILE_SIZE, fp.w * TILE_SIZE, fp.h * TILE_SIZE);
      g.stroke({ width: 1, color: 0x4488bb });
      layer.addChild(g);

      const label = new PixiText({
        text: b.building_type.substring(0, 3).toUpperCase(),
        style: { fontSize: 8, fill: 0xccddee, fontFamily: 'monospace' }
      });
      label.x = b.grid_x * TILE_SIZE + 2;
      label.y = b.grid_y * TILE_SIZE + 2;
      layer.addChild(label);
    }
  }

  function renderBlocks(layer, blocks) {
    if (!blocks) return;
    for (const b of blocks) {
      const g = new Graphics();
      g.rect(b.grid_x * TILE_SIZE + 1, b.grid_y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      g.fill({ color: 0x888888, alpha: 0.5 });
      layer.addChild(g);
    }
  }

  function renderUnits(layer, units) {
    if (!units) return;
    for (const u of units) {
      if (u.status === 'destroyed') continue;

      const colors = UNIT_COLORS[u.side] || UNIT_COLORS.attacker;
      const isSelected = selectedUnit?.id === u.id;
      const color = u.status === 'active' ? colors.active : colors.destroyed;

      const g = new Graphics();
      // Unit circle
      const cx = u.grid_x * TILE_SIZE + TILE_SIZE / 2;
      const cy = u.grid_y * TILE_SIZE + TILE_SIZE / 2;
      g.circle(cx, cy, TILE_SIZE / 2 - 2);
      g.fill(color);
      if (isSelected) {
        g.circle(cx, cy, TILE_SIZE / 2 - 1);
        g.stroke({ width: 2, color: 0xffff00 });
      }

      // HP bar
      const hpPct = u.hp_remaining / u.hp_max;
      const barWidth = TILE_SIZE - 4;
      g.rect(u.grid_x * TILE_SIZE + 2, u.grid_y * TILE_SIZE - 4, barWidth, 3);
      g.fill(0x333333);
      g.rect(u.grid_x * TILE_SIZE + 2, u.grid_y * TILE_SIZE - 4, barWidth * hpPct, 3);
      g.fill(hpPct > 0.5 ? 0x44ff44 : hpPct > 0.25 ? 0xffaa00 : 0xff4444);

      g.eventMode = 'static';
      g.cursor = 'pointer';
      g.on('pointerdown', (e) => {
        e.stopPropagation();
        handleUnitClick(u);
      });

      layer.addChild(g);

      // Unit type label
      const icon = UNIT_TYPE_ICONS[u.unit_type] || '?';
      const label = new PixiText({
        text: icon,
        style: { fontSize: 10, fill: 0xffffff, fontFamily: 'monospace', fontWeight: 'bold' }
      });
      label.x = cx - 4;
      label.y = cy - 5;
      layer.addChild(label);
    }
  }

  function renderMovementRange(layer, unit, state) {
    if (!state?.terrain) return;
    const { width, height, grid } = state.terrain;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dist = Math.abs(x - unit.grid_x) + Math.abs(y - unit.grid_y);
        if (dist > 0 && dist <= unit.speed) {
          const g = new Graphics();
          g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          g.fill({ color: 0x44ff44, alpha: 0.2 });
          g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          g.stroke({ width: 1, color: 0x44ff44, alpha: 0.4 });

          g.eventMode = 'static';
          g.cursor = 'pointer';
          g.on('pointerdown', (e) => {
            e.stopPropagation();
            handleTileClick(x, y);
          });
          layer.addChild(g);
        }

        // Show attack range for enemies
        if (dist > 0 && dist <= unit.range) {
          const enemyOnTile = state.units.find(
            u => u.grid_x === x && u.grid_y === y && u.side !== unit.side && u.status === 'active'
          );
          if (enemyOnTile) {
            const g = new Graphics();
            g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            g.fill({ color: 0xff4444, alpha: 0.3 });
            g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            g.stroke({ width: 1, color: 0xff4444, alpha: 0.5 });

            g.eventMode = 'static';
            g.cursor = 'crosshair';
            g.on('pointerdown', (e) => {
              e.stopPropagation();
              handleAttackClick(enemyOnTile);
            });
            layer.addChild(g);
          }
        }
      }
    }
  }

  function handleUnitClick(unit) {
    // Only allow selecting own attacker units for live play
    if (unit.side === 'attacker' && unit.owner_user_id === user?.user_id && unit.status === 'active') {
      setSelectedUnit(selectedUnit?.id === unit.id ? null : unit);
    }
  }

  function handleTileClick(x, y) {
    if (!selectedUnit) return;
    setOrders(prev => [...prev.filter(o => o.unit_id !== selectedUnit.id), {
      unit_id: selectedUnit.id,
      action: 'move',
      target_x: x,
      target_y: y
    }]);
    setSelectedUnit(null);
  }

  function handleAttackClick(target) {
    if (!selectedUnit) return;
    setOrders(prev => [...prev.filter(o => o.unit_id !== selectedUnit.id), {
      unit_id: selectedUnit.id,
      action: 'attack',
      target_unit_id: target.id
    }]);
    setSelectedUnit(null);
  }

  async function submitTurn() {
    setSubmitting(true);
    try {
      const res = await groundCombatApi.processCombatTurn(instanceId, orders);
      const data = res.data.data;
      setTurnLog(data.turn_log || []);
      setOrders([]);
      setSelectedUnit(null);

      if (data.status === 'active') {
        await fetchCombatState();
      } else {
        setCombatState(prev => ({
          ...prev,
          instance: { ...prev.instance, status: data.status }
        }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit turn');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetreat() {
    if (!confirm('Are you sure you want to retreat? Your units will return to their ship.')) return;
    try {
      await groundCombatApi.retreat(instanceId);
      await fetchCombatState();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retreat');
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-cyan-400">Loading combat...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button className="btn btn-primary" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  if (!combatState) return null;

  const { instance, units } = combatState;
  const isResolved = ['attacker_won', 'defender_won', 'attacker_retreated'].includes(instance.status);
  const isAttacker = instance.attacker_id === user?.user_id;
  const activeAttackers = units.filter(u => u.side === 'attacker' && u.status === 'active');
  const activeDefenders = units.filter(u => u.side === 'defender' && u.status === 'active');

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 border-b border-cyan-900/30">
        <div className="flex items-center gap-4">
          <button className="btn btn-sm" onClick={() => navigate(-1)}>Back</button>
          <span className="text-cyan-400 font-bold">Ground Combat</span>
          <span className="text-sm text-gray-400">Turn {instance.turn_number}</span>
          <span className={`badge ${isResolved ? 'badge-yellow' : 'badge-green'}`}>
            {instance.status.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-red-400">Attackers: {activeAttackers.length}</span>
          <span className="text-blue-400">Defenders: {activeDefenders.length}</span>
          {!isResolved && isAttacker && (
            <>
              <button
                className="btn btn-sm btn-primary"
                onClick={submitTurn}
                disabled={submitting}
              >
                {submitting ? 'Processing...' : `End Turn (${orders.length} orders)`}
              </button>
              <button className="btn btn-sm text-red-400 border-red-400/30" onClick={handleRetreat}>
                Retreat
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative bg-gray-950">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>

        {/* Side panel */}
        <div className="w-72 bg-gray-900/80 border-l border-cyan-900/30 overflow-y-auto p-3">
          {/* Selected unit info */}
          {selectedUnit && (
            <div className="card mb-3 p-3">
              <h3 className="text-cyan-400 text-sm font-bold mb-2">
                {selectedUnit.unit_type.replace(/_/g, ' ').toUpperCase()}
              </h3>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">HP</span>
                  <span>{selectedUnit.hp_remaining}/{selectedUnit.hp_max}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Attack</span>
                  <span>{selectedUnit.attack}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Defense</span>
                  <span>{selectedUnit.defense}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Speed</span>
                  <span>{selectedUnit.speed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Range</span>
                  <span>{selectedUnit.range}</span>
                </div>
              </div>
            </div>
          )}

          {/* Pending orders */}
          {orders.length > 0 && (
            <div className="card mb-3 p-3">
              <h3 className="text-yellow-400 text-sm font-bold mb-2">
                Pending Orders ({orders.length})
              </h3>
              <div className="text-xs space-y-1">
                {orders.map((o, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span>{o.action === 'move' ? `Move → (${o.target_x},${o.target_y})` : 'Attack'}</span>
                    <button
                      className="text-red-400 hover:text-red-300"
                      onClick={() => setOrders(prev => prev.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="text-xs text-gray-400 mt-2 hover:text-white"
                onClick={() => setOrders([])}
              >
                Clear all
              </button>
            </div>
          )}

          {/* Turn log */}
          {turnLog.length > 0 && (
            <div className="card mb-3 p-3">
              <h3 className="text-orange-400 text-sm font-bold mb-2">Last Turn</h3>
              <div className="text-xs space-y-1 max-h-48 overflow-y-auto">
                {turnLog.map((entry, i) => (
                  <div key={i} className={`
                    ${entry.type === 'destroyed' ? 'text-red-400' : ''}
                    ${entry.type === 'attack' ? 'text-orange-300' : ''}
                    ${entry.type === 'move' ? 'text-gray-400' : ''}
                    ${entry.type === 'turret_fire' ? 'text-yellow-400' : ''}
                  `}>
                    {entry.type === 'attack' && `${entry.side || 'attacker'} deals ${entry.damage} dmg`}
                    {entry.type === 'destroyed' && `Unit destroyed (${entry.side})`}
                    {entry.type === 'move' && `${entry.side} moves to (${entry.to?.x},${entry.to?.y})`}
                    {entry.type === 'turret_fire' && `Turret fires: ${entry.damage} dmg`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unit roster */}
          <div className="card p-3">
            <h3 className="text-cyan-400 text-sm font-bold mb-2">Units</h3>
            <div className="space-y-2">
              {units.filter(u => u.status === 'active').map(u => (
                <div
                  key={u.id}
                  className={`flex items-center justify-between text-xs p-1 rounded cursor-pointer hover:bg-gray-800 ${
                    selectedUnit?.id === u.id ? 'bg-cyan-900/30 border border-cyan-500/30' : ''
                  }`}
                  onClick={() => handleUnitClick(u)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${u.side === 'attacker' ? 'bg-red-400' : 'bg-blue-400'}`} />
                    <span>{u.unit_type.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-gray-400">{u.hp_remaining}/{u.hp_max}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Combat result */}
          {isResolved && (
            <div className={`card mt-3 p-3 text-center ${
              instance.status === 'attacker_won' ? 'border-red-500/50' :
              instance.status === 'defender_won' ? 'border-blue-500/50' :
              'border-yellow-500/50'
            }`}>
              <h3 className="text-lg font-bold mb-1">
                {instance.status === 'attacker_won' && 'Colony Captured!'}
                {instance.status === 'defender_won' && 'Colony Defended!'}
                {instance.status === 'attacker_retreated' && 'Attacker Retreated'}
              </h3>
              <button className="btn btn-sm btn-primary mt-2" onClick={() => navigate(-1)}>
                Return
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
