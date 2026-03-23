import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { auth } from './services/api';
import useSocket from './hooks/useSocket';
import useNPCEvents from './hooks/useNPCEvents';
import { GameSessionProvider, useGameSession } from './contexts/GameSessionContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ToastContainer from './components/common/ToastContainer';
import Layout from './components/common/Layout';
import Login from './components/common/Login';
import Dashboard from './components/common/Dashboard';
import NPCChatPanel from './components/npc/NPCChatPanel';
import NPCHailNotification from './components/npc/NPCHailNotification';
import ChatPanel from './components/chat/ChatPanel';
import MiniMap from './components/navigation/MiniMap';
import { MessageSquare } from 'lucide-react';
import { useNotifications } from './contexts/NotificationContext';
import { clearToken, getToken, setToken } from './services/session';
import { ships as shipsApi } from './services/api';
import { playSfx } from './hooks/useSoundEffects';
import LevelUpModal from './components/common/LevelUpModal';

/** Renders MiniMap using activeShip from GameSessionContext */
function MiniMapWidget({ onNavigate }) {
  const { activeShip } = useGameSession();
  if (!activeShip) return null;
  return <MiniMap activeShip={activeShip} onNavigate={onNavigate} />;
}

/** Listens for NPC combat alerts and shows a warning toast */
function CombatAlertListener({ combatAlert, clearCombatAlert }) {
  const { warning } = useNotifications();

  useEffect(() => {
    if (!combatAlert) return;
    const npcName = combatAlert.name || 'Unknown NPC';
    const npcType = combatAlert.npc_type ? ` (${combatAlert.npc_type})` : '';
    warning(`Combat Alert: ${npcName}${npcType} is engaging you!`, 8000);
    playSfx('combatHit');
    clearCombatAlert();
  }, [combatAlert, clearCombatAlert, warning]);

  return null;
}

/** Listens for level-up events via socket and shows a modal + toast */
function LevelUpListener({ socket, onLevelUp }) {
  const { success } = useNotifications();
  const { refreshProgression } = useGameSession();

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      const lvl = data.new_level || '?';
      const pts = data.available_skill_points || 0;
      success(`Level Up! You are now level ${lvl}! (${pts} skill points available)`, 8000);
      playSfx('levelUp');
      refreshProgression().catch(() => {});
      if (onLevelUp) onLevelUp(data);
    };
    socket.on('player:level_up', handler);
    return () => socket.off('player:level_up', handler);
  }, [socket, success, refreshProgression, onLevelUp]);

  return null;
}

/** Listens for real-time achievement unlock events via socket and shows toast */
function AchievementListener({ socket }) {
  const { success } = useNotifications();

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      const rewardParts = [];
      if (data.reward_credits > 0) rewardParts.push(`+${Number(data.reward_credits).toLocaleString()} credits`);
      if (data.reward_xp > 0) rewardParts.push(`+${data.reward_xp} XP`);
      if (data.reward_title) rewardParts.push(`Title: ${data.reward_title}`);
      const rewardStr = rewardParts.length > 0 ? ` (${rewardParts.join(', ')})` : '';
      success(`Achievement Unlocked: ${data.name}!${rewardStr}`, 8000);
      playSfx('notification');
      // Notify dashboard widget to refresh
      window.dispatchEvent(new CustomEvent('sw3k:achievement-unlocked'));
    };
    socket.on('achievement:unlocked', handler);
    return () => socket.off('achievement:unlocked', handler);
  }, [socket, success]);

  return null;
}

const GalaxyMap = lazy(() => import('./components/navigation/GalaxyMap'));
const SystemView = lazy(() => import('./components/navigation/SystemView'));
const ShipPanel = lazy(() => import('./components/ship/ShipPanel'));
const ShipDesigner = lazy(() => import('./components/ship/ShipDesigner'));
const TradingPage = lazy(() => import('./components/trading/TradingPage'));
const CombatPage = lazy(() => import('./components/combat/CombatPage'));
const CombatHistory = lazy(() => import('./components/combat/CombatHistory'));
const RepairPage = lazy(() => import('./components/ship/RepairPage'));
const PlanetsPage = lazy(() => import('./components/planets/PlanetsPage'));
const ColoniesPage = lazy(() => import('./components/colonies/ColoniesPage'));
const ColonySurface = lazy(() => import('./components/colonies/ColonySurface'));
const VoxelSurface = lazy(() => import('./components/colonies/VoxelSurface'));
const ColonyLeaderboard = lazy(() => import('./components/colonies/ColonyLeaderboard'));
const GroundCombatView = lazy(() => import('./components/colonies/GroundCombatView'));
const CrewPage = lazy(() => import('./components/crew/CrewPage'));
const AdminPage = lazy(() => import('./components/admin/AdminPage'));
const PlanetOrbitView = lazy(() => import('./components/planet-orbit/PlanetOrbitView'));
const ProgressionPage = lazy(() => import('./components/progression/ProgressionPage'));
const CraftingPage = lazy(() => import('./components/crafting/CraftingPage'));
const MissionsPage = lazy(() => import('./components/missions/MissionsPage'));
const CorporationPage = lazy(() => import('./components/corporations/CorporationPage'));
const AutomationPage = lazy(() => import('./components/automation/AutomationPage'));
const MarketPage = lazy(() => import('./components/market/MarketPage'));
const WikiPage = lazy(() => import('./components/wiki/WikiPage'));
const FactionPage = lazy(() => import('./components/factions/FactionPage'));
const MessagingPage = lazy(() => import('./components/messaging/MessagingPage'));
const ShipCustomizer = lazy(() => import('./components/ship/ShipCustomizer'));
const OutpostsPage = lazy(() => import('./components/outposts/OutpostsPage'));
const EventsPage = lazy(() => import('./components/events/EventsPage'));
const ShipInteriorView = lazy(() => import('./components/traversal/ShipInteriorView'));
const DerelictBoardingView = lazy(() => import('./components/traversal/DerelictBoardingView'));
const AgentPage = lazy(() => import('./components/agent/AgentPage'));
const AchievementsPage = lazy(() => import('./components/common/AchievementsPage'));

import LoadingScreen from './components/common/LoadingScreen';

function RouteLoadingFallback() {
  return <LoadingScreen variant="default" />;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const appNavigate = useNavigate();
  const [activeChatNPC, setActiveChatNPC] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [levelUpData, setLevelUpData] = useState(null);

  const { socket, connected: socketConnected } = useSocket(user);
  const { sectorNPCs, pendingHails, dismissHail, activityFeed, combatAlert, clearCombatAlert } = useNPCEvents(socket);

  useEffect(() => {
    auth.getProfile({ skipAuthRedirect: true })
      .then(res => {
        setUser(res.data.data);
        // Restore last page on refresh (only when landing on root)
        const lastPage = localStorage.getItem('sw3k_last_page');
        if (lastPage && lastPage !== '/' && window.location.pathname === '/') {
          appNavigate(lastPage, { replace: true });
        }
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user?.faction) {
      document.body.setAttribute('data-faction', user.faction.split('_')[0]);
    } else {
      document.body.removeAttribute('data-faction');
    }
  }, [user?.faction]);

  const handleLogin = (userData, token) => {
    setToken(token);
    setUser(userData);
  };

  const handleLogout = () => {
    auth.logout().catch(() => {});
    clearToken();
    localStorage.removeItem('sw3k_last_page');
    setUser(null);
    setActiveChatNPC(null);
  };

  const handleLevelUp = useCallback((data) => {
    setLevelUpData(data);
  }, []);

  const handleCloseLevelUp = useCallback(() => {
    setLevelUpData(null);
  }, []);

  const handleHailNPC = useCallback((npc) => {
    setActiveChatNPC(npc);
  }, []);

  const handleAcceptHail = useCallback((hail) => {
    dismissHail(hail.npc_id);
    setActiveChatNPC({
      npc_id: hail.npc_id,
      name: hail.name,
      npc_type: hail.npc_type,
      hail_greeting: hail.greeting_text || null
    });
  }, [dismissHail]);

  const handleCloseChat = useCallback(() => {
    setActiveChatNPC(null);
  }, []);

  const handleMiniMapNavigate = useCallback(async (sectorId) => {
    try {
      const shipsRes = await shipsApi.getAll();
      const activeId = shipsRes.data.data?.active_ship_id;
      if (activeId) {
        await shipsApi.move(activeId, sectorId);
        appNavigate('/system');
      }
    } catch {
      appNavigate('/map');
    }
  }, [appNavigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan"></div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <NotificationProvider>
    <GameSessionProvider user={user} onUserUpdate={setUser}>
    <Layout user={user} onLogout={handleLogout} socketConnected={socketConnected}>
      <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/map" element={<GalaxyMap user={user} />} />
        <Route path="/system" element={<SystemView user={user} onHailNPC={handleHailNPC} activityFeed={activityFeed} sectorNPCs={sectorNPCs} />} />
        <Route path="/ships" element={<ShipPanel user={user} />} />
        <Route path="/ship/:shipId/interior" element={<ShipInteriorView user={user} />} />
        <Route path="/ship/:shipId/derelict" element={<DerelictBoardingView user={user} />} />
        <Route path="/designer" element={<ShipDesigner user={user} />} />
        <Route path="/trading" element={<TradingPage user={user} />} />
        <Route path="/combat" element={<CombatPage user={user} socket={socket} />} />
        <Route path="/combat/history" element={<CombatHistory user={user} />} />
        <Route path="/repair" element={<RepairPage user={user} />} />
        <Route path="/planets" element={<PlanetsPage user={user} />} />
        <Route path="/colonies" element={<ColoniesPage user={user} />} />
        <Route path="/colony/:colonyId/surface" element={<ColonySurface user={user} />} />
        <Route path="/colony/:colonyId/surface/public" element={<ColonySurface user={user} readOnly />} />
        <Route path="/colony/:colonyId/voxel" element={<VoxelSurface user={user} />} />
        <Route path="/colony-leaderboard" element={<ColonyLeaderboard user={user} />} />
        <Route path="/ground-combat/:instanceId" element={<GroundCombatView user={user} />} />
        <Route path="/crew" element={<CrewPage user={user} />} />
        <Route path="/planet/:planetId" element={<PlanetOrbitView user={user} />} />
        <Route path="/progression" element={<ProgressionPage user={user} />} />
        <Route path="/crafting" element={<CraftingPage user={user} />} />
        <Route path="/missions" element={<MissionsPage user={user} />} />
        <Route path="/corporation" element={<CorporationPage user={user} />} />
        <Route path="/automation" element={<AutomationPage user={user} />} />
        <Route path="/market" element={<MarketPage user={user} />} />
        <Route path="/wiki" element={<WikiPage />} />
        <Route path="/faction" element={<FactionPage user={user} />} />
        <Route path="/messages" element={<MessagingPage user={user} />} />
        <Route path="/customizer" element={<ShipCustomizer user={user} />} />
        <Route path="/outposts" element={<OutpostsPage user={user} />} />
        <Route path="/events" element={<EventsPage user={user} />} />
        <Route path="/agent" element={<AgentPage user={user} />} />
        <Route path="/achievements" element={<AchievementsPage />} />
        {user.is_admin && <Route path="/admin" element={<AdminPage user={user} />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>

      {/* NPC Hail Notifications */}
      <NPCHailNotification
        pendingHails={pendingHails}
        onAccept={handleAcceptHail}
        onDismiss={dismissHail}
      />

      {/* NPC Chat Panel */}
      {activeChatNPC && (
        <NPCChatPanel
          npc={activeChatNPC}
          socket={socket}
          onClose={handleCloseChat}
          user={user}
        />
      )}

      {/* P5 Item 1: Mini Navigation Map */}
      <MiniMapWidget onNavigate={handleMiniMapNavigate} />

      {/* Chat Toggle Button */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-4 right-4 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-200 hover:scale-105"
        style={{
          background: chatOpen ? 'rgba(0, 255, 255, 0.2)' : 'rgba(10, 10, 30, 0.85)',
          border: '1px solid rgba(0, 255, 255, 0.3)',
          boxShadow: chatOpen ? '0 0 15px rgba(0, 255, 255, 0.2)' : '0 0 8px rgba(0, 255, 255, 0.08)',
        }}
        title="Toggle Chat"
      >
        <MessageSquare className={`w-5 h-5 ${chatOpen ? 'text-neon-cyan' : 'text-gray-300'}`} />
        <span className={`text-xs font-medium ${chatOpen ? 'text-neon-cyan' : 'text-gray-300'}`}>
          {chatOpen ? 'Close' : 'Chat'}
        </span>
      </button>

      {/* Real-time Chat Panel */}
      <ChatPanel
        socket={socket}
        user={user}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      <CombatAlertListener combatAlert={combatAlert} clearCombatAlert={clearCombatAlert} />
      <LevelUpListener socket={socket} onLevelUp={handleLevelUp} />
      <AchievementListener socket={socket} />
      {levelUpData && <LevelUpModal data={levelUpData} onClose={handleCloseLevelUp} />}
      <ToastContainer />
    </Layout>
    </GameSessionProvider>
    </NotificationProvider>
  );
}

export default App;
