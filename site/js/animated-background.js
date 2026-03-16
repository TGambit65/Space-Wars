// Animated Background Loader
document.addEventListener('DOMContentLoaded', function() {
  // Create a container for the animated background if it doesn't exist
  if (!document.getElementById('bgSpace-container')) {
    // Create a div to hold the SVG
    const container = document.createElement('div');
    container.id = 'bgSpace-container';
    
    // Load the SVG from the file
    fetch('/space-background.svg')
      .then(response => response.text())
      .then(svgText => {
        container.innerHTML = svgText;
        document.body.prepend(container);
        
        // Initialize the ship animation
        initShipAnimation();
      })
      .catch(error => console.error('Error loading background:', error));
  }
});

function initShipAnimation() {
  const SVGNS = "http://www.w3.org/2000/svg";
  const shipsLayer = document.getElementById('ships');
  if (!shipsLayer) return;
  
  const viewW = 1920, viewH = 1080;

  function rand(min, max) { 
    return Math.random() * (max - min) + min;
  }

  // generate a single ship with random path
  function launchShip() {
    const ship = document.createElementNS(SVGNS, 'polygon');
    ship.setAttribute('points', '0,-10 6,10 -6,10'); // tiny arrow
    ship.setAttribute('fill', '#9de0ff');

    const glow = document.createElementNS(SVGNS, 'polygon');
    glow.setAttribute('points', '0,10 -2,14 2,14');
    glow.setAttribute('fill', '#37bfff');
    glow.setAttribute('opacity', '.6');
    ship.appendChild(glow); // nesting for simplicity

    // pick random edges for start & end
    const edges = ['top', 'bottom', 'left', 'right'];
    const startEdge = edges[Math.floor(rand(0, 4))];
    let sx, sy;
    switch (startEdge) {
      case 'top': sx = rand(-200, viewW + 200); sy = -50; break;
      case 'bottom': sx = rand(-200, viewW + 200); sy = viewH + 50; break;
      case 'left': sx = -50; sy = rand(-200, viewH + 200); break;
      case 'right': sx = viewW + 50; sy = rand(-200, viewH + 200); break;
    }

    // ensure end edge differs
    let endEdge = edges.filter(e => e !== startEdge)[Math.floor(rand(0, 3))];
    let ex, ey;
    switch (endEdge) {
      case 'top': ex = rand(-200, viewW + 200); ey = -50; break;
      case 'bottom': ex = rand(-200, viewW + 200); ey = viewH + 50; break;
      case 'left': ex = -50; ey = rand(-200, viewH + 200); break;
      case 'right': ex = viewW + 50; ey = rand(-200, viewH + 200); break;
    }

    // a random control point near mid-screen for a soft curve
    const cx = rand(viewW * 0.2, viewW * 0.8);
    const cy = rand(viewH * 0.2, viewH * 0.8);

    // sometimes reverse at mid-point
    const willReverse = Math.random() < 0.2;

    const path = document.createElementNS(SVGNS, 'path');
    path.id = 'p' + performance.now(); // unique id
    
    if (!willReverse) {
      path.setAttribute('d', `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`);
    } else {
      // two-segment path (there & back)
      path.setAttribute('d', `M${sx},${sy} Q${cx},${cy} ${ex},${ey} T${sx},${sy}`);
    }
    shipsLayer.appendChild(path); // invisible, only used for mpath

    // animateMotion
    const motion = document.createElementNS(SVGNS, 'animateMotion');
    motion.setAttribute('dur', rand(18, 30).toFixed(1) + 's');
    motion.setAttribute('rotate', 'auto');
    motion.setAttribute('repeatCount', '1');
    if (willReverse) {
      // little pause at apex
      motion.setAttribute('keyTimes', '0;0.45;0.55;1');
      motion.setAttribute('keySplines', '0.5 0 0.5 1;.5 0 .5 1;.5 0 .5 1');
      motion.setAttribute('calcMode', 'spline');
    }
    
    const mpath = document.createElementNS(SVGNS, 'mpath');
    mpath.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#' + path.id);
    motion.appendChild(mpath);
    ship.appendChild(motion);

    shipsLayer.appendChild(ship);

    // cleanup when done
    motion.addEventListener('endEvent', () => { 
      path.remove(); 
      ship.remove(); 
    });
  }

  // keep launching ships forever
  setInterval(() => launchShip(), rand(3000, 6000));

  // fire a couple immediately so it's not empty
  for (let i = 0; i < 3; i++) launchShip();
} 