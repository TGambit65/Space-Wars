/**
 * Procedural SVG surface pattern generators for each planet type.
 * Uses a seeded RNG from planet_id for deterministic patterns.
 * All SVGs are 2x wide (700px) for seamless CSS translateX(-50%) rotation.
 */

const SVG_WIDTH = 700;
const SVG_HEIGHT = 350;

// Seeded pseudo-random number generator (mulberry32)
function createRNG(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromId(planetId) {
  if (typeof planetId === 'number') return planetId * 2654435761;
  let hash = 0;
  const str = String(planetId);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// Helper: generate a random blobby path
function blobPath(rng, cx, cy, radius, points = 8) {
  const angles = [];
  for (let i = 0; i < points; i++) {
    angles.push((i / points) * Math.PI * 2);
  }
  const pts = angles.map(a => {
    const r = radius * (0.7 + rng() * 0.6);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i <= pts.length; i++) {
    const p0 = pts[(i - 1) % pts.length];
    const p1 = pts[i % pts.length];
    const mx = (p0[0] + p1[0]) / 2;
    const my = (p0[1] + p1[1]) / 2;
    d += ` Q ${p0[0]} ${p0[1]} ${mx} ${my}`;
  }
  d += ' Z';
  return d;
}

// Helper: wavy horizontal line
function wavyLine(rng, y, amplitude, segments) {
  let d = `M 0 ${y}`;
  const segWidth = SVG_WIDTH / segments;
  for (let i = 1; i <= segments; i++) {
    const cx = (i - 0.5) * segWidth;
    const cy = y + (rng() - 0.5) * amplitude * 2;
    const ex = i * segWidth;
    const ey = y + (rng() - 0.5) * amplitude;
    d += ` Q ${cx} ${cy} ${ex} ${ey}`;
  }
  return d;
}

// TERRAN: Blue ocean + green/brown continents + white polar caps
function generateTerran(rng) {
  let elements = '';
  // Ocean base
  elements += `<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#2B6CB0"/>`;
  // Continents
  const continentColors = ['#4A7C3F', '#5B8C4A', '#6B5B3A', '#5A7A3E', '#7A8B4A'];
  for (let i = 0; i < 8; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = 40 + rng() * (SVG_HEIGHT - 80);
    const r = 25 + rng() * 50;
    const color = continentColors[Math.floor(rng() * continentColors.length)];
    elements += `<path d="${blobPath(rng, cx, cy, r, 6 + Math.floor(rng() * 4))}" fill="${color}" opacity="0.9"/>`;
    // Mountain highlights
    if (rng() > 0.5) {
      elements += `<path d="${blobPath(rng, cx + rng() * 10, cy + rng() * 10, r * 0.4, 5)}" fill="#8B7355" opacity="0.6"/>`;
    }
  }
  // Polar caps
  elements += `<ellipse cx="${SVG_WIDTH / 2}" cy="8" rx="${SVG_WIDTH / 2}" ry="25" fill="white" opacity="0.7"/>`;
  elements += `<ellipse cx="${SVG_WIDTH / 2}" cy="${SVG_HEIGHT - 8}" rx="${SVG_WIDTH / 2}" ry="20" fill="white" opacity="0.6"/>`;
  // Duplicate continents for seamless wrap
  for (let i = 0; i < 4; i++) {
    const cx = rng() * (SVG_WIDTH / 2) + SVG_WIDTH / 2;
    const cy = 50 + rng() * (SVG_HEIGHT - 100);
    const r = 20 + rng() * 40;
    const color = continentColors[Math.floor(rng() * continentColors.length)];
    elements += `<path d="${blobPath(rng, cx, cy, r, 6)}" fill="${color}" opacity="0.85"/>`;
  }
  return elements;
}

// DESERT: Sandy base + dune ridges + rock formations
function generateDesert(rng) {
  let elements = '';
  elements += `<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#D4A574"/>`;
  // Darker sand patches
  for (let i = 0; i < 6; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 30 + rng() * 60;
    elements += `<path d="${blobPath(rng, cx, cy, r, 6)}" fill="#C49464" opacity="0.5"/>`;
  }
  // Dune ridge lines
  for (let i = 0; i < 12; i++) {
    const y = 20 + rng() * (SVG_HEIGHT - 40);
    const d = wavyLine(rng, y, 8, 14);
    elements += `<path d="${d}" fill="none" stroke="#B8834A" stroke-width="${1 + rng() * 2}" opacity="0.6"/>`;
  }
  // Rock formations
  for (let i = 0; i < 10; i++) {
    const x = rng() * SVG_WIDTH;
    const y = rng() * SVG_HEIGHT;
    const size = 3 + rng() * 8;
    elements += `<circle cx="${x}" cy="${y}" r="${size}" fill="#8B6B4A" opacity="0.7"/>`;
  }
  // Lighter sand streaks
  for (let i = 0; i < 5; i++) {
    const y = rng() * SVG_HEIGHT;
    const d = wavyLine(rng, y, 5, 10);
    elements += `<path d="${d}" fill="none" stroke="#E8C494" stroke-width="3" opacity="0.4"/>`;
  }
  return elements;
}

// ICE: Cyan base + white ice sheets + blue cracks
function generateIce(rng) {
  let elements = '';
  elements += `<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#A8D8EA"/>`;
  // Large ice sheets
  for (let i = 0; i < 6; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 30 + rng() * 70;
    elements += `<path d="${blobPath(rng, cx, cy, r, 5 + Math.floor(rng() * 3))}" fill="#E8F4F8" opacity="0.8"/>`;
  }
  // Glacier formations
  for (let i = 0; i < 4; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 20 + rng() * 40;
    elements += `<path d="${blobPath(rng, cx, cy, r, 4)}" fill="#D0EAF0" opacity="0.6"/>`;
  }
  // Cracks/fissures
  for (let i = 0; i < 15; i++) {
    const x1 = rng() * SVG_WIDTH;
    const y1 = rng() * SVG_HEIGHT;
    let d = `M ${x1} ${y1}`;
    const segs = 3 + Math.floor(rng() * 4);
    for (let j = 0; j < segs; j++) {
      const dx = (rng() - 0.5) * 40;
      const dy = (rng() - 0.5) * 30;
      d += ` l ${dx} ${dy}`;
    }
    elements += `<path d="${d}" fill="none" stroke="#5B9BB5" stroke-width="${0.5 + rng() * 1.5}" opacity="0.7"/>`;
  }
  // Surface frost sparkles
  for (let i = 0; i < 20; i++) {
    elements += `<circle cx="${rng() * SVG_WIDTH}" cy="${rng() * SVG_HEIGHT}" r="${1 + rng() * 2}" fill="white" opacity="${0.4 + rng() * 0.4}"/>`;
  }
  return elements;
}

// VOLCANIC: Dark base + lava rivers + craters
function generateVolcanic(rng) {
  let elements = '';
  elements += `<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#3D2B1F"/>`;
  // Dark rocky patches
  for (let i = 0; i < 8; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 20 + rng() * 50;
    elements += `<path d="${blobPath(rng, cx, cy, r, 5)}" fill="#2A1F15" opacity="0.6"/>`;
  }
  // Lava rivers
  for (let i = 0; i < 8; i++) {
    const y = rng() * SVG_HEIGHT;
    const d = wavyLine(rng, y, 15, 10);
    const colors = ['#FF4500', '#FF6B35', '#FF8C00', '#FF3300'];
    const color = colors[Math.floor(rng() * colors.length)];
    elements += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${1 + rng() * 3}" opacity="0.8"/>`;
  }
  // Craters
  for (let i = 0; i < 12; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 5 + rng() * 15;
    elements += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#1A1008" stroke="#5A3A1A" stroke-width="1" opacity="0.7"/>`;
    // Glow inside some craters
    if (rng() > 0.5) {
      elements += `<circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="#FF4500" opacity="0.4"/>`;
    }
  }
  // Ember particles
  for (let i = 0; i < 15; i++) {
    elements += `<circle cx="${rng() * SVG_WIDTH}" cy="${rng() * SVG_HEIGHT}" r="${1 + rng()}" fill="#FF6B35" opacity="${0.3 + rng() * 0.5}"/>`;
  }
  return elements;
}

// GAS GIANT: Amber base + horizontal bands + storm spots
function generateGasGiant(rng) {
  let elements = '';
  elements += `<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#D4A06A"/>`;
  // Horizontal bands
  const bandColors = ['#C49058', '#B8804A', '#E0B87A', '#A87040', '#D4A870', '#C89060', '#E8C490'];
  const bandCount = 10 + Math.floor(rng() * 6);
  const bandHeight = SVG_HEIGHT / bandCount;
  for (let i = 0; i < bandCount; i++) {
    const y = i * bandHeight;
    const color = bandColors[Math.floor(rng() * bandColors.length)];
    const wobble = (rng() - 0.5) * 4;
    elements += `<rect x="0" y="${y + wobble}" width="${SVG_WIDTH}" height="${bandHeight * (0.8 + rng() * 0.4)}" fill="${color}" opacity="${0.6 + rng() * 0.3}"/>`;
  }
  // Wavy band edges
  for (let i = 0; i < 6; i++) {
    const y = rng() * SVG_HEIGHT;
    const d = wavyLine(rng, y, 4, 20);
    elements += `<path d="${d}" fill="none" stroke="#C08050" stroke-width="${1 + rng() * 2}" opacity="0.5"/>`;
  }
  // Storm spots (oval)
  for (let i = 0; i < 3; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = 60 + rng() * (SVG_HEIGHT - 120);
    const rx = 10 + rng() * 25;
    const ry = 6 + rng() * 12;
    const stormColors = ['#A05030', '#B86040', '#904020'];
    elements += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${stormColors[Math.floor(rng() * stormColors.length)]}" opacity="0.7"/>`;
    elements += `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.6}" ry="${ry * 0.6}" fill="#C07050" opacity="0.4"/>`;
  }
  return elements;
}

// OCEANIC: Deep blue + wave patterns + island specks
function generateOceanic(rng) {
  let elements = '';
  elements += `<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#1565C0"/>`;
  // Darker depth patches
  for (let i = 0; i < 6; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 40 + rng() * 60;
    elements += `<path d="${blobPath(rng, cx, cy, r, 6)}" fill="#0D47A1" opacity="0.4"/>`;
  }
  // Wave patterns
  for (let i = 0; i < 18; i++) {
    const y = rng() * SVG_HEIGHT;
    const d = wavyLine(rng, y, 6, 16);
    elements += `<path d="${d}" fill="none" stroke="#2196F3" stroke-width="${0.5 + rng()}" opacity="0.4"/>`;
  }
  // Lighter surface reflections
  for (let i = 0; i < 8; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 15 + rng() * 30;
    elements += `<path d="${blobPath(rng, cx, cy, r, 5)}" fill="#42A5F5" opacity="0.2"/>`;
  }
  // Tiny island specks
  for (let i = 0; i < 8; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = 30 + rng() * (SVG_HEIGHT - 60);
    const r = 2 + rng() * 5;
    elements += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#4CAF50" opacity="0.6"/>`;
  }
  // Polar ice hints
  elements += `<ellipse cx="${SVG_WIDTH / 2}" cy="5" rx="${SVG_WIDTH / 2}" ry="12" fill="white" opacity="0.3"/>`;
  elements += `<ellipse cx="${SVG_WIDTH / 2}" cy="${SVG_HEIGHT - 5}" rx="${SVG_WIDTH / 2}" ry="10" fill="white" opacity="0.25"/>`;
  return elements;
}

// BARREN: Grey/brown + craters + rocky dots
function generateBarren(rng) {
  let elements = '';
  elements += `<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#7A6B55"/>`;
  // Terrain variation
  for (let i = 0; i < 8; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 30 + rng() * 60;
    const shade = Math.floor(rng() * 30) + 80;
    elements += `<path d="${blobPath(rng, cx, cy, r, 5)}" fill="rgb(${shade}, ${shade - 10}, ${shade - 20})" opacity="0.4"/>`;
  }
  // Craters (many sizes)
  for (let i = 0; i < 25; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 3 + rng() * 20;
    elements += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#685840" stroke="#5A4A35" stroke-width="0.5" opacity="0.6"/>`;
    // Crater shadow
    elements += `<path d="M ${cx - r * 0.7} ${cy} A ${r * 0.7} ${r * 0.5} 0 0 1 ${cx + r * 0.7} ${cy}" fill="#4A3A28" opacity="0.3"/>`;
  }
  // Rocky texture dots
  for (let i = 0; i < 40; i++) {
    elements += `<circle cx="${rng() * SVG_WIDTH}" cy="${rng() * SVG_HEIGHT}" r="${0.5 + rng() * 2}" fill="#5A4A35" opacity="${0.3 + rng() * 0.3}"/>`;
  }
  return elements;
}

// JUNGLE: Green base + canopy + rivers + clearings
function generateJungle(rng) {
  let elements = '';
  elements += `<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#2E7D32"/>`;
  // Dense canopy patches
  for (let i = 0; i < 12; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 20 + rng() * 50;
    const greens = ['#1B5E20', '#256427', '#1A5218', '#2D6B30'];
    elements += `<path d="${blobPath(rng, cx, cy, r, 7)}" fill="${greens[Math.floor(rng() * greens.length)]}" opacity="0.7"/>`;
  }
  // Lighter canopy highlights
  for (let i = 0; i < 8; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 15 + rng() * 30;
    elements += `<path d="${blobPath(rng, cx, cy, r, 6)}" fill="#4CAF50" opacity="0.3"/>`;
  }
  // Rivers (brown)
  for (let i = 0; i < 4; i++) {
    const y = 30 + rng() * (SVG_HEIGHT - 60);
    const d = wavyLine(rng, y, 10, 12);
    elements += `<path d="${d}" fill="none" stroke="#5D4037" stroke-width="${1 + rng() * 2}" opacity="0.6"/>`;
  }
  // Yellow clearings
  for (let i = 0; i < 5; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 5 + rng() * 12;
    elements += `<path d="${blobPath(rng, cx, cy, r, 5)}" fill="#C8B44A" opacity="0.4"/>`;
  }
  // Polar transition
  elements += `<ellipse cx="${SVG_WIDTH / 2}" cy="5" rx="${SVG_WIDTH / 2}" ry="15" fill="#5D8A5E" opacity="0.5"/>`;
  elements += `<ellipse cx="${SVG_WIDTH / 2}" cy="${SVG_HEIGHT - 5}" rx="${SVG_WIDTH / 2}" ry="15" fill="#5D8A5E" opacity="0.5"/>`;
  return elements;
}

// TOXIC: Yellow-green base + swirling clouds + patches
function generateToxic(rng) {
  let elements = '';
  elements += `<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#8B9A2B"/>`;
  // Darker toxic patches
  for (let i = 0; i < 8; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 25 + rng() * 50;
    const colors = ['#6B7A1B', '#5A6A10', '#7A6B30'];
    elements += `<path d="${blobPath(rng, cx, cy, r, 6)}" fill="${colors[Math.floor(rng() * colors.length)]}" opacity="0.5"/>`;
  }
  // Purple/brown toxic patches
  for (let i = 0; i < 5; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 15 + rng() * 35;
    const colors = ['#5A3A6B', '#6B4A3A', '#4A3050'];
    elements += `<path d="${blobPath(rng, cx, cy, r, 7)}" fill="${colors[Math.floor(rng() * colors.length)]}" opacity="0.4"/>`;
  }
  // Swirling patterns
  for (let i = 0; i < 8; i++) {
    const y = rng() * SVG_HEIGHT;
    const d = wavyLine(rng, y, 12, 12);
    elements += `<path d="${d}" fill="none" stroke="#A0B030" stroke-width="${1 + rng() * 2}" opacity="0.4"/>`;
  }
  // Bubbling spots
  for (let i = 0; i < 15; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 2 + rng() * 6;
    elements += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#BFCF40" opacity="0.3"/>`;
  }
  return elements;
}

// CRYSTALLINE: Purple/lavender base + geometric facets + sparkles
function generateCrystalline(rng) {
  let elements = '';
  elements += `<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#9B89B3"/>`;
  // Lighter lavender patches
  for (let i = 0; i < 6; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 25 + rng() * 50;
    elements += `<path d="${blobPath(rng, cx, cy, r, 4)}" fill="#B8A8D0" opacity="0.5"/>`;
  }
  // Crystal facet shapes (angular polygons)
  for (let i = 0; i < 15; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const size = 8 + rng() * 25;
    const sides = 3 + Math.floor(rng() * 4); // triangles to hexagons
    let points = '';
    for (let j = 0; j < sides; j++) {
      const angle = (j / sides) * Math.PI * 2 + rng() * 0.3;
      const r = size * (0.8 + rng() * 0.4);
      points += `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r} `;
    }
    const colors = ['#C8B8E8', '#D8C8F0', '#A898C8', '#E0D0F8', '#B0A0D0'];
    const color = colors[Math.floor(rng() * colors.length)];
    elements += `<polygon points="${points.trim()}" fill="${color}" opacity="0.6" stroke="#D0C0E8" stroke-width="0.5"/>`;
  }
  // Sharp crystal lines
  for (let i = 0; i < 10; i++) {
    const x1 = rng() * SVG_WIDTH;
    const y1 = rng() * SVG_HEIGHT;
    const x2 = x1 + (rng() - 0.5) * 60;
    const y2 = y1 + (rng() - 0.5) * 40;
    elements += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#E0D0FF" stroke-width="0.5" opacity="0.5"/>`;
  }
  // Sparkle spots
  for (let i = 0; i < 25; i++) {
    const cx = rng() * SVG_WIDTH;
    const cy = rng() * SVG_HEIGHT;
    const r = 1 + rng() * 2;
    elements += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" opacity="${0.4 + rng() * 0.5}"/>`;
  }
  return elements;
}

const generators = {
  'Terran': generateTerran,
  'Desert': generateDesert,
  'Ice': generateIce,
  'Volcanic': generateVolcanic,
  'Gas Giant': generateGasGiant,
  'Oceanic': generateOceanic,
  'Barren': generateBarren,
  'Jungle': generateJungle,
  'Toxic': generateToxic,
  'Crystalline': generateCrystalline,
};

/**
 * Generate surface SVG markup for a planet.
 * Returns an SVG string (no <svg> wrapper) sized at 700x350 for seamless scrolling.
 */
export function generateSurfaceSVG(planetType, planetId) {
  const rng = createRNG(seedFromId(planetId));
  const generator = generators[planetType] || generateBarren;
  const elements = generator(rng);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">${elements}</svg>`;
}

// Types that have visible atmosphere / clouds
const ATMOSPHERIC_TYPES = ['Terran', 'Oceanic', 'Jungle', 'Toxic', 'Ice', 'Gas Giant'];

export function hasAtmosphere(planetType) {
  return ATMOSPHERIC_TYPES.includes(planetType);
}

/**
 * Generate cloud layer SVG for atmospheric planets.
 */
export function generateCloudSVG(planetType, planetId) {
  const rng = createRNG(seedFromId(planetId) + 99999);
  let elements = '';

  if (planetType === 'Gas Giant') {
    // Gas giant: thick horizontal turbulence bands
    for (let i = 0; i < 8; i++) {
      const y = rng() * SVG_HEIGHT;
      const d = wavyLine(rng, y, 10, 16);
      elements += `<path d="${d}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="${3 + rng() * 5}"/>`;
    }
    for (let i = 0; i < 4; i++) {
      const cx = rng() * SVG_WIDTH;
      const cy = rng() * SVG_HEIGHT;
      const r = 15 + rng() * 30;
      elements += `<path d="${blobPath(rng, cx, cy, r, 6)}" fill="rgba(255,255,255,0.08)"/>`;
    }
  } else if (planetType === 'Toxic') {
    // Toxic: sickly green-tinted clouds
    for (let i = 0; i < 10; i++) {
      const cx = rng() * SVG_WIDTH;
      const cy = rng() * SVG_HEIGHT;
      const r = 25 + rng() * 50;
      const opacity = 0.08 + rng() * 0.12;
      elements += `<path d="${blobPath(rng, cx, cy, r, 6)}" fill="rgba(180,210,80,${opacity})"/>`;
    }
  } else {
    // Normal clouds: white/grey swirls
    for (let i = 0; i < 10; i++) {
      const cx = rng() * SVG_WIDTH;
      const cy = rng() * SVG_HEIGHT;
      const r = 20 + rng() * 50;
      const opacity = 0.1 + rng() * 0.15;
      elements += `<path d="${blobPath(rng, cx, cy, r, 7)}" fill="rgba(255,255,255,${opacity})"/>`;
    }
    // Wispy streaks
    for (let i = 0; i < 5; i++) {
      const y = rng() * SVG_HEIGHT;
      const d = wavyLine(rng, y, 8, 12);
      elements += `<path d="${d}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="${2 + rng() * 4}"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">${elements}</svg>`;
}

// Planet type visual properties (atmosphere color, rotation speed, etc.)
export const PLANET_VISUALS = {
  'Terran':     { glow: '#4A90D9', glowIntensity: 0.6, surfaceSpeed: 80,  cloudSpeed: 55 },
  'Desert':     { glow: '#D4A574', glowIntensity: 0.3, surfaceSpeed: 100, cloudSpeed: 0 },
  'Ice':        { glow: '#B8E4F0', glowIntensity: 0.5, surfaceSpeed: 110, cloudSpeed: 70 },
  'Volcanic':   { glow: '#FF6B35', glowIntensity: 0.7, surfaceSpeed: 90,  cloudSpeed: 0 },
  'Gas Giant':  { glow: '#E8B4A0', glowIntensity: 0.4, surfaceSpeed: 60,  cloudSpeed: 40 },
  'Oceanic':    { glow: '#1E90FF', glowIntensity: 0.6, surfaceSpeed: 85,  cloudSpeed: 50 },
  'Barren':     { glow: '#8B7355', glowIntensity: 0.2, surfaceSpeed: 120, cloudSpeed: 0 },
  'Jungle':     { glow: '#228B22', glowIntensity: 0.5, surfaceSpeed: 75,  cloudSpeed: 50 },
  'Toxic':      { glow: '#9ACD32', glowIntensity: 0.6, surfaceSpeed: 70,  cloudSpeed: 45 },
  'Crystalline': { glow: '#E6E6FA', glowIntensity: 0.5, surfaceSpeed: 130, cloudSpeed: 0 },
};
