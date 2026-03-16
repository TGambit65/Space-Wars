const { Sector } = require('../models');
const config = require('../config');
const { Op } = require('sequelize');

const getPhenomena = async (sectorId) => {
  const sector = await Sector.findByPk(sectorId, { attributes: ['phenomena'] });
  if (!sector || !sector.phenomena) return null;

  const phenomena = sector.phenomena;
  // Check if temporary phenomenon has expired
  if (phenomena.expires_at && new Date(phenomena.expires_at) < new Date()) {
    await sector.update({ phenomena: null });
    return null;
  }

  const def = config.spacePhenomena?.[phenomena.type];
  if (!def) return null;

  return {
    ...phenomena,
    name: def.name,
    description: def.description,
    effects: def.effects
  };
};

const applyPhenomenaEffects = async (sectorId) => {
  const phenomena = await getPhenomena(sectorId);
  if (!phenomena) return {};
  return phenomena.effects || {};
};

const spawnTemporaryPhenomena = async () => {
  const phenomenaDefs = config.spacePhenomena || {};
  const temporaryTypes = Object.entries(phenomenaDefs).filter(([, p]) => !p.permanent);

  if (temporaryTypes.length === 0) return 0;

  // Find sectors without phenomena
  const sectors = await Sector.findAll({
    where: { phenomena: null },
    attributes: ['sector_id', 'star_class']
  });

  let spawned = 0;
  for (const sector of sectors) {
    if (sector.star_class === 'BlackHole') continue;

    for (const [type, def] of temporaryTypes) {
      if (Math.random() < def.spawnChance * 0.01) { // Lower chance per tick
        const duration = def.durationMinMs + Math.random() * (def.durationMaxMs - def.durationMinMs);
        await sector.update({
          phenomena: {
            type,
            intensity: 0.5 + Math.random() * 0.5,
            expires_at: new Date(Date.now() + duration).toISOString()
          }
        });
        spawned++;
        break;
      }
    }
  }
  return spawned;
};

const cleanExpiredPhenomena = async () => {
  const sectors = await Sector.findAll({
    where: {
      phenomena: { [Op.ne]: null }
    },
    attributes: ['sector_id', 'phenomena']
  });

  let cleaned = 0;
  for (const sector of sectors) {
    if (sector.phenomena?.expires_at && new Date(sector.phenomena.expires_at) < new Date()) {
      await sector.update({ phenomena: null });
      cleaned++;
    }
  }
  return cleaned;
};

module.exports = {
  getPhenomena,
  applyPhenomenaEffects,
  spawnTemporaryPhenomena,
  cleanExpiredPhenomena
};
