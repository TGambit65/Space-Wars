import React from 'react';
import { Link } from 'react-router-dom';

function TerranDashboard({ user, data, combatLogs }) {
  const primaryShip = data.ships[0];
  const currentSector = primaryShip?.currentSector?.name || 'Sector Unknown';
  
  // Calculate some placeholder or real metrics
  const credits = user?.credits?.toLocaleString() || 0;
  const gems = user?.premium_gems || 0;
  const fleetPower = data.ships.reduce((acc, ship) => acc + (ship.max_hull_points || 1000), 0).toLocaleString();

  return (
    <div className="space-y-6 terran-grid-bg text-slate-100 font-display">
      {/* Welcome Banner */}
      <section className="relative h-64 border border-[#3498db]/30 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-60" 
          style={{ backgroundImage: "linear-gradient(90deg, #020617 20%, transparent 100%), url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=2048&auto=format&fit=crop')" }}
        ></div>
        <div className="relative h-full flex flex-col justify-center px-12 z-10">
          <p className="text-[#00ffff] font-bold uppercase tracking-widest text-sm mb-2">United Earth Command</p>
          <h1 className="text-4xl font-bold text-white uppercase tracking-tighter max-w-lg">
            Commander {user?.username} - Terran Fleet
          </h1>
          <div className="mt-6 flex gap-4">
            <Link to="/ships" className="bg-[#3498db] hover:bg-[#3498db]/80 px-6 py-2 font-bold uppercase text-xs tracking-widest text-white border border-[#00ffff]/20 transition-all">
              Quick Launch
            </Link>
            <Link to="/combat" className="bg-black/60 backdrop-blur-md border border-[#3498db]/40 px-6 py-2 font-bold uppercase text-xs tracking-widest text-white hover:bg-[#3498db]/20 transition-all">
              Fleet Logs
            </Link>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 p-4 opacity-10 pointer-events-none">
          <span className="text-[80px] font-black uppercase tracking-tighter text-white leading-none select-none">TERRAN</span>
        </div>
      </section>

      {/* Metrics Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="terran-glass-panel p-6 border-l-4 border-[#3498db]">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase text-[#3498db] tracking-widest leading-none">Credits</span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums tracking-tighter">{credits}</p>
          <p className="text-[10px] text-[#00ffff] mt-1 font-bold">TERRAN RESERVE</p>
        </div>
        
        <div className="terran-glass-panel p-6 border-l-4 border-[#00ffff]">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase text-[#00ffff] tracking-widest leading-none">Premium Gems</span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums tracking-tighter">{gems}</p>
          <p className="text-[10px] text-slate-400 mt-1 font-bold">SECURE STORAGE</p>
        </div>

        <div className="terran-glass-panel p-6 border-l-4 border-[#3498db]">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase text-[#3498db] tracking-widest leading-none">Fleet Power</span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums tracking-tighter">{fleetPower}</p>
          <p className="text-[10px] text-[#00ffff] mt-1 font-bold">{data.ships.length} ACTIVE SHIPS</p>
        </div>

        <div className="terran-glass-panel p-6 border-l-4 border-[#00ffff]">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase text-[#00ffff] tracking-widest leading-none">Current Sector</span>
          </div>
          <p className="text-2xl font-bold text-white uppercase tracking-tighter">{currentSector}</p>
          <p className="text-[10px] text-slate-400 mt-1 font-bold">FEDERATION SPACE</p>
        </div>
      </section>

      {/* Combat Tactical Log */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#3498db]/20 pb-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#00ffff] flex items-center gap-2">
            Combat Tactical Log
          </h2>
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Live Feed // Uplink: Established</span>
        </div>
        
        <div className="terran-glass-panel bg-black/40 overflow-hidden divide-y divide-[#3498db]/10">
          {combatLogs && combatLogs.length > 0 ? (
            combatLogs.slice(0, 5).map((log, idx) => {
              const isWin = log.winner === 'attacker';
              const logColor = isWin ? 'text-[#00ffff]' : 'text-red-500';
              const dotColor = isWin ? 'bg-[#00ffff]' : 'bg-red-500';
              const timeString = new Date(log.created_at).toLocaleTimeString();
              
              return (
                <div key={idx} className="p-3 flex items-center gap-4 hover:bg-[#3498db]/5 transition-colors group">
                  <div className={`w-1.5 h-1.5 ${dotColor} terran-glow-border`}></div>
                  <span className="text-[10px] font-mono text-slate-500">[{timeString}]</span>
                  <p className="text-[11px] font-bold tracking-wider uppercase flex-1">
                    <span className={logColor}>{isWin ? 'VICTORY: ' : 'ALERT: '}</span> 
                    Engaged {log.defender_id ? 'Hostile Target' : 'Unknown Entity'} in combat.
                  </p>
                </div>
              );
            })
          ) : (
            <div className="p-4 text-center">
              <span className="text-xs font-mono text-slate-500 uppercase">No recent combat activity detected.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default TerranDashboard;
