const fs = require('fs');
const path = require('path');

// Create SVG planets
const generatePlanet = (type, colors, size) => {
  const planetTypes = {
    earth: `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="earthGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stop-color="${colors[0]}" />
          <stop offset="100%" stop-color="${colors[1]}" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="40" fill="url(#earthGradient)" stroke="#ffffff" stroke-width="1"/>
      <path d="M30,40 Q50,20 70,40 T90,60" fill="none" stroke="${colors[2]}" stroke-width="3" opacity="0.7"/>
      <path d="M20,50 Q40,30 60,50 T80,70" fill="none" stroke="${colors[2]}" stroke-width="3" opacity="0.7"/>
    </svg>`,
    
    gas: `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="gasGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stop-color="${colors[0]}" />
          <stop offset="100%" stop-color="${colors[1]}" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="40" fill="url(#gasGradient)" stroke="#ffffff" stroke-width="1"/>
      <ellipse cx="50" cy="50" rx="40" ry="5" fill="none" stroke="${colors[2]}" stroke-width="1" opacity="0.7"/>
      <ellipse cx="50" cy="50" rx="35" ry="15" fill="none" stroke="${colors[2]}" stroke-width="1" opacity="0.5"/>
      <ellipse cx="50" cy="50" rx="30" ry="25" fill="none" stroke="${colors[2]}" stroke-width="1" opacity="0.3"/>
    </svg>`,
    
    desert: `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="desertGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stop-color="${colors[0]}" />
          <stop offset="100%" stop-color="${colors[1]}" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="40" fill="url(#desertGradient)" stroke="#ffffff" stroke-width="1"/>
      <circle cx="30" cy="40" r="8" fill="${colors[2]}" opacity="0.7"/>
      <circle cx="60" cy="30" r="5" fill="${colors[2]}" opacity="0.7"/>
      <circle cx="70" cy="60" r="10" fill="${colors[2]}" opacity="0.7"/>
    </svg>`,
    
    ice: `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="iceGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stop-color="${colors[0]}" />
          <stop offset="100%" stop-color="${colors[1]}" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="40" fill="url(#iceGradient)" stroke="#ffffff" stroke-width="1"/>
      <path d="M30,30 L40,40 M60,30 L50,40 M70,50 L60,60 M30,70 L40,60" stroke="${colors[2]}" stroke-width="2" opacity="0.8"/>
    </svg>`,
    
    lava: `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="lavaGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stop-color="${colors[0]}" />
          <stop offset="100%" stop-color="${colors[1]}" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="40" fill="url(#lavaGradient)" stroke="#ffffff" stroke-width="1"/>
      <circle cx="40" cy="30" r="5" fill="${colors[2]}" opacity="0.8"/>
      <circle cx="60" cy="40" r="7" fill="${colors[2]}" opacity="0.8"/>
      <circle cx="30" cy="60" r="6" fill="${colors[2]}" opacity="0.8"/>
      <circle cx="70" cy="65" r="4" fill="${colors[2]}" opacity="0.8"/>
    </svg>`
  };
  
  return planetTypes[type] || planetTypes.earth;
};

// Planet configurations
const planets = [
  { name: 'earth-blue', type: 'earth', colors: ['#4a4aff', '#1a1a7a', '#ffffff'], size: 200 },
  { name: 'earth-green', type: 'earth', colors: ['#4aff4a', '#1a7a1a', '#ffffff'], size: 200 },
  { name: 'gas-purple', type: 'gas', colors: ['#aa4aff', '#6a1a7a', '#ffffff'], size: 200 },
  { name: 'gas-orange', type: 'gas', colors: ['#ffaa4a', '#7a6a1a', '#ffffff'], size: 200 },
  { name: 'desert-orange', type: 'desert', colors: ['#ff8c4a', '#7a4a1a', '#ffcc4a'], size: 200 },
  { name: 'desert-red', type: 'desert', colors: ['#ff4a4a', '#7a1a1a', '#ff8c4a'], size: 200 },
  { name: 'ice-blue', type: 'ice', colors: ['#4affff', '#1a7a7a', '#ffffff'], size: 200 },
  { name: 'ice-white', type: 'ice', colors: ['#ffffff', '#ccccff', '#4affff'], size: 200 },
  { name: 'lava-red', type: 'lava', colors: ['#ff4a4a', '#7a1a1a', '#ffff4a'], size: 200 },
  { name: 'lava-orange', type: 'lava', colors: ['#ff8c4a', '#7a4a1a', '#ffff4a'], size: 200 }
];

// Generate and save all planets
planets.forEach(planet => {
  const svgContent = generatePlanet(planet.type, planet.colors, planet.size);
  fs.writeFileSync(path.join(__dirname, `${planet.name}.svg`), svgContent);
  console.log(`Generated ${planet.name}.svg`);
});

console.log('All planet images generated successfully!');
