const fs = require('fs');
const path = require('path');

// Create SVG ships
const generateShip = (type, color, size) => {
  const shipTypes = {
    fighter: `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,10 20,80 50,65 80,80" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="50" cy="40" r="10" fill="#ffffff" opacity="0.5"/>
    </svg>`,
    
    cruiser: `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="35" y="20" width="30" height="60" rx="5" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <polygon points="35,40 20,60 35,80" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <polygon points="65,40 80,60 65,80" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="50" cy="30" r="8" fill="#ffffff" opacity="0.5"/>
    </svg>`,
    
    freighter: `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="30" y="30" width="40" height="50" rx="5" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <rect x="40" y="20" width="20" height="10" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <rect x="25" y="50" width="50" height="20" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="50" cy="40" r="5" fill="#ffffff" opacity="0.5"/>
    </svg>`,
    
    explorer: `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="30" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <polygon points="20,50 10,40 10,60" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <polygon points="80,50 90,40 90,60" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="50" cy="50" r="10" fill="#ffffff" opacity="0.5"/>
    </svg>`,
    
    battleship: `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,10 30,30 30,80 70,80 70,30" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <rect x="40" y="80" width="20" height="10" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <rect x="20" y="50" width="10" height="20" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <rect x="70" y="50" width="10" height="20" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="50" cy="40" r="8" fill="#ffffff" opacity="0.5"/>
    </svg>`
  };
  
  return shipTypes[type] || shipTypes.fighter;
};

// Ship configurations
const ships = [
  { name: 'fighter-blue', type: 'fighter', color: '#4a4aff', size: 50 },
  { name: 'fighter-red', type: 'fighter', color: '#ff4a4a', size: 50 },
  { name: 'cruiser-blue', type: 'cruiser', color: '#4a4aff', size: 60 },
  { name: 'cruiser-red', type: 'cruiser', color: '#ff4a4a', size: 60 },
  { name: 'freighter-blue', type: 'freighter', color: '#4a4aff', size: 70 },
  { name: 'freighter-red', type: 'freighter', color: '#ff4a4a', size: 70 },
  { name: 'explorer-blue', type: 'explorer', color: '#4a4aff', size: 60 },
  { name: 'explorer-red', type: 'explorer', color: '#ff4a4a', size: 60 },
  { name: 'battleship-blue', type: 'battleship', color: '#4a4aff', size: 80 },
  { name: 'battleship-red', type: 'battleship', color: '#ff4a4a', size: 80 }
];

// Generate and save all ships
ships.forEach(ship => {
  const svgContent = generateShip(ship.type, ship.color, ship.size);
  fs.writeFileSync(path.join(__dirname, `${ship.name}.svg`), svgContent);
  console.log(`Generated ${ship.name}.svg`);
});

console.log('All ship images generated successfully!');
