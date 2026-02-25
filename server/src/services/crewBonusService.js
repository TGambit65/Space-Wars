/**
 * Crew Bonus Service
 * Calculates bonuses from crew members based on their species, roles, and levels
 */
const { Crew } = require('../models');
const config = require('../config');

/**
 * Calculate total crew bonuses for a ship
 * @param {string} shipId - The ship ID
 * @returns {Object} Bonuses for different stats
 */
const calculateShipCrewBonuses = async (shipId) => {
  const crew = await Crew.findAll({
    where: { current_ship_id: shipId, is_active: true }
  });

  const bonuses = {
    piloting: 0,
    engineering: 0,
    combat: 0,
    science: 0,
    // Derived bonuses
    speed: 0,
    damage: 0,
    accuracy: 0,
    repair: 0,
    scan: 0,
    flee: 0
  };

  for (const member of crew) {
    // Get species bonuses
    const speciesKey = member.species.toUpperCase().replace(/ /g, '_');
    const speciesConfig = config.crewSpecies[speciesKey];
    
    if (speciesConfig && speciesConfig.bonuses) {
      // Apply species base bonuses (scaled by level)
      const levelMultiplier = 1 + (member.level - 1) * 0.1; // 10% per level
      
      if (speciesConfig.bonuses.piloting) {
        bonuses.piloting += speciesConfig.bonuses.piloting * levelMultiplier;
      }
      if (speciesConfig.bonuses.engineering) {
        bonuses.engineering += speciesConfig.bonuses.engineering * levelMultiplier;
      }
      if (speciesConfig.bonuses.combat) {
        bonuses.combat += speciesConfig.bonuses.combat * levelMultiplier;
      }
      if (speciesConfig.bonuses.science) {
        bonuses.science += speciesConfig.bonuses.science * levelMultiplier;
      }
    }

    // Apply role bonuses (if assigned)
    if (member.assigned_role) {
      const roleKey = member.assigned_role.toUpperCase();
      const roleConfig = config.crewRoles[roleKey];
      
      if (roleConfig) {
        const roleBonus = 0.15 * member.level; // 15% per level when assigned to role
        
        switch (member.assigned_role) {
          case 'Pilot':
            bonuses.speed += roleBonus;
            bonuses.flee += roleBonus * 0.5;
            break;
          case 'Engineer':
            bonuses.repair += roleBonus;
            break;
          case 'Gunner':
            bonuses.damage += roleBonus;
            bonuses.accuracy += roleBonus * 0.5;
            break;
          case 'Scientist':
            bonuses.scan += roleBonus;
            break;
        }
      }
    }
  }

  // Cap bonuses at reasonable maximums
  const maxBonus = 2.0; // 200% max bonus
  for (const key of Object.keys(bonuses)) {
    bonuses[key] = Math.min(bonuses[key], maxBonus);
    bonuses[key] = parseFloat(bonuses[key].toFixed(3));
  }

  return {
    crew_count: crew.length,
    bonuses
  };
};

/**
 * Apply crew bonuses to a stat value
 * @param {number} baseValue - The base stat value
 * @param {number} bonusMultiplier - The bonus multiplier (e.g., 0.5 for 50%)
 * @returns {number} Modified value
 */
const applyBonus = (baseValue, bonusMultiplier) => {
  return Math.floor(baseValue * (1 + bonusMultiplier));
};

/**
 * Get crew effectiveness summary for a ship
 * @param {string} shipId - The ship ID
 * @returns {Object} Summary of crew effectiveness
 */
const getCrewEffectivenessSummary = async (shipId) => {
  const { crew_count, bonuses } = await calculateShipCrewBonuses(shipId);
  
  return {
    crew_count,
    effectiveness: {
      combat: Math.round((bonuses.combat + bonuses.damage + bonuses.accuracy) * 33.33),
      navigation: Math.round((bonuses.piloting + bonuses.speed + bonuses.flee) * 33.33),
      engineering: Math.round((bonuses.engineering + bonuses.repair) * 50),
      science: Math.round((bonuses.science + bonuses.scan) * 50)
    },
    raw_bonuses: bonuses
  };
};

module.exports = {
  calculateShipCrewBonuses,
  applyBonus,
  getCrewEffectivenessSummary
};

