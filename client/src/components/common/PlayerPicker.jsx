import { useState, useEffect, useRef } from 'react';
import { factions } from '../../services/api';
import { User, Search, X } from 'lucide-react';

export default function PlayerPicker({ value, onChange, placeholder = 'Search players...', className = '' }) {
  const [players, setPlayers] = useState([]);
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    factions.getLeaderboard().then(res => {
      const raw = res.data.data;
      const lb = Array.isArray(raw) ? raw : raw?.leaderboard || raw?.players || [];
      const names = lb.map(p => p.username).filter(Boolean);
      setPlayers(names);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { setHighlightIdx(-1); }, [query]);

  const filtered = players.filter(p =>
    p.toLowerCase().includes((query || '').toLowerCase())
  ).slice(0, 20);

  const handleSelect = (name) => {
    onChange(name);
    setQuery(name);
    setOpen(false);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    if (val && !open) setOpen(true);
  };

  const handleKeyDown = (e) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && highlightIdx >= 0 && filtered[highlightIdx]) { e.preventDefault(); handleSelect(filtered[highlightIdx]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="input w-full flex items-center gap-2">
        <User className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        <input
          className="bg-transparent text-sm text-white placeholder-gray-500 outline-none flex-1"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => { if (query) setOpen(true); }}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button onClick={handleClear} className="text-gray-500 hover:text-gray-300">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (query && filtered.length === 0) && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg px-3 py-3 text-xs text-gray-500"
          style={{
            background: 'rgba(10, 10, 30, 0.95)',
            border: '1px solid rgba(0, 255, 255, 0.2)',
            backdropFilter: 'blur(12px)',
          }}
        >
          No matching players found. You can still type the exact username.
        </div>
      )}

      {open && filtered.length > 0 && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg overflow-hidden"
          style={{
            background: 'rgba(10, 10, 30, 0.95)',
            border: '1px solid rgba(0, 255, 255, 0.2)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((name, idx) => (
              <button
                key={name}
                className={`w-full text-left px-3 py-2 text-sm text-gray-300 transition-colors ${idx === highlightIdx ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}
                onClick={() => handleSelect(name)}
                onMouseEnter={() => setHighlightIdx(idx)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
