import { useState, useEffect, useRef } from 'react';
import { sectors } from '../../services/api';
import { MapPin, Search, X } from 'lucide-react';

let sectorCache = null;
let sectorCachePort = null;

export default function SectorPicker({ value, onChange, placeholder = 'Search sectors...', hasPort = false, className = '' }) {
  const [allSectors, setAllSectors] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const cache = hasPort ? sectorCachePort : sectorCache;
    if (cache) { setAllSectors(cache); return; }
    setLoading(true);
    sectors.getAll({ limit: 500 }).then(res => {
      const raw = res.data.data?.sectors || res.data.data || [];
      const list = Array.isArray(raw) ? raw : [];
      const result = hasPort ? list.filter(s => s.ports?.length > 0 || s.has_port) : list;
      if (hasPort) sectorCachePort = result; else sectorCache = result;
      setAllSectors(result);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [hasPort]);

  useEffect(() => {
    if (value && allSectors.length) {
      const match = allSectors.find(s => String(s.sector_id || s.id) === String(value));
      if (match) setSelectedLabel(match.name || `Sector ${match.sector_id || match.id}`);
    }
  }, [value, allSectors]);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { setHighlightIdx(-1); }, [query]);

  const filtered = allSectors.filter(s => {
    const name = (s.name || '').toLowerCase();
    const id = String(s.sector_id || s.id);
    const q = query.toLowerCase();
    return name.includes(q) || id.includes(q);
  }).slice(0, 50);

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && highlightIdx >= 0 && filtered[highlightIdx]) { e.preventDefault(); handleSelect(filtered[highlightIdx]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const handleSelect = (sector) => {
    const id = sector.sector_id || sector.id;
    onChange(String(id));
    setSelectedLabel(sector.name || `Sector ${id}`);
    setOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    onChange('');
    setSelectedLabel('');
    setQuery('');
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div
        className="input w-full flex items-center gap-2 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        <span className={`flex-1 text-sm truncate ${selectedLabel ? 'text-white' : 'text-gray-500'}`}>
          {selectedLabel || placeholder}
        </span>
        {value && (
          <button onClick={(e) => { e.stopPropagation(); handleClear(); }} className="text-gray-500 hover:text-gray-300">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg overflow-hidden"
          style={{
            background: 'rgba(10, 10, 30, 0.95)',
            border: '1px solid rgba(0, 255, 255, 0.2)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(0,255,255,0.1)' }}>
            <Search className="w-3.5 h-3.5 text-gray-500" />
            <input
              autoFocus
              className="bg-transparent text-sm text-white placeholder-gray-500 outline-none flex-1"
              placeholder="Type sector name or ID..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-4 text-center text-xs text-gray-500">Loading sectors...</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-500">No sectors found</div>
            ) : (
              filtered.map((s, idx) => {
                const id = s.sector_id || s.id;
                return (
                  <button
                    key={id}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${idx === highlightIdx ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}
                    onClick={() => handleSelect(s)}
                    onMouseEnter={() => setHighlightIdx(idx)}
                  >
                    <span className="text-gray-300">{s.name || `Sector ${id}`}</span>
                    <span className="text-xs text-gray-600">#{id}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
