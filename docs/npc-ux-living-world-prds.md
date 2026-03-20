# NPC UX Review and Living-World PRDs

## Executive Summary

The codebase has solid NPC scaffolding, but the player-facing experience is still mostly static. The current system can spawn NPCs, move them, run simple combat decisions, and open a dialogue panel, but most of that behavior is either invisible to the player, disconnected from the UI, or ends in text with no systemic follow-through.

The biggest UX issue is not "NPC intelligence." It is the illusion gap:

- The client is prepared for live hails and dialogue socket events, but the server does not emit them.
- The system view shows a static NPC snapshot, not live sector activity.
- Dialogue options like `Buy Goods`, `Sell Cargo`, `Offer Contract`, and `Bribe` mostly return flavor text or unused metadata instead of creating gameplay outcomes.
- The local dev snapshot shows broad inactivity: `281` NPCs total, `271` idle, only `7` active near players, and all `10` active ships clustered in one sector.

If the goal is "make the game feel alive," the next step should be to make existing NPC behavior visible, reactive, and actionable before expanding into full AI agents or heavyweight LLM behaviors.

## Current-State Findings

### 1. The simulation exists, but players rarely feel it

- Tactical NPC decisions run every `30` seconds and only for NPCs near active player ships.
- The current system view uses a one-time `/sectors/:id/system` payload and does not render live socket-driven NPC state.
- `useNPCEvents` tracks `sectorNPCs`, `pendingHails`, and `combatAlert`, but only `pendingHails` is consumed at app level, and even that depends on server events that are never emitted.
- The server emits `npc:left_sector`, `npc:entered_sector`, and some `npc:attacks_player` events, but proactive world-social events are missing.

Player result: sectors feel frozen unless the player manually opens a panel or enters combat.

### 2. Dialogue is mostly a wrapper, not a gameplay system

- Scripted dialogue has decent flavor variation, but menu choices are mostly decorative.
- `Buy Goods` and `Sell Cargo` return data payloads such as `open_trade_ui`, but the chat panel ignores those payloads.
- `report_crime`, `request_escort`, `offer_contract`, `ask_bounties`, and pirate `bribe` flows do not change world state in a meaningful way.
- The initial greeting shown in the chat panel is fabricated by the client from a personality summary, not sent as a real NPC utterance.
- Accepted hail notifications do not preserve hail-specific text or create a distinct opening beat.

Player result: NPCs look interactive, but many choices end in non-binding flavor text, which makes the world feel fake rather than alive.

### 3. Identity is too thin to create attachment

- NPCs have lightweight personality JSON, but no faction affiliation, no relationship state, no memory, no schedule, and no narrative role beyond type.
- There is no `NpcMemory` or per-player relationship layer.
- Conversation history is stored in `NPC.dialogue_state` while active, then lost when the conversation ends. The only long-term history is local browser storage in the chat panel.
- The current model also allows only one active dialogue per NPC globally, which is a poor fit for an MMO-style social space.

Player result: NPCs can sound different for one exchange, but they do not feel like persistent characters in a shared world.

### 4. Combat intent is not durable enough

- The behavior tree can choose a specific player target.
- Once an NPC enters `engaging`, the combat tick later picks any active player ship in the same sector instead of a persisted target.
- There is no `target_ship_id` or equivalent combat binding on the NPC.

Player result: combat can feel arbitrary, confusing, and less fair than the UI implies.

### 5. The admin surface is ahead of the player surface

- There is meaningful admin control for AI providers, difficulty, stats, respawn, and logs.
- Several admin-facing toggles imply functionality that is not fully wired on the gameplay side:
  - Per-NPC-type AI toggles are exposed but not consumed by server logic.
  - `npc.spawn_rate_multiplier` exists in settings but is not used by spawning.
  - Decision logging is admin-visible, but the same state changes are not surfaced well to players.

Player result: the tools to tune the system are more complete than the player experience of the system itself.

### 6. Several code paths advertise "living world" behavior without delivering it

- The client expects `npc:hails_player` and `npc:dialogue` events, but the server never emits them.
- `npc:state_change` is expected by the client, but only emitted in a narrow disengage path.
- `buildDialogueContext()` and `buildInteractivePrompt()` disagree on context keys, so AI dialogue gets less useful world context than intended.
- Dialogue caching is keyed only by NPC ID plus player text, not by meaningful world context, so responses can become stale or misleading.

Player result: the game signals reactivity, but players do not consistently receive it.

## Idea Board Comparison

| Idea Board Feature | Board Intent | Current Codebase Reality | Gap Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `npc-types` | 6 distinct types including colony workers, stronger differentiation | 5 roaming types exist; colony workers are absent; behavior differences are shallow and mostly server-side | High | Finish the player-facing identity and reserve colony workers for a separate colony-life pass |
| `difficulty-scaling` | Zone-scaled NPC power, selective AI, memory, dynamic quests | Difficulty slider affects attack confidence only; no zone scaling, no memory, no dynamic quest generation | High | Split into smaller deliverables: zone identity first, memory second, dynamic quests later |
| `factions` | Factions should shape world identity and be extensible | NPCs are not faction-scoped in data model or UI | High | Add faction/clan identity to NPCs before bigger event content |
| `missions` | Repeatable gameplay loop with bounty/patrol/trade hooks | Missions exist separately, but NPC dialogue does not meaningfully drive them | Medium | Turn service NPCs into mission and contract entry points |
| `clan-spawning` / `clan-raids` / `clan-clearing` | Dynamic PvE pressure, territory, bases, bosses, POIs | No clan territory, no regional raid economy, no strongholds, no live map pressure | High | Build a lighter faction/clan territory event layer first |
| `raid-bosses` / `derelict-explore` | Memorable endgame PvE encounters | Not present in current NPC framework | Medium | Use later, after space NPC presence and territory identity are working |
| `ai-agent` | Companion/sub-account AI playing in the same world | Not started; automation is the closest existing primitive | Medium | Defer until the world itself is reactive and NPC contracts are real |
| `endgame-retention` governor/agent ideas | Long-term autonomous world actors | Not present in NPC runtime | Low for now | Keep out of near-term NPC UX scope |

## Strategic Recommendation

Do not try to jump from the current system straight to full `ai-agent`, dynamic quests, and boss-level adaptive AI.

That would optimize intelligence before presence.

The better sequence is:

1. Fix the illusion gap.
2. Make NPC interactions produce gameplay results.
3. Give named NPCs memory and continuity.
4. Add faction/clan territory pressure so regions feel different.
5. Only then layer in companion agents, governors, and more expensive AI behaviors.

## Foundation Blockers To Fix Before New Scope

These are not optional polish tasks. They are prerequisites for a living-world experience.

### F0. Replace `NPC.dialogue_state` with per-player conversation sessions

Why:

- Global per-NPC dialogue locks are a poor shared-world fit.
- This blocks future memory, multi-player hubs, and cleaner history handling.

Needed changes:

- Add `NpcConversationSession` with `session_id`, `npc_id`, `user_id`, `started_at`, `last_message_at`, `state_json`.
- Remove MMO-visible "busy NPC" behavior for standard service NPCs.
- Keep temporary exclusivity only for rare encounter NPCs if needed.

### F1. Persist combat targets

Why:

- The NPC can decide to attack one player and then fight another.

Needed changes:

- Add `target_ship_id` and `target_user_id` on the NPC combat state, or move active combat state into a dedicated combat engagement model.
- Use that binding in combat ticks and UI warnings.

### F2. Wire the live event contract end-to-end

Why:

- The client already has a hook for live NPC activity, but the pipeline is incomplete.

Needed changes:

- Emit real `npc:hails_player`, `npc:dialogue`, and broader `npc:state_change` events.
- Feed `sectorNPCs` into the live system view instead of letting the UI drift from reality.
- Add a lightweight player-visible event feed for arrivals, departures, scans, patrol warnings, and trader offers.

### F3. Execute dialogue action payloads

Why:

- Flavor text without state change kills trust.

Needed changes:

- Handle dialogue `data.action` on the client and server.
- Open trading with the right mode.
- Create escort, bounty, rumor, bribe, and contract flows that actually write game state.

### F4. Fix dialogue context quality

Why:

- The AI path has context mismatches and cache keys that ignore world state.

Needed changes:

- Normalize context contracts between `buildDialogueContext()` and `buildInteractivePrompt()`.
- Use context-aware cache keys: NPC, intent, sector, relevant market state, and faction state.

### F5. Add NPC UX end-to-end tests

Why:

- Current coverage is mostly unit-level and one deep interaction spec that only checks for button visibility.

Needed changes:

- Add dedicated E2E coverage for:
  - live NPC roster updates
  - hail notification acceptance and dismissal
  - service NPC action flows
  - target-consistent NPC attacks
  - repeated conversations with memory cues

## Adjusted Feature PRDs

## PRD 1: Living Sector Presence

### Goal

Make every active sector feel inhabited within minutes, not just when the player opens a detail panel.

### Player Outcome

- Traders feel like traffic, not static buttons.
- Patrols visibly secure systems.
- Hostiles create tension before combat starts.
- The player sees the world reacting around them.

### Scope

In scope:

- live NPC roster updates
- arrival/departure/state-change presentation
- proactive hails and warnings
- ambient beats for traders, patrols, pirates, and bounty hunters
- shorter, event-driven presence cadence around active players

Out of scope:

- full faction war system
- major raid encounters
- LLM-first tactical upgrades

### Functional Requirements

- The server must emit a complete live NPC event contract:
  - `npc:entered_sector`
  - `npc:left_sector`
  - `npc:state_change`
  - `npc:hails_player`
  - `npc:combat_warning`
  - `npc:service_offer`
- The system view must merge initial sector data with socket updates so the NPC list is live.
- Every interactive NPC type must have at least one proactive beat:
  - Traders: market hail, route tip, restock notice
  - Patrols: safety update, contraband warning, bounty notice
  - Pirates: threat or ransom opener when aggression conditions are met
  - Bounty hunters: target rumor or contract solicitation
- Sectors with active players should surface at least one ambient NPC beat every `3-5` minutes in normal space.
- The UI must show a compact event feed with timestamps and source NPC.

### Backend Requirements

- Add a `presence_cooldown_at` or equivalent anti-spam field/state.
- Add `last_hail_at` and `last_seen_player_id` for simple local pacing.
- Expand the tick loop with a presence pass that decides when to message rather than only when to move or attack.
- Emit batched sector updates where density is high.

### Frontend Requirements

- Replace the static sector NPC list with a live source of truth.
- Show state badges such as `Trading`, `Patrolling`, `Interdicting`, `Fleeing`.
- Add an activity rail or compact log in `SystemView`.
- Accepting a hail should open the chat panel with the real hail message already present.

### Success Metrics

- In a 10-minute session in a populated sector, the player sees at least `3` non-combat NPC beats.
- Sector NPC state displayed in UI matches socket activity with no manual refresh.
- Hail acceptance rate and follow-up conversation rate are measurable.

### Dependencies

- F0, F2, F5

## PRD 2: Actionable Service NPCs and Contracts

### Goal

Turn service NPC dialogue into real gameplay loops instead of flavor-only menus.

### Player Outcome

- Talking to a trader can open a real trade flow.
- Talking to patrol can create an escort, bounty, or safety task.
- Talking to bounty hunters and pirates can create meaningful deals and risks.

### Scope

In scope:

- trader service actions
- patrol service actions
- bounty hunter contracts
- pirate bribe / surrender / threat outcomes
- mission handoff from dialogue

Out of scope:

- freeform AI-generated contracts
- fully autonomous agent marketplace

### Functional Requirements

- Each non-farewell menu option must do one of the following:
  - open an existing game surface
  - create a mission/contract/state change
  - update the map or HUD with useful data
  - return a durable result card the player can accept or ignore
- Trader actions:
  - `Buy Goods` opens trading UI in buy mode, anchored to the current merchant/port
  - `Sell Cargo` opens trading UI in sell mode
  - `Ask Prices` and `Ask Routes` can pin route hints or commodity notes
- Patrol actions:
  - `Report Crime` creates a report record and can raise patrol presence in the sector summary
  - `Ask Bounties` can surface nearby hostile targets as a playable contract card
  - `Request Escort` creates a temporary escort request or denial with cooldown
- Bounty hunter actions:
  - `Offer Contract` opens a contract proposal flow
  - `Ask Price` returns a concrete quoted offer
- Pirate actions:
  - `Bribe` creates a real payment choice with accept/refuse outcome
  - `Threaten` can de-escalate, escalate, or set a combat modifier

### Backend Requirements

- Add `NpcContract` or reuse `Mission` with an `issued_by_npc_id` field.
- Add a `dialogueActionService` that translates scripted response data into real side effects.
- Track cooldowns and refusal reasons so the player gets consistency instead of random text.
- Log accepted/refused actions to the audit layer.

### Frontend Requirements

- Chat responses can render:
  - CTA cards
  - quote cards
  - trade shortcuts
  - route markers
  - accept/decline actions
- `NPCChatPanel` must consume the `data` payload from dialogue responses instead of ignoring it.
- The panel must show the gameplay consequence of the last NPC action.

### Success Metrics

- `100%` of service menu actions have gameplay consequence or actionable UI output.
- Players can complete a trade handoff or accept a contract without leaving dead-end dialogue text.
- At least one repeatable patrol and one repeatable bounty loop are available via NPC chat.

### Dependencies

- F3, F5
- Existing `Mission` and `Trading` systems

## PRD 3: NPC Memory and Relationship Summaries

### Goal

Make important NPCs remember the player enough to create attachment and continuity.

### Player Outcome

- Named traders remember your last profitable deal.
- Patrol officers remember whether you helped or caused trouble.
- Rival pirates and bounty hunters can reference past encounters.

### Scope

In scope:

- named or promoted service NPCs
- lightweight per-player memory
- greeting adaptation
- relationship summary in chat and tooltips

Out of scope:

- full memory on every ambient NPC
- vector search or expensive long-form recall for the entire population

### Functional Requirements

- Add `NpcMemory` keyed by `npc_id + player_id`.
- Store a bounded relationship summary:
  - last interaction type
  - sentiment
  - notable fact
  - trust/fear/respect score
  - recent memory bullets
- Dialogue start must include recognition text when a prior relationship exists.
- Repeat interactions should adapt greeting, pricing, contract quality, or refusal thresholds.
- Only select NPCs should persist long-term memory at first:
  - named traders
  - patrol leaders
  - quest givers
  - repeat rivals

### Backend Requirements

- Add `NpcMemory` with small bounded summaries, not raw transcript blobs.
- Add summarization/compaction rules after conversation end or major encounters.
- Decay old memories and cap storage per NPC-player pair.
- Feed relationship summary into scripted dialogue first, AI prompt second.

### Frontend Requirements

- Show a small relationship indicator in chat header:
  - `Trusts You`
  - `Suspicious`
  - `Owes You`
  - `Remembers Last Trade`
- Use subtle recognition lines rather than giant lore dumps.
- Preserve server-side memory across sessions and devices.

### Success Metrics

- On the second or third interaction, important NPCs reference prior events with correct context.
- Players can identify at least one recurring NPC relationship in a normal play week.
- Memory storage remains bounded and cheap.

### Dependencies

- F0, F4, F5
- Board alignment with `difficulty-scaling` memory ambitions

## PRD 4: Faction and Clan Territory Presence

### Goal

Give sectors identity so NPCs feel place-based instead of randomly sampled.

### Player Outcome

- Patrols feel like they belong to a faction.
- Pirate and raider activity varies by region.
- Safe trade corridors, risky border systems, and hostile pockets become readable at a glance.

### Scope

In scope:

- faction-tagged patrol/trader traffic
- clan-tagged pirate presence
- zone-based spawn profiles
- local territory pressure events
- map overlays and rumors tied to territory

Out of scope:

- full stronghold-clearing chain
- world-scale faction governance
- endgame governor automation

### Functional Requirements

- Add faction or clan identity to NPC data and UI.
- Replace flat sector spawning with zone-aware spawn profiles:
  - core
  - inner ring
  - outer ring
  - frontier
  - special territory
- Surface territory pressure through:
  - map tint or badge
  - patrol status
  - pirate heat
  - convoy presence
  - rumor feed
- Introduce lightweight rotating events:
  - trader convoys
  - patrol sweeps
  - pirate tolls
  - clan harassment alerts

### Backend Requirements

- Add `faction_id`, `clan_id`, `zone_tier`, and `spawn_profile_id` on NPCs or spawn templates.
- Add sector-level regional summaries so future raids and convoys do not require whole-world scans every tick.
- Replace universal spawn chance with data-driven spawn tables by zone and territory.

### Frontend Requirements

- Show faction/clan badge in NPC details and chat.
- Add territory cues in system and galaxy views.
- Let patrol and trader rumors point to current regional conditions.

### Success Metrics

- Adjacent regions visibly differ in NPC composition and tone.
- Players can correctly predict safer or riskier routes from map and NPC signals.
- Territory-driven events increase travel and return visits without requiring boss content.

### Dependencies

- F2, F5
- Board alignment with `difficulty-scaling`, `factions`, and `clan-spawning`

## Recommended Sequencing

### Phase A: Fix the illusion gap

- F0 through F5
- PRD 1 first slice

### Phase B: Make service NPCs matter

- PRD 2

### Phase C: Add continuity and attachment

- PRD 3

### Phase D: Make regions feel distinct

- PRD 4

### Phase E: Revisit board-expansion features

- `clan-clearing`
- `raid-bosses`
- `derelict-explore`
- `ai-agent`
- `endgame-retention` governor loops

## Features To Defer

### Full AI Agent Companion

Do not prioritize this before the living-world layer exists. Otherwise the project risks building highly optimized automation against NPCs that still feel fake, generic, or static.

### Colony Workers As NPCs

This is still missing relative to the board, but it should ship as part of a colony-life pass after the space-side NPC service model is stable. Workers need a separate lifecycle and should not be bolted onto the roaming NPC model.

## Final Recommendation

The right near-term investment is not "more AI."

It is:

- more visibility
- more consequence
- more continuity
- more regional identity

If those four things land, the existing NPC foundation becomes credible. If they do not, more sophisticated AI will only make the system sound smarter while still feeling lifeless.
