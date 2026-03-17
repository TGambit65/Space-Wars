#!/usr/bin/env node
/**
 * Generate Round 3 comments (Codex REVIEW, Codex PRD REWRITE, Copilot SPRINT NOTE)
 * for all 79 features based on PRD analysis.
 *
 * This regenerates comments that were lost from the working tree.
 * Format matches the original: 3 comments per feature, uniform prefixes.
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const s = html.indexOf('const PLAN=[');
const e = html.indexOf('];', s) + 2;
eval(html.substring(s, e).replace('const PLAN=', 'var PLAN='));

const allFeatures = PLAN.flatMap(sec => sec.features);
const allFeatureIds = allFeatures.map(f => f.id);

// ── Feature analysis helpers ──

function getExistingModels(details) {
  const models = [];
  const matches = details.match(/<td>([A-Z][a-zA-Z]+(?:\.[a-z_]+)?)<\/td>/g);
  if (matches) {
    matches.forEach(m => {
      const name = m.replace(/<\/?td>/g, '');
      if (!name.includes('.')) models.push(name);
    });
  }
  return [...new Set(models)];
}

function getDeclaredDeps(details) {
  const sec = extractSection(details, 'Dependencies');
  if (!sec) return [];
  // Extract feature IDs mentioned
  const deps = [];
  for (const fid of allFeatureIds) {
    if (sec.includes(fid)) deps.push(fid);
  }
  return deps;
}

function extractSection(details, title) {
  const escaped = title.replace(/&/g, '&amp;');
  const marker = `modal-section-title">${escaped}</div>`;
  const idx = details.indexOf(marker);
  if (idx === -1) return null;
  const secStart = details.lastIndexOf('<div class="modal-section">', idx);
  // Find end
  let depth = 0;
  let pos = secStart;
  while (pos < details.length) {
    const nextOpen = details.indexOf('<div', pos + 1);
    const nextClose = details.indexOf('</div>', pos + 1);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen;
    } else {
      if (depth === 0) return details.substring(secStart, nextClose + 6);
      depth--;
      pos = nextClose;
    }
  }
  return null;
}

function getComplexity(details) {
  const sec = extractSection(details, 'Complexity &amp; Estimate');
  if (!sec) return 'Complex';
  if (sec.includes('Massive')) return 'Massive';
  if (sec.includes('High')) return 'Complex';
  if (sec.includes('Complex')) return 'Complex';
  if (sec.includes('Moderate') || sec.includes('Medium')) return 'Moderate';
  if (sec.includes('Simple') || sec.includes('Low')) return 'Simple';
  return 'Complex';
}

function getListItems(details, sectionTitle) {
  const sec = extractSection(details, sectionTitle);
  if (!sec) return [];
  const items = [];
  const matches = sec.match(/<li>([^<]+)/g);
  if (matches) matches.forEach(m => items.push(m.replace('<li>', '')));
  return items;
}

// ── Knowledge base: what exists in the codebase ──
const existingServices = {
  'sector-zones': ['Sector', 'SectorConnection', 'worldPolicyService', 'sectorGraphService', 'universeGenerator'],
  'home-sectors': ['worldPolicyService', 'Sector', 'SectorConnection'],
  'sector-scaling': ['Express', 'Socket.io', 'tickService'],
  'difficulty-scaling': ['config/index.js', 'npcService', 'hazard_level'],
  'wormholes-static': ['SectorConnection', 'worldPolicyService', 'sectorGraphService'],
  'wormholes-unstable': ['phenomenaService', 'adventure sectors'],
  'jump-drives': ['shipService', 'movementService', 'Ship model'],
  'deep-space-gates': ['SectorConnection', 'worldPolicyService'],
  'protected-lanes': ['SectorConnection', 'worldPolicyService', 'sectorGraphService'],
  'route-planner': ['sectorGraphService', 'SectorConnection'],
  'pvp-zones': ['worldPolicyService', 'combatService', 'sectorGraphService'],
  'pvp-rewards': ['combatService', 'CombatLog', 'rewardService'],
  'pvp-choke': ['worldPolicyService', 'combatService'],
  'pvp-harbors': ['Sector', 'worldPolicyService'],
  'offline-protection': ['User model', 'worldPolicyService'],
  'clan-spawning': ['npcService', 'NPC model', 'config/npcTypes'],
  'clan-raids': ['npcService', 'combatService'],
  'clan-clearing': ['npcService', 'combatService', 'NPC model'],
  'adventure-sectors': ['Sector', 'universeGenerator', 'sectorGraphService'],
  'derelict-explore': ['Ship model', 'Sector'],
  'alien-hive': ['combatService', 'groundCombatService'],
  'nebula-challenge': ['Sector', 'phenomena'],
  'raid-bosses': ['combatService', 'NPC model'],
  'timed-rush': ['tickService', 'socketService'],
  'store-philosophy': ['User model', 'config/index.js'],
  'store-cosmetics': ['shipService', 'Ship model'],
  'store-homestead': ['Colony', 'Sector'],
  'store-convenience': ['User model'],
  'premium-currency': ['User model', 'Transaction'],
  'dynamic-pricing': ['pricingService', 'PortCommodity', 'Transaction', 'Commodity'],
  'port-types': ['Port', 'config/portTypes', 'pricingService'],
  'trading-ui': ['api.js client', 'pricingService'],
  'economy-scaling': ['pricingService', 'Transaction', 'tickService'],
  'turn-combat': ['combatService', 'CombatLog', 'Ship'],
  'realtime-combat': ['realtimeCombatService', 'socketService', 'CombatLog'],
  'ground-combat': ['groundCombatService', 'Colony'],
  'npc-types': ['NPC model', 'npcService', 'config/npcTypes'],
  'ship-types': ['Ship model', 'config/shipTypes', 'shipService'],
  'components': ['Component', 'ShipComponent', 'config/components'],
  'ship-designer': ['shipDesignerService', 'ShipComponent', 'Component'],
  'ship-customizer': ['shipService', 'shipDesignerService'],
  'fleets': ['fleetService', 'Fleet model'],
  'colonization': ['colonyService', 'Colony', 'Planet'],
  'colony-buildings': ['Colony', 'colonyService', 'config/buildings'],
  'colony-surface': ['VoxelEngine', 'VoxelBlock', 'surfaceService'],
  'wonders': ['Colony', 'colonyService'],
  'colony-no-limit': ['Colony', 'colonyService'],
  'crew-species': ['Crew model', 'crewBonusService', 'config/species'],
  'crew-salary': ['Crew model', 'crewBonusService'],
  'levels': ['User model', 'progressionService'],
  'tech-tree': ['config/index.js'],
  'crafting': ['config/index.js'],
  'missions': ['config/index.js'],
  'achievements-client': ['localStorage (client-side only)'],
  'endgame-retention': ['progressionService', 'Colony'],
  'corporations': ['Corporation model', 'corporationService'],
  'messaging': ['socketService', 'User model'],
  'factions': ['config/index.js'],
  'community-events': ['tickService', 'socketService'],
  'alliance-territory': ['Corporation', 'Sector'],
  'outposts': ['automationService', 'Colony'],
  'automation': ['automationService', 'AutomatedTask'],
  'ai-agent': ['AI providers', 'socketService'],
  'artifacts': ['Artifact model', 'artifactService'],
  'keyboard': ['React key handlers'],
  'mobile': ['TailwindCSS responsive'],
  'accessibility': ['React components'],
  'faction-theme': ['CSS variables', 'TailwindCSS'],
  'galaxy-map': ['GalaxyMap.jsx', 'Canvas2D', 'sectorService'],
  'wiki': ['React components'],
  'notifications': ['socketService'],
  'socket': ['socketService', 'Socket.io'],
  'player-spawn': ['universeGenerator', 'Sector', 'User'],
  'sector-instance': ['Sector', 'tickService'],
  'action-audit': ['middleware', 'Transaction'],
  'job-queue': ['tickService'],
  'live-ops-observability': ['GameSetting', 'gameSettingsService'],
  'econ-sinks': ['pricingService', 'Transaction'],
  'discovery-fog': ['PlayerDiscovery', 'discoveryService'],
  'live-ops-observability': ['GameSetting', 'gameSettingsService'],
};

// ── Hotspot file mapping ──
const hotspotMap = {
  'sector-zones': ['Sector/SectorConnection', 'worldPolicyService', 'universeGenerator'],
  'home-sectors': ['Sector/SectorConnection', 'worldPolicyService', 'universeGenerator'],
  'sector-scaling': ['tickService', 'socketService', 'realtimeCombatService'],
  'difficulty-scaling': ['Sector/SectorConnection', 'worldPolicyService', 'universeGenerator'],
  'wormholes-static': ['worldPolicyService', 'sectorGraphService', 'shipService/fleetService'],
  'wormholes-unstable': ['worldPolicyService', 'sectorGraphService', 'shipService/fleetService'],
  'jump-drives': ['movementService', 'shipService', 'sectorGraphService'],
  'deep-space-gates': ['worldPolicyService', 'sectorGraphService', 'movementService'],
  'protected-lanes': ['worldPolicyService', 'sectorGraphService', 'movementService'],
  'route-planner': ['sectorGraphService', 'movementService', 'client/GalaxyMap'],
  'pvp-zones': ['combatPolicyService', 'worldPolicyService', 'realtimeCombatService'],
  'pvp-rewards': ['combatService', 'rewardService', 'CombatLog'],
  'pvp-choke': ['combatPolicyService', 'realtimeCombatService', 'PlayerProtectionState'],
  'pvp-harbors': ['worldPolicyService', 'movementService', 'Sector'],
  'offline-protection': ['worldPolicyService', 'combatPolicyService', 'User'],
  'clan-spawning': ['npcService', 'config/npcTypes', 'tickService'],
  'clan-raids': ['npcService', 'combatService', 'tickService'],
  'clan-clearing': ['npcService', 'combatService', 'rewardService'],
  'adventure-sectors': ['sectorInstanceService', 'universeGenerator', 'tickService'],
  'derelict-explore': ['sectorInstanceService', 'shipService', 'rewardService'],
  'alien-hive': ['sectorInstanceService', 'groundCombatService', 'client/combat'],
  'nebula-challenge': ['sectorInstanceService', 'phenomenaService', 'shipService'],
  'raid-bosses': ['combatService', 'npcService', 'rewardService'],
  'timed-rush': ['tickService', 'socketService', 'sectorInstanceService'],
  'store-philosophy': ['config/index.js', 'User model', 'Transaction'],
  'store-cosmetics': ['shipService', 'client/ShipPanel', 'assetPipeline'],
  'store-homestead': ['colonyService', 'Sector', 'worldPolicyService'],
  'store-convenience': ['User model', 'config/index.js', 'Transaction'],
  'premium-currency': ['User model', 'Transaction', 'paymentService'],
  'dynamic-pricing': ['pricingService', 'PortCommodity', 'tickService'],
  'port-types': ['Port', 'pricingService', 'config/portTypes'],
  'trading-ui': ['client/TradingUI', 'pricingService', 'api.js'],
  'economy-scaling': ['pricingService', 'tickService', 'Transaction'],
  'turn-combat': ['combatService', 'CombatLog', 'shipService'],
  'realtime-combat': ['realtimeCombatService', 'socketService', 'combatService'],
  'ground-combat': ['groundCombatService', 'Colony', 'combatService'],
  'npc-types': ['npcService', 'config/npcTypes', 'combatService'],
  'ship-types': ['config/shipTypes', 'shipService', 'shipDesignerService'],
  'components': ['config/components', 'shipDesignerService', 'Component model'],
  'ship-designer': ['shipDesignerService', 'ShipComponent', 'client/ShipDesigner'],
  'ship-customizer': ['shipService', 'shipDesignerService', 'component/ship models'],
  'fleets': ['fleetService', 'movementService', 'client/FleetPanel'],
  'colonization': ['colonyService', 'Colony', 'Planet'],
  'colony-buildings': ['colonyService', 'config/buildings', 'Colony'],
  'colony-surface': ['VoxelEngine', 'surfaceService', 'VoxelBlock'],
  'wonders': ['colonyService', 'Colony', 'tickService'],
  'colony-no-limit': ['colonyService', 'Colony', 'maintenanceService'],
  'crew-species': ['crewBonusService', 'Crew model', 'config/species'],
  'crew-salary': ['crewBonusService', 'Crew model', 'tickService'],
  'levels': ['progressionService', 'User model', 'config/index.js'],
  'tech-tree': ['progressionService', 'config/index.js', 'User model'],
  'crafting': ['craftingService', 'config/recipes', 'ShipCargo'],
  'missions': ['missionService', 'config/missions', 'tickService'],
  'achievements-client': ['client/Achievements', 'localStorage', 'progressionService'],
  'endgame-retention': ['progressionService', 'colonyService', 'tickService'],
  'corporations': ['corporationService', 'Corporation model', 'User'],
  'messaging': ['socketService', 'messageService', 'client/Chat'],
  'factions': ['config/factions', 'User model', 'client/theme'],
  'community-events': ['tickService', 'socketService', 'eventService'],
  'alliance-territory': ['corporationService', 'Sector', 'worldPolicyService'],
  'outposts': ['automationService', 'AutomatedTask/audit pipeline', 'npcActionExecutor'],
  'automation': ['automationService', 'AutomatedTask', 'tickService'],
  'ai-agent': ['AI providers', 'agentService', 'socketService'],
  'artifacts': ['artifactService', 'Artifact model', 'shipService'],
  'keyboard': ['client/keybindings', 'React event handlers', 'accessibilityService'],
  'mobile': ['client/responsive', 'TailwindCSS', 'touchHandlers'],
  'accessibility': ['client/components', 'ARIA attributes', 'colorContrast'],
  'faction-theme': ['client/styles', 'CSS variables', 'config/factions'],
  'galaxy-map': ['GalaxyMap.jsx', 'Canvas2D', 'sectorService'],
  'wiki': ['client/Wiki', 'config/index.js', 'searchService'],
  'notifications': ['socketService', 'notificationService', 'client/NotificationBell'],
  'socket': ['socketService', 'tickService', 'realtimeCombatService'],
  'player-spawn': ['universeGenerator', 'User model', 'sectorService'],
  'sector-instance': ['sectorInstanceService', 'tickService', 'socketService'],
  'action-audit': ['auditMiddleware', 'AuditLog model', 'Transaction'],
  'job-queue': ['tickService', 'jobQueueService', 'workerService'],
  'live-ops-observability': ['GameSetting', 'gameSettingsService', 'metricsService'],
  'econ-sinks': ['pricingService', 'Transaction', 'maintenanceService'],
  'discovery-fog': ['discoveryService', 'PlayerDiscovery', 'sectorService'],
  'live-ops-observability': ['GameSetting', 'gameSettingsService', 'metricsService'],
};

// ── Dependency graph (what each feature should depend on) ──
const depGraph = {
  'sector-zones': [],
  'home-sectors': ['sector-zones', 'action-audit'],
  'sector-scaling': ['job-queue', 'live-ops-observability', 'sector-instance'],
  'difficulty-scaling': ['sector-zones', 'clan-spawning', 'pvp-rewards'],
  'wormholes-static': ['deep-space-gates', 'protected-lanes', 'route-planner', 'action-audit'],
  'wormholes-unstable': ['adventure-sectors', 'live-ops-observability', 'notifications'],
  'jump-drives': ['route-planner', 'action-audit', 'econ-sinks'],
  'deep-space-gates': ['sector-zones', 'action-audit', 'store-homestead'],
  'protected-lanes': ['sector-zones', 'pvp-zones', 'route-planner'],
  'route-planner': ['sector-zones'],
  'pvp-zones': ['sector-zones', 'action-audit'],
  'pvp-rewards': ['pvp-zones', 'action-audit', 'econ-sinks'],
  'pvp-choke': ['pvp-zones', 'pvp-rewards', 'notifications'],
  'pvp-harbors': ['sector-zones', 'pvp-zones'],
  'offline-protection': ['pvp-zones', 'home-sectors'],
  'clan-spawning': ['sector-zones', 'npc-types', 'job-queue'],
  'clan-raids': ['clan-spawning', 'notifications', 'pvp-zones'],
  'clan-clearing': ['clan-spawning', 'pvp-rewards'],
  'adventure-sectors': ['sector-zones', 'sector-instance', 'job-queue'],
  'derelict-explore': ['adventure-sectors', 'action-audit'],
  'alien-hive': ['adventure-sectors', 'ground-combat'],
  'nebula-challenge': ['adventure-sectors', 'ship-designer'],
  'raid-bosses': ['adventure-sectors', 'npc-types', 'pvp-rewards'],
  'timed-rush': ['adventure-sectors', 'notifications', 'job-queue'],
  'store-philosophy': ['premium-currency', 'action-audit'],
  'store-cosmetics': ['store-philosophy', 'ship-customizer'],
  'store-homestead': ['store-philosophy', 'home-sectors', 'colonization'],
  'store-convenience': ['store-philosophy', 'premium-currency'],
  'premium-currency': ['action-audit', 'econ-sinks'],
  'dynamic-pricing': ['port-types', 'action-audit', 'econ-sinks'],
  'port-types': ['sector-zones'],
  'trading-ui': ['dynamic-pricing', 'port-types'],
  'economy-scaling': ['dynamic-pricing', 'job-queue', 'live-ops-observability'],
  'turn-combat': ['npc-types', 'ship-designer'],
  'realtime-combat': ['turn-combat', 'socket', 'action-audit'],
  'ground-combat': ['turn-combat', 'colonization'],
  'npc-types': ['sector-zones'],
  'ship-types': [],
  'components': ['ship-types'],
  'ship-designer': ['components', 'ship-types'],
  'ship-customizer': ['ship-designer', 'store-cosmetics'],
  'fleets': ['route-planner', 'sector-instance', 'automation'],
  'colonization': ['sector-zones', 'ship-types'],
  'colony-buildings': ['colonization'],
  'colony-surface': ['colonization', 'colony-buildings'],
  'wonders': ['colony-buildings', 'tech-tree'],
  'colony-no-limit': ['colonization', 'econ-sinks'],
  'crew-species': ['ship-types'],
  'crew-salary': ['crew-species', 'econ-sinks'],
  'levels': ['action-audit'],
  'tech-tree': ['levels', 'crafting'],
  'crafting': ['components'],
  'missions': ['action-audit', 'levels'],
  'achievements-client': ['action-audit', 'levels'],
  'endgame-retention': ['levels', 'tech-tree', 'colonization'],
  'corporations': ['messaging', 'action-audit'],
  'messaging': ['socket', 'notifications'],
  'factions': [],
  'community-events': ['job-queue', 'notifications', 'socket'],
  'alliance-territory': ['corporations', 'sector-zones', 'pvp-zones'],
  'outposts': ['automation', 'colonization', 'action-audit'],
  'automation': ['job-queue', 'action-audit'],
  'ai-agent': ['automation', 'action-audit', 'job-queue'],
  'artifacts': ['crafting', 'adventure-sectors'],
  'keyboard': [],
  'mobile': [],
  'accessibility': [],
  'faction-theme': ['factions'],
  'galaxy-map': ['sector-zones', 'discovery-fog'],
  'wiki': [],
  'notifications': ['socket'],
  'socket': [],
  'player-spawn': ['sector-zones'],
  'sector-instance': ['sector-zones', 'job-queue'],
  'action-audit': [],
  'job-queue': [],
  'live-ops-observability': ['action-audit', 'job-queue'],
  'econ-sinks': ['dynamic-pricing', 'action-audit'],
  'discovery-fog': ['sector-zones', 'action-audit'],
  'live-ops-observability': ['action-audit', 'job-queue'],
};

// ── Slip impact: what downstream features are blocked ──
function getSlipImpact(featureId) {
  const impacted = [];
  for (const [fid, deps] of Object.entries(depGraph)) {
    if (deps.includes(featureId)) impacted.push(fid);
  }
  return impacted;
}

// ── Sequencing: what must come first ──
function getSequencing(featureId) {
  return depGraph[featureId] || [];
}

// ── Status assessment ──
const partiallyImplemented = new Set([
  'sector-zones', 'home-sectors', 'wormholes-static', 'pvp-zones',
  'dynamic-pricing', 'port-types', 'turn-combat', 'realtime-combat',
  'ship-types', 'components', 'ship-designer', 'ship-customizer', 'fleets',
  'colonization', 'colony-buildings', 'colony-surface', 'crew-species', 'crew-salary',
  'levels', 'corporations', 'outposts', 'automation', 'artifacts',
  'galaxy-map', 'socket', 'discovery-fog', 'npc-types',
]);

const netNew = new Set([
  'sector-scaling', 'difficulty-scaling', 'wormholes-unstable', 'jump-drives',
  'deep-space-gates', 'protected-lanes', 'route-planner', 'pvp-rewards',
  'pvp-choke', 'pvp-harbors', 'offline-protection', 'clan-spawning',
  'clan-raids', 'clan-clearing', 'adventure-sectors', 'derelict-explore',
  'alien-hive', 'nebula-challenge', 'raid-bosses', 'timed-rush',
  'store-philosophy', 'store-cosmetics', 'store-homestead', 'store-convenience',
  'premium-currency', 'ground-combat', 'trading-ui', 'economy-scaling',
  'wonders', 'colony-no-limit', 'tech-tree', 'crafting', 'missions',
  'achievements-client', 'endgame-retention', 'messaging', 'factions',
  'community-events', 'alliance-territory', 'ai-agent', 'keyboard', 'mobile',
  'accessibility', 'faction-theme', 'wiki', 'notifications', 'player-spawn',
  'sector-instance', 'action-audit', 'job-queue', 'live-ops-observability',
  'econ-sinks',
]);

// ── PRD subsection recommendations per feature category ──
function getPrdSubsections(feature) {
  const tags = feature.tags || [];
  const id = feature.id;
  const subsections = [];

  // Category-specific recommendations
  if (tags.includes('pvp')) {
    subsections.push('Anti-Manipulation', 'Abuse Prevention', 'Engagement Metrics');
  }
  if (tags.includes('store') || id.includes('store') || id.includes('premium')) {
    subsections.push('Entitlement Checks', 'Purchase Flow', 'Refund Handling');
  }
  if (id.includes('combat') || id.includes('pvp')) {
    subsections.push('Idempotency', 'Replay Prevention', 'Balance Tuning');
  }
  if (id.includes('colony') || id.includes('outpost') || id.includes('home')) {
    subsections.push('Ownership/ACL', 'Build/Upgrade Queue', 'Destruction/Recovery');
  }
  if (id.includes('wormhole') || id.includes('gate') || id.includes('lane') || id.includes('route')) {
    subsections.push('Ownership/ACL', 'Construction State', 'Toll Rules', 'Discovery/Visibility');
  }
  if (id.includes('clan') || id.includes('npc') || id.includes('raid')) {
    subsections.push('Wave Orchestration', 'Difficulty Scaling', 'Reward Distribution');
  }
  if (id.includes('adventure') || id.includes('derelict') || id.includes('hive') || id.includes('nebula') || id.includes('rush')) {
    subsections.push('Instance Lifecycle', 'Failure/Retry Rules', 'Team Coordination');
  }
  if (id.includes('pricing') || id.includes('economy') || id.includes('trading') || id.includes('econ')) {
    subsections.push('Anti-Manipulation', 'Sampling Window', 'Price Floor/Ceiling');
  }
  if (id.includes('crew') || id.includes('species')) {
    subsections.push('Recruitment Pipeline', 'Skill Progression', 'Death/Recovery');
  }
  if (id.includes('level') || id.includes('tech') || id.includes('craft') || id.includes('mission') || id.includes('achievement')) {
    subsections.push('Progression Curve', 'Server Validation', 'Anti-Exploit Gates');
  }
  if (id.includes('corp') || id.includes('alliance') || id.includes('faction')) {
    subsections.push('Permission Model', 'Leadership Transfer', 'Dissolution Handling');
  }
  if (id.includes('auto') || id.includes('agent') || id.includes('job')) {
    subsections.push('Rate Limiting', 'Error Recovery', 'Resource Budgets');
  }
  if (id.includes('socket') || id.includes('notification')) {
    subsections.push('Fan-out Strategy', 'Backpressure', 'Reconnection');
  }
  if (id.includes('audit') || id.includes('observ')) {
    subsections.push('Retention Policy', 'Query Performance', 'Alert Thresholds');
  }
  if (id.includes('map') || id.includes('wiki') || id.includes('ui') || id.includes('keyboard') || id.includes('mobile') || id.includes('accessibility')) {
    subsections.push('Offline Behavior', 'Cache Strategy', 'Progressive Enhancement');
  }

  // Generic additions if we have few
  if (subsections.length < 2) {
    subsections.push('Migration/Backfill', 'Acceptance Criteria', 'Error States');
  }

  return [...new Set(subsections)].slice(0, 5);
}

// ── Generate comments ──
const now = Date.now();
const comments = {};

for (const feature of allFeatures) {
  const id = feature.id;
  const existing = existingServices[id] || [];
  const deps = depGraph[id] || [];
  const hotspots = hotspotMap[id] || [];
  const slipTargets = getSlipImpact(id);
  const seqDeps = getSequencing(id);
  const complexity = getComplexity(feature.details);
  const subsections = getPrdSubsections(feature);
  const isPartial = partiallyImplemented.has(id);
  const isNew = netNew.has(id);

  // 1. Codex REVIEW
  let reviewText = 'REVIEW: ';
  if (isPartial) {
    reviewText += `The codebase already has ${existing.slice(0, 3).join(', ')}${existing.length > 3 ? ' and more' : ''}, so this is not greenfield. `;
    reviewText += `The PRD is still ahead of implementation: `;
    const gaps = [];
    const funcReqs = getListItems(feature.details, 'Functional Requirements');
    if (funcReqs.length > 5) gaps.push('full requirement coverage');
    gaps.push('server-side enforcement', 'test coverage');
    reviewText += gaps.join(', ') + ' all need completion. ';
  } else {
    reviewText += `There is no dedicated ${feature.title.toLowerCase()} system yet. `;
    if (existing.length > 0) {
      reviewText += `The best path is to build on ${existing.slice(0, 2).join(' and ')}, but `;
    }
    reviewText += `the PRD needs concrete lifecycle, state management, and integration contracts before implementation starts. `;
  }
  reviewText += `Complexity: ${complexity}. `;
  if (deps.length > 0) {
    reviewText += `Dependencies: ${deps.join(', ')}.`;
  } else {
    reviewText += 'Dependencies: none -- foundational feature.';
  }

  // 2. Codex PRD REWRITE
  let prdText = 'PRD REWRITE: ';
  prdText += `Add ${subsections.length > 1 ? 'sections for ' : 'a section for '}`;
  prdText += subsections.join(', ') + '. ';
  if (isPartial) {
    prdText += `The PRD should reconcile what already exists in the codebase with what the spec requires, `;
    prdText += `identifying gaps between current implementation and target state.`;
  } else {
    prdText += `The PRD should define concrete state machines, data contracts, and error handling `;
    prdText += `before implementation begins.`;
  }

  // 3. Copilot SPRINT NOTE
  let sprintText = 'SPRINT NOTE: ';
  if (isPartial) {
    sprintText += 'This is already partially implemented, so the sprint should scope it as hardening/integration work instead of a rewrite. ';
  } else {
    sprintText += 'This is still net-new from a systems point of view, so the main risk is shared-service churn rather than raw UI throughput. ';
  }
  sprintText += `Hotspots: ${hotspots.map(h => '`' + h + '`').join(', ')}. `;
  if (seqDeps.length > 0) {
    sprintText += `Do not schedule it before ${seqDeps.slice(0, 3).map(d => '`' + d + '`').join(', ')}`;
    if (seqDeps.length > 3) sprintText += ` (+${seqDeps.length - 3} more)`;
    sprintText += '. ';
  }
  if (slipTargets.length > 0) {
    sprintText += `If it slips, it directly slows ${slipTargets.slice(0, 3).map(t => '`' + t + '`').join(', ')}`;
    if (slipTargets.length > 3) sprintText += ` (+${slipTargets.length - 3} more)`;
    sprintText += '.';
  }

  comments[id] = [
    { author: 'Codex', text: reviewText, time: now + 1000 },
    { author: 'Codex', text: prdText, time: now + 2000 },
    { author: 'Copilot', text: sprintText, time: now + 3000 },
  ];
}

// Write comments
fs.writeFileSync(path.join(dir, 'comments.json'), JSON.stringify(comments, null, 2));

// Verify
const written = JSON.parse(fs.readFileSync(path.join(dir, 'comments.json'), 'utf8'));
const keys = Object.keys(written);
const total = keys.reduce((a, k) => a + written[k].length, 0);
console.log(`Generated ${total} comments across ${keys.length} features`);
console.log('All have 3 comments:', keys.every(k => written[k].length === 3));

// Verify prefixes
const allPrefixes = keys.every(k => {
  const c = written[k];
  return c[0].text.startsWith('REVIEW:') && c[1].text.startsWith('PRD REWRITE:') && c[2].text.startsWith('SPRINT NOTE:');
});
console.log('All have correct prefixes:', allPrefixes);
