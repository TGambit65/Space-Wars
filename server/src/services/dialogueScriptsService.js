/**
 * All scripted NPC dialogue responses. Each function receives:
 *   @param {Object} npc - NPC model instance (with ai_personality JSON)
 *   @param {Object} context - { portCommodities?, sectorInfo?, adjacentSectors?, recentEvents? }
 * and returns: { text: string, data?: Object }
 *
 * Speech style variations are applied by wrapping final text through stylize().
 */

// ─── Speech Style Variation ────────────────────────────────────────

const greetingPrefixes = {
  formal: ['Greetings.', 'Good day.', 'Well met.'],
  pirate_slang: ['Ahoy!', 'Yarr!', "Oi, what've we here?"],
  military: ['Attention.', 'Hail, civilian.', 'State your business.'],
  merchant_polite: ['Welcome, friend!', 'Ah, a customer!', 'Good to see you!'],
  threatening: ['Don\'t move.', 'You\'re in my space.', 'Choose your next words carefully.'],
  cryptic: ['The stars align...', 'Interesting...', 'I was expecting you.']
};

const farewellPhrases = {
  formal: ['Safe travels.', 'Until next time.', 'Farewell.'],
  pirate_slang: ['Fair winds, ye scallywag!', "Off with ye now!", "Don't let the void bite ye!"],
  military: ['Dismissed.', 'Carry on.', 'Stay out of trouble.'],
  merchant_polite: ['Come back anytime!', 'Pleasure doing business!', 'Travel safe, friend!'],
  threatening: ['Get lost.', 'Next time, bring credits.', "Don't test your luck."],
  cryptic: ['The void watches...', 'We shall meet again.', 'Go... while you can.']
};

/**
 * Pick a random element from an array.
 */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Get the speech style from an NPC's personality.
 */
const getStyle = (npc) => {
  const personality = npc.ai_personality || {};
  return personality.speech_style || 'formal';
};

/**
 * Get a style-appropriate greeting prefix.
 */
const greetPrefix = (npc) => {
  const style = getStyle(npc);
  return pick(greetingPrefixes[style] || greetingPrefixes.formal);
};

/**
 * Get a style-appropriate farewell.
 */
const farewellText = (npc) => {
  const style = getStyle(npc);
  return pick(farewellPhrases[style] || farewellPhrases.formal);
};

// ─── Trader Scripts ────────────────────────────────────────────────

const FACTION_NAMES = {
  terran_alliance: 'Terran Alliance',
  zythian_swarm: 'Zythian Swarm',
  automaton_collective: 'Automaton Collective',
  synthesis_accord: 'Synthesis Accord',
  sylvari_dominion: 'Sylvari Dominion'
};

const traderScripts = {
  greet: (npc, context) => {
    const factionTag = npc.faction ? `, representing the ${FACTION_NAMES[npc.faction]}` : '';
    const variants = [
      `${greetPrefix(npc)} I'm ${npc.name}${factionTag}, and I've got goods to move. Looking to trade?`,
      `${greetPrefix(npc)} ${npc.name} at your service${factionTag}. My hold's full of merchandise — interested?`,
      `${greetPrefix(npc)} They call me ${npc.name}. You look like someone who knows a good deal when they see one.`
    ];
    return { text: pick(variants) };
  },

  buy: (npc) => {
    const variants = [
      "Let's see what you're looking to buy. Take a look at my stock.",
      "Browsing my wares? Smart move — I've got the best prices in this sector.",
      "You want to buy? I like a customer who knows what they want."
    ];
    return { text: pick(variants), data: { action: 'open_trade_ui', mode: 'buy' } };
  },

  sell: (npc) => {
    const variants = [
      "Got cargo to unload? I'm always buying.",
      "Selling, eh? Let me see what you've got in your hold.",
      "I'll take a look at your goods. Fair prices, I promise."
    ];
    return { text: pick(variants), data: { action: 'open_trade_ui', mode: 'sell' } };
  },

  ask_rumors: (npc, context) => {
    const rumors = [];

    // Contextual rumors based on adjacent sector data
    const dangerousSectors = (context.adjacentSectors || []).filter(s => s.hostileCount > 0);
    if (dangerousSectors.length > 0) {
      const s = pick(dangerousSectors);
      rumors.push(`Word is ${s.name} has pirates lurking about. ${s.hostileCount} hostile${s.hostileCount > 1 ? 's' : ''} last I heard.`);
    }

    const portSectors = (context.adjacentSectors || []).filter(s => s.hasPort);
    if (portSectors.length > 0) {
      const s = pick(portSectors);
      rumors.push(`There's a port in ${s.name}. Might be worth checking their prices.`);
    }

    // Generic rumors as fallback
    rumors.push(
      "I heard there's a derelict freighter drifting near the outer sectors. Salvage for the taking, if you're brave enough.",
      "Patrol activity has been picking up lately. Someone must have upset the authorities.",
      "A trader I know found rare minerals three jumps spinward. Prices were through the roof.",
      "Watch out for bounty hunters in this region. They don't ask questions.",
      "The black market's been busy. Demand for contraband is sky-high."
    );

    return { text: pick(rumors) };
  },

  ask_prices: (npc, context) => {
    if (context.portCommodities && context.portCommodities.length > 0) {
      const items = context.portCommodities.slice(0, 4);
      const priceList = items.map(pc =>
        `${pc.commodity_name}: ${pc.buy_price || '—'}cr buy / ${pc.sell_price || '—'}cr sell`
      ).join('. ');
      return { text: `Current prices at this port: ${priceList}. Anything catch your eye?` };
    }

    const variants = [
      "I'd tell you the prices, but we're not at a port right now. Find a trading hub and I can help.",
      "Prices change by the hour. Dock at a port and you'll see the current rates.",
      "Can't quote you anything out here in open space. Head to the nearest port."
    ];
    return { text: pick(variants) };
  },

  ask_routes: (npc, context) => {
    const portSectors = (context.adjacentSectors || []).filter(s => s.hasPort);
    if (portSectors.length >= 2) {
      const a = portSectors[0];
      const b = portSectors[1];
      return { text: `I'd suggest running cargo between ${a.name} and ${b.name}. Both have ports, and the price differences should turn a profit.` };
    }
    if (portSectors.length === 1) {
      return { text: `There's a port in ${portSectors[0].name}. Start there and work outward — trade routes build themselves once you know the sector.` };
    }

    const variants = [
      "Not many ports nearby, I'm afraid. You might need to range further to find good routes.",
      "Trade's thin in this region. Try heading toward the core — more stations, more opportunity.",
      "Best advice I can give: buy low at mining outposts, sell high at tech centers. Classic route."
    ];
    return { text: pick(variants) };
  },

  farewell: (npc) => {
    return { text: `${farewellText(npc)} — ${npc.name}` };
  }
};

// ─── Patrol Scripts ────────────────────────────────────────────────

const patrolScripts = {
  greet: (npc, context) => {
    const factionTag = npc.faction ? ` ${FACTION_NAMES[npc.faction]}` : '';
    const variants = [
      `${greetPrefix(npc)} This is ${npc.name},${factionTag} sector patrol. Everything in order here?`,
      `${greetPrefix(npc)} ${npc.name},${factionTag} patrol on duty. You're cleared to proceed — for now.`,
      `${greetPrefix(npc)} I'm ${npc.name}. I keep the peace in these parts${npc.faction ? ` on behalf of the ${FACTION_NAMES[npc.faction]}` : ''}. Need something?`
    ];
    return { text: pick(variants) };
  },

  report_crime: (npc) => {
    const variants = [
      "Noted. I'll increase patrols in this area. Stay alert, and don't take matters into your own hands.",
      "Crime report logged. We'll look into it. If you see the suspect again, keep your distance.",
      "Acknowledged. Can't promise immediate action — we're stretched thin — but we'll investigate."
    ];
    return { text: pick(variants), data: { action: 'report_crime' } };
  },

  ask_safety: (npc, context) => {
    const hostileCount = (context.adjacentSectors || []).reduce((sum, s) => sum + (s.hostileCount || 0), 0);
    const currentHostiles = (context.sectorInfo || {}).hostileCount || 0;

    if (currentHostiles > 0) {
      return { text: `This sector has ${currentHostiles} hostile contact${currentHostiles > 1 ? 's' : ''} on my scanners. Stay sharp and keep your shields up.` };
    }
    if (hostileCount > 0) {
      return { text: `Current sector reads clear, but adjacent sectors show ${hostileCount} hostile contact${hostileCount > 1 ? 's' : ''} nearby. Watch your approach vectors.` };
    }

    const variants = [
      "Sector reads clean. No hostile contacts on my scopes. Should be safe to proceed.",
      "All clear in this area. I've been running patrols and nothing's turned up.",
      "Low threat level here. But don't get complacent — things change fast in deep space."
    ];
    return { text: pick(variants) };
  },

  ask_bounties: (npc, context) => {
    const dangerousSectors = (context.adjacentSectors || []).filter(s => s.hostileCount > 0);
    if (dangerousSectors.length > 0) {
      const targets = dangerousSectors.map(s => ({
        sector_name: s.name, sector_id: s.sector_id, hostile_count: s.hostileCount
      }));
      const targetStr = dangerousSectors.map(s => `${s.name} (${s.hostileCount} hostiles)`).join(', ');
      const rewardCredits = 500 + Math.floor(Math.random() * 1000);
      return {
        text: `Known hostile activity in: ${targetStr}. Take them out and I'll authorize a ${rewardCredits} credit bounty for you.`,
        data: { action: 'bounty_info', targets, create_mission: true, reward_credits: rewardCredits }
      };
    }

    const variants = [
      "No active bounties in this area that I'm aware of. Check back after we get some trouble.",
      "Things have been quiet lately. No outstanding warrants on my board.",
      "Nothing on the bounty board right now. But pirates always show up eventually."
    ];
    return { text: pick(variants) };
  },

  request_escort: (npc) => {
    const sectors = 3 + Math.floor(Math.random() * 4);
    const rewardCredits = 300 + Math.floor(Math.random() * 500);
    const variants = [
      `Can't escort you personally, but I can authorize a patrol sweep. Visit ${sectors} sectors and report back — ${rewardCredits} credits for your trouble.`,
      `Escort duty isn't in my mandate, but how about this: patrol ${sectors} sectors nearby and I'll see you get ${rewardCredits} credits. Deal?`,
      `I'm stuck on post, but I need someone to cover my sector sweep. ${sectors} sectors, ${rewardCredits} credits. Interested?`
    ];
    return { text: pick(variants), data: { action: 'patrol_mission_offer', sectors, reward_credits: rewardCredits } };
  },

  farewell: (npc) => {
    return { text: `${farewellText(npc)} — ${npc.name}, signing off.` };
  }
};

// ─── Bounty Hunter Scripts ─────────────────────────────────────────

const bountyHunterScripts = {
  greet: (npc) => {
    const variants = [
      `${greetPrefix(npc)} ${npc.name}. I hunt things. You're not on my list... yet.`,
      `${greetPrefix(npc)} Name's ${npc.name}. Make it quick — I've got targets to track.`,
      `${greetPrefix(npc)} ${npc.name}, bounty hunter. You looking for trouble, or looking to cause some?`
    ];
    return { text: pick(variants) };
  },

  ask_targets: (npc, context) => {
    const hostileSectors = (context.adjacentSectors || []).filter(s => s.hostileCount > 0);
    if (hostileSectors.length > 0) {
      const s = pick(hostileSectors);
      return { text: `I've been tracking contacts in ${s.name}. ${s.hostileCount} hostiles — good pickings if you've got the firepower.` };
    }

    const variants = [
      "Slim pickings around here. The real bounties are deeper in pirate territory.",
      "Nothing worth my time in this sector. I'm waiting for bigger fish.",
      "No marks nearby. But give it time — scum always floats to the surface."
    ];
    return { text: pick(variants) };
  },

  offer_contract: (npc, context) => {
    const kills = 1 + Math.floor(Math.random() * 3);
    const rewardCredits = 800 + Math.floor(Math.random() * 1200);
    const dangerousSectors = (context.adjacentSectors || []).filter(s => s.hostileCount > 0);
    const sectorHint = dangerousSectors.length > 0
      ? ` I know there are targets in ${dangerousSectors[0].name}.`
      : '';

    const variants = [
      `I'll take a contract from you. ${kills} kill${kills > 1 ? 's' : ''}, ${rewardCredits} credits on completion.${sectorHint} Say the word and it's done.`,
      `Alright, here's the deal: I need ${kills} confirmed kill${kills > 1 ? 's' : ''}. Reward is ${rewardCredits} credits.${sectorHint} Accept?`,
      `${kills} hostile${kills > 1 ? 's' : ''} eliminated, ${rewardCredits} credits in your pocket.${sectorHint} Standard terms. Want in?`
    ];
    return { text: pick(variants), data: { action: 'accept_contract', kills, reward_credits: rewardCredits } };
  },

  ask_price: (npc) => {
    const baseRate = 500 + Math.floor(Math.random() * 500);
    const variants = [
      `My standard rate is ${baseRate} credits per confirmed kill. Negotiable for bulk work.`,
      `${baseRate} credits gets you my gun for one job. Take it or leave it.`,
      `For a standard bounty, I charge ${baseRate} credits. Hazard pay extra.`
    ];
    return { text: pick(variants), data: { action: 'price_quote', rate: baseRate } };
  },

  threaten: (npc) => {
    const personality = npc.ai_personality || {};
    if (personality.trait_primary === 'cowardly') {
      return { text: "Hey, let's not get hasty here. I'm sure we can work something out..." };
    }

    const variants = [
      "You're making a mistake. I've put down bigger threats than you before breakfast.",
      "Threats? From you? That's amusing. I suggest you rethink your approach.",
      "Keep talking. Every word brings you closer to my bounty board."
    ];
    return { text: pick(variants) };
  },

  farewell: (npc) => {
    return { text: `${farewellText(npc)} Watch your back out there.` };
  }
};

// ─── Pirate / Pirate Lord Scripts ──────────────────────────────────

const pirateScripts = {
  plead: (npc) => {
    const variants = [
      "Begging? Ha! That's music to my ears. But your credits speak louder than your words.",
      "Save your breath. Unless you've got something valuable, pleading won't help you.",
      "Pathetic. But I'll tell you what — make me an offer and maybe I'll let you go."
    ];
    return { text: pick(variants) };
  },

  bribe: (npc) => {
    const personality = npc.ai_personality || {};
    const isGreedy = personality.trait_primary === 'greedy';
    const amount = isGreedy
      ? 300 + Math.floor(Math.random() * 400)
      : 100 + Math.floor(Math.random() * 200);

    if (isGreedy) {
      return { text: `Credits, eh? Now you're speaking my language. ${amount} credits and I might forget I saw you. Might.`, data: { bribe_amount: amount, bribe_accepted: true } };
    }

    const roll = Math.random();
    if (roll < 0.6) {
      return { text: `${amount} credits and we never met. Deal?`, data: { bribe_amount: amount, bribe_accepted: true } };
    }
    return { text: "Keep your credits. I'd rather have your cargo. All of it.", data: { bribe_accepted: false } };
  },

  threaten_back: (npc) => {
    const personality = npc.ai_personality || {};
    if (personality.trait_primary === 'cowardly') {
      const variants = [
        "Alright, alright! No need for hostility. I was just... passing through. Yeah.",
        "Whoa, easy there! Maybe we got off on the wrong foot. Let's talk about this."
      ];
      return { text: pick(variants), data: { backed_down: true } };
    }

    const variants = [
      "You dare threaten ME? I've scuttled ships twice your size. Try me.",
      "Bold words from someone in my crosshairs. But I respect the nerve. Slightly.",
      "Ha! A threat! I haven't had a good laugh all day. Thanks for that."
    ];
    return { text: pick(variants), data: { backed_down: false } };
  },

  ask_mercy: (npc) => {
    const personality = npc.ai_personality || {};
    if (personality.trait_primary === 'honorable') {
      return { text: "There's no honor in destroying the defenseless. Go. But don't cross my path again." };
    }

    const variants = [
      "Mercy? In space? You're either new or delusional. But today's your lucky day — I'm feeling generous.",
      "You want mercy? Drop your cargo and crawl away. That's the best offer you'll get.",
      "Mercy costs extra. What've you got?"
    ];
    return { text: pick(variants) };
  },

  farewell: (npc) => {
    return { text: `${farewellText(npc)} And don't come back unless you're bringing credits.` };
  }
};

// ─── Script Registry ───────────────────────────────────────────────

const scriptRegistry = {
  TRADER: traderScripts,
  PATROL: patrolScripts,
  BOUNTY_HUNTER: bountyHunterScripts,
  PIRATE: pirateScripts,
  PIRATE_LORD: pirateScripts // Pirate Lords use same scripts as Pirates
};

/**
 * Get a scripted response for an NPC dialogue option.
 * @param {string} npcType - NPC type key
 * @param {string} optionKey - Script function name (e.g. 'greet', 'buy')
 * @param {Object} npc - NPC model instance
 * @param {Object} context - Dialogue context
 * @returns {{ text: string, data?: Object } | null} Response or null if script not found
 */
const getScriptedResponse = (npcType, optionKey, npc, context = {}) => {
  const scripts = scriptRegistry[npcType];
  if (!scripts) return null;

  const scriptFn = scripts[optionKey];
  if (typeof scriptFn !== 'function') return null;

  return scriptFn(npc, context);
};

/**
 * Get available script option keys for an NPC type.
 * @param {string} npcType
 * @returns {string[]}
 */
const getAvailableScripts = (npcType) => {
  const scripts = scriptRegistry[npcType];
  if (!scripts) return [];
  return Object.keys(scripts);
};

module.exports = {
  getScriptedResponse,
  getAvailableScripts
};
