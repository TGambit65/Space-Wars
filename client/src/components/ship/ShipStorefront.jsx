import { useState } from 'react';
import { Rocket, Shield, Zap, Fuel, Box, Lock } from 'lucide-react';
import { getShipIcon } from '../../utils/shipIcons';

const SHIP_CATALOG = [
    { name: 'Scout', hull: 50, shields: 30, cargo: 20, fuel: 60, speed: 8, cost: 5000 },
    { name: 'Trader', hull: 80, shields: 40, cargo: 100, fuel: 50, speed: 5, cost: 15000 },
    { name: 'Fighter', hull: 100, shields: 80, cargo: 15, fuel: 40, speed: 7, cost: 25000 },
    { name: 'Frigate', hull: 200, shields: 150, cargo: 50, fuel: 80, speed: 4, cost: 50000 },
    { name: 'Cruiser', hull: 350, shields: 250, cargo: 80, fuel: 100, speed: 3, cost: 100000 },
    { name: 'Colony Ship', hull: 60, shields: 20, cargo: 200, fuel: 30, speed: 2, cost: 75000 },
];

const ShipStorefront = () => {
    const [selectedShip, setSelectedShip] = useState(null);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-accent-cyan" />
                    Ship Catalog
                </h2>
                <span className="text-xs text-gray-500">Purchase ships at any port</span>
            </div>

            {/* Ship Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SHIP_CATALOG.map((ship) => {
                    const { icon: ShipIcon, color } = getShipIcon(ship.name);
                    const isSelected = selectedShip === ship.name;

                    return (
                        <div
                            key={ship.name}
                            onClick={() => setSelectedShip(isSelected ? null : ship.name)}
                            className={`card p-4 cursor-pointer transition-all hover:border-accent-cyan/30 ${
                                isSelected ? 'border-accent-cyan/40 bg-accent-cyan/5' : ''
                            }`}
                        >
                            {/* Ship Name & Icon */}
                            <div className="flex items-center gap-3 mb-3">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                    style={{
                                        background: `${color}10`,
                                        border: `1px solid ${color}30`,
                                    }}
                                >
                                    <ShipIcon className="w-5 h-5" style={{ color }} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-white font-bold font-mono">{ship.name}</h3>
                                    <p className="text-accent-orange text-sm font-mono">
                                        {ship.cost.toLocaleString()} credits
                                    </p>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-5 gap-2 mb-3">
                                <div className="text-center">
                                    <div className="text-xs text-gray-400 mb-0.5 flex items-center justify-center gap-1">
                                        <Rocket className="w-3 h-3" />
                                        Hull
                                    </div>
                                    <div className="text-white text-xs font-mono">{ship.hull}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs text-gray-400 mb-0.5 flex items-center justify-center gap-1">
                                        <Shield className="w-3 h-3" />
                                        Shld
                                    </div>
                                    <div className="text-white text-xs font-mono">{ship.shields}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs text-gray-400 mb-0.5 flex items-center justify-center gap-1">
                                        <Box className="w-3 h-3" />
                                        Cargo
                                    </div>
                                    <div className="text-white text-xs font-mono">{ship.cargo}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs text-gray-400 mb-0.5 flex items-center justify-center gap-1">
                                        <Fuel className="w-3 h-3" />
                                        Fuel
                                    </div>
                                    <div className="text-white text-xs font-mono">{ship.fuel}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs text-gray-400 mb-0.5 flex items-center justify-center gap-1">
                                        <Zap className="w-3 h-3" />
                                        Spd
                                    </div>
                                    <div className="text-white text-xs font-mono">{ship.speed}</div>
                                </div>
                            </div>

                            {/* Purchase Button (disabled) */}
                            <button
                                disabled
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 bg-space-800 border border-space-600 cursor-not-allowed opacity-60"
                            >
                                <Lock className="w-3.5 h-3.5" />
                                Coming Soon
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ShipStorefront;
