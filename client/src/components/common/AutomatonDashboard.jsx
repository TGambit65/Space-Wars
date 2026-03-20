import React from 'react';
import { Link } from 'react-router-dom';

function AutomatonDashboard({ user, data, combatLogs }) {
  const primaryShip = data.ships[0];
  const currentSector = primaryShip?.currentSector?.name || 'SECTOR UNKNOWN';
  
  // Calculate some placeholder or real metrics
  // For Automatons: Credits -> Energy Credits, Gems -> Cores Active, Ships -> Server Load
  const energyCredits = user?.credits?.toLocaleString() || 0;
  const coresActive = user?.premium_gems || 0;
  const totalShips = data.ships.length;
  const serverLoadPct = Math.min(100, totalShips * 8.5).toFixed(1);

  return (
    <div className="space-y-6 automaton-bg text-slate-300 font-mono min-h-[calc(100vh-80px)] -m-6 p-6 automaton-scanlines">
      {/* Header Section */}
      <header className="p-4 border-b border-[#bc13fe]/30 bg-slate-900/80 backdrop-blur-md mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xs uppercase tracking-widest text-[#bc13fe] font-bold">Mainframe Uplink</h1>
            <p className="text-sm font-bold text-white">Unit [{user?.username || 'A-NULL'}] - <span className="text-[#10b981]">Processing...</span></p>
          </div>
          <div className="h-8 w-8 rounded-full border border-[#bc13fe]/50 flex items-center justify-center bg-[#bc13fe]/10">
            <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></div>
          </div>
        </div>
      </header>

      {/* Top Metrics Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric Item */}
        <div className="automaton-hex-panel p-3 automaton-glow-border flex flex-col justify-between">
          <span className="text-[10px] text-[#bc13fe] block uppercase">Energy Credits</span>
          <div className="flex items-end gap-1 mt-2">
            <span className="text-xl font-bold text-white">{energyCredits}</span>
            <span className="text-[10px] text-[#10b981] mb-1">↑ OPTIMAL</span>
          </div>
        </div>
        
        {/* Metric Item */}
        <div className="automaton-hex-panel p-3 automaton-glow-border flex flex-col justify-between">
          <span className="text-[10px] text-[#bc13fe] block uppercase">Cores Active</span>
          <div className="flex items-end gap-1 mt-2">
            <span className="text-xl font-bold text-white">{coresActive}</span>
            <span className="text-[10px] text-slate-500 mb-1">/256</span>
          </div>
        </div>
        
        {/* Metric Item */}
        <div className="automaton-hex-panel p-3 automaton-glow-border flex flex-col justify-between">
          <span className="text-[10px] text-[#bc13fe] block uppercase">Server Load</span>
          <div className="w-full bg-slate-800 h-1.5 mt-2 rounded-full overflow-hidden">
            <div className="bg-[#bc13fe] h-full" style={{ width: `${serverLoadPct}%` }}></div>
          </div>
          <span className="text-[10px] text-white mt-1 block">{serverLoadPct}% Capacity</span>
        </div>
        
        {/* Metric Item */}
        <div className="automaton-hex-panel p-3 automaton-glow-border flex flex-col justify-between">
          <span className="text-[10px] text-[#bc13fe] block uppercase">Current Sector</span>
          <div className="text-sm font-bold text-white mt-2 uppercase">{currentSector}</div>
          <span className="text-[10px] text-[#10b981] uppercase">Status: Secure</span>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Execution Queue */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-[#bc13fe]"></div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#bc13fe]">Execution Queue (Directives)</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-slate-900/40 border-l-2 border-[#bc13fe]" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
              <div>
                <p className="text-xs font-bold text-white uppercase">Data Harvesting</p>
                <p className="text-[10px] text-slate-400">Sector: {currentSector}</p>
              </div>
              <Link to="/planets" className="px-3 py-1 bg-[#bc13fe] text-slate-950 text-[10px] font-bold uppercase hover:bg-[#bc13fe]/80 transition-colors" style={{ clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}>
                Execute
              </Link>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-900/40 border-l-2 border-slate-700 opacity-60" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
              <div>
                <p className="text-xs font-bold text-white uppercase">System Optimization</p>
                <p className="text-[10px] text-[#10b981]">In Progress... [44%]</p>
              </div>
              <div className="w-4 h-4 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin"></div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-900/40 border-l-2 border-[#bc13fe]" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
              <div>
                <p className="text-xs font-bold text-white uppercase">Target Acquisition</p>
                <p className="text-[10px] text-slate-400">Threat Level: Calculated</p>
              </div>
              <Link to="/combat" className="px-3 py-1 bg-[#bc13fe] text-slate-950 text-[10px] font-bold uppercase hover:bg-[#bc13fe]/80 transition-colors" style={{ clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}>
                Queue
              </Link>
            </div>
          </div>
        </section>

        {/* System Diagnostics (Combat Log) */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-[#10b981]"></div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#10b981]">System Diagnostics</h2>
          </div>
          <div className="h-48 bg-black border border-[#10b981]/30 p-4 font-mono text-[10px] relative overflow-hidden flex flex-col justify-end">
            <div className="space-y-2 text-[#10b981]/80 w-full overflow-y-auto max-h-full">
              <p className="text-slate-500">[{new Date().toLocaleTimeString()}] INITIALIZING DIAGNOSTICS...</p>
              {combatLogs && combatLogs.length > 0 ? (
                combatLogs.slice(0, 5).reverse().map((log, idx) => {
                  const isWin = log.winner === 'attacker';
                  const logColor = isWin ? 'text-[#10b981]' : 'text-red-500';
                  const timeString = new Date(log.created_at).toLocaleTimeString();
                  
                  return (
                    <p key={idx} className={logColor}>
                      [{timeString}] {isWin ? 'THREAT NEUTRALIZED. LOGIC CORE SATISFIED.' : 'CRITICAL WARNING: STRUCTURAL INTEGRITY COMPROMISED.'}
                    </p>
                  );
                })
              ) : (
                <p className="text-slate-500">[{new Date().toLocaleTimeString()}] STANDBY: AWAITING INPUT...</p>
              )}
              <p className="animate-pulse">_</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AutomatonDashboard;
