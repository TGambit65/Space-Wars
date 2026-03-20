#!/usr/bin/env node
/**
 * Parse NPC UX Living-World PRDs document into the Idea Board.
 * Adds 5 new features in a new "NPC UX & Living World" section:
 *   1. npc-foundation       – Foundation Blockers F0-F5
 *   2. living-sector-presence – PRD 1
 *   3. npc-service-actions    – PRD 2
 *   4. npc-memory-relationships – PRD 3
 *   5. faction-territory-presence – PRD 4
 */

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, 'index.html');
const EXPORT_PATH = path.join(__dirname, 'spacewars-plan-export.json');

// ─── Feature definitions ─────────────────────────────────────────────

const NPC_UX_FEATURES = [
  {
    id: 'npc-foundation',
    title: 'NPC Foundation Fixes (F0-F5)',
    status: 'new',
    desc: 'Fix 6 foundation blockers before expanding NPC scope: per-player conversation sessions replacing global dialogue lock (F0), persistent combat targets on NPC state (F1), complete live event pipeline for hails/state-changes (F2), dialogue action payload execution with real side effects (F3), dialogue context normalization and cache-key quality (F4), and NPC UX end-to-end test coverage (F5).',
    tags: ['backend', 'frontend'],
    workflow: ['NpcConversationSession model', 'Per-player dialogue state', 'target_ship_id on NPC combat state', 'Emit npc:hails_player events', 'Emit npc:dialogue events', 'Emit npc:state_change broadly', 'dialogueActionService for side effects', 'Normalize buildDialogueContext/buildInteractivePrompt', 'Context-aware cache keys', 'E2E test suite for NPC UX'],
    details: `<div class="modal-section"><div class="modal-section-title">Purpose</div><p>Address 6 foundation blockers (F0-F5) identified in the NPC UX review. These are prerequisites for all living-world features — without them, NPC dialogue locks out other players, combat targets are inconsistent, live events never fire, dialogue choices have no gameplay consequence, AI context is unreliable, and there is no E2E test coverage for NPC interactions.</p></div>
<div class="modal-section"><div class="modal-section-title">Functional Requirements</div><ol>
<li><strong>F0 — Per-Player Conversation Sessions:</strong> Replace global <code>NPC.dialogue_state</code> with <code>NpcConversationSession</code> keyed by npc_id + user_id. Remove MMO-visible "busy NPC" behavior for standard service NPCs. Keep temporary exclusivity only for rare encounter NPCs if needed</li>
<li><strong>F1 — Persistent Combat Targets:</strong> Add <code>target_ship_id</code> and <code>target_user_id</code> to NPC combat state. Combat ticks must use the persisted target, not pick any player ship in sector. UI warnings reference the correct target</li>
<li><strong>F2 — Live Event Pipeline:</strong> Emit real <code>npc:hails_player</code>, <code>npc:dialogue</code>, and broader <code>npc:state_change</code> events via Socket.io. Feed <code>sectorNPCs</code> into live system view. Add player-visible event feed for arrivals, departures, scans, patrol warnings, trader offers</li>
<li><strong>F3 — Dialogue Action Execution:</strong> Handle dialogue <code>data.action</code> payloads on both client and server. Open trading in correct mode. Create escort, bounty, rumor, bribe, and contract flows that write game state. Log accepted/refused actions to audit layer</li>
<li><strong>F4 — Dialogue Context Quality:</strong> Normalize context contracts between <code>buildDialogueContext()</code> and <code>buildInteractivePrompt()</code>. Use context-aware cache keys: NPC, intent, sector, relevant market state, and faction state. Fix stale/misleading cached responses</li>
<li><strong>F5 — NPC UX E2E Tests:</strong> Dedicated E2E coverage for live NPC roster updates, hail notification acceptance/dismissal, service NPC action flows, target-consistent NPC attacks, and repeated conversations with memory cues</li>
</ol></div>
<div class="modal-section"><div class="modal-section-title">Data Model</div>
<table class="detail-table"><tr><th>Model/Column</th><th>Type</th><th>Notes</th></tr>
<tr><td>NpcConversationSession</td><td>New Model</td><td>session_id PK, npc_id FK, user_id FK, started_at, last_message_at, state_json JSONB, status ENUM(active/ended)</td></tr>
<tr><td>NPC.target_ship_id</td><td>Column Add</td><td>FK to Ship, nullable — persisted combat target for consistent engagement</td></tr>
<tr><td>NPC.target_user_id</td><td>Column Add</td><td>FK to User, nullable — persisted combat target user</td></tr>
</table></div>
<div class="modal-section"><div class="modal-section-title">API Surface</div><ul>
<li><code>POST /api/npcs/:id/dialogue/start</code> — start conversation session (returns session_id)</li>
<li><code>POST /api/npcs/:id/dialogue/message</code> — send message within session</li>
<li><code>POST /api/npcs/:id/dialogue/end</code> — end conversation session</li>
<li>Socket events: <code>npc:hails_player</code>, <code>npc:dialogue</code>, <code>npc:state_change</code>, <code>npc:combat_warning</code></li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">UX Specification</div><ul>
<li>Multiple players can talk to the same service NPC simultaneously (no "busy" lock)</li>
<li>Combat warnings reference the correct NPC target ship</li>
<li>Hail notifications carry real NPC text, not client-fabricated greetings</li>
<li>Dialogue responses show consequence preview before player commits</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Dependencies</div><p>Existing NPC system (npcService, dialogueService, socketService, useNPCEvents hook)</p></div>
<div class="modal-section"><div class="modal-section-title">Risks &amp; Mitigations</div><ul>
<li><strong>Risk:</strong> Session table growth with many concurrent conversations. <strong>Mitigation:</strong> Auto-expire sessions after 10 minutes of inactivity; archive ended sessions periodically.</li>
<li><strong>Risk:</strong> Breaking existing dialogue flow during migration. <strong>Mitigation:</strong> Feature-flag new session system; fall back to existing single-state if disabled.</li>
<li><strong>Risk:</strong> Socket event volume in high-density sectors. <strong>Mitigation:</strong> Rate-limit events per sector; batch updates when NPC density exceeds threshold.</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Complexity &amp; Estimate</div><p><strong>Complex — 2 weeks. 6 discrete blockers touching dialogue, combat, sockets, context, and testing layers.</strong></p></div>
<div class="modal-section"><div class="modal-section-title">Acceptance Criteria</div><ol>
<li>Two players can converse with the same NPC simultaneously without lock conflicts</li>
<li>NPC combat target persists across ticks — attacks the same player until disengage/death</li>
<li>Client receives real <code>npc:hails_player</code> events from server (not client-fabricated)</li>
<li>Dialogue "Buy Goods" action opens trading UI in buy mode with correct port/NPC</li>
<li><code>buildDialogueContext()</code> and <code>buildInteractivePrompt()</code> produce consistent context keys</li>
<li>E2E tests pass for hail flow, service action flow, and combat target consistency</li>
</ol></div>`
  },
  {
    id: 'living-sector-presence',
    title: 'Living Sector Presence',
    status: 'new',
    desc: 'Make every active sector feel inhabited: live NPC roster updates via WebSocket, proactive hails and warnings from traders/patrols/pirates/bounty hunters, ambient NPC beats every 3-5 minutes in populated sectors, compact event feed with timestamps and source NPC.',
    tags: ['backend', 'frontend'],
    workflow: ['Live NPC event contract (6 event types)', 'Presence tick pass in NPC loop', 'Proactive hail logic per NPC type', 'Ambient beat scheduling (3-5 min)', 'Anti-spam cooldowns (presence_cooldown_at)', 'Batched sector updates for density', 'Live NPC roster in SystemView', 'State badges (Trading, Patrolling, etc.)', 'Activity rail / compact event log', 'Hail acceptance opens chat with real message'],
    details: `<div class="modal-section"><div class="modal-section-title">Purpose</div><p>Make every active sector feel inhabited within minutes. Players should see traders as traffic, patrols securing systems, and hostiles creating tension before combat starts — the world reacting around them in real time.</p></div>
<div class="modal-section"><div class="modal-section-title">Functional Requirements</div><ol>
<li>Server emits complete live NPC event contract: <code>npc:entered_sector</code>, <code>npc:left_sector</code>, <code>npc:state_change</code>, <code>npc:hails_player</code>, <code>npc:combat_warning</code>, <code>npc:service_offer</code></li>
<li>System view merges initial sector data with socket updates so NPC list is always live</li>
<li>Every interactive NPC type has at least one proactive beat:
  <ul>
  <li>Traders: market hail, route tip, restock notice</li>
  <li>Patrols: safety update, contraband warning, bounty notice</li>
  <li>Pirates: threat or ransom opener when aggression conditions met</li>
  <li>Bounty hunters: target rumor or contract solicitation</li>
  </ul>
</li>
<li>Sectors with active players surface at least one ambient NPC beat every 3-5 minutes in normal space</li>
<li>UI shows compact event feed with timestamps and source NPC</li>
<li>Presence cooldown prevents NPC spam: <code>presence_cooldown_at</code> field with anti-spam pacing</li>
<li>Track <code>last_hail_at</code> and <code>last_seen_player_id</code> for local pacing</li>
<li>Tick loop expanded with presence pass that decides when to message (not only when to move/attack)</li>
<li>Batched sector updates when NPC density is high</li>
</ol></div>
<div class="modal-section"><div class="modal-section-title">Data Model</div>
<table class="detail-table"><tr><th>Model/Column</th><th>Type</th><th>Notes</th></tr>
<tr><td>NPC.presence_cooldown_at</td><td>Column Add</td><td>DATETIME — anti-spam cooldown for proactive NPC messages</td></tr>
<tr><td>NPC.last_hail_at</td><td>Column Add</td><td>DATETIME — when this NPC last hailed a player</td></tr>
<tr><td>NPC.last_seen_player_id</td><td>Column Add</td><td>FK to User — last player this NPC interacted with (pacing)</td></tr>
<tr><td>SectorEventFeed</td><td>Transient/Redis</td><td>sector_id, events[] with timestamp, npc_id, event_type, message — rolling window for UI feed</td></tr>
</table></div>
<div class="modal-section"><div class="modal-section-title">API Surface</div><ul>
<li><code>GET /api/sectors/:id/npc-feed</code> — recent NPC activity feed for sector (last 20 events)</li>
<li>Socket: <code>npc:entered_sector</code> — NPC arrived with type, name, state</li>
<li>Socket: <code>npc:left_sector</code> — NPC departed</li>
<li>Socket: <code>npc:state_change</code> — NPC changed state (idle→patrolling, trading→fleeing, etc.)</li>
<li>Socket: <code>npc:hails_player</code> — proactive NPC hail with message and action options</li>
<li>Socket: <code>npc:combat_warning</code> — hostile NPC targeting player</li>
<li>Socket: <code>npc:service_offer</code> — trader/bounty hunter offering service</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">UX Specification</div><ul>
<li>Replace static sector NPC list with live source of truth updated via WebSocket</li>
<li>State badges on NPCs: <code>Trading</code>, <code>Patrolling</code>, <code>Interdicting</code>, <code>Fleeing</code>, <code>Idle</code></li>
<li>Activity rail or compact log in SystemView showing recent NPC events with timestamps</li>
<li>Accepting a hail opens chat panel with real hail message already present (not fabricated greeting)</li>
<li>Arrival/departure animations or transitions in system view</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Dependencies</div><p>npc-foundation (F0, F2, F5 blockers must be resolved first)</p></div>
<div class="modal-section"><div class="modal-section-title">Risks &amp; Mitigations</div><ul>
<li><strong>Risk:</strong> Event storm in high-density sectors. <strong>Mitigation:</strong> Batch updates; presence cooldowns; client-side throttling of feed rendering.</li>
<li><strong>Risk:</strong> Ambient beats feel repetitive. <strong>Mitigation:</strong> Variety pool per NPC type (8+ message templates); context-sensitive selection based on sector state.</li>
<li><strong>Risk:</strong> Performance impact of presence tick pass. <strong>Mitigation:</strong> Only run presence pass for sectors with active players; skip idle NPCs far from players.</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Complexity &amp; Estimate</div><p><strong>Complex — 2 weeks. Event pipeline, presence tick, proactive hail logic, live roster UI, event feed component.</strong></p></div>
<div class="modal-section"><div class="modal-section-title">Acceptance Criteria</div><ol>
<li>In a 10-minute session in a populated sector, player sees at least 3 non-combat NPC beats</li>
<li>Sector NPC state displayed in UI matches socket activity with no manual refresh</li>
<li>Hail acceptance rate and follow-up conversation rate are measurable (logged)</li>
<li>NPC arrivals and departures appear in event feed within 2 seconds</li>
<li>No duplicate events from batching or reconnection</li>
</ol></div>`
  },
  {
    id: 'npc-service-actions',
    title: 'Actionable Service NPCs & Contracts',
    status: 'new',
    desc: 'Turn service NPC dialogue into real gameplay loops: trader Buy/Sell opens trade UI, patrol Report Crime/Ask Bounties/Request Escort create game records, bounty hunter contracts create missions, pirate bribes process real payments. 100% of menu actions produce gameplay consequence.',
    tags: ['backend', 'frontend'],
    workflow: ['dialogueActionService implementation', 'Trader: Buy/Sell opens trade UI', 'Trader: Ask Prices/Routes pins hints', 'Patrol: Report Crime creates record', 'Patrol: Ask Bounties surfaces contracts', 'Patrol: Request Escort creates request', 'Bounty hunter: Offer Contract flow', 'Bounty hunter: Ask Price quoted offer', 'Pirate: Bribe payment choice', 'Pirate: Threaten escalation logic', 'NpcContract model (or Mission extension)', 'CTA/quote/action card rendering in chat', 'Cooldown and refusal tracking'],
    details: `<div class="modal-section"><div class="modal-section-title">Purpose</div><p>Turn service NPC dialogue from flavor-only menus into real gameplay loops. Every non-farewell dialogue option must open a game surface, create a mission/contract/state change, update the map/HUD, or return a durable result card. Eliminates dead-end flavor text that makes the world feel fake.</p></div>
<div class="modal-section"><div class="modal-section-title">Functional Requirements</div><ol>
<li><strong>Trader actions:</strong>
  <ul>
  <li><code>Buy Goods</code> opens trading UI in buy mode, anchored to current merchant/port</li>
  <li><code>Sell Cargo</code> opens trading UI in sell mode</li>
  <li><code>Ask Prices</code> and <code>Ask Routes</code> pin route hints or commodity notes to HUD</li>
  </ul>
</li>
<li><strong>Patrol actions:</strong>
  <ul>
  <li><code>Report Crime</code> creates report record, raises patrol presence in sector summary</li>
  <li><code>Ask Bounties</code> surfaces nearby hostile targets as playable contract card</li>
  <li><code>Request Escort</code> creates temporary escort request or denial with cooldown</li>
  </ul>
</li>
<li><strong>Bounty hunter actions:</strong>
  <ul>
  <li><code>Offer Contract</code> opens contract proposal flow</li>
  <li><code>Ask Price</code> returns concrete quoted offer</li>
  </ul>
</li>
<li><strong>Pirate actions:</strong>
  <ul>
  <li><code>Bribe</code> creates real payment choice with accept/refuse outcome</li>
  <li><code>Threaten</code> can de-escalate, escalate, or set combat modifier</li>
  </ul>
</li>
<li>Each action logged to audit layer with accepted/refused status</li>
<li>Cooldowns and refusal reasons tracked for consistency</li>
<li>Mission handoff: dialogue can create missions via existing Mission system with <code>issued_by_npc_id</code></li>
</ol></div>
<div class="modal-section"><div class="modal-section-title">Data Model</div>
<table class="detail-table"><tr><th>Model/Column</th><th>Type</th><th>Notes</th></tr>
<tr><td>NpcContract</td><td>New Model</td><td>id, npc_id FK, player_id FK, type ENUM(escort/bounty/trade-tip/bribe/patrol-report), terms JSONB, status ENUM(offered/accepted/completed/expired/refused), reward, expires_at, created_at</td></tr>
<tr><td>Mission.issued_by_npc_id</td><td>Column Add</td><td>FK to NPC — tracks which NPC created this mission via dialogue</td></tr>
<tr><td>NpcActionCooldown</td><td>New Model</td><td>npc_id FK, player_id FK, action_type, cooldown_until — prevents spam requests</td></tr>
</table></div>
<div class="modal-section"><div class="modal-section-title">API Surface</div><ul>
<li><code>POST /api/npcs/:id/action/:actionType</code> — execute dialogue action (buy, sell, report, escort, bounty, bribe, threaten)</li>
<li><code>GET /api/npc-contracts?player_id=X</code> — active NPC contracts for player</li>
<li><code>POST /api/npc-contracts/:id/accept</code> — accept offered contract</li>
<li><code>POST /api/npc-contracts/:id/complete</code> — mark contract complete (server validates)</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">UX Specification</div><ul>
<li>Chat responses render: CTA cards, quote cards, trade shortcuts, route markers, accept/decline actions</li>
<li><code>NPCChatPanel</code> consumes <code>data</code> payload from dialogue responses instead of ignoring it</li>
<li>Panel shows gameplay consequence of the last NPC action</li>
<li>Contract cards show terms, reward, expiry countdown, and accept/decline buttons</li>
<li>Completed contracts show summary with reward breakdown</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Dependencies</div><p>npc-foundation (F3 dialogue action execution, F5 tests), existing Mission and Trading systems</p></div>
<div class="modal-section"><div class="modal-section-title">Risks &amp; Mitigations</div><ul>
<li><strong>Risk:</strong> Economy exploit via NPC contract farming. <strong>Mitigation:</strong> Cooldowns per NPC-player pair; diminishing returns on repeated same-type contracts; server-validated completion.</li>
<li><strong>Risk:</strong> Bribe mechanic trivializes pirate encounters. <strong>Mitigation:</strong> Bribe cost scales with cargo value; some pirates refuse bribes based on personality/aggression; bribe failure can escalate to combat.</li>
<li><strong>Risk:</strong> Contract spam from many NPCs. <strong>Mitigation:</strong> Max 3 active NPC contracts per player; oldest auto-expire.</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Complexity &amp; Estimate</div><p><strong>Complex — 2 weeks. dialogueActionService, NpcContract model, action-specific logic for 4 NPC types, chat card rendering, cooldown system.</strong></p></div>
<div class="modal-section"><div class="modal-section-title">Acceptance Criteria</div><ol>
<li>100% of service menu actions have gameplay consequence or actionable UI output</li>
<li>Trader Buy Goods opens trade UI in buy mode with correct port context</li>
<li>Patrol Ask Bounties returns playable bounty contract card</li>
<li>Pirate Bribe deducts credits on accept and grants temporary safe passage</li>
<li>Players can complete a trade handoff or accept a contract without dead-end text</li>
<li>At least one repeatable patrol loop and one bounty loop available via NPC chat</li>
</ol></div>`
  },
  {
    id: 'npc-memory-relationships',
    title: 'NPC Memory & Relationship Summaries',
    status: 'new',
    desc: 'Named NPCs remember the player: NpcMemory model keyed by npc_id + player_id with bounded relationship summaries (sentiment, trust/fear/respect scores, notable facts, recent memory bullets). Greeting adaptation, pricing adjustments, and relationship indicators in chat header.',
    tags: ['backend', 'frontend'],
    workflow: ['NpcMemory model', 'Relationship summary structure', 'Memory write on conversation end', 'Memory write on combat encounter', 'Summarization/compaction rules', 'Memory decay and cap', 'Feed relationship into scripted dialogue', 'Feed relationship into AI prompt', 'Recognition text on repeat interaction', 'Relationship indicator in chat header', 'Pricing/contract quality adaptation'],
    details: `<div class="modal-section"><div class="modal-section-title">Purpose</div><p>Make important NPCs remember the player enough to create attachment and continuity. Named traders remember profitable deals, patrol officers remember whether the player helped or caused trouble, rival pirates reference past encounters. Transforms NPCs from stateless responders into persistent characters in a shared world.</p></div>
<div class="modal-section"><div class="modal-section-title">Functional Requirements</div><ol>
<li>Add <code>NpcMemory</code> keyed by <code>npc_id + player_id</code> with bounded relationship summary</li>
<li>Relationship summary fields: last interaction type, sentiment (positive/neutral/negative), notable fact, trust/fear/respect score (-100 to 100), recent memory bullets (max 5)</li>
<li>Dialogue start includes recognition text when prior relationship exists</li>
<li>Repeat interactions adapt: greeting tone, pricing favorability, contract quality, refusal thresholds</li>
<li>Only select NPCs persist long-term memory:
  <ul>
  <li>Named traders</li>
  <li>Patrol leaders</li>
  <li>Quest givers</li>
  <li>Repeat rivals (pirates/bounty hunters encountered 3+ times)</li>
  </ul>
</li>
<li>Summarization/compaction after conversation end or major encounters</li>
<li>Memory decay: oldest memories fade after configurable period; cap storage per NPC-player pair</li>
<li>Feed relationship summary into scripted dialogue first, AI prompt second</li>
</ol></div>
<div class="modal-section"><div class="modal-section-title">Data Model</div>
<table class="detail-table"><tr><th>Model/Column</th><th>Type</th><th>Notes</th></tr>
<tr><td>NpcMemory</td><td>New Model</td><td>id, npc_id FK, player_id FK, last_interaction_type ENUM, sentiment ENUM(positive/neutral/negative), notable_fact TEXT, trust_score INT, fear_score INT, respect_score INT, memory_bullets JSONB (max 5), last_interaction_at, created_at, updated_at</td></tr>
<tr><td>NPC.memory_eligible</td><td>Column Add</td><td>BOOLEAN default false — only named/promoted NPCs persist memory</td></tr>
</table></div>
<div class="modal-section"><div class="modal-section-title">API Surface</div><ul>
<li><code>GET /api/npcs/:id/relationship</code> — player's relationship summary with NPC (trust, sentiment, interaction count)</li>
<li><code>GET /api/player/npc-relationships</code> — all NPC relationships for current player (sorted by recency)</li>
<li>Internal: memory written automatically on conversation end, combat, and trade completion</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">UX Specification</div><ul>
<li>Relationship indicator in chat header: <code>Trusts You</code>, <code>Suspicious</code>, <code>Owes You</code>, <code>Remembers Last Trade</code>, <code>Hostile</code></li>
<li>Subtle recognition lines in dialogue rather than giant lore dumps</li>
<li>Trust/reputation bar visible on NPC detail panel for memory-eligible NPCs</li>
<li>Server-side memory persists across sessions and devices (not localStorage)</li>
<li>Tooltip on relationship badge shows last interaction summary</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Dependencies</div><p>npc-foundation (F0 conversation sessions, F4 dialogue context quality, F5 tests), difficulty-scaling (alignment on memory ambitions)</p></div>
<div class="modal-section"><div class="modal-section-title">Risks &amp; Mitigations</div><ul>
<li><strong>Risk:</strong> Memory table grows unbounded with many NPCs × players. <strong>Mitigation:</strong> Only memory-eligible NPCs (named/promoted); max 5 bullets; decay old memories after 30 days of no interaction.</li>
<li><strong>Risk:</strong> Recognition text feels generic or wrong. <strong>Mitigation:</strong> Template library with 20+ variants per sentiment tier; notable_fact inserted only when confidence is high.</li>
<li><strong>Risk:</strong> Memory inconsistency with AI-generated dialogue. <strong>Mitigation:</strong> Relationship summary always included in AI prompt context; compaction normalizes format.</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Complexity &amp; Estimate</div><p><strong>Medium — 1.5 weeks. NpcMemory model, write hooks on dialogue/combat/trade, scripted recognition, relationship UI indicators.</strong></p></div>
<div class="modal-section"><div class="modal-section-title">Acceptance Criteria</div><ol>
<li>On second interaction, named NPCs reference prior events with correct context</li>
<li>Players can identify at least one recurring NPC relationship in a normal play week</li>
<li>Memory storage remains bounded: max 5 bullets per NPC-player pair, 30-day decay</li>
<li>Relationship indicator visible in chat header for memory-eligible NPCs</li>
<li>Trust score affects pricing favorability (measurable: ±5-15% based on trust tier)</li>
</ol></div>`
  },
  {
    id: 'faction-territory-presence',
    title: 'Faction & Clan Territory Presence',
    status: 'new',
    desc: 'Zone-aware NPC spawning and regional identity: core/inner/outer/frontier/special spawn profiles, faction-tagged patrol/trader traffic, clan-tagged pirate presence, lightweight rotating territory events (convoys, sweeps, tolls, harassment alerts), map overlays and rumor feeds tied to territory.',
    tags: ['backend', 'frontend'],
    workflow: ['Zone tier classification (core/inner/outer/frontier/special)', 'Spawn profile system per zone', 'faction_id/clan_id on NPC spawn templates', 'Replace universal spawn with data-driven tables', 'Sector-level regional summaries', 'Territory pressure events (convoys, sweeps, tolls)', 'Map tint/badge for territory', 'Faction/clan badge in NPC details', 'Territory cues in system/galaxy views', 'Patrol/trader rumor feeds'],
    details: `<div class="modal-section"><div class="modal-section-title">Purpose</div><p>Give sectors identity so NPCs feel place-based instead of randomly sampled. Adjacent regions should visibly differ in NPC composition and tone. Players should predict safer or riskier routes from map signals and NPC behavior, creating readable geography without requiring boss content or faction war systems.</p></div>
<div class="modal-section"><div class="modal-section-title">Functional Requirements</div><ol>
<li>Add faction or clan identity to NPC data and UI</li>
<li>Replace flat sector spawning with zone-aware spawn profiles:
  <ul>
  <li>Core: high patrol density, low pirate, safe trade corridors</li>
  <li>Inner Ring: moderate patrol, some pirate activity</li>
  <li>Outer Ring: reduced patrol, increased pirate and raider presence</li>
  <li>Frontier: minimal patrol, high pirate/raider, clan territory</li>
  <li>Special Territory: faction-specific compositions</li>
  </ul>
</li>
<li>Surface territory pressure through: map tint or badge, patrol status, pirate heat, convoy presence, rumor feed</li>
<li>Lightweight rotating events:
  <ul>
  <li>Trader convoys (safe passage periods)</li>
  <li>Patrol sweeps (temporary security boosts)</li>
  <li>Pirate tolls (passage tax in contested zones)</li>
  <li>Clan harassment alerts (increased raider activity)</li>
  </ul>
</li>
<li>Sector-level regional summaries for efficient territory pressure calculation (no whole-world scan per tick)</li>
<li>Patrol and trader rumor dialogue references current regional conditions</li>
</ol></div>
<div class="modal-section"><div class="modal-section-title">Data Model</div>
<table class="detail-table"><tr><th>Model/Column</th><th>Type</th><th>Notes</th></tr>
<tr><td>NPC.faction_id</td><td>Column Add</td><td>FK to Faction — which faction this NPC serves (nullable for rogues)</td></tr>
<tr><td>NPC.clan_id</td><td>Column Add</td><td>FK to NpcClan — which clan this NPC belongs to (nullable)</td></tr>
<tr><td>SpawnProfile</td><td>New Model</td><td>id, zone_tier ENUM(core/inner/outer/frontier/special), npc_type_weights JSONB, faction_distribution JSONB, density_multiplier FLOAT, event_chance FLOAT</td></tr>
<tr><td>Sector.zone_tier</td><td>Column Add</td><td>ENUM — classified zone for spawn profile selection</td></tr>
<tr><td>TerritoryEvent</td><td>New Model</td><td>id, sector_id FK, event_type ENUM(convoy/sweep/toll/harassment), faction_id FK, started_at, expires_at, effects JSONB</td></tr>
</table></div>
<div class="modal-section"><div class="modal-section-title">API Surface</div><ul>
<li><code>GET /api/sectors/:id/territory</code> — zone tier, controlling faction, active events, threat level</li>
<li><code>GET /api/territory/map</code> — bulk territory overlay data for galaxy map</li>
<li><code>GET /api/territory/events</code> — active territory events near player</li>
<li><code>GET /api/territory/rumors</code> — NPC-sourced rumors about regional conditions</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">UX Specification</div><ul>
<li>Faction/clan badge in NPC details panel and chat header</li>
<li>Territory cues in system and galaxy views: zone tint, faction insignia, threat indicators</li>
<li>Galaxy map overlay: color-coded zones with faction control, pirate heat, active events</li>
<li>Patrol and trader rumor dialogue references current regional conditions dynamically</li>
<li>Convoy/sweep events visible as temporary map markers with countdown</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Dependencies</div><p>npc-foundation (F2 live events, F5 tests), factions (faction data model), clan-spawning (clan data model), difficulty-scaling (zone scaling alignment), sector-zones (zone classification)</p></div>
<div class="modal-section"><div class="modal-section-title">Risks &amp; Mitigations</div><ul>
<li><strong>Risk:</strong> Zone classification is too rigid for procedurally generated galaxies. <strong>Mitigation:</strong> Distance-from-center heuristic with manual override capability; zone_tier stored on sector for flexibility.</li>
<li><strong>Risk:</strong> Territory events feel formulaic. <strong>Mitigation:</strong> Randomized timing, varied event compositions, faction-specific event flavors; at least 4 event types with 3+ variants each.</li>
<li><strong>Risk:</strong> Performance of regional summary computation. <strong>Mitigation:</strong> Precomputed and updated incrementally on player/NPC state changes; cached in Redis with 60s TTL.</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Complexity &amp; Estimate</div><p><strong>Complex — 2.5 weeks. Zone classification, spawn profile system, territory events, map overlays, regional summaries, rumor integration.</strong></p></div>
<div class="modal-section"><div class="modal-section-title">Acceptance Criteria</div><ol>
<li>Adjacent regions visibly differ in NPC composition and tone</li>
<li>Players can correctly predict safer or riskier routes from map and NPC signals</li>
<li>Territory-driven events increase travel and return visits without requiring boss content</li>
<li>Zone tier correctly classifies sectors by distance/position heuristic</li>
<li>Faction/clan badges appear on all NPCs with faction/clan assignment</li>
<li>At least 2 different territory events rotate through frontier zones per game day</li>
</ol></div>`
  }
];

// ─── Read + Parse ─────────────────────────────────────────────────────

let html = fs.readFileSync(HTML_PATH, 'utf8');

// Find insertion point: right before NPC CLANS & RAIDS section
const insertMarker = '// ============ NPC CLANS & RAIDS ============';
const insertIdx = html.indexOf(insertMarker);
if (insertIdx === -1) {
  console.error('ERROR: Could not find NPC CLANS & RAIDS section marker');
  process.exit(1);
}

// ─── Build section string ─────────────────────────────────────────────

function serializeFeature(f) {
  const tags = f.tags.map(t => `'${t}'`).join(',');
  const wf = f.workflow.map(w => `'${w.replace(/'/g, "\\'")}'`).join(',');
  return `{id:'${f.id}',title:'${f.title}',status:'${f.status}',
  desc:'${f.desc.replace(/'/g, "\\'")}',
  tags:[${tags}],
  workflow:[${wf}],
  details:\`${f.details}\`}`;
}

let sectionStr = `// ============ NPC UX & LIVING WORLD ============\n`;
sectionStr += `{id:'npc-ux',title:'NPC UX & Living World',status:'new',features:[\n`;

const featureStrs = NPC_UX_FEATURES.map(serializeFeature);
sectionStr += featureStrs.join(',\n');
sectionStr += `\n]},\n`;

// ─── Insert ───────────────────────────────────────────────────────────

html = html.slice(0, insertIdx) + sectionStr + html.slice(insertIdx);

// ─── Write ────────────────────────────────────────────────────────────

fs.writeFileSync(HTML_PATH, html, 'utf8');
console.log('Inserted NPC UX & Living World section with 5 features');

// ─── Verify ───────────────────────────────────────────────────────────

const planStart = html.indexOf('const PLAN=[');
const planEnd = html.indexOf('];', planStart) + 2;
const planCode = html.substring(planStart, planEnd);

try {
  const fn = new Function(planCode + '\nreturn PLAN;');
  const PLAN = fn();
  const totalFeatures = PLAN.reduce((a, s) => a + s.features.length, 0);
  const npcUxSection = PLAN.find(s => s.id === 'npc-ux');
  console.log(`Total sections: ${PLAN.length}`);
  console.log(`Total features: ${totalFeatures}`);
  console.log(`NPC UX section: ${npcUxSection ? npcUxSection.features.length + ' features' : 'NOT FOUND'}`);
  if (npcUxSection) {
    npcUxSection.features.forEach(f => console.log(`  - ${f.id}: ${f.title}`));
  }
} catch (e) {
  console.error('PARSE ERROR:', e.message);
  process.exit(1);
}

// ─── Re-export JSON ───────────────────────────────────────────────────

try {
  const fn2 = new Function(planCode + '\nreturn PLAN;');
  const PLAN = fn2();
  const exportData = {
    meta: {
      title: 'Space Wars 3000 — Game Design Plan',
      version: '2.3',
      exported_at: new Date().toISOString(),
      total_sections: PLAN.length,
      total_features: PLAN.reduce((a, s) => a + s.features.length, 0)
    },
    sections: PLAN.map(s => ({
      id: s.id,
      title: s.title,
      status: s.status,
      feature_count: s.features.length,
      features: s.features.map(f => ({
        id: f.id,
        title: f.title,
        status: f.status,
        summary: f.desc,
        tags: f.tags || [],
        workflow_steps: (f.workflow || []).length,
        has_prd: !!(f.details && f.details.includes('modal-section'))
      }))
    }))
  };
  fs.writeFileSync(EXPORT_PATH, JSON.stringify(exportData, null, 2));
  console.log(`Export JSON updated: v${exportData.meta.version}, ${exportData.meta.total_features} features`);
} catch (e) {
  console.error('Export error:', e.message);
}

console.log('\nDone!');
