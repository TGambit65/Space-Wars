import { useState, useEffect, useRef } from 'react';
import { corporations } from '../../services/api';
import { Users, Search, X } from 'lucide-react';

export default function CorporationPicker({ value, onChange, placeholder = 'Search corporations...', className = '' }) {
  const [corps, setCorps] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    corporations.getLeaderboard().then(res => {
      const raw = res.data.data;
      setCorps(Array.isArray(raw) ? raw : raw?.corporations || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (value && corps.length) {
      const match = corps.find(c => String(c.corporation_id || c.id) === String(value));
      if (match) setSelectedLabel(`${match.name} [${match.tag}]`);
    }
  }, [value, corps]);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { setHighlightIdx(-1); }, [query]);

  const filtered = corps.filter(c => {
    const q = query.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) ||
           (c.tag || '').toLowerCase().includes(q) ||
           String(c.corporation_id || c.id).includes(q);
  });

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && highlightIdx >= 0 && filtered[highlightIdx]) { e.preventDefault(); handleSelect(filtered[highlightIdx]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const handleSelect = (corp) => {
    const id = corp.corporation_id || corp.id;
    onChange(String(id));
    setSelectedLabel(`${corp.name} [${corp.tag}]`);
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
      <div className="input w-full flex items-center gap-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <Users className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
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
              placeholder="Type corporation name or tag..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-4 text-center text-xs text-gray-500">Loading corporations...</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-500">No corporations found</div>
            ) : (
              filtered.map((c, idx) => {
                const id = c.corporation_id || c.id;
                return (
                  <button
                    key={id}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${idx === highlightIdx ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}
                    onClick={() => handleSelect(c)}
                    onMouseEnter={() => setHighlightIdx(idx)}
                  >
                    <div>
                      <span className="text-gray-300">{c.name}</span>
                      <span className="ml-2 text-xs text-neon-cyan">[{c.tag}]</span>
                    </div>
                    <span className="text-xs text-gray-600">{c.member_count || 0} members</span>
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
