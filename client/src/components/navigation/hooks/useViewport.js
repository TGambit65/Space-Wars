import { useState, useCallback, useRef, useEffect } from 'react';

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 5.0;
const ZOOM_SPEED = 0.1;
const SYSTEM_VIEW_THRESHOLD = 2.5;

export default function useViewport(containerRef) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.5);
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState('galaxy'); // 'galaxy' | 'system'
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState(null); // { startX, startY, endX, endY } screen coords
  const [shiftHeld, setShiftHeld] = useState(false);
  const dragStart = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const selectionStart = useRef(null);
  const onSelectionCompleteRef = useRef(null);
  const lastTouchDist = useRef(null);
  const lastTouchCenter = useRef(null);

  // Allow callers to set selection complete callback
  const setOnSelectionComplete = useCallback((fn) => {
    onSelectionCompleteRef.current = fn;
  }, []);

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

  // Mouse drag for panning OR selection box
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // Left click only

    if (e.shiftKey) {
      // Start selection box
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setIsSelecting(true);
      selectionStart.current = { x, y };
      setSelectionRect({ startX: x, startY: y, endX: x, endY: y });
      return;
    }

    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = { ...offset };
  }, [offset, containerRef]);

  const handleMouseMove = useCallback((e) => {
    if (isSelecting && selectionStart.current) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setSelectionRect(prev => prev ? { ...prev, endX: x, endY: y } : null);
      return;
    }

    if (!isDragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({
      x: dragOffset.current.x + dx,
      y: dragOffset.current.y + dy
    });
  }, [isDragging, isSelecting, containerRef]);

  const handleMouseUp = useCallback(() => {
    if (isSelecting && selectionRect) {
      // Finalize selection
      if (onSelectionCompleteRef.current) {
        onSelectionCompleteRef.current(selectionRect);
      }
      setIsSelecting(false);
      setSelectionRect(null);
      selectionStart.current = null;
      return;
    }

    setIsDragging(false);
    dragStart.current = null;
  }, [isSelecting, selectionRect]);

  // Touch handlers for mobile pan + pinch-zoom
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      setIsDragging(true);
      dragStart.current = { x: t.clientX, y: t.clientY };
      dragOffset.current = { ...offset };
      lastTouchDist.current = null;
      lastTouchCenter.current = null;
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      dragStart.current = null;
      const t0 = e.touches[0], t1 = e.touches[1];
      lastTouchDist.current = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      lastTouchCenter.current = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
    }
  }, [offset]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging && dragStart.current) {
      const t = e.touches[0];
      const dx = t.clientX - dragStart.current.x;
      const dy = t.clientY - dragStart.current.y;
      setOffset({
        x: dragOffset.current.x + dx,
        y: dragOffset.current.y + dy
      });
    } else if (e.touches.length === 2 && lastTouchDist.current != null) {
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const center = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const cx = center.x - rect.left;
      const cy = center.y - rect.top;

      // Pinch zoom
      const scale = dist / lastTouchDist.current;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * scale));
      const worldX = (cx - offset.x) / zoom;
      const worldY = (cy - offset.y) / zoom;

      // Pan from center movement
      const prevCenter = lastTouchCenter.current;
      const panDx = center.x - prevCenter.x;
      const panDy = center.y - prevCenter.y;

      setOffset({
        x: cx - worldX * newZoom + panDx,
        y: cy - worldY * newZoom + panDy
      });
      setZoom(newZoom);

      lastTouchDist.current = dist;
      lastTouchCenter.current = center;
    }
  }, [isDragging, zoom, offset, containerRef]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
    lastTouchDist.current = null;
    lastTouchCenter.current = null;
  }, []);

  // Track shift key for cursor feedback
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Shift') setShiftHeld(true);

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
          setZoom(1.5);
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Shift') setShiftHeld(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
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
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    screenToWorld,
    worldToScreen,
    setZoom,
    isSelecting,
    selectionRect,
    shiftHeld,
    setOnSelectionComplete
  };
}
