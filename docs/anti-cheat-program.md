# Anti-Cheat And Anti-Grief Program

This file is the authoritative task tracker for the anti-cheat and anti-grief expansion work.

Status values:
- `planned`: defined, not started
- `in_progress`: currently being implemented
- `blocked`: waiting on another task or missing design input
- `verified`: implemented and verified against the listed checks

Verification rules:
- A task cannot move to `verified` until every listed verification item is completed.
- If behavior changes after a task was verified, the task returns to `in_progress`.
- Every implementation pass should update this file and [progress.md](/media/thoder/Share/Projects/Space-Wars/progress.md).

## Current Focus

Current execution slice:
- `AC-008` complete
- `AC-009` complete
- `AC-010` complete

## Foundation Tasks

### AC-001 Server Action Authority
- Status: `verified`
- Goal: route movement, PvP initiation, PvP toggles, and other hostile actions through shared server-owned policy decisions.
- Scope:
  - shared combat policy service
  - shared abuse/audit hooks
  - no direct controller-only PvP decisions
- Verification:
  - targeted backend tests for allowed and denied PvP initiation
  - targeted backend tests for protected-zone denial
  - audit log emitted for allow and deny decisions

### AC-002 PvP Protection And Hostility State
- Status: `verified`
- Goal: add persistent protection state so protected entry windows, safe harbors, newbie protection, and hostility cooldowns survive requests and reconnects.
- Scope:
  - persistent `PlayerProtectionState`
  - server-side helpers to grant and consume protections
  - cooldown-backed PvP toggles
- Verification:
  - targeted tests for toggle cooldowns
  - targeted tests for protection-window denial
  - direct DB-backed persistence checks in test flow

### AC-003 Fleet Travel Policy Unification
- Status: `verified`
- Goal: ensure fleet movement obeys the same access and traversal rules as single-ship movement.
- Scope:
  - replace raw adjacency-only fleet checks with world-policy traversal checks
  - preserve partial success behavior for mixed fleets
- Verification:
  - fleet service tests for owner/corp/faction/locked denial
  - regression tests for valid adjacent movement

### AC-004 Real-Time Combat Command Abuse Controls
- Status: `verified`
- Goal: reduce socket command spam, replay, and timing abuse in realtime combat.
- Scope:
  - per-ship command rate limiting
  - monotonic sequence handling when provided
  - audit records for rejected abusive commands
- Verification:
  - targeted tests for command throttle behavior
  - targeted tests for stale sequence rejection
  - targeted tests that a normal command cadence is still accepted

## Next Wave

### AC-005 Safe Harbor And Portal Entry Immunity
- Status: `verified`
- Depends on: `AC-001`, `AC-002`
- Goal: enforce no-attack grace windows on portal, wormhole, respawn, and home-sector entry.
- Verification:
  - protected-entry combat denial tests
  - integration tests for portal-entry immunity expiration

### AC-006 First Aggressor Tracking
- Status: `verified`
- Depends on: `AC-001`, `AC-002`
- Goal: allow commercial PvE-to-PvP portals without instant camp griefing.
- Verification:
  - tests showing defenders cannot attack portal arrivals until arrivals initiate hostility

### AC-007 Action Audit Ledger
- Status: `verified`
- Depends on: `AC-001`
- Goal: persist allow/deny decisions for movement, PvP initiation, portal use, toggles, and abuse events.
- Verification:
  - integration tests for audit record creation
  - admin query path or service-level fetch test

### AC-008 Sector Instance Admission Control
- Status: `verified`
- Depends on: `AC-001`, `AC-007`
- Goal: server-owned instance assignment and capacity enforcement for shared sectors, homes, and adventures.
- Scope:
  - persistent sector instance assignments with TTL and release handling
  - sticky assignment reuse for repeated entries
  - capacity and max-instance denial with audit records
  - movement services attach instance assignment metadata on success
- Verification:
  - capacity denial tests
  - instance placement tests by sector type
  - ship movement test verifying instance assignment propagation

### AC-009 Economic Anti-Abuse Controls
- Status: `verified`
- Goal: add idempotency, transfer anomaly detection, and suspicious credit/item movement auditability.
- Scope:
  - transfer ledger with idempotency keys and replay-safe result payloads
  - suspicious transfer flagging for large credit and commodity movement
  - controller passthrough for idempotency headers on trade and corporation treasury actions
- Verification:
  - duplicate purchase/request tests
  - suspicious transfer ledger tests

### AC-010 Raid Anti-Grief Rules
- Status: `verified`
- Goal: prevent repeated harassment loops through raids, offline abuse, and low-risk farming.
- Scope:
  - offline protection for inactive colony owners
  - per-colony raid cooldowns
  - repeated-attacker throttling with audit records
  - invasion-time authorization gate inside ground combat flow
- Verification:
  - raid cooldown tests
  - repeated-attacker throttling tests
  - offline protection tests

## Latest Verification

Verified on this pass with:

```bash
npm test -- --runInBand tests/services/sectorInstanceService.test.js tests/services/raidProtectionService.test.js tests/services/tradeService.test.js tests/services/corporationService.test.js tests/services/shipService.test.js tests/services/groundCombatService.test.js tests/integration/api.test.js
```

Result:
- `7` suites passed
- `115` tests passed

## Definition Of Ready For Sprint Features

Feature work that depends on PvP, portals, home sectors, instances, or raid pressure should not be marked ready until:
- `AC-001` is `verified`
- `AC-002` is `verified`
- `AC-003` is `verified`
- `AC-004` is `verified`

Additional required tasks by feature family:
- Home sectors: `AC-005`, `AC-007`
- Commercial portals and gates: `AC-005`, `AC-006`, `AC-007`
- Adventure sector instances: `AC-008`
- Raid ecology and clan systems: `AC-010`
- Store and economy expansion: `AC-009`
