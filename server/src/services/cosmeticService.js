const { Ship, CosmeticUnlock, User } = require('../models');
const config = require('../config');

const getAvailableCosmetics = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const unlocks = await CosmeticUnlock.findAll({
    where: { user_id: userId }
  });

  const unlockedSet = new Set(unlocks.map(u => `${u.cosmetic_type}:${u.cosmetic_id}`));
  const customization = config.shipCustomization;

  // Build catalog with owned/locked status
  const catalog = {
    hullColors: customization.hullColors.map(color => ({
      id: color,
      type: 'hull_color',
      unlocked: true // hull colors are always available
    })),
    accentColors: customization.accentColors.map(color => ({
      id: color,
      type: 'accent_color',
      unlocked: true // accent colors are always available
    })),
    engineTrails: customization.engineTrails.map(trail => ({
      id: trail,
      type: 'engine_trail',
      unlocked: unlockedSet.has(`engine_trail:${trail}`) || trail === 'cyan'
    })),
    decals: customization.decals.map(decal => ({
      id: decal,
      type: 'decal',
      unlocked: unlockedSet.has(`decal:${decal}`) || decal === 'none' || decal === 'faction_emblem'
    })),
    skins: customization.skins.map(skin => ({
      id: skin,
      type: 'skin',
      unlocked: unlockedSet.has(`skin:${skin}`) || skin === 'default'
    })),
    nameplateStyles: customization.nameplateStyles.map(style => ({
      id: style,
      type: 'nameplate',
      unlocked: unlockedSet.has(`nameplate:${style}`) || style === 'default'
    }))
  };

  return catalog;
};

const updateShipVisual = async (shipId, userId, visualConfig) => {
  const ship = await Ship.findOne({
    where: { ship_id: shipId, owner_user_id: userId }
  });

  if (!ship) {
    const error = new Error('Ship not found or you do not own it');
    error.statusCode = 404;
    throw error;
  }

  // Validate that the user has unlocked each cosmetic in the config
  const unlocks = await CosmeticUnlock.findAll({
    where: { user_id: userId }
  });
  const unlockedSet = new Set(unlocks.map(u => `${u.cosmetic_type}:${u.cosmetic_id}`));

  // Validate skin
  if (visualConfig.skin && visualConfig.skin !== 'default') {
    if (!unlockedSet.has(`skin:${visualConfig.skin}`)) {
      const error = new Error(`Skin '${visualConfig.skin}' is not unlocked`);
      error.statusCode = 403;
      throw error;
    }
  }

  // Validate decal
  if (visualConfig.decal && visualConfig.decal !== 'none' && visualConfig.decal !== 'faction_emblem') {
    if (!unlockedSet.has(`decal:${visualConfig.decal}`)) {
      const error = new Error(`Decal '${visualConfig.decal}' is not unlocked`);
      error.statusCode = 403;
      throw error;
    }
  }

  // Validate engine trail
  if (visualConfig.engine_trail && visualConfig.engine_trail !== 'cyan') {
    if (!unlockedSet.has(`engine_trail:${visualConfig.engine_trail}`)) {
      const error = new Error(`Engine trail '${visualConfig.engine_trail}' is not unlocked`);
      error.statusCode = 403;
      throw error;
    }
  }

  // Validate nameplate
  if (visualConfig.nameplate && visualConfig.nameplate !== 'default') {
    if (!unlockedSet.has(`nameplate:${visualConfig.nameplate}`)) {
      const error = new Error(`Nameplate style '${visualConfig.nameplate}' is not unlocked`);
      error.statusCode = 403;
      throw error;
    }
  }

  await ship.update({ visual_config: visualConfig });

  return ship;
};

const unlockCosmetic = async (userId, cosmeticType, cosmeticId) => {
  // Check if already unlocked
  const existing = await CosmeticUnlock.findOne({
    where: { user_id: userId, cosmetic_type: cosmeticType, cosmetic_id: cosmeticId }
  });

  if (existing) {
    return existing;
  }

  const unlock = await CosmeticUnlock.create({
    user_id: userId,
    cosmetic_type: cosmeticType,
    cosmetic_id: cosmeticId
  });

  return unlock;
};

const checkMilestoneUnlocks = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const playerLevel = user.player_level || 1;
  const milestones = config.shipCustomization.unlockMilestones;
  const newUnlocks = [];

  for (const [levelStr, items] of Object.entries(milestones)) {
    const level = parseInt(levelStr);
    if (playerLevel >= level) {
      for (const itemId of items) {
        // Determine cosmetic type based on config lists
        let cosmeticType = 'skin';
        if (config.shipCustomization.decals.includes(itemId)) {
          cosmeticType = 'decal';
        } else if (config.shipCustomization.engineTrails.includes(itemId)) {
          cosmeticType = 'engine_trail';
        } else if (config.shipCustomization.nameplateStyles.includes(itemId)) {
          cosmeticType = 'nameplate';
        }

        const existing = await CosmeticUnlock.findOne({
          where: { user_id: userId, cosmetic_type: cosmeticType, cosmetic_id: itemId }
        });

        if (!existing) {
          const unlock = await CosmeticUnlock.create({
            user_id: userId,
            cosmetic_type: cosmeticType,
            cosmetic_id: itemId
          });
          newUnlocks.push(unlock);
        }
      }
    }
  }

  return newUnlocks;
};

module.exports = {
  getAvailableCosmetics,
  updateShipVisual,
  unlockCosmetic,
  checkMilestoneUnlocks
};
