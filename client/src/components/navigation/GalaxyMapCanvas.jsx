import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import useViewport from './hooks/useViewport';

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

const STAR_SIZES = {
  Core: 8, Inner: 7, Mid: 6, Outer: 5, Fringe: 4, Unknown: 4
};

const GalaxyMapCanvas = ({
  mapData,
  currentSectorId,
  adjacencyMap,
  onSystemClick,
  selectedSystemId
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
    setZoom
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

  // Adjacent system IDs for current position
  const adjacentIds = useMemo(() => {
    if (!currentSectorId || !adjacencyMap.has(currentSectorId)) return new Set();
    return new Set(adjacencyMap.get(currentSectorId));
  }, [currentSectorId, adjacencyMap]);

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

  // Hit-test: find system under screen coordinates
  const hitTest = useCallback((screenX, screenY) => {
    const world = screenToWorld(screenX, screenY);
    const hitRadius = 12 / zoom; // Larger hit area at lower zoom
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
  }, [screenToWorld, zoom, systemPositions]);

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

  // Mouse hover handler
  const handleHover = useCallback((e) => {
    if (isDragging) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = hitTest(x, y);
    setHoveredSystem(hit);
    containerRef.current.style.cursor = hit ? 'pointer' : (isDragging ? 'grabbing' : 'grab');
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

      // Draw background stars (faint dots)
      drawBackgroundStars(ctx, canvas.width, canvas.height, offset, zoom);

      // Draw hyperlanes
      drawHyperlanes(ctx, mapData.hyperlanes, systemPositions, offset, zoom,
        currentSectorId, adjacentIds, t);

      // Draw star systems
      drawSystems(ctx, mapData.systems, offset, zoom, currentSectorId,
        adjacentIds, hoveredSystem, selectedSystemId, t);

      // Draw labels (only when zoomed in enough)
      if (zoom > 0.35) {
        drawLabels(ctx, mapData.systems, offset, zoom, currentSectorId, hoveredSystem);
      }

      // Draw tooltip
      if (hoveredSystem) {
        const sys = systemPositions.get(hoveredSystem);
        if (sys) {
          const screen = worldToScreen(sys.x, sys.y);
          drawTooltip(ctx, sys, screen.x, screen.y, adjacentIds.has(hoveredSystem),
            hoveredSystem === currentSectorId);
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mapData, offset, zoom, currentSectorId, adjacentIds, hoveredSystem,
    selectedSystemId, systemPositions, worldToScreen]);

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
  currentSectorId, adjacentIds, time) {
  if (!hyperlanes) return;

  for (const lane of hyperlanes) {
    const from = systemPositions.get(lane.from_id);
    const to = systemPositions.get(lane.to_id);
    if (!from || !to) continue;

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

    if (lane.connection_type === 'wormhole' && fromDiscovered && toDiscovered) {
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
  adjacentIds, hoveredSystem, selectedSystemId, time) {
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

function drawTooltip(ctx, sys, screenX, screenY, isAdjacent, isCurrent) {
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
  if (sys.has_port) lines.push('Has Port');
  if (sys.ship_count > 0) lines.push(`Ships: ${sys.ship_count}`);
  if (isCurrent) lines.push('CURRENT LOCATION');
  else if (isAdjacent) lines.push('Click to travel');

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
