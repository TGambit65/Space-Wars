import { useRef, useEffect, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FACTION_HEX, FACTION_COLORS as FACTION_CSS } from '../../constants/factions';

// ============== Visual Configuration ==============

// Map Space Wars planet types to visual configs
const PLANET_VISUALS = {
  'Terran':      { color: '#3b82f6', pattern: 'habitable', atmo: true,  shininess: 70, desc: 'habitable' },
  'Desert':      { color: '#d97706', pattern: 'rocky',     atmo: false, shininess: 15, desc: 'arid' },
  'Ice':         { color: '#7dd3fc', pattern: 'ice',       atmo: true,  shininess: 50, desc: 'frozen' },
  'Volcanic':    { color: '#dc2626', pattern: 'lava',      atmo: false, shininess: 30, desc: 'volcanic' },
  'Gas Giant':   { color: '#f59e0b', pattern: 'gas',       atmo: true,  shininess: 15, desc: 'gas' },
  'Oceanic':     { color: '#1d4ed8', pattern: 'water',     atmo: true,  shininess: 70, desc: 'aquatic' },
  'Barren':      { color: '#78716c', pattern: 'pitted',    atmo: false, shininess: 10, desc: 'barren' },
  'Jungle':      { color: '#16a34a', pattern: 'jungle',    atmo: true,  shininess: 50, desc: 'lush' },
  'Toxic':       { color: '#84cc16', pattern: 'toxic',     atmo: true,  shininess: 20, desc: 'toxic' },
  'Crystalline': { color: '#c4b5fd', pattern: 'crystal',   atmo: false, shininess: 80, desc: 'crystalline' },
};

const STAR_CONFIGS = {
  O:        { radius: 14, color: '#6B8BFF', intensity: 5 },
  B:        { radius: 12, color: '#8BB5FF', intensity: 4.5 },
  A:        { radius: 10, color: '#D4E4FF', intensity: 4 },
  F:        { radius: 9,  color: '#F8F0D0', intensity: 3.5 },
  G:        { radius: 8,  color: '#FFE87A', intensity: 3 },
  K:        { radius: 6,  color: '#FFB84D', intensity: 2.5 },
  M:        { radius: 5,  color: '#FF6B4D', intensity: 2 },
  Neutron:  { radius: 3,  color: '#E0E8FF', intensity: 6 },
  BlackHole:{ radius: 2,  color: '#9B59B6', intensity: 0.5 },
};

// Orbital distance = BASE + position * SPACING
const ORBIT_BASE = 22;
const ORBIT_SPACING = 14;
// Habitable zone: orbital positions 4-9
const HAB_INNER = ORBIT_BASE + 4 * ORBIT_SPACING;
const HAB_OUTER = ORBIT_BASE + 9 * ORBIT_SPACING;

// ============== Texture Generators ==============

function generatePlanetTexture(planetType, isScanned) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const vis = PLANET_VISUALS[planetType] || PLANET_VISUALS['Barren'];

  if (!isScanned) {
    // Unscanned: dim mysterious sphere with faint static pattern
    ctx.fillStyle = '#252540';
    ctx.fillRect(0, 0, 1024, 512);
    // Subtle noise pattern
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = `rgba(140, 160, 200, ${0.08 + Math.random() * 0.15})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 512, 2 + Math.random() * 10, 0, Math.PI * 2);
      ctx.fill();
    }
    // Faint scan-line effect
    for (let y = 0; y < 512; y += 8) {
      ctx.fillStyle = 'rgba(100, 130, 180, 0.04)';
      ctx.fillRect(0, y, 1024, 2);
    }
    return new THREE.CanvasTexture(canvas);
  }

  ctx.fillStyle = vis.color;
  ctx.fillRect(0, 0, 1024, 512);

  if (vis.pattern === 'habitable') {
    // Ocean base
    ctx.fillStyle = '#081426';
    ctx.fillRect(0, 0, 1024, 512);
    // Shallow water
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 512, 10 + Math.random() * 40, 0, Math.PI * 2);
      ctx.fill();
    }
    // Landmasses
    const landColors = ['#1a472a', '#2d5a27', '#5d4037', '#8d6e63', '#1b5e20'];
    for (const lc of landColors) {
      ctx.fillStyle = lc;
      for (let i = 0; i < 120; i++) {
        const x = Math.random() * 1024, y = Math.random() * 512;
        const r = 4 + Math.random() * 30;
        for (let k = 0; k < 10; k++) {
          ctx.beginPath();
          ctx.arc(x + (Math.random() - 0.5) * r * 2.5, y + (Math.random() - 0.5) * r * 2.5, r * (0.3 + Math.random()), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Polar caps
    ctx.fillStyle = '#e8edf2';
    ctx.fillRect(0, 0, 1024, 50);
    ctx.fillRect(0, 462, 1024, 50);
  } else if (vis.pattern === 'jungle') {
    ctx.fillStyle = '#042f1a';
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = 'rgba(34, 139, 34, 0.2)';
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 512, 15 + Math.random() * 50, 0, Math.PI * 2);
      ctx.fill();
    }
    const jungleColors = ['#0a5c2e', '#14532d', '#166534', '#064e3b', '#052e16'];
    for (const jc of jungleColors) {
      ctx.fillStyle = jc;
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 1024, y = Math.random() * 512;
        for (let k = 0; k < 8; k++) {
          ctx.beginPath();
          ctx.arc(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60, 3 + Math.random() * 20, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Rivers
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = 'rgba(30, 64, 175, 0.4)';
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      let x = Math.random() * 1024, y = Math.random() * 512;
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        x += (Math.random() - 0.5) * 80;
        y += (Math.random() - 0.5) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (vis.pattern === 'gas') {
    for (let i = 0; i < 512; i++) {
      const band = Math.sin(i * 0.05) * 0.5 + 0.5;
      ctx.fillStyle = band > 0.5
        ? `rgba(255,255,255,${0.05 + Math.random() * 0.1})`
        : `rgba(0,0,0,${0.05 + Math.random() * 0.1})`;
      ctx.fillRect(0, i, 1024, 1 + Math.random() * 4);
    }
    // Great spot
    const spotX = 300 + Math.random() * 400, spotY = 200 + Math.random() * 100;
    const spotGrad = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, 40);
    spotGrad.addColorStop(0, 'rgba(180, 80, 40, 0.6)');
    spotGrad.addColorStop(1, 'rgba(180, 80, 40, 0)');
    ctx.fillStyle = spotGrad;
    ctx.beginPath();
    ctx.ellipse(spotX, spotY, 50, 25, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (vis.pattern === 'lava') {
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 500; i++) {
      const glow = Math.random();
      ctx.fillStyle = glow > 0.7
        ? `rgba(255, ${Math.floor(80 + Math.random() * 80)}, 0, ${0.3 + Math.random() * 0.5})`
        : `rgba(40, 10, 5, ${0.2 + Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 512, 2 + Math.random() * 15, 0, Math.PI * 2);
      ctx.fill();
    }
    // Lava rivers
    for (let i = 0; i < 20; i++) {
      ctx.strokeStyle = `rgba(255, ${60 + Math.random() * 60}, 0, ${0.4 + Math.random() * 0.4})`;
      ctx.lineWidth = 1 + Math.random() * 3;
      ctx.beginPath();
      let x = Math.random() * 1024, y = Math.random() * 512;
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (Math.random() - 0.5) * 100;
        y += (Math.random() - 0.5) * 50;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (vis.pattern === 'ice') {
    ctx.fillStyle = '#c7e8f3';
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(200, 230, 255, ${0.1 + Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 512, 5 + Math.random() * 30, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cracks
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(100, 160, 200, ${0.2 + Math.random() * 0.3})`;
      ctx.lineWidth = 0.5 + Math.random();
      ctx.beginPath();
      let x = Math.random() * 1024, y = Math.random() * 512;
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (Math.random() - 0.5) * 60;
        y += (Math.random() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (vis.pattern === 'water') {
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = `rgba(30, 80, 200, ${0.1 + Math.random() * 0.25})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 512, 5 + Math.random() * 40, 0, Math.PI * 2);
      ctx.fill();
    }
    // Highlights
    for (let i = 0; i < 100; i++) {
      ctx.fillStyle = `rgba(100, 200, 255, ${0.05 + Math.random() * 0.1})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 512, 10 + Math.random() * 50, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (vis.pattern === 'toxic') {
    ctx.fillStyle = '#1a2e0a';
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(132, 204, 22, ${0.05 + Math.random() * 0.15})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 512, 5 + Math.random() * 30, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(200, 200, 0, ${0.03 + Math.random() * 0.08})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 512, 20 + Math.random() * 60, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (vis.pattern === 'crystal') {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 300; i++) {
      const bright = Math.random();
      ctx.fillStyle = bright > 0.5
        ? `rgba(196, 181, 253, ${0.1 + Math.random() * 0.4})`
        : `rgba(139, 92, 246, ${0.05 + Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 512, 2 + Math.random() * 12, 0, Math.PI * 2);
      ctx.fill();
    }
    // Crystal facets as lines
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = `rgba(230, 230, 250, ${0.1 + Math.random() * 0.2})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const x = Math.random() * 1024, y = Math.random() * 512;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 20);
      ctx.stroke();
    }
  } else if (vis.pattern === 'rocky') {
    // Desert / rocky
    ctx.fillStyle = '#4a3520';
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(217, 119, 6, ${0.05 + Math.random() * 0.15})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 512, 3 + Math.random() * 20, 0, Math.PI * 2);
      ctx.fill();
    }
    // Dunes
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = `rgba(180, 120, 50, ${0.15 + Math.random() * 0.2})`;
      ctx.lineWidth = 2 + Math.random() * 3;
      ctx.beginPath();
      const y = Math.random() * 512;
      ctx.moveTo(0, y);
      for (let x = 0; x < 1024; x += 50) {
        ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 15);
      }
      ctx.stroke();
    }
  } else {
    // Pitted / barren
    ctx.fillStyle = '#3a3530';
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 600; i++) {
      const dark = Math.random() > 0.3;
      ctx.fillStyle = dark
        ? `rgba(0, 0, 0, ${0.1 + Math.random() * 0.2})`
        : `rgba(140, 130, 120, ${0.05 + Math.random() * 0.1})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 512, 1 + Math.random() * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function generateAtmosphereTexture(planetType) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1024, 512);

  const vis = PLANET_VISUALS[planetType] || PLANET_VISUALS['Barren'];
  if (!vis.atmo) return null;

  // Cloud layer
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * 1024, y = Math.random() * 512;
    const w = 50 + Math.random() * 300, h = 2 + Math.random() * 10;
    const alpha = 0.1 + Math.random() * 0.5;
    ctx.fillStyle = planetType === 'Toxic'
      ? `rgba(180, 255, 0, ${alpha * 0.4})`
      : `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, (Math.random() - 0.5) * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function createLabelTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = '800 72px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 14;
  ctx.strokeText(text, 256, 64);
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 64);
  return new THREE.CanvasTexture(canvas);
}

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'white');
  g.addColorStop(0.2, 'rgba(255,224,102,0.7)');
  g.addColorStop(0.5, 'rgba(255,150,0,0.1)');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

// ============== Three.js Component ==============

const SystemViewCanvas = ({
  systemDetail,
  currentShip,
  selectedEntityId,
  onEntityClick,
  onEntityDoubleClick,
  neighbors,
  onEntityRightClick,
}) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const animFrameRef = useRef(null);
  const timeRef = useRef(0);
  const meshToEntityRef = useRef(new Map()); // mesh → { type, entity }
  const planetObjectsRef = useRef([]); // array of { group, mesh, atmoMesh, labelSprite, orbitLine, data }
  const sceneObjectsRef = useRef([]); // all disposable objects for cleanup
  const habLinesRef = useRef([]);
  const selectedRingRef = useRef(null);
  const shipMeshRef = useRef(null);
  const shipPulseRef = useRef(null);
  const jumpPointObjectsRef = useRef([]);
  const shipTargetPosRef = useRef(null); // Vector3 target for ship flight
  const shipTrailRef = useRef(null); // engine trail line
  const shipVelocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const shipSpeedRef = useRef(10); // derived from ship stats

  // Compute entity data from system detail
  const entityData = useMemo(() => {
    if (!systemDetail) return null;
    const sector = systemDetail.sector;
    const starConfig = STAR_CONFIGS[sector?.star_class] || STAR_CONFIGS.G;

    const planets = (systemDetail.planets || []).map(p => {
      const vis = PLANET_VISUALS[p.type] || PLANET_VISUALS['Barren'];
      const orbitalPos = p.orbital_position || 1;
      const distance = ORBIT_BASE + orbitalPos * ORBIT_SPACING;
      // Planet radius: Gas Giants bigger, dwarfs smaller
      let baseRadius;
      if (p.type === 'Gas Giant') {
        baseRadius = 2.5 + (p.size || 5) * 0.25;
      } else {
        baseRadius = 0.8 + (p.size || 5) * 0.18;
      }
      return {
        ...p,
        distance,
        threeRadius: baseRadius,
        speed: (0.4 / Math.sqrt(distance / 50)) * 0.15,
        rotationSpeed: (0.003 + (orbitalPos * 0.37) % 0.005) * 0.5,
        offset: orbitalPos * 1.2 + (p.size || 5) * 0.3,
        vis,
      };
    });

    const ports = (systemDetail.ports || []).map((p, i) => ({
      ...p,
      distance: 15 + i * 5,
      angle: (Math.PI / 4) + i * (Math.PI / 3),
    }));

    const npcs = (systemDetail.npcs || []).map((n, i) => ({
      ...n,
      distance: 30 + ((i * 47 + 13) % 150),
      angle: (Math.PI * 2 / Math.max(1, systemDetail.npcs.length)) * i,
    }));

    return { sector, starConfig, planets, ports, npcs };
  }, [systemDetail]);

  // Memoize neighbors for buildScene dependency
  const neighborsKey = useMemo(() => (neighbors || []).map(n => n.sector_id).join(','), [neighbors]);

  // Build/rebuild the scene when data changes
  const buildScene = useCallback(() => {
    if (!sceneRef.current || !entityData) return;
    const scene = sceneRef.current;

    // Clear previous objects
    for (const obj of sceneObjectsRef.current) {
      scene.remove(obj);
      obj.traverse?.(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
    }
    sceneObjectsRef.current = [];
    planetObjectsRef.current = [];
    meshToEntityRef.current.clear();
    habLinesRef.current = [];
    shipMeshRef.current = null;
    shipPulseRef.current = null;
    shipTargetPosRef.current = null;
    if (shipTrailRef.current) {
      scene.remove(shipTrailRef.current);
      shipTrailRef.current.geometry?.dispose();
      shipTrailRef.current.material?.dispose();
      shipTrailRef.current = null;
    }
    jumpPointObjectsRef.current = [];

    const { sector, starConfig, planets, ports, npcs } = entityData;
    const isBlackHole = sector?.star_class === 'BlackHole';

    // --- Star ---
    if (isBlackHole) {
      // Accretion disk rings
      for (let ring = 0; ring < 8; ring++) {
        const r = 8 + ring * 2;
        const geo = new THREE.TorusGeometry(r, 0.3, 16, 100);
        const hue = (270 + ring * 15) / 360;
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(hue, 0.8, 0.6),
          transparent: true,
          opacity: 0.3 - ring * 0.03,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = Math.PI / 2 + ring * 0.03;
        scene.add(mesh);
        sceneObjectsRef.current.push(mesh);
      }
      // Dark core
      const coreGeo = new THREE.SphereGeometry(4, 32, 32);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const core = new THREE.Mesh(coreGeo, coreMat);
      scene.add(core);
      sceneObjectsRef.current.push(core);
      meshToEntityRef.current.set(core, { type: 'star', entity: sector });
    } else {
      // Normal star
      const sunGeo = new THREE.SphereGeometry(starConfig.radius, 64, 64);
      const sunMat = new THREE.MeshBasicMaterial({ color: starConfig.color });
      const sun = new THREE.Mesh(sunGeo, sunMat);
      scene.add(sun);
      sceneObjectsRef.current.push(sun);
      meshToEntityRef.current.set(sun, { type: 'star', entity: sector });

      // Glow sprite
      const glowTex = createGlowTexture();
      const glowMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: new THREE.Color(starConfig.color),
        transparent: true,
        blending: THREE.AdditiveBlending,
      });
      const glow = new THREE.Sprite(glowMat);
      glow.scale.set(starConfig.radius * 4, starConfig.radius * 4, 1);
      sun.add(glow);

      // Point light from star
      const light = new THREE.PointLight(starConfig.color, starConfig.intensity, 3000);
      scene.add(light);
      sceneObjectsRef.current.push(light);
    }

    // --- Habitable zone rings ---
    const createHabRing = (radius) => {
      const geo = new THREE.TorusGeometry(radius, 0.1, 16, 100);
      const mat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.12 });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
      sceneObjectsRef.current.push(ring);
      habLinesRef.current.push(ring);
      return ring;
    };
    createHabRing(HAB_INNER);
    createHabRing(HAB_OUTER);

    // --- Planets ---
    for (const pData of planets) {
      const isScanned = pData.is_scanned;
      const vis = pData.vis;

      const group = new THREE.Group();

      // Planet body — unscanned planets use a minimum radius so they're visible
      const displayRadius = isScanned ? pData.threeRadius : Math.max(pData.threeRadius, 1.8);
      const bodyGeo = new THREE.SphereGeometry(displayRadius, 64, 64);
      const bodyTex = generatePlanetTexture(pData.type, isScanned);
      const bodyMat = new THREE.MeshPhongMaterial({
        map: bodyTex,
        shininess: isScanned ? vis.shininess : 10,
        specular: isScanned ? 0x999999 : 0x333333,
        emissive: isScanned ? 0x000000 : 0x222233,
        emissiveIntensity: isScanned ? 0 : 0.4,
        transparent: !isScanned,
        opacity: isScanned ? 1.0 : 0.75,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      group.add(bodyMesh);

      // Scan pulse ring for unscanned planets
      if (!isScanned) {
        const pulseGeo = new THREE.TorusGeometry(displayRadius + 0.6, 0.08, 16, 64);
        const pulseMat = new THREE.MeshBasicMaterial({
          color: 0x6688cc, transparent: true, opacity: 0.5,
        });
        const pulseRing = new THREE.Mesh(pulseGeo, pulseMat);
        pulseRing.rotation.x = Math.PI / 2;
        pulseRing.userData.isPulse = true;
        group.add(pulseRing);
      }

      // Atmosphere
      let atmoMesh = null;
      if (vis.atmo && isScanned) {
        const atmoTex = generateAtmosphereTexture(pData.type);
        if (atmoTex) {
          const atmoMat = new THREE.MeshPhongMaterial({
            map: atmoTex,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          atmoMesh = new THREE.Mesh(
            new THREE.SphereGeometry(pData.threeRadius + 0.12, 64, 64),
            atmoMat
          );
          group.add(atmoMesh);
        }
      }

      // Colony ring indicator
      if (isScanned && (pData.colony || pData.owner_user_id)) {
        const ringGeo = new THREE.TorusGeometry(pData.threeRadius + 0.5, 0.06, 16, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.6 });
        const colonyRing = new THREE.Mesh(ringGeo, ringMat);
        colonyRing.rotation.x = Math.PI / 2;
        group.add(colonyRing);
      }

      // Label sprite
      const labelText = isScanned ? pData.name : 'SIG-DETECTED';
      const labelColor = isScanned ? vis.color : '#8899bb';
      const labelTex = createLabelTexture(labelText, labelColor);
      const labelMat = new THREE.SpriteMaterial({
        map: labelTex,
        transparent: true,
        depthTest: false,
      });
      const labelSprite = new THREE.Sprite(labelMat);
      labelSprite.scale.set(12, 3, 1);
      labelSprite.position.y = displayRadius + 4;
      group.add(labelSprite);

      scene.add(group);
      sceneObjectsRef.current.push(group);

      // Orbit line
      const orbitPoints = [];
      for (let j = 0; j <= 128; j++) {
        const angle = (j / 128) * Math.PI * 2;
        orbitPoints.push(new THREE.Vector3(
          Math.cos(angle) * pData.distance, 0, Math.sin(angle) * pData.distance
        ));
      }
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const orbitMat = new THREE.LineBasicMaterial({
        color: isScanned ? 0x3b82f6 : 0x334155,
        transparent: true,
        opacity: isScanned ? 0.3 : 0.15,
      });
      const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
      scene.add(orbitLine);
      sceneObjectsRef.current.push(orbitLine);

      // Register for raycasting
      meshToEntityRef.current.set(bodyMesh, { type: 'planet', entity: pData });

      planetObjectsRef.current.push({
        group, mesh: bodyMesh, atmoMesh, labelSprite, orbitLine, data: pData,
      });
    }

    // --- Ports (space station) ---
    for (const port of ports) {
      const stationGeo = new THREE.OctahedronGeometry(1.5, 0);
      const stationMat = new THREE.MeshPhongMaterial({
        color: 0x22d3ee,
        shininess: 60,
        emissive: 0x0e7490,
        emissiveIntensity: 0.3,
      });
      const stationMesh = new THREE.Mesh(stationGeo, stationMat);
      // Position on orbit
      const px = Math.cos(port.angle) * port.distance;
      const pz = Math.sin(port.angle) * port.distance;
      stationMesh.position.set(px, 2, pz);
      scene.add(stationMesh);
      sceneObjectsRef.current.push(stationMesh);
      meshToEntityRef.current.set(stationMesh, { type: 'port', entity: port });

      // Port label
      const pLabel = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createLabelTexture(port.name, '#22d3ee'),
        transparent: true,
        depthTest: false,
      }));
      pLabel.scale.set(10, 2.5, 1);
      pLabel.position.y = 5;
      stationMesh.add(pLabel);
    }

    // --- NPCs ---
    for (const npc of npcs) {
      const isHostile = npc.npc_type === 'PIRATE' || npc.npc_type === 'PIRATE_LORD';
      // Faction-colored NPCs: faction color > type color
      const npcColor = npc.faction && FACTION_HEX[npc.faction]
        ? FACTION_HEX[npc.faction]
        : isHostile ? 0xef4444 : 0xf59e0b;
      const npcCssColor = npc.faction && FACTION_CSS[npc.faction]
        ? FACTION_CSS[npc.faction]
        : isHostile ? '#ef4444' : '#f59e0b';

      // Simple ship shape (cone)
      const npcGeo = new THREE.ConeGeometry(0.8, 2.5, 6);
      const npcMat = new THREE.MeshPhongMaterial({
        color: npcColor,
        emissive: npcColor,
        emissiveIntensity: 0.2,
      });
      const npcMesh = new THREE.Mesh(npcGeo, npcMat);
      npcMesh.rotation.x = -Math.PI / 2; // Point forward
      const nx = Math.cos(npc.angle) * npc.distance;
      const nz = Math.sin(npc.angle) * npc.distance;
      npcMesh.position.set(nx, 1, nz);
      scene.add(npcMesh);
      sceneObjectsRef.current.push(npcMesh);
      meshToEntityRef.current.set(npcMesh, { type: 'npc', entity: npc });

      // NPC label
      const nLabel = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createLabelTexture(npc.name, npcCssColor),
        transparent: true,
        depthTest: false,
      }));
      nLabel.scale.set(10, 2.5, 1);
      nLabel.position.set(0, 3, 0);
      npcMesh.add(nLabel);
    }

    // --- Player ship near star ---
    if (currentShip) {
      // Derive in-system flight speed from ship's speed stat + engine components
      // speed stat ranges from 10 (Ion Drive) to 50 (Hyperspace Drive)
      // Map to visual in-system speed: slow, deliberate movement
      const baseSpeed = currentShip.speed || 10;
      shipSpeedRef.current = 0.3 + baseSpeed * 0.02; // 0.5 – 1.3 units/tick
      shipVelocityRef.current.set(0, 0, 0);

      const shipGeo = new THREE.ConeGeometry(1.0, 3, 6);
      const shipMat = new THREE.MeshPhongMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.4,
      });
      const shipMesh = new THREE.Mesh(shipGeo, shipMat);
      shipMesh.rotation.x = -Math.PI / 2;
      shipMesh.position.set(starConfig.radius + 5, 2, 0);
      scene.add(shipMesh);
      sceneObjectsRef.current.push(shipMesh);
      meshToEntityRef.current.set(shipMesh, { type: 'ship', entity: currentShip });
      shipMeshRef.current = shipMesh;

      // Pulsing cyan glow ring
      const pulseGeo = new THREE.TorusGeometry(2.0, 0.1, 16, 64);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4, transparent: true, opacity: 0.6,
      });
      const pulseRing = new THREE.Mesh(pulseGeo, pulseMat);
      pulseRing.rotation.x = Math.PI / 2;
      pulseRing.userData.isShipPulse = true;
      shipMesh.add(pulseRing);
      shipPulseRef.current = pulseRing;

      // Ship name label
      const shipLabelTex = createLabelTexture(currentShip.name, '#06b6d4');
      const shipLabelMat = new THREE.SpriteMaterial({
        map: shipLabelTex, transparent: true, depthTest: false,
      });
      const shipLabel = new THREE.Sprite(shipLabelMat);
      shipLabel.scale.set(10, 2.5, 1);
      shipLabel.position.set(0, 4, 0);
      shipMesh.add(shipLabel);
    }

    // --- Jump Points (connected systems) ---
    const jumpNeighbors = neighbors || [];
    if (jumpNeighbors.length > 0) {
      const jumpRadius = 120;
      const angleStep = (Math.PI * 2) / jumpNeighbors.length;

      for (let i = 0; i < jumpNeighbors.length; i++) {
        const neighbor = jumpNeighbors[i];
        const angle = angleStep * i;
        const px = Math.cos(angle) * jumpRadius;
        const pz = Math.sin(angle) * jumpRadius;
        const py = 5; // Above orbital plane

        const laneKind = neighbor.lane_class || neighbor.connection_type;
        const isWormhole = laneKind === 'wormhole';
        const isPortal = laneKind === 'portal';
        const isProtected = laneKind === 'protected';

        let portalMesh;
        if (isWormhole) {
          // Wormhole: purple dodecahedron
          const wormGeo = new THREE.DodecahedronGeometry(5, 0);
          const wormMat = new THREE.MeshPhongMaterial({
            color: 0x9b59b6, emissive: 0x9b59b6, emissiveIntensity: 0.4,
            transparent: true, opacity: 0.8,
          });
          portalMesh = new THREE.Mesh(wormGeo, wormMat);
        } else if (isPortal) {
          const portalGeo = new THREE.TorusKnotGeometry(4.5, 0.9, 72, 10);
          const portalMat = new THREE.MeshPhongMaterial({
            color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 0.45,
            transparent: true, opacity: 0.85,
          });
          portalMesh = new THREE.Mesh(portalGeo, portalMat);
        } else if (isProtected) {
          const shieldGeo = new THREE.OctahedronGeometry(5.5, 0);
          const shieldMat = new THREE.MeshPhongMaterial({
            color: 0xbfdbfe, emissive: 0x60a5fa, emissiveIntensity: 0.35,
            transparent: true, opacity: 0.75,
          });
          portalMesh = new THREE.Mesh(shieldGeo, shieldMat);
        } else {
          // Standard: cyan torus portal ring
          const portalGeo = new THREE.TorusGeometry(5, 0.5, 16, 48);
          const portalMat = new THREE.MeshPhongMaterial({
            color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.3,
            transparent: true, opacity: 0.8,
          });
          portalMesh = new THREE.Mesh(portalGeo, portalMat);
          // Orient torus facing outward from center
          portalMesh.lookAt(0, py, 0);

          // Glowing inner disc for visibility
          const discGeo = new THREE.CircleGeometry(4.5, 32);
          const discMat = new THREE.MeshBasicMaterial({
            color: 0x06b6d4, transparent: true, opacity: 0.12,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const disc = new THREE.Mesh(discGeo, discMat);
          portalMesh.add(disc);
        }
        portalMesh.position.set(px, py, pz);
        scene.add(portalMesh);
        sceneObjectsRef.current.push(portalMesh);
        meshToEntityRef.current.set(portalMesh, { type: 'jumpPoint', entity: neighbor });

        // Destination label
        const jpLabelTex = createLabelTexture(neighbor.name || `Sector ${neighbor.sector_id}`, isWormhole ? '#9b59b6' : '#06b6d4');
        const jpLabelMat = new THREE.SpriteMaterial({
          map: jpLabelTex, transparent: true, depthTest: false,
        });
        const jpLabel = new THREE.Sprite(jpLabelMat);
        jpLabel.scale.set(14, 3.5, 1);
        jpLabel.position.set(0, 8, 0);
        portalMesh.add(jpLabel);

        // Lane line from near star to jump point
        const laneGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(px * 0.08, 1, pz * 0.08),
          new THREE.Vector3(px, py, pz),
        ]);
        const laneMat = new THREE.LineBasicMaterial({
          color: isWormhole ? 0x9b59b6 : 0x06b6d4,
          transparent: true, opacity: 0.25,
        });
        const lane = new THREE.Line(laneGeo, laneMat);
        scene.add(lane);
        sceneObjectsRef.current.push(lane);

        jumpPointObjectsRef.current.push({ mesh: portalMesh, isWormhole });
      }
    }

  }, [entityData, currentShip, neighborsKey]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010103);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60, container.clientWidth / container.clientHeight, 0.1, 10000
    );
    camera.position.set(160, 130, 260);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 20;
    controls.maxDistance = 800;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controlsRef.current = controls;

    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambient);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      timeRef.current += 0.004;
      const t = timeRef.current;

      // Animate planets
      for (const po of planetObjectsRef.current) {
        const angle = t * po.data.speed + po.data.offset;
        po.group.position.set(
          Math.cos(angle) * po.data.distance,
          0,
          Math.sin(angle) * po.data.distance
        );
        po.mesh.rotation.y += po.data.rotationSpeed;
        if (po.atmoMesh) po.atmoMesh.rotation.y += po.data.rotationSpeed * 1.3;
        // Pulse unscanned planet rings
        po.group.children.forEach(child => {
          if (child.userData?.isPulse) {
            const pulse = 0.3 + Math.sin(t * 80 + po.data.offset) * 0.25;
            child.material.opacity = pulse;
            const s = 1.0 + Math.sin(t * 80 + po.data.offset) * 0.08;
            child.scale.set(s, s, s);
          }
        });
      }

      // Animate ship flight — velocity-based physics with gravity
      if (shipMeshRef.current) {
        const ship = shipMeshRef.current;
        const vel = shipVelocityRef.current;
        const maxSpeed = shipSpeedRef.current;
        const GRAVITY_STRENGTH = 0.003; // gentle pull toward orbital plane (Y=0)
        const DRAG = 0.985; // velocity damping when no target

        if (shipTargetPosRef.current) {
          const target = shipTargetPosRef.current;
          const toTarget = new THREE.Vector3().subVectors(target, ship.position);
          const dist = toTarget.length();

          if (dist < 0.5) {
            // Arrived
            ship.position.copy(target);
            shipTargetPosRef.current = null;
            vel.set(0, 0, 0);
            ship.rotation.set(-Math.PI / 2, 0, 0);
            // Remove trail
            if (shipTrailRef.current) {
              scene.remove(shipTrailRef.current);
              shipTrailRef.current.geometry?.dispose();
              shipTrailRef.current.material?.dispose();
              shipTrailRef.current = null;
            }
          } else {
            // Thrust toward target — accelerate, don't teleport
            const dir = toTarget.normalize();
            // Decelerate when close to target (brake zone = 5x speed)
            const brakeZone = maxSpeed * 5;
            const throttle = dist < brakeZone ? (dist / brakeZone) * 0.6 + 0.1 : 1.0;
            const accel = maxSpeed * 0.04 * throttle;
            vel.addScaledVector(dir, accel);

            // Apply gravity — pull toward Y=0 orbital plane (before clamp)
            vel.y -= ship.position.y * GRAVITY_STRENGTH;

            // Clamp velocity to max speed
            if (vel.length() > maxSpeed) {
              vel.normalize().multiplyScalar(maxSpeed);
            }

            // Move ship
            ship.position.add(vel);

            // Rotate ship to face velocity direction
            if (vel.length() > 0.01) {
              const flyDir = vel.clone().normalize();
              const up = new THREE.Vector3(0, 1, 0);
              const qTarget = new THREE.Quaternion().setFromUnitVectors(up, flyDir);
              ship.quaternion.slerp(qTarget, 0.06);
            }

            // Engine trail
            if (!shipTrailRef.current) {
              const trailGeo = new THREE.BufferGeometry().setFromPoints([ship.position.clone(), ship.position.clone()]);
              const trailMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.4 });
              shipTrailRef.current = new THREE.Line(trailGeo, trailMat);
              scene.add(shipTrailRef.current);
            }
            const positions = shipTrailRef.current.geometry.attributes.position;
            positions.setXYZ(1, ship.position.x, ship.position.y, ship.position.z);
            positions.needsUpdate = true;
          }
        } else {
          // No target — apply gravity + drag (ship drifts and settles)
          if (vel.length() > 0.001) {
            vel.multiplyScalar(DRAG);
            vel.y -= ship.position.y * GRAVITY_STRENGTH;
            ship.position.add(vel);
          } else if (Math.abs(ship.position.y) > 0.05) {
            // Gentle gravity settle toward orbital plane even when still
            ship.position.y *= (1 - GRAVITY_STRENGTH * 2);
          }
        }
      }

      // Animate ship pulse ring
      if (shipPulseRef.current) {
        const pulse = 0.3 + Math.sin(t * 60) * 0.3;
        shipPulseRef.current.material.opacity = pulse;
        const s = 1.0 + Math.sin(t * 60) * 0.1;
        shipPulseRef.current.scale.set(s, s, s);
      }

      // Animate jump points
      for (const jp of jumpPointObjectsRef.current) {
        jp.mesh.rotation.y += 0.005;
        if (jp.mesh.material) {
          const emPulse = 0.2 + Math.sin(t * 40) * 0.15;
          jp.mesh.material.emissiveIntensity = emPulse;
        }
      }

      // Animate selection ring
      if (selectedRingRef.current) {
        selectedRingRef.current.rotation.z += 0.02;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Rebuild scene when data changes
  useEffect(() => {
    buildScene();
  }, [buildScene]);

  // Update selection ring when selectedEntityId changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old ring
    if (selectedRingRef.current) {
      scene.remove(selectedRingRef.current);
      selectedRingRef.current.geometry?.dispose();
      selectedRingRef.current.material?.dispose();
      selectedRingRef.current = null;
    }

    if (!selectedEntityId) return;

    // Find the planet object
    const po = planetObjectsRef.current.find(p =>
      p.data.planet_id === selectedEntityId
    );
    if (po) {
      const ringGeo = new THREE.TorusGeometry(po.data.threeRadius + 1, 0.08, 16, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      po.group.add(ring);
      selectedRingRef.current = ring;
    }
  }, [selectedEntityId]);

  // Raycast helper
  const raycastEntities = useCallback((e) => {
    if (!rendererRef.current || !cameraRef.current) return null;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const clickables = Array.from(meshToEntityRef.current.keys());
    const hits = raycaster.intersectObjects(clickables);
    if (hits.length > 0) {
      return meshToEntityRef.current.get(hits[0].object) || null;
    }
    return null;
  }, []);

  // Get world position of a hit entity for ship flight target
  const getEntityWorldPos = useCallback((hitObject, hitType) => {
    if (!hitObject) return null;
    // Don't fly to the star or to self
    if (hitType === 'star' || hitType === 'ship') return null;
    const pos = new THREE.Vector3();
    hitObject.getWorldPosition(pos);
    // Offset slightly so ship doesn't overlap the entity
    const shipPos = shipMeshRef.current?.position;
    if (shipPos) {
      const dir = new THREE.Vector3().subVectors(shipPos, pos).normalize();
      // For planets, offset more (they're bigger)
      const offset = hitType === 'planet' ? 5 : hitType === 'jumpPoint' ? 6 : 3;
      pos.add(dir.multiplyScalar(offset));
    }
    pos.y = 0.5; // near orbital plane, gravity will settle
    return pos;
  }, []);

  // Click handler with raycasting (left-click selects entities only, no ship movement)
  const handleClick = useCallback((e) => {
    const hitData = raycastEntities(e);
    if (hitData) {
      onEntityClick?.(hitData.type, hitData.entity);
    }
  }, [onEntityClick, raycastEntities]);

  // Double-click handler
  const handleDoubleClick = useCallback((e) => {
    const hitData = raycastEntities(e);
    if (hitData) {
      onEntityDoubleClick?.(hitData.type, hitData.entity);
    }
  }, [onEntityDoubleClick, raycastEntities]);

  // Right-click handler for entities and empty space
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    const hitData = raycastEntities(e);
    if (hitData) {
      onEntityRightClick?.(hitData.type, hitData.entity);
    } else if (shipMeshRef.current) {
      // Right-click empty space — fly ship to that point on the orbital plane
      if (!rendererRef.current || !cameraRef.current) return;
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const point = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, point)) {
        point.y = 0.5; // slight offset, gravity will settle ship down
        shipTargetPosRef.current = point;
      }
    }
  }, [raycastEntities, onEntityRightClick]);

  // Hover cursor feedback
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const hitData = raycastEntities(e);
    containerRef.current.style.cursor = hitData ? 'pointer' : 'crosshair';
  }, [raycastEntities]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMouseMove}
      onContextMenu={handleContextMenu}
      style={{ cursor: 'grab' }}
    />
  );
};

export default SystemViewCanvas;
