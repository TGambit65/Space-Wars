import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, Flag, Building2, Gem, Scan, Thermometer, Ruler, Weight, Orbit } from 'lucide-react';
import Breadcrumb from '../common/Breadcrumb';

const PLANET_TYPE_COLORS = {
  'Terran': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  'Desert': { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  'Ice': { bg: 'bg-cyan-300/20', text: 'text-cyan-300', border: 'border-cyan-300/30' },
  'Volcanic': { bg: 'bg-orange-500/20', text: 'text-orange-500', border: 'border-orange-500/30' },
  'Gas Giant': { bg: 'bg-orange-300/20', text: 'text-orange-300', border: 'border-orange-300/30' },
  'Oceanic': { bg: 'bg-blue-500/20', text: 'text-blue-500', border: 'border-blue-500/30' },
  'Barren': { bg: 'bg-stone-400/20', text: 'text-stone-400', border: 'border-stone-400/30' },
  'Jungle': { bg: 'bg-green-500/20', text: 'text-green-500', border: 'border-green-500/30' },
  'Toxic': { bg: 'bg-lime-400/20', text: 'text-lime-400', border: 'border-lime-400/30' },
  'Crystalline': { bg: 'bg-purple-300/20', text: 'text-purple-300', border: 'border-purple-300/30' },
};

const OrbitHUD = ({ planet, colony, onScan, scanning }) => {
  const navigate = useNavigate();
  const typeColors = PLANET_TYPE_COLORS[planet.type] || PLANET_TYPE_COLORS['Barren'];
  const isScanned = planet.is_scanned;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {/* Top-left: Back + Planet Name */}
      <div className="absolute top-6 left-6 pointer-events-auto">
        <div className="bg-space-900/80 backdrop-blur-sm border border-space-700 rounded-lg p-4 max-w-xs">
          <Breadcrumb
            items={[
              { label: 'Sector Map', path: '/map' },
              { label: 'System View', path: '/system' },
              { label: planet.name },
            ]}
            className="mb-3"
          />
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-5 h-5 text-blue-400" />
            <h1 className="text-xl font-bold text-white">{planet.name}</h1>
          </div>
          <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${typeColors.bg} ${typeColors.text} ${typeColors.border}`}>
            {planet.type}
          </span>
        </div>
      </div>

      {/* Left: Stats panel */}
      {isScanned && (
        <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-auto">
          <div className="bg-space-900/80 backdrop-blur-sm border border-space-700 rounded-lg p-4 w-56">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Planetary Data</h3>
            <div className="space-y-2.5">
              <StatRow icon={Ruler} label="Size" value={planet.size} />
              <StatRow icon={Weight} label="Gravity" value={`${planet.gravity?.toFixed(2)}g`} />
              <StatRow icon={Thermometer} label="Temperature" value={`${planet.temperature}°C`} />
              <StatRow icon={Orbit} label="Orbit" value={`#${planet.orbital_position}`} />

              {/* Habitability bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Habitability</span>
                  <span className="text-gray-300">{Math.round((planet.habitability || 0) * 100)}%</span>
                </div>
                <div className="w-full bg-space-700 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${(planet.habitability || 0) * 100}%`,
                      backgroundColor: (planet.habitability || 0) >= 0.5 ? '#10B981' : (planet.habitability || 0) >= 0.2 ? '#F59E0B' : '#EF4444',
                    }}
                  />
                </div>
              </div>

              {/* Resources */}
              {planet.resources && planet.resources.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 mb-1.5">Resources</div>
                  <div className="flex flex-wrap gap-1">
                    {planet.resources.map((r, i) => (
                      <span key={i} className="text-[10px] bg-space-700 text-gray-300 px-1.5 py-0.5 rounded">
                        {r.resource_name || r.name || r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom center: Action bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="bg-space-900/80 backdrop-blur-sm border border-space-700 rounded-lg p-3 flex gap-3">
          {!isScanned && (
            <button
              onClick={onScan}
              disabled={scanning}
              className="btn btn-primary text-sm flex items-center gap-2"
            >
              {scanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-space-900 border-t-transparent rounded-full animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Scan className="w-4 h-4" /> Scan Planet
                </>
              )}
            </button>
          )}
          {isScanned && !planet.owner_user_id && !colony && planet.habitability >= 0.5 && (
            <button
              onClick={() => navigate('/colonies', { state: { colonizePlanet: planet } })}
              className="btn btn-primary text-sm flex items-center gap-2"
            >
              <Flag className="w-4 h-4" /> Colonize
            </button>
          )}
          {colony && (
            <button
              onClick={() => navigate('/colonies')}
              className="btn text-sm flex items-center gap-2 bg-space-700 hover:bg-space-600 text-white border border-space-600"
            >
              <Building2 className="w-4 h-4" /> View Colony
            </button>
          )}
          {planet.has_artifact && !planet.artifact_claimed && (
            <button
              className="btn text-sm flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white"
            >
              <Gem className="w-4 h-4" /> Collect Artifact
            </button>
          )}
        </div>
      </div>

      {/* Right: Colony info (if colonized) */}
      {colony && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-auto">
          <div className="bg-space-900/80 backdrop-blur-sm border border-space-700 rounded-lg p-4 w-56">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-bold text-white">{colony.name}</h3>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Population</span>
                <span className="text-gray-200">{colony.population?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Infrastructure</span>
                <span className="text-gray-200">Level {colony.infrastructure_level}</span>
              </div>
              {colony.resources && colony.resources.length > 0 && (
                <div>
                  <div className="text-gray-400 mb-1">Production</div>
                  {colony.resources.map((r, i) => (
                    <div key={i} className="flex justify-between text-[10px] text-gray-300">
                      <span>{r.name || r.resource_name}</span>
                      <span className="text-green-400">+{r.production_rate || r.rate}/hr</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="flex items-center gap-1.5 text-gray-400">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
    <span className="text-gray-200">{value}</span>
  </div>
);

export default OrbitHUD;
