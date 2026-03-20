import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SHORTCUTS = {
  d: '/',
  s: '/ships',
  m: '/map',
  v: '/system',
  t: '/trading',
  c: '/combat',
  p: '/progression',
  i: '/messages',
};

export default function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Don't intercept keys when pointer lock is active (e.g. voxel first-person view)
      if (document.pointerLockElement) return;

      const key = e.key.toLowerCase();
      if (key === 'escape') {
        document.querySelectorAll('[data-dismiss]').forEach(el => el.click());
        return;
      }
      if (key === '?') {
        window.dispatchEvent(new CustomEvent('sw3k:show-shortcuts'));
        return;
      }
      if (SHORTCUTS[key]) {
        e.preventDefault();
        navigate(SHORTCUTS[key]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
}

export { SHORTCUTS };
