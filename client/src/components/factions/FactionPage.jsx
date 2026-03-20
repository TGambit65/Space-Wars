import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { factions as factionsApi } from '../../services/api';
import { Shield, Swords, TrendingUp, Eye, Leaf, Users, Star, Trophy, ArrowRight } from 'lucide-react';

const FACTION_ICONS = {
  terran_alliance: Shield,
  zythian_swarm: Swords,
  automaton_collective: TrendingUp,
  synthesis_accord: Eye,
  sylvari_dominion: Leaf,
};

const FACTION_COLORS = {
  terran_alliance: '#3498db',
  zythian_swarm: '#e74c3c',
  automaton_collective: '#9b59b6',
  synthesis_accord: '#d4a017',
  sylvari_dominion: '#2ecc71',
};

const FACTION_TIPS = {
  terran_alliance: [
    { action: 'Trade at Terran-aligned ports', link: '/trading' },
    { action: 'Complete missions in Terran space', link: '/missions' },
    { action: 'Defeat Zythian pirates', link: '/combat' },
  ],
  zythian_swarm: [
    { action: 'Trade at Zythian-controlled ports', link: '/trading' },
    { action: 'Engage in PvP combat', link: '/combat' },
    { action: 'Complete Zythian faction missions', link: '/missions' },
  ],
  automaton_collective: [
    { action: 'Trade rare tech at Automaton ports', link: '/trading' },
    { action: 'Research advanced technologies', link: '/progression' },
    { action: 'Build colonies in deep space', link: '/colonies' },
  ],
  synthesis_accord: [
    { action: 'Scan sectors for intel at Synthesis stations', link: '/map' },
    { action: 'Trade market data with Synthesis brokers', link: '/trading' },
    { action: 'Research encryption technologies', link: '/progression' },
  ],
  sylvari_dominion: [
    { action: 'Explore uncharted systems', link: '/map' },
    { action: 'Establish colonies on frontier worlds', link: '/colonies' },
    { action: 'Complete Sylvari exploration missions', link: '/missions' },
  ],
};

function FactionPage({ user }) {
  const [standings, setStandings] = useState([]);
  const [factionList, setFactionList] = useState([]);
  const [wars, setWars] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [factionsRes, standingsRes, warsRes, leaderboardRes] = await Promise.all([
          factionsApi.list(),
          factionsApi.getStandings(),
          factionsApi.getActiveWars(),
          factionsApi.getLeaderboard(),
        ]);
        setFactionList(factionsRes.data.data || []);
        setStandings(standingsRes.data.data || []);
        setWars(warsRes.data.data || []);
        setLeaderboard(leaderboardRes.data.data || []);
      } catch (err) {
        console.error('Failed to fetch faction data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan"></div>
      </div>
    );
  }

  const userFaction = factionList.find(f => f.id === user?.faction);
  const userColor = FACTION_COLORS[user?.faction] || '#00ffff';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Faction Affairs</h1>
        <p className="text-gray-500 text-sm mt-1">Your allegiance and standing across the galaxy</p>
      </div>

      {/* Your Faction */}
      {userFaction && (
        <div className="holo-panel p-6" style={{ borderColor: `${userColor}40` }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-lg" style={{ background: `${userColor}15`, border: `1px solid ${userColor}30` }}>
              {(() => { const Icon = FACTION_ICONS[user.faction] || Shield; return <Icon className="w-8 h-8" style={{ color: userColor }} />; })()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-display">{userFaction.name}</h2>
              <p className="text-sm text-gray-400">{userFaction.description}</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 italic">{userFaction.lore}</p>
          <div className="grid grid-cols-4 gap-4 mt-4">
            {Object.entries(userFaction.bonuses || {}).map(([key, val]) => (
              <div key={key} className="text-center">
                <p className="text-xs text-gray-500 uppercase">{key}</p>
                <p className="text-lg font-bold font-display" style={{ color: val >= 1 ? '#4caf50' : '#f44336' }}>
                  {val >= 1 ? '+' : ''}{Math.round((val - 1) * 100)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Standings */}
      <div className="holo-panel p-4">
        <h2 className="card-header mb-4">Faction Standings</h2>
        <div className="space-y-3">
          {standings.map(s => {
            const color = FACTION_COLORS[s.faction] || '#888';
            const pct = ((s.reputation + 1000) / 2000) * 100;
            return (
              <div key={s.faction} className="flex items-center gap-4">
                <div className="w-32 text-sm font-display" style={{ color }}>
                  {factionList.find(f => f.id === s.faction)?.name || s.faction}
                </div>
                <div className="flex-1">
                  <div className="w-full h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
                <div className="w-20 text-right">
                  <span className="text-xs font-display" style={{ color }}>{s.rank}</span>
                </div>
                <div className="w-16 text-right text-xs text-gray-500">{s.reputation}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Improve Standing Tips */}
      {standings.length > 0 && (
        <div className="holo-panel p-4">
          <h2 className="card-header mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-neon-orange" /> Improve Your Standing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {standings.map(s => {
              const color = FACTION_COLORS[s.faction] || '#888';
              const tips = FACTION_TIPS[s.faction] || [];
              const fName = factionList.find(f => f.id === s.faction)?.name || s.faction;
              return (
                <div key={s.faction} className="p-3 rounded-lg" style={{ background: `${color}08`, border: `1px solid ${color}15` }}>
                  <h3 className="text-sm font-display mb-2" style={{ color }}>{fName}</h3>
                  <div className="space-y-1.5">
                    {tips.map((tip, i) => (
                      <Link key={i} to={tip.link} className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors group">
                        <ArrowRight className="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100" style={{ color }} />
                        <span>{tip.action}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Wars */}
      {wars.length > 0 && (
        <div className="holo-panel p-4">
          <h2 className="card-header mb-4 flex items-center gap-2">
            <Swords className="w-4 h-4 text-red-400" /> Active Wars
          </h2>
          <div className="space-y-3">
            {wars.map(war => (
              <div key={war.war_id} className="p-3 rounded-lg" style={{ background: 'rgba(244,67,54,0.05)', border: '1px solid rgba(244,67,54,0.15)' }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: FACTION_COLORS[war.attacker_faction] }}>
                    {factionList.find(f => f.id === war.attacker_faction)?.name}
                  </span>
                  <span className="text-red-400 text-xs font-display">VS</span>
                  <span style={{ color: FACTION_COLORS[war.defender_faction] }}>
                    {factionList.find(f => f.id === war.defender_faction)?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>Score: {war.attacker_score}</span>
                  <span>Score: {war.defender_score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Faction Leaderboard */}
      <div className="holo-panel p-4">
        <h2 className="card-header mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-neon-orange" /> Faction Leaderboard
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {leaderboard.map((faction, i) => {
            const color = FACTION_COLORS[faction.faction] || '#888';
            return (
              <div key={faction.faction} className="p-4 rounded-lg text-center" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
                <Users className="w-6 h-6 mx-auto mb-2" style={{ color }} />
                <h3 className="font-display text-sm" style={{ color }}>{faction.name}</h3>
                <p className="text-2xl font-bold text-white mt-2">{faction.member_count}</p>
                <p className="text-xs text-gray-500">members</p>
                {faction.avg_level && (
                  <p className="text-xs text-gray-500 mt-1">Avg Level: {Math.round(faction.avg_level)}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default FactionPage;
