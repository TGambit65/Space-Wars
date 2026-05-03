import axios from 'axios';
import { clearToken, getToken, redirectToGameLogin } from './session';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors — only redirect when an authenticated session is invalidated,
// not when login/register returns 401 (wrong credentials)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');
      if (!isAuthEndpoint && !error.config?.skipAuthRedirect) {
        clearToken();
        redirectToGameLogin();
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const auth = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  getProfile: (config = {}) => api.get('/auth/profile', config),
  togglePvP: () => api.post('/auth/pvp-toggle'),
};

// Ships
export const ships = {
  getAll: () => api.get('/ships'),
  getById: (id) => api.get(`/ships/${id}`),
  move: (shipId, targetSectorId) => api.post(`/ships/${shipId}/move`, { target_sector_id: targetSectorId }),
  getCrewEffectiveness: (shipId) => api.get(`/ships/${shipId}/crew-effectiveness`),
  activate: (shipId) => api.post(`/ships/${shipId}/activate`),
  jump: (shipId, targetSectorId) => api.post(`/ships/${shipId}/jump`, { target_sector_id: targetSectorId }),
};

// Sectors
export const sectors = {
  getAll: (params) => api.get('/sectors', { params }),
  getById: (id) => api.get(`/sectors/${id}`),
  getAdjacent: (id) => api.get(`/sectors/${id}/adjacent`),
  getStats: () => api.get('/sectors/stats'),
  getMapData: () => api.get('/sectors/map'),
  getSystemDetail: (id) => api.get(`/sectors/${id}/system`),
};

// Planets
export const planets = {
  scan: (sectorId) => api.get(`/planets/scan/${sectorId}`),
  getDetails: (planetId) => api.get(`/planets/${planetId}`),
  getUserPlanets: () => api.get('/planets/user/owned'),
  getUserArtifacts: () => api.get('/planets/user/artifacts'),
  claimArtifact: (artifactId) => api.post(`/planets/artifacts/${artifactId}/claim`),
};

// Colonies
export const colonies = {
  getAll: () => api.get('/colonies'),
  getDetails: (colonyId) => api.get(`/colonies/${colonyId}`),
  colonize: (planetId, shipId, name) => api.post(`/colonies/${planetId}/colonize`, { ship_id: shipId, colony_name: name }),
  collect: (colonyId, shipId) => api.post(`/colonies/${colonyId}/collect`, { ship_id: shipId }),
  upgrade: (colonyId) => api.post(`/colonies/${colonyId}/upgrade`),
  abandon: (colonyId) => api.delete(`/colonies/${colonyId}`),
  getRaids: () => api.get('/colonies/raids'),
  // Surface endpoints
  getSurface: (colonyId) => api.get(`/colonies/${colonyId}/surface`),
  initializeSurface: (colonyId) => api.post(`/colonies/${colonyId}/surface/initialize`),
  placeBuilding: (colonyId, type, x, y) => api.post(`/colonies/${colonyId}/surface/place`, { building_type: type, grid_x: x, grid_y: y }),
  moveBuilding: (colonyId, buildingId, x, y) => api.post(`/colonies/${colonyId}/surface/move`, { building_id: buildingId, grid_x: x, grid_y: y }),
  undoPlacement: (colonyId, buildingId) => api.post(`/colonies/${colonyId}/surface/undo`, { building_id: buildingId }),
  claimAnomaly: (colonyId, anomalyId) => api.post(`/colonies/${colonyId}/surface/anomaly`, { anomaly_id: anomalyId }),
  repairBuildings: (colonyId, data) => api.post(`/colonies/${colonyId}/surface/repair`, data),
  // Custom block endpoints
  getBlocks: (colonyId) => api.get(`/colonies/${colonyId}/blocks`),
  placeBlock: (colonyId, data) => api.post(`/colonies/${colonyId}/blocks`, data),
  placeBlocks: (colonyId, blocks) => api.post(`/colonies/${colonyId}/blocks`, { blocks }),
  removeBlock: (colonyId, blockId) => api.delete(`/colonies/${colonyId}/blocks`, { data: { block_id: blockId } }),
  removeBlocks: (colonyId, blockIds) => api.delete(`/colonies/${colonyId}/blocks`, { data: { block_ids: blockIds } }),
  // Phase 4 endpoints
  getPublicSurface: (colonyId) => api.get(`/colonies/${colonyId}/surface/public`),
  getLeaderboard: (sortBy = 'production', limit = 20) => api.get(`/colonies/leaderboard?sortBy=${sortBy}&limit=${limit}`),
  getDailyQuests: () => api.get('/colonies/daily-quests'),
  claimDailyQuest: (questId) => api.post(`/colonies/daily-quests/${questId}/claim`),
  // Voxel 3D endpoints
  getShipInterior: (shipId, mode) => api.get(`/ships/${shipId}/interior${mode ? `?mode=${mode}` : ''}`),
  lootShipCrate: (shipId, deckId, x, y) => api.post(`/ships/${shipId}/loot`, { deckId, x, y }),
  getShipOnBoardCrew: (shipId) => api.get(`/ships/${shipId}/onboard-crew`),
  getDerelictInterior: (derelictId) => api.get(`/derelicts/${derelictId}/interior`),
  lootDerelictCrate: (derelictId, deckId, x, y) => api.post(`/derelicts/${derelictId}/loot`, { deckId, x, y }),
};

// Ground Combat
export const groundCombatApi = {
  trainUnit: (colonyId, unitType) => api.post('/ground-combat/train', { colony_id: colonyId, unit_type: unitType }),
  getGarrison: (colonyId) => api.get(`/ground-combat/garrison/${colonyId}`),
  setDefensePolicy: (colonyId, policy) => api.patch(`/ground-combat/policy/${colonyId}`, { policy }),
  disbandUnit: (colonyId, unitId) => api.post(`/ground-combat/disband/${colonyId}`, { unit_id: unitId }),
  getCombatHistory: (colonyId) => api.get(`/ground-combat/history/${colonyId}`),
  initiateInvasion: (colonyId, shipId, unitIds) => api.post('/ground-combat/invade', { colony_id: colonyId, ship_id: shipId, unit_ids: unitIds }),
  getCombatState: (instanceId) => api.get(`/ground-combat/${instanceId}`),
  processCombatTurn: (instanceId, orders) => api.post(`/ground-combat/${instanceId}/orders`, { orders }),
  retreat: (instanceId) => api.post(`/ground-combat/${instanceId}/retreat`),
};

// Crew
export const crew = {
  getAll: () => api.get('/crew'),
  getAtPort: (portId) => api.get(`/crew/port/${portId}`),
  getShipCrew: (shipId) => api.get(`/crew/ship/${shipId}`),
  hire: (crewId, shipId) => api.post('/crew/hire', { crew_id: crewId, ship_id: shipId }),
  assignRole: (crewId, role) => api.post(`/crew/${crewId}/assign`, { role }),
  transfer: (crewId, targetShipId) => api.post(`/crew/${crewId}/transfer`, { target_ship_id: targetShipId }),
  dismiss: (crewId) => api.delete(`/crew/${crewId}`),
  processSalaries: () => api.post('/crew/salaries/process'),
  payDebt: (amount) => api.post('/crew/salaries/pay-debt', { amount }),
};

// Ports
export const ports = {
  getAll: (params) => api.get('/ports', { params }),
  getById: (id) => api.get(`/ports/${id}`),
  getBySector: (sectorId) => api.get('/ports', { params: { sector_id: sectorId } }),
};

// Combat
export const combat = {
  getHistory: () => api.get('/combat/history'),
  getLog: (logId) => api.get(`/combat/log/${logId}`),
  realtimeAttackNPC: (shipId, npcId) => api.post(`/combat/realtime/attack-npc/${shipId}`, { npcId }),
  realtimeAttackPlayer: (shipId, defenderShipId) => api.post(`/combat/realtime/attack-player/${shipId}`, { defenderShipId }),
  getRealtimeState: (combatId) => api.get(`/combat/realtime/state/${combatId}`),
};

// Ship Designer
export const designer = {
  getComponents: () => api.get('/designer/components'),
  getDesign: (shipId) => api.get(`/designer/design/${shipId}`),
  install: (shipId, componentId) => api.post(`/designer/install/${shipId}`, { component_id: componentId }),
  uninstall: (shipId, componentId) => api.delete(`/designer/uninstall/${shipId}/${componentId}`),
  getRepairEstimate: (shipId) => api.get(`/designer/repair/${shipId}`),
  repairHull: (shipId) => api.post(`/designer/repair/${shipId}/hull`),
  repairComponent: (shipId, componentId) => api.post(`/designer/repair/${shipId}/component/${componentId}`),
};

// NPCs
export const npcs = {
  getInSector: (sectorId) => api.get(`/npcs/sector/${sectorId}`),
  getById: (npcId) => api.get(`/npcs/${npcId}`),
};

// Trade
export const trade = {
  getCargo: (shipId) => api.get(`/trade/cargo/${shipId}`),
  buy: (shipId, portId, commodityId, quantity) =>
    api.post('/trade/buy', { ship_id: shipId, port_id: portId, commodity_id: commodityId, quantity }),
  sell: (shipId, portId, commodityId, quantity) =>
    api.post('/trade/sell', { ship_id: shipId, port_id: portId, commodity_id: commodityId, quantity }),
  getCommodities: () => api.get('/trade/commodities'),
  getMarket: (commodityId) => api.get(`/trade/market/${commodityId}`),
  getMarketSummary: () => api.get('/trade/market'),
  getHistory: (params) => api.get('/trade/history', { params }),
  refuel: (shipId, portId, amount) => api.post(`/trade/refuel/${shipId}`, { port_id: portId, amount }),
};

// NPC Dialogue
export const dialogue = {
  start: (npcId) => api.post(`/dialogue/${npcId}/start`),
  selectOption: (npcId, option) => api.post(`/dialogue/${npcId}/option`, { option }),
  sendMessage: (npcId, text) => api.post(`/dialogue/${npcId}/message`, { text }),
  sendVoice: (npcId, audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice.webm');
    return api.post(`/dialogue/${npcId}/voice`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  end: (npcId) => api.post(`/dialogue/${npcId}/end`),
  getState: (npcId) => api.get(`/dialogue/${npcId}/state`),
};

// Progression
export const progression = {
  get: () => api.get('/progression'),
  upgradeSkill: (skillName) => api.post(`/progression/skills/${skillName}/upgrade`),
  getTech: () => api.get('/progression/tech'),
  research: (techName) => api.post(`/progression/tech/${techName}/research`),
  checkResearch: () => api.post('/progression/tech/check'),
};

// Crafting
export const crafting = {
  getBlueprints: () => api.get('/crafting/blueprints'),
  start: (data) => api.post('/crafting/start', data),
  cancel: (jobId) => api.post(`/crafting/${jobId}/cancel`),
  complete: (jobId) => api.post(`/crafting/${jobId}/complete`),
  check: () => api.post('/crafting/check'),
  getJobs: () => api.get('/crafting/jobs'),
};

// Missions
export const missions = {
  getActive: () => api.get('/missions/active'),
  getAvailable: (portId) => api.get(`/missions/available/${portId}`),
  accept: (missionId) => api.post(`/missions/${missionId}/accept`),
  abandon: (playerMissionId) => api.post(`/missions/${playerMissionId}/abandon`),
};

// Corporations
export const corporations = {
  create: (data) => api.post('/corporations', data),
  getMine: () => api.get('/corporations/mine'),
  getLeaderboard: () => api.get('/corporations/leaderboard'),
  getById: (id) => api.get(`/corporations/${id}`),
  join: (id) => api.post(`/corporations/${id}/join`),
  leave: () => api.post('/corporations/leave'),
  promote: (userId) => api.post(`/corporations/members/${userId}/promote`),
  transfer: (userId) => api.post(`/corporations/transfer/${userId}`),
  disband: () => api.delete('/corporations'),
  contribute: (amount) => api.post('/corporations/treasury/contribute', { amount }),
  withdraw: (amount) => api.post('/corporations/treasury/withdraw', { amount }),
};

// Wonders
export const wonders = {
  getTypes: () => api.get('/wonders/types'),
  getColonyWonders: (colonyId) => api.get(`/wonders/colony/${colonyId}`),
  build: (colonyId, wonderType) => api.post(`/wonders/colony/${colonyId}/build`, { wonder_type: wonderType }),
  advance: (wonderId) => api.post(`/wonders/${wonderId}/advance`),
};

// Automation
export const automation = {
  getTasks: () => api.get('/automation/tasks'),
  createTradeRoute: (data) => api.post('/automation/trade-route', data),
  createMiningRun: (data) => api.post('/automation/mining-run', data),
  pause: (taskId) => api.post(`/automation/${taskId}/pause`),
  resume: (taskId) => api.post(`/automation/${taskId}/resume`),
  cancel: (taskId) => api.delete(`/automation/${taskId}`),
};

// Market
export const market = {
  getOverview: (portId) => api.get(`/market/${portId}/overview`),
  getHistory: (portId, commodityId) => api.get(`/market/history/${portId}/${commodityId}`),
  getTrends: (commodityId) => api.get(`/market/trends/${commodityId}`),
};

// Colony Buildings
export const buildings = {
  getTypes: () => api.get('/buildings/types'),
  getColonyBuildings: (colonyId) => api.get(`/buildings/colony/${colonyId}`),
  getAvailable: (colonyId) => api.get(`/buildings/colony/${colonyId}/available`),
  build: (colonyId, buildingType) => api.post(`/buildings/colony/${colonyId}/build`, { building_type: buildingType }),
  upgrade: (buildingId) => api.post(`/buildings/${buildingId}/upgrade`),
  demolish: (buildingId) => api.delete(`/buildings/${buildingId}`),
  toggle: (buildingId, isActive) => api.patch(`/buildings/${buildingId}/toggle`, { is_active: isActive }),
  repair: (buildingId) => api.post(`/buildings/${buildingId}/repair`),
};

// Artifacts
export const artifacts = {
  getAll: () => api.get('/artifacts'),
  equip: (id, shipId) => api.post(`/artifacts/${id}/equip`, { ship_id: shipId }),
  unequip: (id) => api.post(`/artifacts/${id}/unequip`),
};

// Factions
export const factions = {
  list: () => api.get('/factions'),
  getStandings: () => api.get('/factions/standings'),
  getLeaderboard: () => api.get('/factions/leaderboard'),
  getWars: () => api.get('/factions/wars'),
  getActiveWars: () => api.get('/factions/wars/active'),
};

// Messages
export const messages = {
  getInbox: (params) => api.get('/messages/inbox', { params }),
  getSent: (params) => api.get('/messages/sent', { params }),
  send: (data) => api.post('/messages/send', data),
  markRead: (id) => api.post(`/messages/${id}/read`),
  delete: (id) => api.delete(`/messages/${id}`),
  getUnread: () => api.get('/messages/unread'),
};

// Outposts
export const outposts = {
  getAll: () => api.get('/outposts'),
  getInSector: (sectorId) => api.get(`/outposts/sector/${sectorId}`),
  build: (data) => api.post('/outposts', data),
  upgrade: (id) => api.post(`/outposts/${id}/upgrade`),
  destroy: (id) => api.delete(`/outposts/${id}`),
};

// Ship Design Templates
export const templates = {
  getAll: () => api.get('/templates'),
  save: (data) => api.post('/templates', data),
  load: (id) => api.get(`/templates/${id}`),
  delete: (id) => api.delete(`/templates/${id}`),
};

// Cosmetics
export const cosmetics = {
  getCatalog: () => api.get('/cosmetics/catalog'),
  updateVisual: (shipId, visualConfig) => api.put(`/cosmetics/ships/${shipId}/visual`, { visual_config: visualConfig }),
  checkMilestones: () => api.post('/cosmetics/check-milestones'),
};

// Community Events
export const events = {
  getAll: (params) => api.get('/events', { params }),
  getActive: () => api.get('/events/active'),
  contribute: (eventId, amount) => api.post(`/events/${eventId}/contribute`, { amount }),
  getLeaderboard: (eventId) => api.get(`/events/${eventId}/leaderboard`),
};

// Corporation Agreements
export const agreements = {
  getAll: () => api.get('/corporations/agreements'),
  propose: (data) => api.post('/corporations/agreements/propose', data),
  respond: (id, accept) => api.post(`/corporations/agreements/${id}/respond`, { accept }),
  breakAgreement: (id) => api.post(`/corporations/agreements/${id}/break`),
};

// Fleets
export const fleets = {
  getAll: () => api.get('/fleets'),
  getById: (id) => api.get(`/fleets/${id}`),
  create: (name, shipIds) => api.post('/fleets', { name, ship_ids: shipIds }),
  rename: (id, name) => api.patch(`/fleets/${id}`, { name }),
  addShips: (id, shipIds) => api.post(`/fleets/${id}/ships`, { ship_ids: shipIds }),
  removeShips: (id, shipIds) => api.delete(`/fleets/${id}/ships`, { data: { ship_ids: shipIds } }),
  disband: (id) => api.delete(`/fleets/${id}`),
  move: (id, targetSectorId) => api.post(`/fleets/${id}/move`, { target_sector_id: targetSectorId }),
};

// Admin
export const admin = {
  generateUniverse: (params) => api.post('/admin/universe/generate', params),
  getConfig: () => api.get('/admin/universe/config'),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (settings) => api.put('/admin/settings', { settings }),
  testAIConnection: (data) => api.post('/admin/ai/test', data),
  getAIStats: () => api.get('/admin/ai/stats'),
  getAILogs: (params) => api.get('/admin/ai/logs', { params }),
  getNPCStats: () => api.get('/admin/npcs/stats'),
  forceRespawn: () => api.post('/admin/npcs/respawn'),
  getTickStatus: () => api.get('/admin/ticks/status'),
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUserTier: (userId, tier) => api.put('/admin/users/tier', { user_id: userId, subscription_tier: tier }),
  // Server
  getServerStatus: () => api.get('/admin/server/status'),
  getRuntimeLog: (params) => api.get('/admin/server/runtime-log', { params }),
  startTicks: () => api.post('/admin/server/ticks/start'),
  stopTicks: () => api.post('/admin/server/ticks/stop'),
  // Economy
  getEconomyOverview: () => api.get('/admin/economy/overview'),
  getTransfers: (params) => api.get('/admin/economy/transfers', { params }),
  forceEconomyTick: () => api.post('/admin/economy/force-tick'),
  resetPortStocks: () => api.post('/admin/economy/reset-stocks'),
  // Player Support
  getUserDetail: (userId) => api.get(`/admin/users/${userId}/detail`),
  adjustCredits: (userId, data) => api.post(`/admin/users/${userId}/credits`, data),
  reviveShip: (userId, data) => api.post(`/admin/users/${userId}/revive-ship`, data),
  repairShip: (userId, data) => api.post(`/admin/users/${userId}/repair-ship`, data),
  moveShip: (userId, data) => api.post(`/admin/users/${userId}/move-ship`, data),
  setActiveShip: (userId, data) => api.post(`/admin/users/${userId}/set-active-ship`, data),
  // Wars
  getWars: (params) => api.get('/admin/wars', { params }),
  getActiveWars: () => api.get('/admin/wars/active'),
  declareWar: (data) => api.post('/admin/wars/declare', data),
  resolveWar: (warId) => api.post(`/admin/wars/${warId}/resolve`),
  // Events
  getEvents: (params) => api.get('/admin/events', { params }),
  createEvent: (data) => api.post('/admin/events', data),
  endEvent: (eventId) => api.put(`/admin/events/${eventId}/end`),
  deleteEvent: (eventId) => api.delete(`/admin/events/${eventId}`),
  // Audit
  getAuditLogs: (params) => api.get('/admin/action-audit', { params }),
  getAuditSummary: () => api.get('/admin/audit/summary'),
};

// Achievements
export const achievements = {
  getAll: () => api.get('/achievements'),
  getStats: () => api.get('/achievements/stats'),
};

// PvP: Bounty Board, Arena queue, Duels, Spectator
export const pvp = {
  // Bounty board
  listBounties: () => api.get('/pvp/bounties'),
  acceptBounty: (contractId) => api.post(`/pvp/bounties/${contractId}/accept`),
  abandonBounty: (contractId) => api.post(`/pvp/bounties/${contractId}/abandon`),
  // Arena
  arenaStatus: () => api.get('/pvp/arena/status'),
  arenaJoin: (shipId, bracket = '1v1') => api.post('/pvp/arena/join', { ship_id: shipId, bracket }),
  arenaLeave: () => api.post('/pvp/arena/leave'),
  // Duels
  duelChallenge: (challengerShipId, defenderShipId) =>
    api.post('/pvp/duels/challenge', { challenger_ship_id: challengerShipId, defender_ship_id: defenderShipId }),
  duelRespond: (requestId, accept) => api.post(`/pvp/duels/${requestId}/respond`, { accept }),
  duelIncoming: () => api.get('/pvp/duels/incoming'),
  // Spectator
  listSpectatable: () => api.get('/pvp/spectatable'),
};

// AI Agent
export const agents = {
  get: () => api.get('/agents'),
  create: (data) => api.post('/agents', data),
  update: (data) => api.put('/agents', data),
  remove: () => api.delete('/agents'),
  setStatus: (status) => api.post('/agents/status', { status }),
  regenerateKey: () => api.post('/agents/regenerate-key'),
  getLogs: (params) => api.get('/agents/logs', { params }),
};

export default api;
