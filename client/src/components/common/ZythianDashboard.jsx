import React from 'react';
import { Link } from 'react-router-dom';

function ZythianDashboard({ user, data, combatLogs }) {
  const primaryShip = data.ships[0];
  const currentSector = primaryShip?.currentSector?.name || 'Sector Unknown';
  
  // Calculate some placeholder or real metrics
  // For Zythians: Credits -> Biomass, Gems -> Evolution Points, Ships -> Swarm Density
  const biomass = user?.credits?.toLocaleString() || 0;
  const evoPoints = user?.premium_gems || 0;
  const swarmDensity = `${Math.min(100, data.ships.length * 12.5).toFixed(1)}%`;

  return (
    <div className="space-y-6 zythian-bg text-slate-100 font-display min-h-[calc(100vh-80px)] -m-6 p-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#1a2f23] min-h-[180px] flex flex-col justify-end border border-[#2d4a3a] shadow-2xl shadow-black/50 group">
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#f39c12]/30 via-transparent to-transparent"></div>
        <div 
          className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-40" 
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2048&auto=format&fit=crop')" }}
        ></div>
        <div className="relative p-5 z-10 bg-gradient-to-t from-[#0d1310] to-transparent">
          <p className="text-[#f39c12] text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Status: Synchronized</p>
          <h1 className="text-white text-2xl font-bold leading-tight">Broodlord {user?.username}</h1>
          <div className="flex gap-2 mt-2">
            <span className="bg-[#f39c12]/20 text-[#f39c12] text-[10px] px-2 py-0.5 rounded-full border border-[#f39c12]/30">Tier 4 Neural Hub</span>
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30">Active Spawning</span>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1 rounded-2xl p-4 bg-[#1a2f23]/50 border border-[#2d4a3a]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-emerald-500 text-lg">♥</span>
            <p className="text-emerald-500 text-[10px] font-bold uppercase">Optimal</p>
          </div>
          <p className="text-slate-400 text-xs font-medium">Biomass</p>
          <p className="text-slate-100 text-xl font-bold">{biomass}</p>
        </div>

        <div className="flex flex-col gap-1 rounded-2xl p-4 bg-[#1a2f23]/50 border border-[#2d4a3a]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#f39c12] text-lg">🧬</span>
            <p className="text-[#f39c12] text-[10px] font-bold uppercase">Ready</p>
          </div>
          <p className="text-slate-400 text-xs font-medium">Evolution Points</p>
          <p className="text-slate-100 text-xl font-bold">{evoPoints}</p>
        </div>

        <div className="flex flex-col gap-1 rounded-2xl p-4 bg-[#1a2f23]/50 border border-[#2d4a3a]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-amber-500 text-lg">🕸</span>
            <p className="text-amber-500 text-[10px] font-bold uppercase">Growing</p>
          </div>
          <p className="text-slate-400 text-xs font-medium">Swarm Density</p>
          <p className="text-slate-100 text-xl font-bold">{swarmDensity}</p>
        </div>

        <div className="flex flex-col gap-1 rounded-2xl p-4 bg-[#1a2f23]/50 border border-[#2d4a3a]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400 text-lg">👁</span>
            <p className="text-slate-500 text-[10px] font-bold uppercase">Hostile</p>
          </div>
          <p className="text-slate-400 text-xs font-medium">Sector</p>
          <p className="text-slate-100 text-xl font-bold">{currentSector}</p>
        </div>
      </div>

      {/* Sensory Network (Live Combat Log) */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-slate-100 text-lg font-bold tracking-tight">Sensory Network</h3>
            <span className="w-2 h-2 rounded-full bg-[#f39c12] zythian-pulse"></span>
          </div>
          <Link to="/combat" className="bg-[#f39c12]/10 hover:bg-[#f39c12]/20 text-[#f39c12] text-[10px] font-bold px-3 py-1 rounded-full border border-[#f39c12]/20 transition-all">
            LIVE
          </Link>
        </div>
        
        <div className="bg-[#0d1310]/80 border border-[#2d4a3a] rounded-2xl overflow-hidden">
          <div className="p-3 border-b border-[#2d4a3a] flex items-center justify-between bg-[#1a2f23]/20">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Transmission Stream</span>
            <span className="text-[10px] text-[#f39c12]/60 font-mono tracking-tighter">SYNAPSE_LINK_STABLE</span>
          </div>
          <div className="p-4 space-y-2 font-mono text-[11px]">
            {combatLogs && combatLogs.length > 0 ? (
              combatLogs.slice(0, 5).map((log, idx) => {
                const isWin = log.winner === 'attacker';
                const logColor = isWin ? 'text-emerald-400' : 'text-red-500';
                const timeString = new Date(log.created_at).toLocaleTimeString();
                
                return (
                  <div key={idx} className="flex gap-2">
                    <span className="text-[#f39c12] font-bold">[{timeString}]</span>
                    <span className={logColor}>
                      {isWin ? 'Assimilation of target successful. Biomass secured.' : 'WARNING: Swarm casualties detected. Recommend forced evolution.'}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex gap-2">
                <span className="text-[#f39c12] font-bold">[SYS]</span>
                <span className="text-slate-400">Sensory network quiet. Awaiting prey.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ZythianDashboard;
