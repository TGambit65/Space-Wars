import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const auth = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/profile'),
};

// Ships
export const ships = {
  getAll: () => api.get('/ships'),
  getById: (id) => api.get(`/ships/${id}`),
  move: (shipId, targetSectorId) => api.post(`/ships/${shipId}/move`, { target_sector_id: targetSectorId }),
  getCrewEffectiveness: (shipId) => api.get(`/ships/${shipId}/crew-effectiveness`),
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
  attack: (shipId, npcId) => api.post(`/combat/attack/${shipId}`, { npc_id: npcId }),
  flee: (shipId) => api.post(`/combat/flee/${shipId}`),
  getHistory: () => api.get('/combat/history'),
  getLog: (logId) => api.get(`/combat/log/${logId}`),
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
};

export default api;

