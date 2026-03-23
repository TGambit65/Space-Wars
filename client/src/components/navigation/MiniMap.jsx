import { useState, useEffect } from 'react';
import { Map, ChevronUp, ChevronDown, Navigation, MapPin } from 'lucide-react';
import { sectors } from '../../services/api';

const CONNECTION_STYLES = {
  wormhole:  { color: '#c084fc', label: 'Wormhole' },
  portal:    { color: '#fb923c', label: 'Portal' },
  protected: { color: '#93c5fd', label: 'Protected' },
  standard:  { color: '#22d3ee', label: 'Hyperlane' },
};

const getConnectionStyle = (type) =>
  CONNECTION_STYLES[type] || CONNECTION_STYLES.standard;

const MiniMap = ({ activeShip, onNavigate }) => {
  const [expanded, setExpanded] = useState(false);
  const [adjacent, setAdjacent] = useState([]);
  const [loading, setLoading] = useState(false);

  const sectorId = activeShip?.currentSector?.sector_id || activeShip?.current_sector_id || activeShip?.sector_id;

  useEffect(() => {
    if (!sectorId || !expanded) return;
    let cancelled = false;
    setLoading(true);
    sectors.getById(sectorId)
      .then(res => {
        if (!cancelled) {
          setAdjacent(res.data?.data?.adjacentSectors || []);
        }
      })
      .catch(() => {
        if (!cancelled) setAdjacent([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sectorId, expanded]);

  if (!activeShip) return null;

  const sectorName = activeShip.currentSector?.name || activeShip.current_sector?.name || `Sector ${sectorId}`;

  return (
    <div
      className="fixed bottom-20 left-4 z-40 pointer-events-auto"
      style={{ maxWidth: 260 }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-lg text-xs font-medium text-cyan-300 hover:text-white transition-colors"
        style={{ background: 'rgba(15, 23, 42, 0.92)', borderTop: '1px solid rgba(100,116,139,0.4)', borderLeft: '1px solid rgba(100,116,139,0.4)', borderRight: '1px solid rgba(100,116,139,0.4)' }}
      >
        <Map className="w-3.5 h-3.5" />
        <span>Nav Map</span>
        {expanded ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronUp className="w-3 h-3 ml-auto" />}
      </button>

      {/* Panel */}
      {expanded && (
        <div
          className="rounded-b-lg rounded-tr-lg backdrop-blur-sm"
          style={{ background: 'rgba(15, 23, 42, 0.92)', border: '1px solid rgba(100,116,139,0.4)' }}
        >
          {/* Current sector */}
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'rgba(100,116,139,0.3)' }}>
            <MapPin className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span className="text-xs text-white font-semibold truncate">{sectorName}</span>
          </div>

          {/* Adjacent sectors */}
          <div className="p-2 flex flex-col gap-1" style={{ maxHeight: 200, overflowY: 'auto' }}>
            {loading && (
              <div className="text-xs text-gray-500 text-center py-2">Loading...</div>
            )}
            {!loading && adjacent.length === 0 && (
              <div className="text-xs text-gray-500 text-center py-2">No adjacent sectors</div>
            )}
            {!loading && adjacent.map((entry) => {
              const sector = entry.sector;
              const style = getConnectionStyle(entry.connection_type || entry.lane_class);
              return (
                <button
                  key={sector.sector_id}
                  onClick={() => onNavigate?.(sector.sector_id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left hover:bg-white/10 transition-colors group w-full"
                >
                  <Navigation className="w-3 h-3 shrink-0" style={{ color: style.color }} />
                  <span className="text-gray-300 group-hover:text-white truncate flex-1">
                    {sector.name}
                  </span>
                  <span className="text-[10px] shrink-0" style={{ color: style.color }}>
                    {style.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MiniMap;
