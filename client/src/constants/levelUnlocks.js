/**
 * What the player unlocks at each level. Used by the level-up modal.
 * Only levels with meaningful unlocks are listed.
 */
export const LEVEL_UNLOCKS = {
  2: { ships: [], features: ['Crafting: Synthesize Plasma'] },
  3: { ships: ['Corvette'], features: ['Basic component crafting (Pulse Laser, Combat Shield, Fusion Engine)'] },
  4: { ships: [], features: ['Crafting: Fabricate AI Cores'] },
  5: { ships: ['Frigate'], features: [], cosmetics: ['Pirate Black skin', 'Crosshairs decal'] },
  7: { ships: ['Destroyer'], features: ['Jump Drive component'] },
  10: { ships: ['Cruiser'], features: ['Advanced automation routes'], cosmetics: ['Golden skin', 'Crown decal'] },
  12: { ships: ['Battlecruiser'], features: [] },
  15: { ships: ['Battleship'], features: ['Fleet command expansion'], cosmetics: ['Stealth skin', 'Spiral decal'] },
  18: { ships: ['Dreadnought'], features: [] },
  20: { ships: ['Titan'], features: ['All systems unlocked'], cosmetics: ['Arctic skin', 'Lightning decal'] },
};
