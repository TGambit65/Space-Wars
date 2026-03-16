const fs = require('fs');
const path = require('path');

// Create SVG space backgrounds
const generateBackground = (type, colors, size) => {
  const backgroundTypes = {
    starfield: `<svg width="${size}" height="${size}" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
      <rect width="1000" height="1000" fill="${colors[0]}"/>
      ${Array(200).fill().map(() => {
        const x = Math.floor(Math.random() * 1000);
        const y = Math.floor(Math.random() * 1000);
        const r = Math.random() * 2 + 0.5;
        const opacity = Math.random() * 0.8 + 0.2;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="${colors[1]}" opacity="${opacity}"/>`;
      }).join('')}
      ${Array(50).fill().map(() => {
        const x = Math.floor(Math.random() * 1000);
        const y = Math.floor(Math.random() * 1000);
        const r = Math.random() * 3 + 1;
        const opacity = Math.random() * 0.8 + 0.2;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="${colors[2]}" opacity="${opacity}"/>`;
      }).join('')}
    </svg>`,
    
    nebula: `<svg width="${size}" height="${size}" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="nebulaGradient" cx="50%" cy="50%" r="70%" fx="50%" fy="50%">
          <stop offset="0%" stop-color="${colors[1]}" stop-opacity="0.1"/>
          <stop offset="50%" stop-color="${colors[1]}" stop-opacity="0.05"/>
          <stop offset="100%" stop-color="${colors[1]}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="nebulaGradient2" cx="30%" cy="30%" r="50%" fx="30%" fy="30%">
          <stop offset="0%" stop-color="${colors[2]}" stop-opacity="0.1"/>
          <stop offset="50%" stop-color="${colors[2]}" stop-opacity="0.05"/>
          <stop offset="100%" stop-color="${colors[2]}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1000" height="1000" fill="${colors[0]}"/>
      <circle cx="500" cy="500" r="400" fill="url(#nebulaGradient)"/>
      <circle cx="300" cy="300" r="300" fill="url(#nebulaGradient2)"/>
      ${Array(300).fill().map(() => {
        const x = Math.floor(Math.random() * 1000);
        const y = Math.floor(Math.random() * 1000);
        const r = Math.random() * 2 + 0.5;
        const opacity = Math.random() * 0.8 + 0.2;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="${opacity}"/>`;
      }).join('')}
    </svg>`,
    
    galaxy: `<svg width="${size}" height="${size}" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="galaxyGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stop-color="${colors[1]}" stop-opacity="0.3"/>
          <stop offset="70%" stop-color="${colors[1]}" stop-opacity="0.1"/>
          <stop offset="100%" stop-color="${colors[1]}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1000" height="1000" fill="${colors[0]}"/>
      <ellipse cx="500" cy="500" rx="400" ry="200" fill="url(#galaxyGradient)" transform="rotate(45, 500, 500)"/>
      ${Array(400).fill().map((_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 350;
        const x = 500 + Math.cos(angle) * distance;
        const y = 500 + Math.sin(angle) * distance;
        const r = Math.random() * 2 + 0.5;
        const opacity = Math.random() * 0.8 + 0.2;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 5 === 0 ? colors[2] : 'white'}" opacity="${opacity}"/>`;
      }).join('')}
    </svg>`,
    
    deepspace: `<svg width="${size}" height="${size}" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
      <rect width="1000" height="1000" fill="${colors[0]}"/>
      ${Array(500).fill().map(() => {
        const x = Math.floor(Math.random() * 1000);
        const y = Math.floor(Math.random() * 1000);
        const r = Math.random() * 1.5 + 0.2;
        const opacity = Math.random() * 0.7 + 0.3;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="${opacity}"/>`;
      }).join('')}
      ${Array(20).fill().map(() => {
        const x = Math.floor(Math.random() * 1000);
        const y = Math.floor(Math.random() * 1000);
        const r = Math.random() * 100 + 50;
        const opacity = Math.random() * 0.05 + 0.02;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="${colors[1]}" opacity="${opacity}"/>`;
      }).join('')}
      ${Array(10).fill().map(() => {
        const x = Math.floor(Math.random() * 1000);
        const y = Math.floor(Math.random() * 1000);
        const r = Math.random() * 80 + 30;
        const opacity = Math.random() * 0.05 + 0.02;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="${colors[2]}" opacity="${opacity}"/>`;
      }).join('')}
    </svg>`
  };
  
  return backgroundTypes[type] || backgroundTypes.starfield;
};

// Background configurations
const backgrounds = [
  { name: 'starfield-blue', type: 'starfield', colors: ['#0a0a2a', '#ffffff', '#4a4aff'], size: 1000 },
  { name: 'starfield-purple', type: 'starfield', colors: ['#1a0a2a', '#ffffff', '#aa4aff'], size: 1000 },
  { name: 'nebula-blue', type: 'nebula', colors: ['#0a0a2a', '#4a4aff', '#4affff'], size: 1000 },
  { name: 'nebula-purple', type: 'nebula', colors: ['#1a0a2a', '#aa4aff', '#ff4aaa'], size: 1000 },
  { name: 'galaxy-blue', type: 'galaxy', colors: ['#0a0a2a', '#4a4aff', '#4affff'], size: 1000 },
  { name: 'galaxy-green', type: 'galaxy', colors: ['#0a1a0a', '#4aff4a', '#4affff'], size: 1000 },
  { name: 'deepspace-dark', type: 'deepspace', colors: ['#050510', '#4a4aff', '#aa4aff'], size: 1000 },
  { name: 'deepspace-black', type: 'deepspace', colors: ['#000005', '#4a4aff', '#4affff'], size: 1000 },
  { name: 'hero-background', type: 'deepspace', colors: ['#0a0a2a', '#4a4aff', '#4affff'], size: 1920 }
];

// Generate and save all backgrounds
backgrounds.forEach(bg => {
  const svgContent = generateBackground(bg.type, bg.colors, bg.size);
  fs.writeFileSync(path.join(__dirname, `${bg.name}.svg`), svgContent);
  console.log(`Generated ${bg.name}.svg`);
});

console.log('All background images generated successfully!');
