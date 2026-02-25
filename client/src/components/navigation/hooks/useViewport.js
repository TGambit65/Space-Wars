import { useState, useCallback, useRef, useEffect } from 'react';

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 5.0;
const ZOOM_SPEED = 0.1;
const SYSTEM_VIEW_THRESHOLD = 2.5;

export default function useViewport(containerRef) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState('galaxy'); // 'galaxy' | 'system'
  const dragStart = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Center viewport on a world position
  const centerOn = useCallback((worldX, worldY, targetZoom) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const z = targetZoom || zoom;
    setOffset({
      x: rect.width / 2 - worldX * z,
      y: rect.height / 2 - worldY * z
    });
    if (targetZoom) setZoom(targetZoom);
  }, [containerRef, zoom]);

  // Handle mouse wheel zoom (targets cursor position)
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // World position under cursor before zoom
    const worldX = (mouseX - offset.x) / zoom;
    const worldY = (mouseY - offset.y) / zoom;

    const direction = e.deltaY > 0 ? -1 : 1;
    const factor = 1 + ZOOM_SPEED * direction;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));

    // Adjust offset so world position stays under cursor
    setOffset({
      x: mouseX - worldX * newZoom,
      y: mouseY - worldY * newZoom
    });
    setZoom(newZoom);

    // Auto-switch view mode
    if (newZoom >= SYSTEM_VIEW_THRESHOLD && viewMode === 'galaxy') {
      setViewMode('system');
    } else if (newZoom < SYSTEM_VIEW_THRESHOLD && viewMode === 'system') {
      setViewMode('galaxy');
    }
  }, [containerRef, offset, zoom, viewMode]);

  // Mouse drag for panning
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = { ...offset };
  }, [offset]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({
      x: dragOffset.current.x + dx,
      y: dragOffset.current.y + dy
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      const PAN_AMOUNT = 50;
      switch (e.key) {
        case 'ArrowLeft':
          setOffset(prev => ({ ...prev, x: prev.x + PAN_AMOUNT }));
          break;
        case 'ArrowRight':
          setOffset(prev => ({ ...prev, x: prev.x - PAN_AMOUNT }));
          break;
        case 'ArrowUp':
          setOffset(prev => ({ ...prev, y: prev.y + PAN_AMOUNT }));
          break;
        case 'ArrowDown':
          setOffset(prev => ({ ...prev, y: prev.y - PAN_AMOUNT }));
          break;
        case '+':
        case '=':
          setZoom(prev => Math.min(MAX_ZOOM, prev * 1.2));
          break;
        case '-':
          setZoom(prev => Math.max(MIN_ZOOM, prev / 1.2));
          break;
        case 'Escape':
          setViewMode('galaxy');
          setZoom(0.5);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback((screenX, screenY) => {
    return {
      x: (screenX - offset.x) / zoom,
      y: (screenY - offset.y) / zoom
    };
  }, [offset, zoom]);

  // Convert world coordinates to screen coordinates
  const worldToScreen = useCallback((worldX, worldY) => {
    return {
      x: worldX * zoom + offset.x,
      y: worldY * zoom + offset.y
    };
  }, [offset, zoom]);

  return {
    offset,
    zoom,
    isDragging,
    viewMode,
    setViewMode,
    centerOn,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    screenToWorld,
    worldToScreen,
    setZoom
  };
}
