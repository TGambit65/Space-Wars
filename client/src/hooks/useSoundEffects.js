import { useCallback, useRef } from 'react';

/**
 * Lightweight sound effects via Web Audio API.
 * Sounds are user-toggleable via localStorage key 'sw3k_sfx_enabled'.
 * All sounds are synthesized — no audio files needed.
 */

let audioCtx = null;
function getCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function isEnabled() {
  return localStorage.getItem('sw3k_sfx_enabled') !== 'false';
}

function tone(freq, duration, type = 'sine', volume = 0.12) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

const SOUNDS = {
  // UI click — short high blip
  click: () => tone(880, 0.06, 'sine', 0.08),

  // Success — ascending two-tone
  success: () => {
    tone(523, 0.12, 'sine', 0.1);
    setTimeout(() => tone(659, 0.15, 'sine', 0.1), 100);
  },

  // Error — descending tone
  error: () => {
    tone(440, 0.12, 'sawtooth', 0.08);
    setTimeout(() => tone(330, 0.2, 'sawtooth', 0.08), 100);
  },

  // Warning — mid-pitch pulse
  warning: () => tone(660, 0.2, 'triangle', 0.1),

  // Trade confirm — cash register ding
  trade: () => {
    tone(1047, 0.08, 'sine', 0.1);
    setTimeout(() => tone(1319, 0.08, 'sine', 0.1), 60);
    setTimeout(() => tone(1568, 0.12, 'sine', 0.12), 120);
  },

  // Combat hit — low thump
  combatHit: () => tone(110, 0.15, 'sawtooth', 0.15),

  // Warp jump — frequency sweep
  warp: () => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  },

  // NPC hail — radio blip pattern
  hail: () => {
    tone(800, 0.06, 'square', 0.06);
    setTimeout(() => tone(1000, 0.06, 'square', 0.06), 100);
    setTimeout(() => tone(800, 0.06, 'square', 0.06), 200);
  },

  // Level up — triumphant fanfare
  levelUp: () => {
    tone(523, 0.15, 'sine', 0.12);
    setTimeout(() => tone(659, 0.15, 'sine', 0.12), 150);
    setTimeout(() => tone(784, 0.15, 'sine', 0.12), 300);
    setTimeout(() => tone(1047, 0.3, 'sine', 0.15), 450);
  },

  // Notification — gentle chime
  notification: () => {
    tone(698, 0.1, 'sine', 0.08);
    setTimeout(() => tone(880, 0.15, 'sine', 0.1), 80);
  },

  // Scan complete — sweep up
  scan: () => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  },
};

export default function useSoundEffects() {
  const play = useCallback((name) => {
    if (!isEnabled()) return;
    const fn = SOUNDS[name];
    if (fn) fn();
  }, []);

  return { play };
}

// For non-hook contexts (e.g., inside socket listeners)
export function playSfx(name) {
  if (!isEnabled()) return;
  const fn = SOUNDS[name];
  if (fn) fn();
}
