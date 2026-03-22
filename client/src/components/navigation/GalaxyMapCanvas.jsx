import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import useViewport from './hooks/useViewport';
import { FACTION_LABELS } from '../../constants/factions';

// Simple Quadtree for spatial indexing (optimized for 1200+ nodes)
class Quadtree {
  constructor(bounds, capacity = 8) {
    this.bounds = bounds; // { x, y, w, h }
    this.capacity = capacity;
    this.points = [];
    this.divided = false;
    this.nw = null; this.ne = null; this.sw = null; this.se = null;
  }

  insert(point) { // { x, y, data }
    if (!this._contains(point)) return false;
    if (this.points.length < this.capacity && !this.divided) {
      this.points.push(point);
      return true;
    }
    if (!this.divided) this._subdivide();
    return this.nw.insert(point) || this.ne.insert(point) || this.sw.insert(point) || this.se.insert(point);
  }

  query(range, found = []) { // range: { x, y, w, h }
    if (!this._intersects(range)) return found;
    for (const p of this.points) {
      if (p.x >= range.x && p.x <= range.x + range.w && p.y >= range.y && p.y <= range.y + range.h) {
        found.push(p);
      }
    }
    if (this.divided) {
      this.nw.query(range, found);
      this.ne.query(range, found);
      this.sw.query(range, found);
      this.se.query(range, found);
    }
    return found;
  }

  queryRadius(cx, cy, r) {
    const range = { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
    const candidates = this.query(range);
    const r2 = r * r;
    return candidates.filter(p => (p.x - cx) ** 2 + (p.y - cy) ** 2 <= r2);
  }

  _contains(p) {
    const b = this.bounds;
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  _intersects(range) {
    const b = this.bounds;
    return !(range.x > b.x + b.w || range.x + range.w < b.x || range.y > b.y + b.h || range.y + range.h < b.y);
  }

  _subdivide() {
    const { x, y, w, h } = this.bounds;
    const hw = w / 2, hh = h / 2;
    this.nw = new Quadtree({ x, y, w: hw, h: hh }, this.capacity);
    this.ne = new Quadtree({ x: x + hw, y, w: hw, h: hh }, this.capacity);
    this.sw = new Quadtree({ x, y: y + hh, w: hw, h: hh }, this.capacity);
    this.se = new Quadtree({ x: x + hw, y: y + hh, w: hw, h: hh }, this.capacity);
    for (const p of this.points) {
      this.nw.insert(p) || this.ne.insert(p) || this.sw.insert(p) || this.se.insert(p);
    }
    this.points = [];
    this.divided = true;
  }
}

// Star class colors
const STAR_COLORS = {
  O: '#6B8BFF', B: '#8BB5FF', A: '#D4E4FF', F: '#F8F0D0',
  G: '#FFE87A', K: '#FFB84D', M: '#FF6B4D',
  Neutron: '#E0E8FF', BlackHole: '#9B59B6'
};

// Sector type ring colors
const TYPE_COLORS = {
  Core: '#FFD700', Inner: '#00D4FF', Mid: '#FFFFFF',
  Outer: '#A855F7', Fringe: '#F97316', Unknown: '#6B7280'
};

const PHENOMENA_COLORS = {
  ion_storm: '#FFD700',
  nebula: '#9B59B6',
  asteroid_field: '#CD853F',
  solar_flare: '#FF4500',
  gravity_well: '#DC143C'
};

const STAR_SIZES = {
  Core: 8, Inner: 7, Mid: 6, Outer: 5, Fringe: 4, Unknown: 4
};

// Faction territory tint colors (RGBA with low alpha for subtle overlay)
const FACTION_TINT = {
  terran_alliance: '52, 152, 219',
  zythian_swarm: '231, 76, 60',
  automaton_collective: '155, 89, 182',
  synthesis_accord: '212, 160, 23',
  sylvari_dominion: '46, 204, 113'
};

const GalaxyMapCanvas = ({
  mapData,
  currentSectorId,
  adjacencyMap,
  onSystemClick,
  onSystemRightClick,
  selectedSystemId,
  userShipsBySector,
  onSelectionComplete,
  routePath = [],
  onCenterReady,
  highlightedSystemId,
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth - 256, height: window.innerHeight });
  const [hoveredSystem, setHoveredSystem] = useState(null);
  const animFrameRef = useRef(null);
  const timeRef = useRef(0);

  const {
    offset, zoom, isDragging,
    centerOn, handleWheel,
    handleMouseDown, handleMouseMove, handleMouseUp,
    worldToScreen, screenToWorld,
    setZoom,
    isSelecting, selectionRect, shiftHeld,
    setOnSelectionComplete
  } = useViewport(containerRef);

  // Build position lookup
  const systemPositions = useMemo(() => {
    if (!mapData?.systems) return new Map();
    const m = new Map();
    for (const sys of mapData.systems) {
      m.set(sys.sector_id, { x: sys.x_coord, y: sys.y_coord, ...sys });
    }
    return m;
  }, [mapData]);

  // Build quadtree spatial index for fast hit-testing at 1200+ nodes
  const quadtree = useMemo(() => {
    if (!mapData?.systems || mapData.systems.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const sys of mapData.systems) {
      if (sys.x_coord < minX) minX = sys.x_coord;
      if (sys.y_coord < minY) minY = sys.y_coord;
      if (sys.x_coord > maxX) maxX = sys.x_coord;
      if (sys.y_coord > maxY) maxY = sys.y_coord;
    }
    const pad = 50;
    const qt = new Quadtree({ x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 });
    for (const sys of mapData.systems) {
      qt.insert({ x: sys.x_coord, y: sys.y_coord, data: sys.sector_id });
    }
    return qt;
  }, [mapData]);

  // Wire up selection complete: pass screenToWorld and quadtree to parent callback
  useEffect(() => {
    if (!onSelectionComplete) return;
    setOnSelectionComplete((rect) => {
      onSelectionComplete(rect, screenToWorld, quadtree);
    });
  }, [onSelectionComplete, screenToWorld, quadtree, setOnSelectionComplete]);

  // Adjacent system IDs for current position
  const adjacentIds = useMemo(() => {
    if (!currentSectorId || !adjacencyMap.has(currentSectorId)) return new Set();
    return new Set(adjacencyMap.get(currentSectorId));
  }, [currentSectorId, adjacencyMap]);

  // Expose centerOn to parent
  useEffect(() => {
    if (onCenterReady) onCenterReady(centerOn);
  }, [centerOn, onCenterReady]);

  // Center on ship's position initially
  useEffect(() => {
    if (!currentSectorId || !systemPositions.has(currentSectorId)) return;
    const pos = systemPositions.get(currentSectorId);
    centerOn(pos.x, pos.y, 0.6);
  }, [currentSectorId, systemPositions.size > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize handling
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Hit-test: find system under screen coordinates (quadtree-optimized)
  const hitTest = useCallback((screenX, screenY) => {
    const world = screenToWorld(screenX, screenY);
    const hitRadius = 12 / zoom; // Larger hit area at lower zoom

    // Use quadtree for fast spatial lookup
    if (quadtree) {
      const nearby = quadtree.queryRadius(world.x, world.y, hitRadius);
      let closest = null;
      let closestDist = Infinity;
      for (const p of nearby) {
        const dx = p.x - world.x;
        const dy = p.y - world.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closest = p.data;
          closestDist = dist;
        }
      }
      return closest;
    }

    // Fallback to linear scan
    let closest = null;
    let closestDist = Infinity;
    for (const [id, pos] of systemPositions) {
      const dx = pos.x - world.x;
      const dy = pos.y - world.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < hitRadius && dist < closestDist) {
        closest = id;
        closestDist = dist;
      }
    }
    return closest;
  }, [screenToWorld, zoom, systemPositions, quadtree]);

  // Mouse click handler
  const handleClick = useCallback((e) => {
    if (isDragging) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = hitTest(x, y);
    if (hit) {
      onSystemClick(hit);
    }
  }, [isDragging, hitTest, onSystemClick]);

  // Right-click handler
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    if (isDragging) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = hitTest(x, y);
    if (hit && onSystemRightClick) {
      onSystemRightClick(hit);
    }
  }, [isDragging, hitTest, onSystemRightClick]);

  // Mouse hover handler
  const handleHover = useCallback((e) => {
    if (isDragging) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = hitTest(x, y);
    setHoveredSystem(hit);
    containerRef.current.style.cursor = (isSelecting || shiftHeld) ? 'crosshair' : (hit ? 'pointer' : (isDragging ? 'grabbing' : 'grab'));
  }, [isDragging, hitTest]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      timeRef.current += 0.016; // ~60fps time
      const t = timeRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate viewport bounds in world coordinates for frustum culling
      const viewBounds = {
        minX: -offset.x / zoom - 50 / zoom,
        minY: -offset.y / zoom - 50 / zoom,
        maxX: (-offset.x + canvas.width) / zoom + 50 / zoom,
        maxY: (-offset.y + canvas.height) / zoom + 50 / zoom
      };

      // Filter visible systems for LOD (major perf win at 1200+ systems)
      const visibleSystems = mapData.systems.filter(sys =>
        sys.x_coord >= viewBounds.minX && sys.x_coord <= viewBounds.maxX &&
        sys.y_coord >= viewBounds.minY && sys.y_coord <= viewBounds.maxY
      );

      // Draw background stars (faint dots)
      drawBackgroundStars(ctx, canvas.width, canvas.height, offset, zoom);

      // Draw hyperlanes (use full set but skip offscreen lanes)
      drawHyperlanes(ctx, mapData.hyperlanes, systemPositions, offset, zoom,
        currentSectorId, adjacentIds, t, viewBounds);

      // Draw route overlay
      if (routePath.length > 1 && routePath.every(id => systemPositions.has(id))) {
        ctx.save();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2.5 / Math.max(zoom, 0.3);
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 8;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.lineDashOffset = -t * 20;
        ctx.beginPath();
        for (let i = 0; i < routePath.length; i++) {
          const pos = systemPositions.get(routePath[i]);
          const sx = pos.x * zoom + offset.x;
          const sy = pos.y * zoom + offset.y;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Draw star systems (only visible ones)
      drawSystems(ctx, visibleSystems, offset, zoom, currentSectorId,
        adjacentIds, hoveredSystem, selectedSystemId, t, highlightedSystemId);

      // Draw labels — LOD: show names at medium zoom, hide at far zoom
      if (zoom > 0.25) {
        // At low zoom, only show labels for current/hovered/selected systems
        const labelSystems = zoom > 0.45 ? visibleSystems : visibleSystems.filter(s =>
          s.sector_id === currentSectorId || s.sector_id === hoveredSystem || s.sector_id === selectedSystemId
        );
        drawLabels(ctx, labelSystems, offset, zoom, currentSectorId, hoveredSystem);
      }

      // Draw ship badges on systems with user's ships
      if (userShipsBySector && userShipsBySector.size > 0) {
        drawShipBadges(ctx, visibleSystems, offset, zoom, userShipsBySector);
      }

      // Draw selection box (Shift+drag)
      if (isSelecting && selectionRect) {
        drawSelectionBox(ctx, selectionRect, visibleSystems, offset, zoom, userShipsBySector);
      }

      // Draw tooltip
      if (hoveredSystem) {
        const sys = systemPositions.get(hoveredSystem);
        if (sys) {
          const screen = worldToScreen(sys.x, sys.y);
          const myShips = userShipsBySector ? userShipsBySector.get(hoveredSystem) : null;
          drawTooltip(ctx, sys, screen.x, screen.y, adjacentIds.has(hoveredSystem),
            hoveredSystem === currentSectorId, myShips);
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mapData, offset, zoom, currentSectorId, adjacentIds, hoveredSystem,
    selectedSystemId, systemPositions, worldToScreen, userShipsBySector,
    isSelecting, selectionRect, highlightedSystemId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={(e) => { handleMouseMove(e); handleHover(e); }}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={{ width: canvasSize.width, height: canvasSize.height }}
      />
    </div>
  );
};

// ============== Drawing Functions ==============

function drawBackgroundStars(ctx, width, height, offset, zoom) {
  // Static background stars based on position for parallax
  const seed = 12345;
  for (let i = 0; i < 300; i++) {
    const hash = (seed * (i + 1) * 2654435761) >>> 0;
    const px = ((hash % width) + offset.x * 0.1) % width;
    const py = (((hash >> 8) % height) + offset.y * 0.1) % height;
    const brightness = ((hash >> 16) % 100) / 100;
    const size = brightness > 0.8 ? 1.5 : (brightness > 0.5 ? 1 : 0.6);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + brightness * 0.25})`;
    ctx.beginPath();
    ctx.arc(
      ((px % width) + width) % width,
      ((py % height) + height) % height,
      size, 0, Math.PI * 2
    );
    ctx.fill();
  }
}

function drawHyperlanes(ctx, hyperlanes, systemPositions, offset, zoom,
  currentSectorId, adjacentIds, time, viewBounds) {
  if (!hyperlanes) return;

  for (const lane of hyperlanes) {
    const from = systemPositions.get(lane.from_id);
    const to = systemPositions.get(lane.to_id);
    if (!from || !to) continue;

    // Frustum culling: skip lanes where both endpoints are outside viewport
    if (viewBounds) {
      const fromVisible = from.x >= viewBounds.minX && from.x <= viewBounds.maxX &&
        from.y >= viewBounds.minY && from.y <= viewBounds.maxY;
      const toVisible = to.x >= viewBounds.minX && to.x <= viewBounds.maxX &&
        to.y >= viewBounds.minY && to.y <= viewBounds.maxY;
      if (!fromVisible && !toVisible) continue;
    }

    // Skip lanes where both ends are undiscovered
    const fromDiscovered = from.discovered !== false;
    const toDiscovered = to.discovered !== false;
    if (!fromDiscovered && !toDiscovered) continue;

    const x1 = from.x * zoom + offset.x;
    const y1 = from.y * zoom + offset.y;
    const x2 = to.x * zoom + offset.x;
    const y2 = to.y * zoom + offset.y;

    // Dim lanes leading to undiscovered systems
    const hasFogEnd = !fromDiscovered || !toDiscovered;

    // Is this lane adjacent to player?
    const isAdjacentLane =
      (lane.from_id === currentSectorId && adjacentIds.has(lane.to_id)) ||
      (lane.to_id === currentSectorId && adjacentIds.has(lane.from_id));

    const laneKind = lane.lane_class || lane.connection_type;

    if (laneKind === 'wormhole' && fromDiscovered && toDiscovered) {
      // Animated dashed cyan line for wormholes (only if both ends discovered)
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -time * 30;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (laneKind === 'portal' && fromDiscovered && toDiscovered) {
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = time * 25;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (laneKind === 'protected') {
      ctx.strokeStyle = hasFogEnd ? 'rgba(191, 219, 254, 0.2)' : 'rgba(191, 219, 254, 0.55)';
      ctx.lineWidth = isAdjacentLane ? 2 : 1.25;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (isAdjacentLane) {
      // Highlighted lanes near player
      ctx.strokeStyle = hasFogEnd ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (hasFogEnd) {
      // Faint lane into fog
      ctx.strokeStyle = 'rgba(55, 65, 81, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else {
      // Normal hyperlanes (both discovered)
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
}

function drawSystems(ctx, systems, offset, zoom, currentSectorId,
  adjacentIds, hoveredSystem, selectedSystemId, time, highlightedSystemId) {
  if (!systems) return;

  for (const sys of systems) {
    const sx = sys.x_coord * zoom + offset.x;
    const sy = sys.y_coord * zoom + offset.y;
    const isCurrent = sys.sector_id === currentSectorId;
    const isAdj = adjacentIds.has(sys.sector_id);
    const isHovered = sys.sector_id === hoveredSystem;
    const isSelected = sys.sector_id === selectedSystemId;
    const isDiscovered = sys.discovered !== false;

    // Undiscovered systems: dim small dot
    if (!isDiscovered) {
      const dimSize = Math.max(2, 3 * zoom);
      // Faint glow
      const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, dimSize * 3);
      gradient.addColorStop(0, 'rgba(100, 116, 139, 0.5)');
      gradient.addColorStop(1, 'rgba(100, 116, 139, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sx, sy, dimSize * 3, 0, Math.PI * 2);
      ctx.fill();
      // Dot
      ctx.fillStyle = 'rgba(100, 116, 139, 0.4)';
      ctx.beginPath();
      ctx.arc(sx, sy, dimSize, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    const baseSize = Math.max(3, (STAR_SIZES[sys.type] || 5) * Math.min(1.5, zoom * 0.8));
    const starColor = STAR_COLORS[sys.star_class] || '#FFFFFF';

    // Faction territory tint (subtle halo behind star)
    if (sys.dominant_faction && FACTION_TINT[sys.dominant_faction] && zoom > 0.3) {
      const factionRgb = FACTION_TINT[sys.dominant_faction];
      const tintRadius = baseSize * 6;
      const tintAlpha = Math.min(0.15, zoom * 0.1);
      const tintGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, tintRadius);
      tintGrad.addColorStop(0, `rgba(${factionRgb}, ${tintAlpha})`);
      tintGrad.addColorStop(0.6, `rgba(${factionRgb}, ${tintAlpha * 0.4})`);
      tintGrad.addColorStop(1, `rgba(${factionRgb}, 0)`);
      ctx.fillStyle = tintGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, tintRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glow effect
    const glowSize = baseSize * (isCurrent ? 4 : isHovered ? 3 : 2);
    const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowSize);
    gradient.addColorStop(0, starColor);
    gradient.addColorStop(0.3, starColor + '80');
    gradient.addColorStop(1, starColor + '00');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sx, sy, glowSize, 0, Math.PI * 2);
    ctx.fill();

    // Star core
    ctx.fillStyle = starColor;
    ctx.beginPath();
    ctx.arc(sx, sy, baseSize, 0, Math.PI * 2);
    ctx.fill();

    // Port indicator (small ring)
    if (sys.has_port) {
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, baseSize + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Phenomena indicator
    if (sys.phenomena) {
      const phenColor = PHENOMENA_COLORS[sys.phenomena.type] || '#FFD700';
      ctx.strokeStyle = phenColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, baseSize + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Current location pulsing ring
    if (isCurrent) {
      const pulse = 1 + Math.sin(time * 3) * 0.3;
      ctx.strokeStyle = `rgba(6, 182, 212, ${0.5 + Math.sin(time * 2) * 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, (baseSize + 8) * pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Ship chevron
      const chevronSize = baseSize * 1.5;
      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.moveTo(sx, sy - chevronSize - 6);
      ctx.lineTo(sx - chevronSize * 0.6, sy - chevronSize - 12);
      ctx.lineTo(sx, sy - chevronSize - 8);
      ctx.lineTo(sx + chevronSize * 0.6, sy - chevronSize - 12);
      ctx.closePath();
      ctx.fill();
    }

    // Adjacent highlight ring
    if (isAdj && !isCurrent) {
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(sx, sy, baseSize + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Selection ring
    if (isSelected) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, baseSize + 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Hover highlight
    if (isHovered && !isCurrent) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, baseSize + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Search highlight
    if (sys.sector_id === highlightedSystemId) {
      const pulse = 1 + Math.sin(time * 4) * 0.2;
      ctx.strokeStyle = `rgba(255, 165, 0, ${0.6 + Math.sin(time * 3) * 0.3})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx, sy, (baseSize + 12) * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawLabels(ctx, systems, offset, zoom, currentSectorId, hoveredSystem) {
  if (!systems) return;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const fontSize = Math.max(8, Math.min(12, 10 * zoom));
  ctx.font = `${fontSize}px monospace`;

  for (const sys of systems) {
    // Skip undiscovered systems (no name to show)
    if (sys.discovered === false || !sys.name) continue;

    const sx = sys.x_coord * zoom + offset.x;
    const sy = sys.y_coord * zoom + offset.y;
    const isCurrent = sys.sector_id === currentSectorId;
    const isHovered = sys.sector_id === hoveredSystem;

    // Only show labels for current, hovered, or when zoomed in enough
    if (!isCurrent && !isHovered && zoom < 0.6) continue;

    const baseSize = Math.max(3, (STAR_SIZES[sys.type] || 5) * Math.min(1.5, zoom * 0.8));

    ctx.fillStyle = isCurrent ? '#06B6D4' : (isHovered ? '#FFFFFF' : 'rgba(156, 163, 175, 0.7)');
    ctx.fillText(sys.name, sx, sy + baseSize + 6);
  }
}

function drawShipBadges(ctx, systems, offset, zoom, userShipsBySector) {
  if (!systems || !userShipsBySector) return;

  for (const sys of systems) {
    const myShips = userShipsBySector.get(sys.sector_id);
    if (!myShips || myShips.length === 0) continue;

    const sx = sys.x_coord * zoom + offset.x;
    const sy = sys.y_coord * zoom + offset.y;
    const baseSize = Math.max(3, (STAR_SIZES[sys.type] || 5) * Math.min(1.5, zoom * 0.8));

    const hasFleetShips = myShips.some(s => s.fleet_id);
    const badgeColor = hasFleetShips ? '#F97316' : '#06B6D4'; // orange for fleet, cyan for unassigned

    // Badge position: bottom-right of star
    const bx = sx + baseSize + 4;
    const by = sy + baseSize + 4;
    const badgeSize = Math.max(6, 8 * Math.min(1, zoom));

    // Badge background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.arc(bx, by, badgeSize + 2, 0, Math.PI * 2);
    ctx.fill();

    // Badge circle
    ctx.fillStyle = badgeColor;
    ctx.beginPath();
    ctx.arc(bx, by, badgeSize, 0, Math.PI * 2);
    ctx.fill();

    // Ship count text
    ctx.fillStyle = '#0F172A';
    ctx.font = `bold ${Math.max(8, badgeSize)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(myShips.length), bx, by);
  }
}

function drawSelectionBox(ctx, rect, systems, offset, zoom, userShipsBySector) {
  const x = Math.min(rect.startX, rect.endX);
  const y = Math.min(rect.startY, rect.endY);
  const w = Math.abs(rect.endX - rect.startX);
  const h = Math.abs(rect.endY - rect.startY);

  // Semi-transparent cyan fill
  ctx.fillStyle = 'rgba(6, 182, 212, 0.1)';
  ctx.fillRect(x, y, w, h);

  // Dashed cyan border
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  // Highlight systems with user ships inside the selection box
  if (!systems || !userShipsBySector) return;
  for (const sys of systems) {
    const myShips = userShipsBySector.get(sys.sector_id);
    if (!myShips || myShips.length === 0) continue;

    const sx = sys.x_coord * zoom + offset.x;
    const sy = sys.y_coord * zoom + offset.y;

    if (sx >= x && sx <= x + w && sy >= y && sy <= y + h) {
      const baseSize = Math.max(3, (STAR_SIZES[sys.type] || 5) * Math.min(1.5, zoom * 0.8));
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, baseSize + 14, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawTooltip(ctx, sys, screenX, screenY, isAdjacent, isCurrent, myShips) {
  const padding = 10;
  const lineHeight = 16;

  // Undiscovered system tooltip
  if (sys.discovered === false) {
    const lines = ['Unknown System', 'Not yet explored'];
    const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
    const boxW = maxWidth + padding * 2;
    const boxH = lines.length * lineHeight + padding * 2;
    const boxX = screenX + 15;
    const boxY = screenY - boxH / 2;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = 'rgba(55, 65, 81, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'italic 11px monospace';
    ctx.fillStyle = '#64748B';
    lines.forEach((line, i) => {
      ctx.fillText(line, boxX + padding, boxY + padding + i * lineHeight);
    });
    return;
  }

  const lines = [
    sys.name,
    `Type: ${sys.type}`,
    `Star: ${sys.star_class}`,
    `Hazard: ${sys.hazard_level}/10`,
  ];
  if (sys.dominant_faction) {
    lines.push(`Faction: ${FACTION_LABELS[sys.dominant_faction] || sys.dominant_faction}`);
  }
  if (sys.has_port) lines.push('Has Port');
  if (sys.ship_count > 0) lines.push(`Ships: ${sys.ship_count}`);
  if (myShips && myShips.length > 0) lines.push(`My Ships: ${myShips.length}`);
  if (sys.phenomena) {
    const phenDefs = { ion_storm: 'Ion Storm', nebula: 'Nebula', asteroid_field: 'Asteroid Field', solar_flare: 'Solar Flare', gravity_well: 'Gravity Well' };
    lines.push(`Phenomena: ${phenDefs[sys.phenomena.type] || sys.phenomena.type}`);
  }
  if (isCurrent) lines.push('CURRENT LOCATION');
  else if (isAdjacent) lines.push('Right-click to travel');

  const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
  const boxW = maxWidth + padding * 2;
  const boxH = lines.length * lineHeight + padding * 2;
  const boxX = screenX + 15;
  const boxY = screenY - boxH / 2;

  // Background
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.strokeStyle = 'rgba(55, 65, 81, 0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 4);
  ctx.fill();
  ctx.stroke();

  // Text
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '11px monospace';

  lines.forEach((line, i) => {
    if (i === 0) {
      ctx.fillStyle = STAR_COLORS[sys.star_class] || '#06B6D4';
      ctx.font = 'bold 12px monospace';
    } else if (line === 'CURRENT LOCATION') {
      ctx.fillStyle = '#22C55E';
      ctx.font = 'bold 10px monospace';
    } else if (line === 'Click to travel') {
      ctx.fillStyle = '#06B6D4';
      ctx.font = 'italic 10px monospace';
    } else {
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '11px monospace';
    }
    ctx.fillText(line, boxX + padding, boxY + padding + i * lineHeight);
  });
}

export default GalaxyMapCanvas;
