import { useState, useEffect } from 'react';
import { cosmetics, ships } from '../../services/api';
import {
  Paintbrush, Save, AlertCircle, RefreshCw, Lock, Check,
  Sparkles, Palette, Flame, Sticker, Image, Type
} from 'lucide-react';

const TRAIL_COLORS = { standard: '#00ffff', plasma: '#ff4444', ion: '#4488ff', nova: '#ffcc00', shadow: '#6622cc', rainbow: '#ff00ff' };

const COLOR_PALETTE = [
  '#FF0000', '#FF4444', '#FF6600', '#FF9900', '#FFCC00',
  '#FFFF00', '#CCFF00', '#66FF00', '#00FF00', '#00FF66',
  '#00FFCC', '#00FFFF', '#00CCFF', '#0066FF', '#0000FF',
  '#6600FF', '#9900FF', '#CC00FF', '#FF00FF', '#FF0066',
  '#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333',
  '#1A1A2E', '#16213E', '#0F3460', '#E94560', '#533483',
];

const ENGINE_TRAILS = [
  { value: 'standard', label: 'Standard' },
  { value: 'plasma', label: 'Plasma Burst' },
  { value: 'ion', label: 'Ion Stream' },
  { value: 'nova', label: 'Nova Flare' },
  { value: 'shadow', label: 'Shadow Trail' },
  { value: 'rainbow', label: 'Chromatic Shift' },
];

const DECALS = [
  { value: 'none', label: 'None' },
  { value: 'skull', label: 'Skull & Crossbones' },
  { value: 'star', label: 'Star Command' },
  { value: 'lightning', label: 'Lightning Strike' },
  { value: 'flames', label: 'Inferno' },
  { value: 'tribal', label: 'Tribal' },
  { value: 'camo', label: 'Camouflage' },
];

const SKINS = [
  { value: 'default', label: 'Factory Default' },
  { value: 'chrome', label: 'Chrome' },
  { value: 'matte', label: 'Matte Black' },
  { value: 'carbon', label: 'Carbon Fiber' },
  { value: 'holographic', label: 'Holographic' },
  { value: 'rustic', label: 'Battle-Scarred' },
];

const NAMEPLATE_STYLES = [
  { value: 'standard', label: 'Standard' },
  { value: 'gold', label: 'Gold Engraved' },
  { value: 'neon', label: 'Neon Glow' },
  { value: 'military', label: 'Military Stencil' },
  { value: 'cursive', label: 'Cursive Script' },
];

const ShipCustomizer = ({ user }) => {
  const [userShips, setUserShips] = useState([]);
  const [selectedShipId, setSelectedShipId] = useState('');
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Visual config state
  const [hullColor, setHullColor] = useState('#00FFFF');
  const [accentColor, setAccentColor] = useState('#FF6600');
  const [engineTrail, setEngineTrail] = useState('standard');
  const [decal, setDecal] = useState('none');
  const [skin, setSkin] = useState('default');
  const [nameplateStyle, setNameplateStyle] = useState('standard');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [shipsRes, catalogRes] = await Promise.all([
        ships.getAll(),
        cosmetics.getCatalog(),
      ]);
      const shipList = shipsRes.data.data?.ships || [];
      setUserShips(shipList);
      setCatalog(catalogRes.data.data?.catalog || catalogRes.data.catalog || null);

      if (shipList.length > 0) {
        const activeId = shipsRes.data.data?.active_ship_id;
        const firstShip = (activeId && shipList.find(s => s.ship_id === activeId)) || shipList[0];
        setSelectedShipId(firstShip.ship_id);
        applyShipConfig(firstShip);
      }
    } catch (err) {
      setError('Failed to load customization data.');
    } finally {
      setLoading(false);
    }
  };

  const applyShipConfig = (ship) => {
    const vc = ship.visual_config || {};
    setHullColor(vc.hull_color || '#00FFFF');
    setAccentColor(vc.accent_color || '#FF6600');
    setEngineTrail(vc.engine_trail || 'standard');
    setDecal(vc.decal || 'none');
    setSkin(vc.skin || 'default');
    setNameplateStyle(vc.nameplate_style || 'standard');
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleShipChange = (e) => {
    const shipId = e.target.value;
    setSelectedShipId(shipId);
    const ship = userShips.find(s => String(s.ship_id) === String(shipId));
    if (ship) applyShipConfig(ship);
  };

  const isItemLocked = (category, value) => {
    if (!catalog) return false;
    const items = catalog[category] || [];
    const item = items.find(i => i.value === value || i.id === value || i.name === value);
    if (!item) return false;
    return item.locked === true;
  };

  const handleSave = async () => {
    if (!selectedShipId) return;
    try {
      setSaveLoading(true);
      setError(null);
      await cosmetics.updateVisual(selectedShipId, {
        hull_color: hullColor,
        accent_color: accentColor,
        engine_trail: engineTrail,
        decal,
        skin,
        nameplate_style: nameplateStyle,
      });
      setToast({ message: 'Visual configuration saved.', type: 'success' });
      setTimeout(() => setToast(null), 4000);
      // Update local ship data
      setUserShips(prev =>
        prev.map(s =>
          String(s.ship_id) === String(selectedShipId)
            ? { ...s, visual_config: { hull_color: hullColor, accent_color: accentColor, engine_trail: engineTrail, decal, skin, nameplate_style: nameplateStyle } }
            : s
        )
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save configuration.');
    } finally {
      setSaveLoading(false);
    }
  };

  const renderColorGrid = (label, icon, selectedColor, onSelect) => (
    <div>
      <label className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
        {icon} {label}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {COLOR_PALETTE.map(color => (
          <button
            key={color}
            onClick={() => onSelect(color)}
            className={`w-7 h-7 rounded border-2 transition-all ${
              selectedColor === color
                ? 'border-white scale-110 shadow-lg'
                : 'border-space-600 hover:border-gray-400'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="w-8 h-8 rounded border border-space-600" style={{ backgroundColor: selectedColor }} />
        <span className="text-xs text-gray-400 font-mono">{selectedColor}</span>
      </div>
    </div>
  );

  const renderDropdown = (label, icon, options, value, onChange, category) => (
    <div>
      <label className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
        {icon} {label}
      </label>
      <div className="space-y-1">
        {options.map(opt => {
          const locked = isItemLocked(category, opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => !locked && onChange(opt.value)}
              disabled={locked}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between transition-colors ${
                locked
                  ? 'bg-space-900/50 text-gray-600 cursor-not-allowed'
                  : value === opt.value
                    ? 'bg-accent-cyan/10 border border-accent-cyan/40 text-accent-cyan'
                    : 'bg-space-800 border border-space-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              <span>{opt.label}</span>
              {locked ? (
                <Lock className="w-3.5 h-3.5 text-gray-600" />
              ) : value === opt.value ? (
                <Check className="w-3.5 h-3.5 text-accent-cyan" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Paintbrush className="w-7 h-7 text-accent-purple" />
            Ship Customizer
          </h1>
          <p className="text-gray-400">Personalize your vessel's appearance</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="holo-button" disabled={loading}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saveLoading || !selectedShipId}
            className="holo-button-orange disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saveLoading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-sm underline">Dismiss</button>
        </div>
      )}

      {toast && (
        <div className={`flex items-center gap-2 p-3 rounded-lg border ${
          toast.type === 'success'
            ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
            : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
        }`}>
          <Sparkles className="w-4 h-4" />
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-auto text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Ship Selector */}
      <div className="holo-panel p-4">
        <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Select Ship</label>
        <select
          value={selectedShipId}
          onChange={handleShipChange}
          className="w-full bg-space-900 border border-space-600 text-white rounded px-3 py-2 text-sm focus:border-accent-cyan outline-none"
        >
          {userShips.length === 0 && <option value="">No ships available</option>}
          {userShips.map(s => (
            <option key={s.ship_id} value={s.ship_id}>
              {s.name} ({s.ship_type})
            </option>
          ))}
        </select>
      </div>

      {selectedShipId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Colors */}
          <div className="space-y-6">
            <div className="holo-panel p-5 space-y-5">
              {renderColorGrid(
                'Hull Color',
                <Palette className="w-3.5 h-3.5" />,
                hullColor,
                setHullColor
              )}
            </div>
            <div className="holo-panel p-5 space-y-5">
              {renderColorGrid(
                'Accent Color',
                <Sparkles className="w-3.5 h-3.5" />,
                accentColor,
                setAccentColor
              )}
            </div>
          </div>

          {/* Right Column: Dropdowns */}
          <div className="space-y-6">
            <div className="holo-panel p-5">
              {renderDropdown(
                'Engine Trail',
                <Flame className="w-3.5 h-3.5" />,
                ENGINE_TRAILS, engineTrail, setEngineTrail, 'engine_trails'
              )}
            </div>
            <div className="holo-panel p-5">
              {renderDropdown(
                'Decal',
                <Sticker className="w-3.5 h-3.5" />,
                DECALS, decal, setDecal, 'decals'
              )}
            </div>
            <div className="holo-panel p-5">
              {renderDropdown(
                'Ship Skin',
                <Image className="w-3.5 h-3.5" />,
                SKINS, skin, setSkin, 'skins'
              )}
            </div>
            <div className="holo-panel p-5">
              {renderDropdown(
                'Nameplate Style',
                <Type className="w-3.5 h-3.5" />,
                NAMEPLATE_STYLES, nameplateStyle, setNameplateStyle, 'nameplate_styles'
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Preview */}
      {selectedShipId && (() => {
        const shipObj = userShips.find(s => String(s.ship_id) === String(selectedShipId));
        return (
          <div className="holo-panel p-6">
            <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-4">Live Preview</h3>
            <div className="flex flex-col md:flex-row gap-6 items-center">
              {/* Visual Ship */}
              <div className="relative w-48 h-32 rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)', border: `2px solid ${accentColor}40` }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    {/* Hull body */}
                    <div className="w-20 h-8 rounded-full" style={{ background: `linear-gradient(135deg, ${hullColor}, ${hullColor}88)`, boxShadow: `0 0 20px ${hullColor}33` }} />
                    {/* Accent stripe */}
                    <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2" style={{ background: accentColor }} />
                    {/* Engine trail */}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 w-12 h-2 rounded-l-full opacity-60" style={{
                      background: `linear-gradient(to left, ${TRAIL_COLORS[engineTrail] || '#00ffff'}, transparent)`,
                      boxShadow: `0 0 8px ${TRAIL_COLORS[engineTrail] || '#00ffff'}`,
                    }} />
                  </div>
                </div>
                {/* Nameplate */}
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{
                    color: nameplateStyle === 'neon' ? hullColor : nameplateStyle === 'gold' ? '#ffd700' : '#fff',
                    fontFamily: nameplateStyle === 'cursive' ? 'cursive' : nameplateStyle === 'military' ? 'monospace' : 'inherit',
                    textShadow: nameplateStyle === 'neon' ? `0 0 6px ${hullColor}` : 'none',
                  }}>{shipObj?.name || 'Ship'}</span>
                </div>
                {/* Skin overlay */}
                {skin !== 'default' && (
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: skin === 'chrome' ? 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))' :
                      skin === 'matte' ? 'rgba(0,0,0,0.3)' :
                      skin === 'carbon' ? 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)' :
                      skin === 'holographic' ? 'linear-gradient(135deg, rgba(255,0,0,0.05), rgba(0,255,0,0.05), rgba(0,0,255,0.05))' :
                      skin === 'rustic' ? 'radial-gradient(circle at 30% 50%, rgba(139,69,19,0.15), transparent)' : 'none',
                  }} />
                )}
              </div>
              {/* Config summary */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-space-600" style={{ backgroundColor: hullColor }} />
                  <span className="text-gray-400 text-xs">Hull</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-space-600" style={{ backgroundColor: accentColor }} />
                  <span className="text-gray-400 text-xs">Accent</span>
                </div>
                <div className="text-xs text-gray-400">Trail: <span className="text-white">{ENGINE_TRAILS.find(e => e.value === engineTrail)?.label}</span></div>
                <div className="text-xs text-gray-400">Decal: <span className="text-white">{DECALS.find(d => d.value === decal)?.label}</span></div>
                <div className="text-xs text-gray-400">Skin: <span className="text-white">{SKINS.find(s => s.value === skin)?.label}</span></div>
                <div className="text-xs text-gray-400">Nameplate: <span className="text-white">{NAMEPLATE_STYLES.find(n => n.value === nameplateStyle)?.label}</span></div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ShipCustomizer;
