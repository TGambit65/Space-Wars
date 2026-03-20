import { useState } from 'react';
import { Settings, Globe, Server, TrendingUp, UserCog, Users, Cpu, Swords, Calendar, Shield } from 'lucide-react';
import UniverseTab from './UniverseTab';
import ServerTab from './ServerTab';
import EconomyTab from './EconomyTab';
import UsersTab from './UsersTab';
import NPCManagementTab from './NPCManagementTab';
import AIConfigTab from './AIConfigTab';
import WarsTab from './WarsTab';
import EventsTab from './EventsTab';
import AuditTab from './AuditTab';

const TABS = [
  { key: 'universe', label: 'Universe', icon: Globe },
  { key: 'server', label: 'Server', icon: Server },
  { key: 'economy', label: 'Economy', icon: TrendingUp },
  { key: 'users', label: 'Players', icon: UserCog },
  { key: 'npcs', label: 'NPCs', icon: Users },
  { key: 'ai', label: 'AI Config', icon: Cpu },
  { key: 'wars', label: 'Wars', icon: Swords },
  { key: 'events', label: 'Events', icon: Calendar },
  { key: 'audit', label: 'Audit Log', icon: Shield },
];

const TAB_COMPONENTS = {
  universe: UniverseTab,
  server: ServerTab,
  economy: EconomyTab,
  users: UsersTab,
  npcs: NPCManagementTab,
  ai: AIConfigTab,
  wars: WarsTab,
  events: EventsTab,
  audit: AuditTab,
};

const AdminPage = ({ user }) => {
  const [activeTab, setActiveTab] = useState('universe');
  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-8 h-8 text-accent-cyan" />
        <div>
          <h1 className="text-3xl font-bold text-white">Administration</h1>
          <p className="text-gray-400 text-sm">Manage universe, server, economy, players, NPCs, wars, events, and audit</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-space-700 pb-0 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                isActive
                  ? 'border-accent-cyan text-accent-cyan'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-space-500'
              }`}>
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {ActiveComponent && <ActiveComponent />}
    </div>
  );
};

export default AdminPage;
