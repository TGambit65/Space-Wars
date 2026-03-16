import { Rocket, Crosshair, Shield, Truck, Ship, Plane, Anchor, Globe, Hammer, Compass, Zap } from 'lucide-react';

const SHIP_ICON_MAP = {
  'Scout':            { icon: Compass,   color: '#00ffff' },
  'Fighter':          { icon: Crosshair, color: '#f44336' },
  'Corvette':         { icon: Zap,       color: '#ff6600' },
  'Destroyer':        { icon: Shield,    color: '#ff4444' },
  'Battlecruiser':    { icon: Shield,    color: '#e74c3c' },
  'Carrier':          { icon: Ship,      color: '#9b59b6' },
  'Interceptor':      { icon: Plane,     color: '#ff9900' },
  'Freighter':        { icon: Truck,     color: '#4caf50' },
  'Merchant Cruiser':  { icon: Truck,     color: '#66bb6a' },
  'Colony Ship':      { icon: Globe,     color: '#2196f3' },
  'Insta Colony Ship': { icon: Globe,     color: '#42a5f5' },
  'Mining Barge':     { icon: Hammer,    color: '#ffc107' },
  'Explorer':         { icon: Compass,   color: '#00bcd4' },
};

export function getShipIcon(shipType) {
  return SHIP_ICON_MAP[shipType] || { icon: Rocket, color: '#00ffff' };
}
