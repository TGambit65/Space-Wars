import { useState, useEffect, useCallback } from 'react';
import { admin } from '../../services/api';
import { Save, CheckCircle, XCircle, Loader, RotateCcw, Volume2, Mic } from 'lucide-react';

const PROVIDERS = [
  { value: 'none', label: 'None (Disabled)' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'grok', label: 'Grok' },
  { value: 'nvidia', label: 'NVIDIA NIM' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'local', label: 'Local Model' },
];

const STT_PROVIDERS = [
  { value: 'none', label: 'None (Disabled)' },
  { value: 'openai', label: 'OpenAI (Whisper)' },
  { value: 'google', label: 'Google Cloud' },
  { value: 'local', label: 'Local (Whisper.cpp)' },
];

const TTS_PROVIDERS = [
  { value: 'none', label: 'None (Disabled)' },
  { value: 'openai', label: 'OpenAI TTS' },
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'google', label: 'Google Cloud' },
  { value: 'local', label: 'Local (Piper)' },
];

const NPC_TYPES = ['PIRATE', 'TRADER', 'PATROL', 'BOUNTY_HUNTER', 'PIRATE_LORD'];

const DIFFICULTY_LABELS = {
  1: { label: 'Passive', desc: 'NPCs rarely attack. AI almost never consulted.' },
  2: { label: 'Easy', desc: 'NPCs cautious. AI rarely consulted.' },
  3: { label: 'Normal', desc: 'Balanced combat. AI consulted for ambiguous situations.' },
  4: { label: 'Hard', desc: 'NPCs are aggressive. AI frequently drives decisions.' },
  5: { label: 'Brutal', desc: 'NPCs are highly aggressive. AI frequently drives tactical decisions.' },
};

const PROMPT_VARIABLES = '{npc_name}, {npc_type}, {trait_primary}, {trait_secondary}, {speech_style}, {quirk}, {sector_name}, {hull_percent}, {nearby_players}';

const showsBaseUrl = (provider) => provider === 'local' || provider === 'openrouter';

const AIConfigTab = () => {
  const [settings, setSettings] = useState({});
  const [original, setOriginal] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState({});
  const [activePromptTab, setActivePromptTab] = useState('PIRATE');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await admin.getSettings();
      const data = res.data.data;
      setSettings(data);
      setOriginal(data);
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const getSetting = useCallback((key) => {
    return settings[key] ?? '';
  }, [settings]);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Build diff of changed settings
      const changed = {};
      for (const key of Object.keys(settings)) {
        if (JSON.stringify(settings[key]) !== JSON.stringify(original[key])) {
          changed[key] = settings[key];
        }
      }

      if (Object.keys(changed).length === 0) {
        setSuccess('No changes to save');
        return;
      }

      await admin.updateSettings(changed);
      setOriginal({ ...settings });
      setSuccess(`Saved ${Object.keys(changed).length} setting(s)`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (purpose) => {
    const prefix = purpose === 'tactical' ? 'ai_llm.tactical' : purpose === 'interactive' ? 'ai_llm.interactive' : purpose === 'stt' ? 'ai_stt' : 'ai_tts';
    const providerType = getSetting(`${prefix}.provider`);

    if (!providerType || providerType === 'none') {
      setTestResults(prev => ({ ...prev, [purpose]: { connected: false, message: 'No provider selected' } }));
      return;
    }

    try {
      setTesting(prev => ({ ...prev, [purpose]: true }));
      const config = {
        api_key: getSetting(`${prefix}.api_key`),
        model: getSetting(`${prefix}.model`),
        base_url: getSetting(`${prefix}.base_url`),
      };
      const res = await admin.testAIConnection({ provider_type: providerType, purpose, config });
      setTestResults(prev => ({ ...prev, [purpose]: res.data.data }));
    } catch (err) {
      setTestResults(prev => ({ ...prev, [purpose]: { connected: false, message: err.message } }));
    } finally {
      setTesting(prev => ({ ...prev, [purpose]: false }));
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader className="w-8 h-8 text-accent-cyan mx-auto mb-2 animate-spin" />
        <div className="text-gray-400 text-sm">Loading AI settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-3 flex items-center gap-2">
          <XCircle className="w-5 h-5 text-accent-red flex-shrink-0" />
          <span className="text-accent-red text-sm">{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
          <span className="text-green-400 text-sm">{success}</span>
        </div>
      )}

      {/* LLM Configuration */}
      <div className="card p-4">
        <h2 className="card-header">LLM Configuration</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LLMColumn
            title="Tactical AI"
            subtitle="NPC behavior decisions"
            prefix="ai_llm.tactical"
            purpose="tactical"
            getSetting={getSetting}
            updateSetting={updateSetting}
            testResult={testResults.tactical}
            testing={testing.tactical}
            onTest={() => handleTestConnection('tactical')}
          />
          <LLMColumn
            title="Interactive AI"
            subtitle="NPC dialogue responses"
            prefix="ai_llm.interactive"
            purpose="interactive"
            getSetting={getSetting}
            updateSetting={updateSetting}
            testResult={testResults.interactive}
            testing={testing.interactive}
            onTest={() => handleTestConnection('interactive')}
          />
        </div>
      </div>

      {/* Voice Configuration */}
      <div className="card p-4">
        <h2 className="card-header flex items-center gap-2">
          <Volume2 className="w-4 h-4" /> Voice Configuration
        </h2>
        <div className="mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => updateSetting('npc.voice_enabled', !getSetting('npc.voice_enabled'))}
              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                getSetting('npc.voice_enabled') ? 'bg-accent-cyan' : 'bg-space-600'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                getSetting('npc.voice_enabled') ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </div>
            <span className="text-sm text-gray-300">Voice Features Enabled</span>
            <span className="text-xs text-gray-500">(Premium/Elite users only)</span>
          </label>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* STT */}
          <div className="bg-space-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-accent-cyan mb-3 flex items-center gap-2">
              <Mic className="w-4 h-4" /> Speech-to-Text
            </h3>
            <div className="space-y-3">
              <SettingSelect label="Provider" value={getSetting('ai_stt.provider')} options={STT_PROVIDERS}
                onChange={(v) => updateSetting('ai_stt.provider', v)} />
              <SettingInput label="API Key" type="password" value={getSetting('ai_stt.api_key')}
                onChange={(v) => updateSetting('ai_stt.api_key', v)} placeholder="Enter API key" />
              <SettingInput label="Model" value={getSetting('ai_stt.model')}
                onChange={(v) => updateSetting('ai_stt.model', v)} placeholder="whisper-1" />
              <SettingInput label="Language" value={getSetting('ai_stt.language')}
                onChange={(v) => updateSetting('ai_stt.language', v)} placeholder="en" />
              <TestButton purpose="stt" result={testResults.stt} testing={testing.stt}
                onTest={() => handleTestConnection('stt')} />
            </div>
          </div>
          {/* TTS */}
          <div className="bg-space-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-accent-cyan mb-3 flex items-center gap-2">
              <Volume2 className="w-4 h-4" /> Text-to-Speech
            </h3>
            <div className="space-y-3">
              <SettingSelect label="Provider" value={getSetting('ai_tts.provider')} options={TTS_PROVIDERS}
                onChange={(v) => updateSetting('ai_tts.provider', v)} />
              <SettingInput label="API Key" type="password" value={getSetting('ai_tts.api_key')}
                onChange={(v) => updateSetting('ai_tts.api_key', v)} placeholder="Enter API key" />
              <SettingInput label="Model" value={getSetting('ai_tts.model')}
                onChange={(v) => updateSetting('ai_tts.model', v)} placeholder="tts-1" />
              <SettingInput label="Voice ID" value={getSetting('ai_tts.voice_id')}
                onChange={(v) => updateSetting('ai_tts.voice_id', v)} placeholder="alloy" />
              <TestButton purpose="tts" result={testResults.tts} testing={testing.tts}
                onTest={() => handleTestConnection('tts')} />
            </div>
          </div>
        </div>
      </div>

      {/* Prompt Templates */}
      <div className="card p-4">
        <h2 className="card-header">Prompt Templates</h2>
        <div className="flex gap-1 mb-4 flex-wrap">
          {NPC_TYPES.map(type => (
            <button key={type} onClick={() => setActivePromptTab(type)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activePromptTab === type
                  ? 'bg-accent-cyan/20 border border-accent-cyan text-accent-cyan'
                  : 'bg-space-800 border border-space-700 text-gray-400 hover:border-space-600'
              }`}>
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <textarea
            value={getSetting(`ai_llm.prompt.${activePromptTab}`) || ''}
            onChange={(e) => updateSetting(`ai_llm.prompt.${activePromptTab}`, e.target.value)}
            className="input w-full font-mono text-sm"
            rows={8}
            placeholder={`System prompt for ${activePromptTab} NPCs...`}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Variables: <code className="text-gray-400">{PROMPT_VARIABLES}</code>
            </p>
            <button onClick={() => updateSetting(`ai_llm.prompt.${activePromptTab}`, '')}
              className="btn text-xs bg-space-700 text-gray-400 hover:text-white px-2 py-1 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Difficulty */}
      <div className="card p-4">
        <h2 className="card-header">NPC Difficulty</h2>
        <div className="space-y-3">
          <input type="range" min="1" max="5" step="1"
            value={getSetting('npc.difficulty') || 3}
            onChange={(e) => updateSetting('npc.difficulty', parseInt(e.target.value))}
            className="w-full accent-accent-cyan"
          />
          <div className="flex justify-between text-xs text-gray-500">
            {[1, 2, 3, 4, 5].map(n => (
              <span key={n} className={parseInt(getSetting('npc.difficulty')) === n ? 'text-accent-cyan font-bold' : ''}>
                {DIFFICULTY_LABELS[n].label}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-400">
            {DIFFICULTY_LABELS[getSetting('npc.difficulty') || 3]?.desc}
          </p>
        </div>
      </div>

      {/* Global Toggles */}
      <div className="card p-4">
        <h2 className="card-header">Global Toggles</h2>
        <div className="space-y-3">
          <ToggleRow label="AI Enabled (Master)" settingKey="npc.ai_enabled"
            value={getSetting('npc.ai_enabled')} onChange={updateSetting} />
          <div className="border-t border-space-700 pt-3">
            <p className="text-xs text-gray-500 mb-2">Per-NPC Type AI</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {NPC_TYPES.map(type => (
                <ToggleRow key={type} label={type.replace('_', ' ')} compact
                  settingKey={`npc.ai.${type.toLowerCase()}`}
                  value={getSetting(`npc.ai.${type.toLowerCase()}`)}
                  onChange={updateSetting} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="btn btn-primary flex items-center gap-2 px-6">
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

// --- Sub-components ---

const SettingInput = ({ label, value, onChange, type = 'text', placeholder }) => (
  <div>
    <label className="block text-xs text-gray-400 mb-1">{label}</label>
    <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)}
      className="input w-full text-sm" placeholder={placeholder} />
  </div>
);

const SettingSelect = ({ label, value, options, onChange }) => (
  <div>
    <label className="block text-xs text-gray-400 mb-1">{label}</label>
    <select value={value || 'none'} onChange={(e) => onChange(e.target.value)}
      className="input w-full text-sm">
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const ToggleRow = ({ label, settingKey, value, onChange, compact }) => (
  <label className={`flex items-center gap-3 cursor-pointer ${compact ? '' : ''}`}>
    <div
      onClick={() => onChange(settingKey, !value)}
      className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
        value ? 'bg-accent-cyan' : 'bg-space-600'
      }`}
    >
      <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
        value ? 'translate-x-4' : 'translate-x-0.5'
      }`} />
    </div>
    <span className={`text-gray-300 ${compact ? 'text-xs' : 'text-sm'}`}>{label}</span>
  </label>
);

const TestButton = ({ purpose, result, testing, onTest }) => (
  <div>
    <button onClick={onTest} disabled={testing}
      className="btn btn-secondary text-xs w-full flex items-center justify-center gap-2">
      {testing ? <Loader className="w-3 h-3 animate-spin" /> : null}
      {testing ? 'Testing...' : 'Test Connection'}
    </button>
    {result && (
      <div className={`mt-2 text-xs flex items-center gap-1 ${result.connected ? 'text-green-400' : 'text-accent-red'}`}>
        {result.connected ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
        {result.message}
        {result.latency_ms > 0 && <span className="text-gray-500 ml-1">({result.latency_ms}ms)</span>}
      </div>
    )}
  </div>
);

const LLMColumn = ({ title, subtitle, prefix, purpose, getSetting, updateSetting, testResult, testing, onTest }) => {
  const provider = getSetting(`${prefix}.provider`) || 'none';
  return (
    <div className="bg-space-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-accent-cyan mb-1">{title}</h3>
      <p className="text-xs text-gray-500 mb-3">{subtitle}</p>
      <div className="space-y-3">
        <SettingSelect label="Provider" value={provider} options={PROVIDERS}
          onChange={(v) => updateSetting(`${prefix}.provider`, v)} />
        <SettingInput label="Model" value={getSetting(`${prefix}.model`)}
          onChange={(v) => updateSetting(`${prefix}.model`, v)} placeholder="e.g. gpt-4o-mini" />
        <SettingInput label="API Key" type="password" value={getSetting(`${prefix}.api_key`)}
          onChange={(v) => updateSetting(`${prefix}.api_key`, v)} placeholder="Enter API key" />
        {showsBaseUrl(provider) && (
          <SettingInput label="Base URL" value={getSetting(`${prefix}.base_url`)}
            onChange={(v) => updateSetting(`${prefix}.base_url`, v)} placeholder="http://localhost:8080/v1" />
        )}
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Temperature: {getSetting(`${prefix}.temperature`) ?? 0.7}
          </label>
          <input type="range" min="0" max="2" step="0.1"
            value={getSetting(`${prefix}.temperature`) ?? 0.7}
            onChange={(e) => updateSetting(`${prefix}.temperature`, parseFloat(e.target.value))}
            className="w-full accent-accent-cyan"
          />
        </div>
        <SettingInput label="Max Tokens" type="number"
          value={getSetting(`${prefix}.max_tokens`)}
          onChange={(v) => updateSetting(`${prefix}.max_tokens`, parseInt(v) || 0)}
          placeholder={purpose === 'tactical' ? '200' : '300'} />
        <TestButton purpose={purpose} result={testResult} testing={testing} onTest={onTest} />
      </div>
    </div>
  );
};

export default AIConfigTab;
