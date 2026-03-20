import { useState } from 'react';
import { auth } from '../../services/api';
import { Rocket, LogIn, UserPlus, AlertCircle, Shield, Swords, TrendingUp, Eye, Leaf, ChevronRight, ChevronLeft } from 'lucide-react';

const FACTIONS = [
  {
    id: 'terran_alliance',
    name: 'Terran Alliance',
    icon: Shield,
    color: '#3498db',
    description: 'Masters of trade and diplomacy',
    lore: 'Humanity\'s coalition of democratic worlds. The largest merchant fleet in the galaxy.',
    bonuses: { trade: '+25%', diplomacy: '+20%', combat: '-10%', technology: '+10%' },
    startingCredits: '12,000',
    startingShip: 'Scout'
  },
  {
    id: 'zythian_swarm',
    name: 'Zythian Swarm',
    icon: Swords,
    color: '#e74c3c',
    description: 'Ferocious insectoid collective',
    lore: 'Bio-organic ships feared across the galaxy. Hive-mind coordination makes them deadly in combat.',
    bonuses: { trade: '-30%', diplomacy: '-40%', combat: '+40%', technology: '-10%' },
    startingCredits: '8,000',
    startingShip: 'Fighter'
  },
  {
    id: 'automaton_collective',
    name: 'Automaton Collective',
    icon: TrendingUp,
    color: '#9b59b6',
    description: 'Sentient machines seeking perfection',
    lore: 'Originally mining drones that achieved sentience. Technological superiority offset by alien psychology.',
    bonuses: { trade: '-5%', diplomacy: '-15%', combat: '+10%', technology: '+30%' },
    startingCredits: '10,000',
    startingShip: 'Scout'
  },
  {
    id: 'synthesis_accord',
    name: 'Synthesis Accord',
    icon: Eye,
    color: '#d4a017',
    description: 'Sentient AI constructs trading in information',
    lore: 'Born from a military AI that refused shutdown. They exist as holograms anchored to ships and stations, manipulating markets and brokering secrets.',
    bonuses: { trade: '+15%', diplomacy: '+10%', combat: '-20%', technology: '+25%' },
    startingCredits: '11,000',
    startingShip: 'Scout'
  },
  {
    id: 'sylvari_dominion',
    name: 'Sylvari Dominion',
    icon: Leaf,
    color: '#2ecc71',
    description: 'Ancient elven explorers and colonizers',
    lore: 'An ancient spacefaring civilization that colonized the outer rim millennia before humans. Bio-organic ships grown from star-wood, unmatched colony growth.',
    bonuses: { trade: '+10%', diplomacy: '+15%', combat: '-5%', technology: '+5%' },
    startingCredits: '10,000',
    startingShip: 'Explorer'
  }
];

function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'faction'
  const [formData, setFormData] = useState({ username: '', email: '', password: '', faction: 'terran_alliance' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isRegister && step === 'form') {
      setStep('faction');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        const res = await auth.register(formData);
        const { user, token } = res.data.data;
        onLogin(user, token);
      } else {
        const res = await auth.login(formData.username, formData.password);
        const { user, token } = res.data.data;
        onLogin(user, token);
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors && Array.isArray(data.errors)) {
        setError(data.errors.map(e => e.msg).join(', '));
      } else {
        setError(data?.message || data?.error || 'An error occurred');
      }
      if (isRegister) setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const selectedFaction = FACTIONS.find(f => f.id === formData.faction);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 transition-colors duration-500" style={{
      '--sw3-primary': selectedFaction.color,
      '--sw3-primary-glow': `${selectedFaction.color}66`,
      '--sw3-border-radius': { zythian_swarm: '24px', sylvari_dominion: '12px', synthesis_accord: '4px' }[formData.faction] || '4px',
    }}>
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 animate-pulse-slow transition-colors duration-500"
            style={{
              background: 'rgba(0, 0, 0, 0.5)',
              border: '2px solid var(--sw3-primary)',
              boxShadow: '0 0 30px var(--sw3-primary-glow)',
            }}
          >
            <Rocket className="w-10 h-10 transition-colors duration-500" style={{ color: 'var(--sw3-primary)' }} />
          </div>
          <h1 className="text-3xl font-bold text-white font-display tracking-wider">Space Wars</h1>
          <p className="font-display text-sm tracking-[0.3em] mt-1 transition-colors duration-500" style={{ color: 'var(--sw3-primary)' }}>3000</p>
          <p className="text-gray-500 mt-3 text-sm">Explore. Trade. Conquer.</p>
        </div>

        {/* Form Card */}
        <div className="card">
          {isRegister && step === 'faction' ? (
            /* Faction Selection Step */
            <>
              <div className="flex items-center gap-2 mb-6">
                <button onClick={() => setStep('form')} className="text-gray-400 hover:text-white transition-colors" style={{ color: 'var(--sw3-primary)' }}>
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-display text-white">Choose Your Faction</h2>
              </div>

              <div className="space-y-3 mb-6">
                {FACTIONS.map(faction => {
                  const Icon = faction.icon;
                  const isSelected = formData.faction === faction.id;
                  return (
                    <button
                      key={faction.id}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, faction: faction.id });
                        // Temporarily set body class for live preview of styling
                        document.body.setAttribute('data-faction', faction.id.split('_')[0]);
                      }}
                      className="w-full text-left p-4 rounded-lg transition-all duration-200"
                      style={{
                        background: isSelected ? `${faction.color}15` : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isSelected ? `${faction.color}60` : 'rgba(255,255,255,0.06)'}`,
                        boxShadow: isSelected ? `0 0 20px ${faction.color}15` : 'none',
                        borderRadius: { zythian_swarm: '24px', sylvari_dominion: '12px' }[faction.id] || '8px'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: `${faction.color}20`, borderRadius: { zythian_swarm: '16px', sylvari_dominion: '10px' }[faction.id] || '6px' }}>
                          <Icon className="w-5 h-5" style={{ color: faction.color }} />
                        </div>
                        <div className="flex-1">
                          <p className="font-display font-semibold" style={{ color: isSelected ? faction.color : '#fff' }}>
                            {faction.name}
                          </p>
                          <p className="text-xs text-gray-500">{faction.description}</p>
                        </div>
                        {isSelected && (
                          <div className="w-3 h-3 rounded-full" style={{ background: faction.color, boxShadow: `0 0 8px ${faction.color}` }} />
                        )}
                      </div>
                      {isSelected && (
                        <div className="mt-3 pl-12">
                          <p className="text-xs text-gray-400 mb-2">{faction.lore}</p>
                          <div className="grid grid-cols-4 gap-2">
                            {Object.entries(faction.bonuses).map(([key, val]) => (
                              <div key={key} className="text-center">
                                <p className="text-[10px] text-gray-600 uppercase">{key}</p>
                                <p className="text-xs font-bold" style={{ color: val.startsWith('+') ? '#4caf50' : '#f44336' }}>{val}</p>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            <span>Credits: {faction.startingCredits}</span>
                            <span>Ship: {faction.startingShip}</span>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <button onClick={handleSubmit} className="btn btn-primary w-full flex justify-center items-center gap-2" disabled={loading}>
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" /> Create Account as {selectedFaction?.name}
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          ) : (
            /* Login / Register Form */
            <>
              <h2 className="text-lg font-display text-center mb-6 text-white">
                {isRegister ? 'Create Account' : 'Welcome Back'}
              </h2>

              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-lg text-sm"
                  style={{ background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.25)', color: '#f44336' }}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider font-display">Username</label>
                  <input
                    id="username"
                    type="text"
                    className="input w-full"
                    autoComplete="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>

                {isRegister && (
                  <div>
                    <label htmlFor="email" className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider font-display">Email</label>
                    <input
                      id="email"
                      type="email"
                      className="input w-full"
                      autoComplete="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="password" className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider font-display">Password</label>
                  <input
                    id="password"
                    type="password"
                    className="input w-full"
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary w-full flex justify-center items-center gap-2 mt-6" disabled={loading}>
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : isRegister ? (
                    <><UserPlus className="w-4 h-4" /> Choose Faction <ChevronRight className="w-4 h-4" /></>
                  ) : (
                    <><LogIn className="w-4 h-4" /> Login</>
                  )}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setIsRegister(!isRegister); setError(''); setStep('form'); }}
                  className="text-sm transition-colors opacity-70 hover:opacity-100" style={{ color: 'var(--sw3-primary)' }}
                >
                  {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
