import { useState, useEffect, useCallback } from 'react';
import { progression } from '../../services/api';
import { TrendingUp, Zap, Lock, CheckCircle, Clock } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';

function ProgressionPage({ user }) {
  const [data, setData] = useState(null);
  const [tech, setTech] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const notify = useNotifications();

  const fetchData = useCallback(async () => {
    try {
      const [progRes, techRes] = await Promise.all([
        progression.get(),
        progression.getTech(),
      ]);
      setData(progRes.data.data || progRes.data);
      setTech(techRes.data.data || techRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load progression data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpgradeSkill = async (skillName) => {
    setActionLoading(skillName);
    try {
      const prevLevel = data?.level;
      await progression.upgradeSkill(skillName);
      const [progRes, techRes] = await Promise.all([progression.get(), progression.getTech()]);
      const newData = progRes.data.data || progRes.data;
      setData(newData);
      setTech(techRes.data.data || techRes.data);
      const displayName = skillName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      notify.success(`Skill upgraded: ${displayName}`);
      if (prevLevel && newData.level > prevLevel) {
        notify.success(`Level Up! You are now Level ${newData.level}`, 8000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upgrade skill');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResearch = async (techName) => {
    setActionLoading(techName);
    try {
      await progression.research(techName);
      await fetchData();
      const displayName = techName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      notify.info(`Research started: ${displayName}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start research');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckResearch = async () => {
    try {
      await progression.checkResearch();
      await fetchData();
    } catch (err) {
      // Silently ignore if nothing to check
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan"></div>
      </div>
    );
  }

  const level = data?.level || 1;
  const xp = data?.xp || 0;
  const xpToNext = data?.xp_to_next_level || 1000;
  const skillPoints = data?.skill_points || 0;
  const skills = data?.skills || {};
  const techs = tech?.technologies || tech || [];
  const xpPct = Math.min((xp / xpToNext) * 100, 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Progression</h1>
          <p className="text-gray-500 text-sm mt-1">Skills, technologies, and advancement</p>
        </div>
        <button onClick={handleCheckResearch} className="btn btn-ghost text-sm">
          <Clock className="w-4 h-4 mr-1 inline" /> Check Research
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.3)', color: '#f44336' }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Level & XP */}
      <div className="holo-panel p-6">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-display mb-1">Level</p>
            <p className="text-4xl font-bold font-display holo-text">{level}</p>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Experience</span>
              <span className="text-neon-cyan font-display">{xp.toLocaleString()} / {xpToNext.toLocaleString()} XP</span>
            </div>
            <div className="progress-bar h-3">
              <div className="progress-fill bg-neon-cyan" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
          <div className="text-center" style={{ borderLeft: '1px solid rgba(0,255,255,0.1)', paddingLeft: '1.5rem' }}>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-display mb-1">Skill Points</p>
            <p className="text-3xl font-bold font-display text-neon-orange">{skillPoints}</p>
          </div>
        </div>
      </div>

      {/* Skills Grid */}
      <div>
        <h2 className="text-lg font-display text-white mb-3">Skills</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(skills).map(([name, skill]) => (
            <SkillCard
              key={name}
              name={name}
              skill={skill}
              canUpgrade={skillPoints > 0 && (skill.level || 0) < 10}
              onUpgrade={() => handleUpgradeSkill(name)}
              loading={actionLoading === name}
            />
          ))}
        </div>
      </div>

      {/* Tech Tree */}
      <div>
        <h2 className="text-lg font-display text-white mb-3">Technology</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Array.isArray(techs) ? techs : Object.entries(techs).map(([name, t]) => ({ name, ...t }))).map((t) => (
            <TechCard
              key={t.name || t.tech_name}
              tech={t}
              onResearch={() => handleResearch(t.name || t.tech_name)}
              loading={actionLoading === (t.name || t.tech_name)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillCard({ name, skill, canUpgrade, onUpgrade, loading }) {
  const level = skill.level || 0;
  const maxLevel = 10;
  const pct = (level / maxLevel) * 100;
  const displayName = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="holo-panel p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-display text-white">{displayName}</h3>
        <span className="text-xs font-display text-neon-cyan">{level}/{maxLevel}</span>
      </div>
      <div className="progress-bar mb-3">
        <div className="progress-fill bg-neon-cyan" style={{ width: `${pct}%` }} />
      </div>
      {skill.effect && (
        <p className="text-xs text-gray-500 mb-3">{skill.effect}</p>
      )}
      {canUpgrade && (
        <button
          onClick={onUpgrade}
          disabled={loading}
          className="holo-button w-full text-xs justify-center"
        >
          {loading ? 'Upgrading...' : 'Upgrade'}
        </button>
      )}
    </div>
  );
}

function TechCard({ tech, onResearch, loading }) {
  const status = tech.status || (tech.completed ? 'completed' : tech.in_progress ? 'in_progress' : tech.available ? 'available' : 'locked');
  const name = tech.name || tech.tech_name;
  const displayName = (name || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const statusConfig = {
    completed: { icon: CheckCircle, color: '#00ffff', label: 'Completed', bg: 'rgba(0,255,255,0.08)' },
    in_progress: { icon: Clock, color: '#ffc107', label: 'Researching', bg: 'rgba(255,193,7,0.08)' },
    available: { icon: Zap, color: '#ff6600', label: 'Available', bg: 'rgba(255,102,0,0.08)' },
    locked: { icon: Lock, color: '#666', label: 'Locked', bg: 'rgba(100,100,100,0.05)' },
  };

  const cfg = statusConfig[status] || statusConfig.locked;
  const Icon = cfg.icon;

  return (
    <div className="holo-panel p-4" style={{ borderColor: `${cfg.color}30` }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-display text-white">{displayName}</h3>
        <Icon className="w-4 h-4" style={{ color: cfg.color }} />
      </div>
      <span className="badge text-xs mb-2 inline-block" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
        {cfg.label}
      </span>
      {tech.description && <p className="text-xs text-gray-500 mt-2">{tech.description}</p>}
      {tech.prerequisites?.length > 0 && status === 'locked' && (
        <p className="text-xs text-gray-600 mt-2">
          Requires: {tech.prerequisites.join(', ')}
        </p>
      )}
      {(tech.cost || tech.research_cost) && status === 'available' && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">Cost: {(tech.cost || tech.research_cost || 0).toLocaleString()} cr</span>
          <button onClick={onResearch} disabled={loading} className="holo-button-orange text-xs px-3 py-1">
            {loading ? '...' : 'Research'}
          </button>
        </div>
      )}
      {status === 'in_progress' && tech.progress !== undefined && (
        <div className="mt-3">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${tech.progress || 0}%`, background: '#ffc107', boxShadow: '0 0 8px rgba(255,193,7,0.3)' }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default ProgressionPage;
