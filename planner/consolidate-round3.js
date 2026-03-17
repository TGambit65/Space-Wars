#!/usr/bin/env node
/**
 * Consolidation Script - Round 3
 * Integrates 237 comments (Codex REVIEW, Codex PRD REWRITE, Copilot SPRINT NOTE)
 * into 79 features' summaries and PRDs, then creates 4 new anti-cheat features.
 */
const fs = require('fs');

// ────────────────────────────── helpers ──────────────────────────────

function readHTML() {
  return fs.readFileSync('index.html', 'utf8');
}

function extractPLAN(html) {
  const s = html.indexOf('const PLAN=[');
  const e = html.indexOf('];', s) + 2;
  const raw = html.substring(s, e);
  eval(raw.replace('const PLAN=', 'var PLAN='));
  return { PLAN, start: s, end: e };
}

function findFeature(PLAN, featureId) {
  for (const sec of PLAN) {
    for (const f of sec.features) {
      if (f.id === featureId) return f;
    }
  }
  return null;
}

// Find a <div class="modal-section"> block by its title text
function findSection(details, sectionTitle) {
  // The title appears as: <div class="modal-section-title">Title</div>
  // We need to find the enclosing modal-section div
  // Don't double-escape: if title already has &amp;, use as-is
  const escaped = sectionTitle.includes('&amp;') ? sectionTitle : sectionTitle.replace(/&/g, '&amp;');
  const marker = `modal-section-title">${escaped}</div>`;
  const idx = details.indexOf(marker);
  if (idx === -1) return null;

  // Walk backward to find the opening <div class="modal-section">
  const secOpen = details.lastIndexOf('<div class="modal-section">', idx);
  if (secOpen === -1) return null;

  // Walk forward to find the closing </div> of the modal-section
  // The structure is: <div class="modal-section">...<div class="modal-section-title">...</div>..content..</div>
  // We need to find the matching closing </div>
  let depth = 0;
  let pos = secOpen;
  while (pos < details.length) {
    const nextOpen = details.indexOf('<div', pos + 1);
    const nextClose = details.indexOf('</div>', pos + 1);
    if (nextClose === -1) break;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen;
    } else {
      if (depth === 0) {
        // This closing tag matches our opening
        return {
          start: secOpen,
          end: nextClose + 6,
          content: details.substring(secOpen, nextClose + 6)
        };
      }
      depth--;
      pos = nextClose;
    }
  }
  return null;
}

// ────────────────────────────── comment parsers ──────────────────────────────

function parseReview(text) {
  // Extract: complexity, gaps/what exists, corrected dependencies
  const result = { complexity: null, statusNote: null, dependencies: [] };

  // Complexity rating
  const cxMatch = text.match(/Complexity:\s*(Simple|Moderate|Complex|Massive|High)/i);
  if (cxMatch) result.complexity = cxMatch[1];

  // Dependencies
  const depMatch = text.match(/Dependencies?:\s*([^.]+)/i);
  if (depMatch) {
    result.dependencies = depMatch[1].split(/,\s*/).map(d => d.trim()).filter(Boolean);
  }

  // The full review text after "REVIEW: " is the status note
  result.statusNote = text.replace(/^REVIEW:\s*/i, '').trim();

  return result;
}

function parsePrdRewrite(text) {
  // Extract subsection names and content
  const cleaned = text.replace(/^PRD REWRITE:\s*/i, '').trim();

  // Try to extract named subsections - they follow patterns like:
  // "Add sections for X, Y, Z" or "Add X, Y, Z subsections" or "Add a X section that..."
  const subsections = [];

  // Pattern: "Add explicit subsections named X, Y, Z and W"
  // or "Add X, Y, Z, and W sections"
  // or "Add sections for X, Y, Z"
  // Just extract the whole cleaned text as subsection guidance
  subsections.push(cleaned);

  return { subsections, fullText: cleaned };
}

function parseSprintNote(text) {
  const cleaned = text.replace(/^SPRINT NOTE:\s*/i, '').trim();
  const result = { hotspots: [], sequencing: null, slipImpact: null, fullText: cleaned };

  // Hotspots
  const hotMatch = cleaned.match(/Hotspots?:\s*([^.]+)/i);
  if (hotMatch) {
    result.hotspots = hotMatch[1].split(/,\s*/).map(h => h.trim().replace(/`/g, '')).filter(Boolean);
  }

  // Sequencing: "Do not schedule it before X" or "Sequence it after X, Y"
  const seqMatch = cleaned.match(/(?:Do not schedule (?:it )?before|Sequence it after)\s+([^.]+)/i);
  if (seqMatch) {
    result.sequencing = seqMatch[1].trim().replace(/;.*$/, '').trim();
  }

  // Slip impact: "If it slips, it directly slows X, Y, Z"
  const slipMatch = cleaned.match(/If it slips,?\s*it directly slows\s+([^.]+)/i);
  if (slipMatch) {
    result.slipImpact = slipMatch[1].trim();
  }

  return result;
}

// ────────────────────────────── injection logic ──────────────────────────────

function injectIntoFunctionalReqs(details, prdRewrite) {
  const sec = findSection(details, 'Functional Requirements');
  if (!sec) return details;

  // Find closing </ol> or </ul> in the section
  const listEnd = sec.content.lastIndexOf('</ol>');
  const ulEnd = sec.content.lastIndexOf('</ul>');
  const closeTag = listEnd !== -1 ? '</ol>' : (ulEnd !== -1 ? '</ul>' : null);

  if (!closeTag) return details;

  const endIdx = sec.content.lastIndexOf(closeTag);
  const absEndIdx = sec.start + endIdx;

  // Create new <li> items from PRD rewrite subsections
  const newItems = `\n<li><strong>[Codex PRD Guidance]</strong> ${escapeHtml(prdRewrite.fullText)}</li>`;

  return details.substring(0, absEndIdx) + newItems + '\n' + details.substring(absEndIdx);
}

function injectIntoDependencies(details, review, sprint) {
  const sec = findSection(details, 'Dependencies');
  if (!sec) return details;

  const additions = [];

  // Add corrected dependencies from review
  if (review.dependencies.length > 0) {
    additions.push(`<li><strong>[Codex Review]</strong> Required dependencies: ${review.dependencies.join(', ')}</li>`);
  }

  // Add hotspots from sprint note
  if (sprint.hotspots.length > 0) {
    additions.push(`<li><strong>[Sprint Hotspots]</strong> Key files: ${sprint.hotspots.map(h => '<code>' + escapeHtml(h) + '</code>').join(', ')}</li>`);
  }

  // Add sequencing from sprint note
  if (sprint.sequencing) {
    additions.push(`<li><strong>[Sprint Sequencing]</strong> Must schedule after: ${escapeHtml(sprint.sequencing)}</li>`);
  }

  if (additions.length === 0) return details;

  // Check if deps section has a <ul> or <p> or <ol>
  if (sec.content.includes('<ul>')) {
    const ulClose = sec.content.lastIndexOf('</ul>');
    const absIdx = sec.start + ulClose;
    return details.substring(0, absIdx) + '\n' + additions.join('\n') + '\n' + details.substring(absIdx);
  } else if (sec.content.includes('<ol>')) {
    const olClose = sec.content.lastIndexOf('</ol>');
    const absIdx = sec.start + olClose;
    return details.substring(0, absIdx) + '\n' + additions.join('\n') + '\n' + details.substring(absIdx);
  } else {
    // It's a <p> - convert to <ul>
    const closeDiv = sec.content.lastIndexOf('</div>');
    const absIdx = sec.start + closeDiv;
    const newContent = '\n<ul>\n' + additions.join('\n') + '\n</ul>\n';
    return details.substring(0, absIdx) + newContent + details.substring(absIdx);
  }
}

function injectIntoRisks(details, sprint) {
  if (!sprint.slipImpact) return details;

  const sec = findSection(details, 'Risks &amp; Mitigations');
  if (!sec) return details;

  const newItem = `<li><strong>Risk:</strong> Sprint slip. <strong>Mitigation:</strong> Prioritize — if this slips, it directly slows ${escapeHtml(sprint.slipImpact)}.</li>`;

  if (sec.content.includes('<ul>')) {
    const ulClose = sec.content.lastIndexOf('</ul>');
    const absIdx = sec.start + ulClose;
    return details.substring(0, absIdx) + '\n' + newItem + '\n' + details.substring(absIdx);
  } else if (sec.content.includes('<ol>')) {
    const olClose = sec.content.lastIndexOf('</ol>');
    const absIdx = sec.start + olClose;
    return details.substring(0, absIdx) + '\n' + newItem + '\n' + details.substring(absIdx);
  } else {
    const closeDiv = sec.content.lastIndexOf('</div>');
    const absIdx = sec.start + closeDiv;
    return details.substring(0, absIdx) + '\n<ul>\n' + newItem + '\n</ul>\n' + details.substring(absIdx);
  }
}

function updateComplexity(details, review) {
  if (!review.complexity) return details;

  const sec = findSection(details, 'Complexity &amp; Estimate');
  if (!sec) return details;

  // Check if current complexity differs
  const currentCx = sec.content.match(/<strong>(Simple|Moderate|Complex|Massive|High)/i);
  if (currentCx && currentCx[1].toLowerCase() === review.complexity.toLowerCase()) return details;

  // Append complexity note
  const closeDiv = sec.content.lastIndexOf('</div>');
  const absIdx = sec.start + closeDiv;
  const note = `\n<p><em>[Codex Review] Revised complexity: <strong>${escapeHtml(review.complexity)}</strong></em></p>\n`;
  return details.substring(0, absIdx) + note + details.substring(absIdx);
}

function updatePurpose(details, review) {
  // Only add implementation status note
  const sec = findSection(details, 'Purpose');
  if (!sec) return details;

  // Add a brief status note from the review
  let statusBrief = '';
  if (review.statusNote.includes('not greenfield') || review.statusNote.includes('already exist') || review.statusNote.includes('already has')) {
    statusBrief = 'Partially implemented — hardening/integration work, not greenfield.';
  } else if (review.statusNote.includes('no dedicated') || review.statusNote.includes('no true') || review.statusNote.includes('not satisfied') || review.statusNote.includes('no ')) {
    statusBrief = 'Net-new system — requires full implementation.';
  } else if (review.statusNote.includes('partially implemented') || review.statusNote.includes('exists')) {
    statusBrief = 'Partially implemented — extends existing infrastructure.';
  } else {
    // Generic
    statusBrief = 'Implementation assessment complete — see Codex review for gaps.';
  }

  const closeDiv = sec.content.lastIndexOf('</div>');
  const absIdx = sec.start + closeDiv;
  const note = `\n<p><em>[Implementation Status] ${escapeHtml(statusBrief)}</em></p>\n`;
  return details.substring(0, absIdx) + note + details.substring(absIdx);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ────────────────────────────── desc update ──────────────────────────────

function shouldUpdateDesc(review) {
  return review.statusNote.includes('not greenfield') ||
         review.statusNote.includes('hardening') ||
         review.statusNote.includes('integration work') ||
         review.statusNote.includes('already partially');
}

function updateDesc(desc, review, sprint) {
  // If copilot says "hardening/integration work instead of a rewrite", note that
  if (sprint.fullText.includes('hardening/integration')) {
    if (!desc.includes('hardening')) {
      desc = desc.replace(/\.$/, '') + '. Sprint scope: hardening/integration of existing implementation, not a rewrite.';
    }
  }
  return desc;
}

// ────────────────────────────── PART 1: Process 237 comments ──────────────────────────────

function processPart1() {
  console.log('=== PART 1: Processing 237 comments into 79 features ===\n');

  let html = readHTML();
  const { PLAN, start, end } = extractPLAN(html);
  const comments = JSON.parse(fs.readFileSync('comments.json', 'utf8'));
  const featureIds = Object.keys(comments);

  let processed = 0;
  let descUpdated = 0;

  for (const featureId of featureIds) {
    const feature = findFeature(PLAN, featureId);
    if (!feature) {
      console.log(`  WARN: Feature ${featureId} not found in PLAN`);
      continue;
    }

    const cmts = comments[featureId];
    // Parse the 3 comments
    const reviewCmt = cmts.find(c => c.text.startsWith('REVIEW:'));
    const prdCmt = cmts.find(c => c.text.startsWith('PRD REWRITE:'));
    const sprintCmt = cmts.find(c => c.text.startsWith('SPRINT NOTE:'));

    if (!reviewCmt || !prdCmt || !sprintCmt) {
      console.log(`  WARN: Feature ${featureId} missing expected comment prefixes`);
      continue;
    }

    const review = parseReview(reviewCmt.text);
    const prdRewrite = parsePrdRewrite(prdCmt.text);
    const sprint = parseSprintNote(sprintCmt.text);

    // Update details (PRD)
    let details = feature.details;
    details = updatePurpose(details, review);
    details = injectIntoFunctionalReqs(details, prdRewrite);
    details = injectIntoDependencies(details, review, sprint);
    details = injectIntoRisks(details, sprint);
    details = updateComplexity(details, review);
    feature.details = details;

    // Optionally update desc
    if (shouldUpdateDesc(review) || sprint.fullText.includes('hardening/integration')) {
      feature.desc = updateDesc(feature.desc, review, sprint);
      descUpdated++;
    }

    processed++;
  }

  console.log(`  Processed: ${processed}/${featureIds.length} features`);
  console.log(`  Desc updated: ${descUpdated}`);

  return PLAN;
}

// ────────────────────────────── PART 2A: New anti-cheat features ──────────────────────────────

function createAntiCheatFeatures() {
  console.log('\n=== PART 2A: Creating new anti-cheat/moderation features ===\n');

  const newFeatures = [];

  // 1. anti-cheat-system
  newFeatures.push({
    id: 'anti-cheat-system',
    title: 'Unified Anti-Cheat & Anti-Exploit Architecture',
    status: 'new',
    desc: 'Centralized anti-cheat infrastructure consolidating device fingerprinting, alt-account detection, rate limiting, bot detection, trade-route abuse prevention, account-bound enforcement, combat idempotency, and reward journaling into one authoritative service layer.',
    tags: ['backend'],
    workflow: ['Device fingerprint service', 'Alt-account detection pipeline', 'Centralized rate-limit service', 'Bot detection engine', 'Trade-route margin degradation', 'Account-bound material enforcement', 'Combat replay verification', 'Reward idempotency journaling'],
    details: `<div class="modal-section"><div class="modal-section-title">Purpose</div><p>Consolidate scattered anti-cheat provisions from 56+ features into a single, authoritative anti-cheat service layer. Provides device fingerprinting (from pvp-rewards), trade-route abuse detection (from dynamic-pricing), bot detection, rate limiting, and reward integrity guarantees that all game systems can depend on.</p></div>
<div class="modal-section"><div class="modal-section-title">Functional Requirements</div><ol>
<li>DeviceFingerprintService: collect hardware ID, browser fingerprint, IP correlation; link to user accounts; flag multi-account clusters</li>
<li>AltAccountDetector: behavioral signal analysis (play-time overlap, trade patterns, identical configs), IP correlation, hardware ID matching; confidence scoring with human review queue</li>
<li>RateLimitService: centralized, configurable per-endpoint and per-tick rate limits; token bucket algorithm with Redis backing; graduated response (warn → throttle → temp-ban)</li>
<li>BotDetectionEngine: action-pattern analysis (click timing regularity, route optimization patterns), headless-client fingerprinting, CAPTCHA challenge triggers</li>
<li>TradeRouteAbuseDetector: margin degradation engine tracking per-player route profitability; diminishing returns on repeated identical routes; consolidates RouteUsageTracker from dynamic-pricing</li>
<li>Account-bound material enforcement: prevent cross-account transfers of bound items; server-side validation on all trade/transfer endpoints</li>
<li>CombatIdempotencyService: replay verification for combat results; detect duplicate combat submissions; cryptographic action signing</li>
<li>RewardJournalService: idempotency keys on all reward grants; append-only audit log; reconciliation jobs to detect anomalies</li>
<li>All detection events feed into action-audit for GM review</li>
<li>Configurable sensitivity thresholds via GameSetting (not hardcoded)</li>
</ol></div>
<div class="modal-section"><div class="modal-section-title">Data Model</div>
<table class="detail-table"><tr><th>Model/Column</th><th>Type</th><th>Notes</th></tr>
<tr><td>DeviceFingerprint</td><td>New Model</td><td>user_id FK, hardware_hash, browser_hash, ip_history JSONB, first_seen, last_seen, confidence_score</td></tr>
<tr><td>BehavioralSignal</td><td>New Model</td><td>user_id FK, signal_type ENUM, raw_data JSONB, score FLOAT, detected_at, resolved BOOLEAN</td></tr>
<tr><td>RateLimitPolicy</td><td>New Model</td><td>endpoint_key, bucket_size INT, refill_rate FLOAT, penalty_escalation JSONB</td></tr>
<tr><td>BotDetectionEvent</td><td>New Model</td><td>user_id FK, detection_type ENUM, evidence JSONB, action_taken ENUM, created_at</td></tr>
<tr><td>RewardJournal</td><td>New Model</td><td>idempotency_key UNIQUE, user_id FK, reward_type, quantity, source_action, granted_at</td></tr>
<tr><td>RouteUsageTracker</td><td>New Model</td><td>user_id FK, route_hash, usage_count INT, last_used, margin_multiplier FLOAT</td></tr>
</table></div>
<div class="modal-section"><div class="modal-section-title">API Surface</div><ul>
<li><code>Internal: AntiCheatService.validateAction(userId, actionType, context)</code> — called by all game endpoints</li>
<li><code>Internal: RateLimitService.check(userId, endpoint)</code> — middleware integration</li>
<li><code>Internal: RewardJournalService.grant(userId, rewardType, qty, idempotencyKey)</code></li>
<li><code>GET /api/admin/anti-cheat/alerts</code> — GM dashboard feed</li>
<li><code>POST /api/admin/anti-cheat/resolve/:alertId</code> — mark alert reviewed</li>
<li><code>GET /api/admin/anti-cheat/player/:userId</code> — full anti-cheat profile for a player</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">UX Specification</div><ul>
<li>No player-facing UI — all detection is server-side and invisible</li>
<li>GM admin panel: alerts list with severity, player profile with fingerprint history, bulk action tools</li>
<li>Rate limit responses return standard 429 with Retry-After header</li>
<li>Bot detection CAPTCHA challenge: minimal modal, does not interrupt legitimate play</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Dependencies</div><ul>
<li>action-audit (event ingestion for all detection signals)</li>
<li>job-queue (async detection pipelines, reconciliation jobs)</li>
<li>live-ops-observability (metrics on detection rates, false positives)</li>
<li>pvp-rewards (consolidates DeviceFingerprint model)</li>
<li>dynamic-pricing (consolidates RouteUsageTracker)</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Risks &amp; Mitigations</div><ul>
<li><strong>Risk:</strong> False positives ban legitimate players. <strong>Mitigation:</strong> All automated actions are soft (throttle/flag) — only GM-reviewed actions result in bans; confidence scoring with configurable thresholds.</li>
<li><strong>Risk:</strong> Fingerprinting blocked by privacy tools. <strong>Mitigation:</strong> Multiple signal layers (hardware, behavioral, IP); no single signal is decisive; graceful degradation.</li>
<li><strong>Risk:</strong> Performance overhead on hot paths. <strong>Mitigation:</strong> Rate limit checks are O(1) Redis lookups; behavioral analysis runs async via job queue; combat validation is lightweight hash comparison.</li>
<li><strong>Risk:</strong> Regulatory/privacy concerns with fingerprinting. <strong>Mitigation:</strong> Fingerprints are hashed, not raw data; retention policy with auto-expiry; compliant with ToS disclosure.</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Complexity &amp; Estimate</div><p><strong>Massive — 3-4 weeks. Touches every game endpoint (rate limiting middleware), combat service, reward grants, trading, and requires new detection infrastructure.</strong></p></div>
<div class="modal-section"><div class="modal-section-title">Acceptance Criteria</div><ol>
<li>All reward grants go through RewardJournalService with idempotency keys</li>
<li>Rate limiting active on all API endpoints with configurable per-endpoint policies</li>
<li>Device fingerprinting captures hardware + browser + IP signals on login</li>
<li>Alt-account clusters detected with >80% precision in test scenarios</li>
<li>Bot detection flags automated play patterns within 30 minutes of detection</li>
<li>Trade route margin degradation activates after configurable repeat threshold</li>
<li>GM dashboard shows all alerts with one-click investigation</li>
<li>Zero false-positive bans — all automated responses are soft (throttle/warn only)</li>
<li>All detection events appear in action-audit log</li>
</ol></div>`
  });

  // 2. moderation-tools
  newFeatures.push({
    id: 'moderation-tools',
    title: 'GM/Moderation Tooling',
    status: 'new',
    desc: 'Comprehensive GM and moderation dashboard providing player reporting, appeal/dispute workflows, penalty escalation, chat moderation, live spectate, bulk ban tools, and full audit trail integration.',
    tags: ['backend', 'frontend'],
    workflow: ['Player report system', 'Appeal/dispute workflow', 'GM dashboard', 'Chat moderation filters', 'Penalty escalation engine', 'Live spectate mode', 'Bulk action tools'],
    details: `<div class="modal-section"><div class="modal-section-title">Purpose</div><p>Provide game masters with a unified toolset for handling player reports, investigating violations, issuing penalties, moderating chat, and managing appeals. Consolidates moderation needs scattered across pvp-choke (appeal workflow), messaging (chat moderation), and community-events (player behavior) into one system.</p></div>
<div class="modal-section"><div class="modal-section-title">Functional Requirements</div><ol>
<li>Player Report System: in-game report button on player profiles, death screens, and chat; report categories: griefing, botting, exploiting, harassment, RMT; evidence attachment: combat log links, chat log references, screenshots</li>
<li>Appeal/Dispute Workflow: player submits appeal from account settings; GM reviews evidence, player history, anti-cheat signals; resolution options: dismiss, reduce penalty, overturn; notification to both reporter and reported player</li>
<li>GM Dashboard: search players by name/ID/IP, view full audit log, account history, anti-cheat profile; issue penalties directly; grant refunds or compensation; view active reports queue with priority scoring</li>
<li>Chat Moderation: configurable profanity filter with word lists and regex patterns; message flagging for GM review; player block lists (per-player and global); mute functionality with duration</li>
<li>Penalty Escalation: warning → mute (1h) → mute (24h) → temp ban (3d) → temp ban (7d) → perma ban; automatic escalation based on violation history; manual override for severity</li>
<li>Live Spectate Mode: GM can observe any player's session in real-time without their knowledge; read-only view of player actions, position, inventory; used for investigating active reports</li>
<li>Bulk Action Tools: select multiple players for batch penalties (ban waves); import/export ban lists; scheduled penalty execution</li>
<li>All moderation actions logged to action-audit with GM identity and justification</li>
</ol></div>
<div class="modal-section"><div class="modal-section-title">Data Model</div>
<table class="detail-table"><tr><th>Model/Column</th><th>Type</th><th>Notes</th></tr>
<tr><td>PlayerReport</td><td>New Model</td><td>reporter_id FK, reported_id FK, category ENUM, description TEXT, evidence JSONB, status ENUM(open/investigating/resolved/dismissed), priority INT, created_at</td></tr>
<tr><td>AppealCase</td><td>New Model</td><td>user_id FK, penalty_id FK, appeal_text TEXT, gm_response TEXT, status ENUM(pending/reviewing/resolved), resolution ENUM, created_at, resolved_at</td></tr>
<tr><td>ModerationAction</td><td>New Model</td><td>gm_id FK, target_id FK, action_type ENUM, severity INT, justification TEXT, expires_at, created_at</td></tr>
<tr><td>ChatFilter</td><td>New Model</td><td>pattern TEXT, filter_type ENUM(word/regex/phrase), action ENUM(block/flag/replace), active BOOLEAN</td></tr>
<tr><td>BanRecord</td><td>New Model</td><td>user_id FK, ban_type ENUM(mute/temp_ban/perma_ban), reason TEXT, issued_by FK, duration INT, expires_at, active BOOLEAN</td></tr>
</table></div>
<div class="modal-section"><div class="modal-section-title">API Surface</div><ul>
<li><code>POST /api/reports</code> — submit player report (authenticated)</li>
<li><code>GET /api/reports/mine</code> — player's submitted reports and their status</li>
<li><code>POST /api/appeals</code> — submit appeal (authenticated)</li>
<li><code>GET /api/admin/moderation/reports</code> — GM report queue with filters</li>
<li><code>POST /api/admin/moderation/action</code> — issue penalty</li>
<li><code>PUT /api/admin/moderation/appeal/:id</code> — resolve appeal</li>
<li><code>GET /api/admin/moderation/player/:id</code> — full player moderation profile</li>
<li><code>POST /api/admin/moderation/bulk-action</code> — batch penalties</li>
<li><code>GET /api/admin/moderation/spectate/:userId</code> — WebSocket spectate stream</li>
<li><code>CRUD /api/admin/moderation/chat-filters</code> — manage chat filter rules</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">UX Specification</div><ul>
<li>Player-facing: report button (flag icon) on player profiles and post-death screen; appeal form in account settings; notification bell for report resolution</li>
<li>GM dashboard: dedicated /admin/moderation route; report queue with priority badges; player search with autocomplete; one-click penalty shortcuts; evidence viewer with combat log replay</li>
<li>Chat moderation: real-time filter preview; filter test tool; flagged message review queue</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Dependencies</div><ul>
<li>action-audit (all moderation actions logged)</li>
<li>anti-cheat-system (anti-cheat signals feed into GM investigation view)</li>
<li>messaging (chat moderation integration)</li>
<li>socket (live spectate WebSocket stream)</li>
<li>notifications (report resolution notifications)</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Risks &amp; Mitigations</div><ul>
<li><strong>Risk:</strong> GM abuse of power. <strong>Mitigation:</strong> All GM actions audited with justification; senior GM review required for perma bans; action rate alerts for unusual GM activity.</li>
<li><strong>Risk:</strong> Report spam/abuse. <strong>Mitigation:</strong> Rate limit on reports per player; report credibility scoring based on history; false report penalties.</li>
<li><strong>Risk:</strong> Spectate mode privacy concerns. <strong>Mitigation:</strong> Spectate access restricted to senior GMs; all spectate sessions logged; auto-timeout after 30 minutes.</li>
<li><strong>Risk:</strong> Chat filter circumvention. <strong>Mitigation:</strong> Regex + phonetic matching + Levenshtein distance; community-reported additions; ML-based escalation for repeated offenders.</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Complexity &amp; Estimate</div><p><strong>Massive — 3 weeks. Full moderation workflow, GM dashboard, chat integration, spectate mode, and penalty system.</strong></p></div>
<div class="modal-section"><div class="modal-section-title">Acceptance Criteria</div><ol>
<li>Players can report others from profile and death screen with category and evidence</li>
<li>GM dashboard shows prioritized report queue with investigation tools</li>
<li>Penalty escalation automatically applies correct tier based on history</li>
<li>Appeals workflow: submit → review → resolve with notifications to both parties</li>
<li>Chat filter blocks/flags messages matching configured patterns</li>
<li>Live spectate shows real-time player actions for active investigations</li>
<li>All moderation actions appear in action-audit with GM identity</li>
<li>Bulk action processes 100+ players without timeout</li>
</ol></div>`
  });

  // 3. server-achievements
  newFeatures.push({
    id: 'server-achievements',
    title: 'Server-Authoritative Achievement System',
    status: 'new',
    desc: 'Server-side achievement state management replacing localStorage, with tamper-resistant unlock validation, event-driven progress tracking from action-audit, cross-device sync, and anti-fraud enforcement where the client is display-only.',
    tags: ['backend'],
    workflow: ['Achievement data model', 'Server-side unlock validation', 'Event ingestion from action-audit', 'Progress tracking service', 'Cross-device sync API', 'Client migration from localStorage'],
    details: `<div class="modal-section"><div class="modal-section-title">Purpose</div><p>Migrate achievements from client-side localStorage to a server-authoritative system where all unlock conditions are validated server-side, progress is tracked via action-audit events, and the client is display-only. Prevents achievement tampering and enables cross-device sync, leaderboards, and achievement-gated content.</p></div>
<div class="modal-section"><div class="modal-section-title">Functional Requirements</div><ol>
<li>Achievement model with definition (name, description, icon, category, rarity), unlock conditions (event type + threshold), and progress tracking</li>
<li>Server validates all unlock attempts — client never directly unlocks achievements</li>
<li>Event ingestion pipeline: action-audit events (kills, trades, exploration, colonies, crafting, missions) are matched against achievement conditions</li>
<li>Progress tracking: incremental achievements (e.g., "kill 100 pirates") maintain server-side counters</li>
<li>Cross-device sync: achievement state fetched on login, cached client-side, invalidated on new unlocks via WebSocket</li>
<li>Achievement categories: Combat, Trading, Exploration, Colonization, Social, Crafting, Missions, Special</li>
<li>Rarity tiers: Common, Uncommon, Rare, Epic, Legendary — based on global unlock percentage</li>
<li>Achievement-gated content: certain features/cosmetics require specific achievements</li>
<li>Migration path: one-time import of existing localStorage achievements with server-side re-validation</li>
<li>Anti-fraud: idempotent unlock processing, duplicate event filtering, rate limiting on progress updates</li>
</ol></div>
<div class="modal-section"><div class="modal-section-title">Data Model</div>
<table class="detail-table"><tr><th>Model/Column</th><th>Type</th><th>Notes</th></tr>
<tr><td>Achievement</td><td>New Model</td><td>key UNIQUE, name, description, icon, category ENUM, rarity ENUM, unlock_condition JSONB, points INT</td></tr>
<tr><td>AchievementProgress</td><td>New Model</td><td>user_id FK, achievement_id FK, current_count INT, target_count INT, updated_at</td></tr>
<tr><td>AchievementUnlock</td><td>New Model</td><td>user_id FK, achievement_id FK, unlocked_at, source_event_id FK (action-audit ref), verified BOOLEAN</td></tr>
</table></div>
<div class="modal-section"><div class="modal-section-title">API Surface</div><ul>
<li><code>GET /api/achievements</code> — list all achievement definitions</li>
<li><code>GET /api/achievements/mine</code> — player's progress and unlocks</li>
<li><code>GET /api/achievements/player/:id</code> — public achievement profile</li>
<li><code>POST /api/achievements/migrate</code> — one-time localStorage import with server re-validation</li>
<li><code>Internal: AchievementService.processEvent(userId, eventType, eventData)</code> — called by action-audit pipeline</li>
<li><code>WebSocket: achievement_unlocked event pushed on new unlock</code></li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">UX Specification</div><ul>
<li>Achievement notification toast on unlock (reuse existing notification system)</li>
<li>Achievement page: grid/list view with progress bars, filter by category, sort by rarity</li>
<li>Player profile: achievement showcase (pin up to 5 favorites)</li>
<li>Achievement comparison between players</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Dependencies</div><ul>
<li>action-audit (event source for all achievement triggers)</li>
<li>achievements-client (this provides the backend; client becomes display-only)</li>
<li>socket (real-time unlock notifications)</li>
<li>anti-cheat-system (idempotency and fraud prevention)</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Risks &amp; Mitigations</div><ul>
<li><strong>Risk:</strong> Event processing lag causes delayed unlocks. <strong>Mitigation:</strong> Direct event processing for common achievements; async batch processing for complex multi-condition achievements.</li>
<li><strong>Risk:</strong> localStorage migration imports fraudulent achievements. <strong>Mitigation:</strong> Server re-validates all imported achievements against action-audit history; unverifiable imports marked as "legacy" tier.</li>
<li><strong>Risk:</strong> Achievement condition changes invalidate existing unlocks. <strong>Mitigation:</strong> Unlocks are permanent once granted; condition changes only affect future unlocks; versioned achievement definitions.</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Complexity &amp; Estimate</div><p><strong>Complex — 2 weeks. Achievement model, event processing pipeline, migration path, and anti-fraud layer.</strong></p></div>
<div class="modal-section"><div class="modal-section-title">Acceptance Criteria</div><ol>
<li>All achievement unlocks validated server-side — client requests are rejected</li>
<li>Action-audit events trigger achievement progress updates within 5 seconds</li>
<li>Cross-device: unlock on device A visible on device B after re-login</li>
<li>localStorage migration imports and re-validates existing achievements</li>
<li>Achievement progress persists across sessions without client storage</li>
<li>Duplicate events do not double-count progress</li>
<li>Achievement rarity dynamically calculated from global unlock percentages</li>
</ol></div>`
  });

  // 4. reporting-appeals (merged into moderation-tools scope, but kept as dedicated player-facing feature)
  newFeatures.push({
    id: 'reporting-appeals',
    title: 'Player Reporting & Appeal System',
    status: 'new',
    desc: 'Player-facing reporting and appeals interface: in-game report buttons on profiles and death screens, categorized reports with evidence attachment, appeal submission from account settings, resolution notifications, and GM priority queue integration.',
    tags: ['frontend', 'backend'],
    workflow: ['Report UI on profiles/death screen', 'Report category & evidence forms', 'Appeal submission flow', 'GM priority queue integration', 'Resolution notifications', 'Report credibility scoring'],
    details: `<div class="modal-section"><div class="modal-section-title">Purpose</div><p>Provide the player-facing half of the moderation system: intuitive reporting UI, structured evidence collection, appeal submission, and transparent resolution communication. Works in tandem with moderation-tools (GM-facing) to create a complete moderation loop.</p></div>
<div class="modal-section"><div class="modal-section-title">Functional Requirements</div><ol>
<li>In-game report button on player profiles (flag icon) and post-death/combat-loss screen</li>
<li>Report categories: griefing, botting, exploiting, harassment, RMT (real-money trading), other</li>
<li>Evidence attachment: automatic combat log link for combat-related reports; chat log references for harassment; free-text description field</li>
<li>Report submission confirmation with tracking ID</li>
<li>Appeal submission from account settings page when player has active penalty</li>
<li>Appeal form: select penalty, write appeal text, attach supporting evidence</li>
<li>Resolution notifications: in-app notification when report is resolved or appeal decided</li>
<li>Report history: player can view their submitted reports and status (open/investigating/resolved/dismissed)</li>
<li>Credibility scoring: reporters with high accuracy get reports prioritized; false reporters get deprioritized</li>
<li>Rate limiting: max 5 reports per hour per player to prevent abuse</li>
</ol></div>
<div class="modal-section"><div class="modal-section-title">Data Model</div>
<table class="detail-table"><tr><th>Model/Column</th><th>Type</th><th>Notes</th></tr>
<tr><td>PlayerReport</td><td>Shared w/ moderation-tools</td><td>reporter_id, reported_id, category, description, evidence JSONB, status, priority, tracking_id UUID, created_at</td></tr>
<tr><td>ReportEvidence</td><td>New Model</td><td>report_id FK, evidence_type ENUM(combat_log/chat_log/screenshot/text), reference_id, content TEXT</td></tr>
<tr><td>AppealCase</td><td>Shared w/ moderation-tools</td><td>user_id, penalty_id, appeal_text, status, resolution, created_at</td></tr>
<tr><td>ResolutionRecord</td><td>New Model</td><td>case_id FK, resolution_type ENUM, notification_sent BOOLEAN, resolved_by FK, resolved_at</td></tr>
</table></div>
<div class="modal-section"><div class="modal-section-title">API Surface</div><ul>
<li><code>POST /api/reports</code> — submit report with category and evidence</li>
<li><code>GET /api/reports/mine</code> — player's report history with status</li>
<li><code>POST /api/appeals</code> — submit appeal for active penalty</li>
<li><code>GET /api/appeals/mine</code> — player's appeal history</li>
<li><code>GET /api/penalties/mine</code> — player's active and historical penalties</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">UX Specification</div><ul>
<li>Report button: small flag icon on player profile cards and combat result screen; opens modal with category selector and evidence form</li>
<li>Report confirmation: toast with tracking ID and estimated review time</li>
<li>Appeal form: accessible from account settings → "Penalties" tab; shows penalty details and appeal form</li>
<li>Notification: bell icon badge for report/appeal resolution; notification details page</li>
<li>Report history: table view with status badges (open=yellow, investigating=blue, resolved=green, dismissed=gray)</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Dependencies</div><ul>
<li>moderation-tools (GM-facing counterpart; shared data models)</li>
<li>notifications (resolution notifications)</li>
<li>messaging (chat log evidence extraction)</li>
<li>anti-cheat-system (report credibility feeds into anti-cheat signals)</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Risks &amp; Mitigations</div><ul>
<li><strong>Risk:</strong> Report spam overwhelming GM queue. <strong>Mitigation:</strong> Rate limiting (5/hour), credibility scoring, auto-deprioritize low-credibility reporters.</li>
<li><strong>Risk:</strong> Weaponized reporting (false reports to harass players). <strong>Mitigation:</strong> False report tracking; penalty for chronic false reporters; GM sees reporter history.</li>
<li><strong>Risk:</strong> Appeal backlog creates player frustration. <strong>Mitigation:</strong> SLA tracking on appeal response times; escalation to senior GM after 48h; transparent status updates.</li>
</ul></div>
<div class="modal-section"><div class="modal-section-title">Complexity &amp; Estimate</div><p><strong>Moderate — 1.5 weeks. Player-facing UI and API; data models shared with moderation-tools.</strong></p></div>
<div class="modal-section"><div class="modal-section-title">Acceptance Criteria</div><ol>
<li>Report button visible on all player profiles and post-combat screens</li>
<li>Reports include category, description, and auto-attached combat/chat logs</li>
<li>Player receives tracking ID on report submission</li>
<li>Appeal form accessible for players with active penalties</li>
<li>Resolution notifications delivered within 1 minute of GM action</li>
<li>Report history shows accurate status for all submitted reports</li>
<li>Rate limiting prevents more than 5 reports per hour per player</li>
</ol></div>`
  });

  return newFeatures;
}

// ────────────────────────────── PART 2B: Cross-references ──────────────────────────────

function updateCrossReferences(PLAN) {
  console.log('\n=== PART 2B: Updating cross-references ===\n');

  const crossRefs = {
    'pvp-rewards': { dep: 'anti-cheat-system', note: 'DeviceFingerprint model consolidated into anti-cheat-system' },
    'pvp-choke': { dep: 'moderation-tools', note: 'Appeal workflow provided by moderation-tools' },
    'dynamic-pricing': { dep: 'anti-cheat-system', note: 'RouteUsageTracker consolidated into anti-cheat-system' },
    'achievements-client': { dep: 'server-achievements', note: 'Server-authoritative backend provided by server-achievements; client becomes display-only' },
    'messaging': { dep: 'moderation-tools', note: 'Chat moderation provided by moderation-tools' },
  };

  let updated = 0;

  for (const sec of PLAN) {
    for (const f of sec.features) {
      const ref = crossRefs[f.id];
      if (!ref) continue;

      const depSec = findSection(f.details, 'Dependencies');
      if (!depSec) continue;

      const newItem = `<li><strong>[Cross-ref]</strong> ${escapeHtml(ref.note)} — depends on <code>${escapeHtml(ref.dep)}</code></li>`;

      if (depSec.content.includes('<ul>')) {
        const ulClose = depSec.content.lastIndexOf('</ul>');
        const absIdx = depSec.start + ulClose;
        f.details = f.details.substring(0, absIdx) + '\n' + newItem + '\n' + f.details.substring(absIdx);
      } else if (depSec.content.includes('<ol>')) {
        const olClose = depSec.content.lastIndexOf('</ol>');
        const absIdx = depSec.start + olClose;
        f.details = f.details.substring(0, absIdx) + '\n' + newItem + '\n' + f.details.substring(absIdx);
      } else {
        const closeDiv = depSec.content.lastIndexOf('</div>');
        const absIdx = depSec.start + closeDiv;
        f.details = f.details.substring(0, absIdx) + '\n<ul>\n' + newItem + '\n</ul>\n' + f.details.substring(absIdx);
      }
      console.log(`  Updated cross-ref: ${f.id} → ${ref.dep}`);
      updated++;
    }
  }
  console.log(`  Total cross-refs updated: ${updated}`);
}

// ────────────────────────────── PLAN serializer ──────────────────────────────

function serializePLAN(PLAN, originalHTML) {
  // Extract original section comments from the HTML
  const sectionComments = {};
  const commentRe = /\/\/ ============ (.+?) ============\s*\n\{id:'([^']+)'/g;
  let cm;
  while ((cm = commentRe.exec(originalHTML)) !== null) {
    sectionComments[cm[2]] = cm[1];
  }

  function sq(str) {
    // Single-quote string, matching original format
    return "'" + str.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }

  function sqArr(arr) {
    return '[' + arr.map(sq).join(',') + ']';
  }

  let lines = ['const PLAN=['];

  for (let si = 0; si < PLAN.length; si++) {
    const sec = PLAN[si];
    const comment = sectionComments[sec.id] || sec.title.toUpperCase();

    lines.push(`// ============ ${comment} ============`);
    lines.push(`{id:${sq(sec.id)},title:${sq(sec.title)},status:${sq(sec.status)},features:[`);

    for (let fi = 0; fi < sec.features.length; fi++) {
      const f = sec.features[fi];
      const comma = fi < sec.features.length - 1 ? ',' : '';

      let fStr = `{id:${sq(f.id)},title:${sq(f.title)},status:${sq(f.status)},\n`;
      fStr += `  desc:${sq(f.desc || '')},\n`;
      fStr += `  tags:${sqArr(f.tags || [])},\n`;
      fStr += `  workflow:${sqArr(f.workflow || [])},\n`;
      fStr += `  details:\`${(f.details || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`}${comma}`;
      lines.push(fStr);
    }

    const secComma = si < PLAN.length - 1 ? ',' : '';
    lines.push(`]}${secComma}`);
  }

  lines.push('];');
  return lines.join('\n');
}

// ────────────────────────────── Export JSON ──────────────────────────────

function generateExportJSON(PLAN) {
  console.log('\n=== Generating export JSON ===\n');

  const exportData = {
    meta: {
      title: 'Space Wars 3000 - Complete Game Design Document',
      version: '2.2',
      exported_at: new Date().toISOString(),
      total_sections: PLAN.length,
      total_features: PLAN.reduce((a, s) => a + s.features.length, 0),
      tech_stack: {
        backend: 'Node.js/Express + Sequelize + PostgreSQL',
        frontend: 'React 18 + Vite + TailwindCSS + Three.js',
        realtime: 'Socket.io',
        testing: 'Jest + SQLite in-memory',
        dev_db: 'PostgreSQL (SQLite for quick dev only)'
      },
      reviews_applied: [
        'Phase 1: Codex + Droid + Gemini (249 comments)',
        'Phase 2: Deeptink review',
        'Phase 3: 5.4 PRO review fixes',
        'Phase 4: Codex REVIEW + PRD REWRITE + Copilot SPRINT NOTE (237 comments)',
        'Phase 5: Anti-cheat/moderation feature consolidation'
      ]
    },
    sections: PLAN.map(sec => ({
      id: sec.id,
      title: sec.title,
      status: sec.status,
      feature_count: sec.features.length,
      features: sec.features.map(f => {
        // Parse details HTML into structured sections
        const sections = {};
        const sectionNames = ['Purpose', 'Functional Requirements', 'Data Model', 'API Surface',
          'UX Specification', 'Dependencies', 'Risks & Mitigations', 'Complexity & Estimate', 'Acceptance Criteria'];

        for (const name of sectionNames) {
          const sec = findSection(f.details, name);
          if (sec) {
            // Strip HTML tags for plain text
            let text = sec.content
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            sections[name.toLowerCase().replace(/[& ]+/g, '_')] = text;
          }
        }

        return {
          id: f.id,
          title: f.title,
          status: f.status,
          description: f.desc,
          tags: f.tags,
          workflow: f.workflow,
          prd: sections
        };
      })
    }))
  };

  fs.writeFileSync('spacewars-plan-export.json', JSON.stringify(exportData, null, 2));
  console.log(`  Exported ${exportData.meta.total_features} features to spacewars-plan-export.json`);
}

// ────────────────────────────── MAIN ──────────────────────────────

function main() {
  console.log('Consolidation Script - Round 3');
  console.log('==============================\n');

  // PART 1: Process 237 comments
  const PLAN = processPart1();

  // PART 2A: Create new anti-cheat features
  const newFeatures = createAntiCheatFeatures();

  // Add new features to Section 16 (Scaling & Operations)
  const sec16 = PLAN.find(s => s.id === 'ops' || s.title.includes('Scaling'));
  if (sec16) {
    for (const f of newFeatures) {
      sec16.features.push(f);
      console.log(`  Added new feature: ${f.id} → Section 16`);
    }
  } else {
    console.log('  ERROR: Section 16 not found');
    return;
  }

  // PART 2B: Cross-references
  updateCrossReferences(PLAN);

  // Serialize PLAN back to HTML
  console.log('\n=== Serializing updated PLAN ===\n');
  const html = readHTML();
  const planStart = html.indexOf('const PLAN=[');
  const planEnd = html.indexOf('];', planStart) + 2;

  const newPlanStr = serializePLAN(PLAN, html);
  const newHTML = html.substring(0, planStart) + newPlanStr + html.substring(planEnd);

  fs.writeFileSync('index.html', newHTML);
  console.log('  Written updated index.html');

  // Clear comments
  fs.writeFileSync('comments.json', '{}');
  console.log('  Cleared comments.json');

  // Generate export JSON
  generateExportJSON(PLAN);

  // Verify
  console.log('\n=== Verification ===\n');
  const verifyHTML = fs.readFileSync('index.html', 'utf8');
  const vs = verifyHTML.indexOf('const PLAN=[');
  const ve = verifyHTML.indexOf('];', vs) + 2;
  try {
    eval(verifyHTML.substring(vs, ve).replace('const PLAN=', 'var VP='));
    const totalFeatures = VP.reduce((a, s) => a + s.features.length, 0);
    console.log(`  OK: ${totalFeatures} features across ${VP.length} sections`);
    VP.forEach(s => console.log(`    ${s.title}: ${s.features.length} features`));

    if (totalFeatures !== 83) {
      console.log(`  WARN: Expected 83 features, got ${totalFeatures}`);
    }

    // Spot-check 10 features for comment integration
    console.log('\n  Spot-checking 10 features for Codex/Copilot integration...');
    const checkIds = ['sector-zones', 'pvp-rewards', 'dynamic-pricing', 'colonization', 'corporations',
      'achievements-client', 'messaging', 'galaxy-map', 'action-audit', 'discovery-fog'];
    for (const id of checkIds) {
      const f = VP.flatMap(s => s.features).find(f => f.id === id);
      if (!f) { console.log(`    FAIL: ${id} not found`); continue; }
      const hasCodex = f.details.includes('[Codex');
      const hasSprint = f.details.includes('[Sprint');
      const hasStatus = f.details.includes('[Implementation Status]');
      console.log(`    ${id}: Codex=${hasCodex} Sprint=${hasSprint} Status=${hasStatus}`);
    }

    // Check new features have all 9 sections
    console.log('\n  Checking new features for completeness...');
    const newIds = ['anti-cheat-system', 'moderation-tools', 'server-achievements', 'reporting-appeals'];
    for (const id of newIds) {
      const f = VP.flatMap(s => s.features).find(f => f.id === id);
      if (!f) { console.log(`    FAIL: ${id} not found`); continue; }
      const titles = (f.details || '').match(/modal-section-title">([^<]+)/g);
      console.log(`    ${id}: ${titles ? titles.length : 0} PRD sections`);
    }
  } catch (e) {
    console.log('  FAIL: PLAN parse error:', e.message);
  }
}

main();
