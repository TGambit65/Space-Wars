const { Ship, Component, ShipComponent, User, Port, sequelize } = require('../models');
const config = require('../config');

/**
 * Get ship type key from ship type name
 */
const getShipTypeKey = (shipTypeName) => {
  const mapping = {
    'Scout': 'SCOUT',
    'Merchant Cruiser': 'MERCHANT_CRUISER',
    'Freighter': 'FREIGHTER',
    'Fighter': 'FIGHTER',
    'Corvette': 'CORVETTE',
    'Destroyer': 'DESTROYER',
    'Carrier': 'CARRIER',
    'Colony Ship': 'COLONY_SHIP',
    'Insta Colony Ship': 'INSTA_COLONY_SHIP',
    'Battlecruiser': 'BATTLECRUISER',
    'Interceptor': 'INTERCEPTOR',
    'Mining Barge': 'MINING_BARGE',
    'Explorer': 'EXPLORER'
  };
  return mapping[shipTypeName] || 'SCOUT';
};

/**
 * Get available slots for a ship type
 */
const getShipSlots = (shipType) => {
  const key = getShipTypeKey(shipType);
  return config.shipSlots[key] || config.shipSlots.SCOUT;
};

/**
 * Get all available components
 */
const getAvailableComponents = async (type = null) => {
  const where = type ? { type } : {};
  return Component.findAll({ where, order: [['tier', 'ASC'], ['price', 'ASC']] });
};

/**
 * Get ship with installed components
 */
const getShipWithComponents = async (shipId, userId) => {
  const ship = await Ship.findOne({
    where: { ship_id: shipId, owner_user_id: userId },
    include: [{
      model: ShipComponent,
      as: 'components',
      include: [{ model: Component, as: 'component' }]
    }]
  });
  if (!ship) throw Object.assign(new Error('Ship not found'), { statusCode: 404 });
  return ship;
};

/**
 * Count installed components by type
 */
const getInstalledSlotCounts = async (shipId, transaction = null) => {
  const components = await ShipComponent.findAll({
    where: { ship_id: shipId },
    include: [{ model: Component, as: 'component', attributes: ['type'] }],
    ...(transaction && { transaction })
  });

  const counts = {};
  for (const sc of components) {
    const type = sc.component.type;
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
};

/**
 * Calculate total energy cost of installed components
 */
const getTotalEnergyCost = async (shipId, transaction = null) => {
  const components = await ShipComponent.findAll({
    where: { ship_id: shipId, is_active: true },
    include: [{ model: Component, as: 'component', attributes: ['energy_cost'] }],
    ...(transaction && { transaction })
  });

  return components.reduce((total, sc) => total + (sc.component.energy_cost || 0), 0);
};

/**
 * Install a component on a ship (requires ship to be at a port)
 */
const installComponent = async (userId, shipId, componentId) => {
  const t = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    const ship = await Ship.findOne({
      where: { ship_id: shipId, owner_user_id: userId },
      transaction: t, lock: t.LOCK.UPDATE
    });
    if (!ship) throw Object.assign(new Error('Ship not found'), { statusCode: 404 });

    // Verify ship is at a port
    const port = await Port.findOne({
      where: { sector_id: ship.current_sector_id, is_active: true },
      transaction: t
    });
    if (!port) {
      throw Object.assign(new Error('Ship must be at a port to install components'), { statusCode: 400 });
    }

    const component = await Component.findByPk(componentId, { transaction: t });
    if (!component) throw Object.assign(new Error('Component not found'), { statusCode: 404 });

    // Check credits
    if (user.credits < component.price) {
      throw Object.assign(new Error(`Insufficient credits. Need ${component.price}`), { statusCode: 400 });
    }

    // Check slot availability
    const slots = getShipSlots(ship.ship_type);
    const maxSlots = slots[component.type] || 0;
    if (maxSlots === 0) {
      throw Object.assign(new Error(`Ship cannot equip ${component.type} components`), { statusCode: 400 });
    }

    const installedCounts = await getInstalledSlotCounts(shipId, t);
    const currentCount = installedCounts[component.type] || 0;
    if (currentCount >= maxSlots) {
      throw Object.assign(new Error(`No ${component.type} slots available (${currentCount}/${maxSlots})`), { statusCode: 400 });
    }

    // Check energy capacity
    const currentEnergyCost = await getTotalEnergyCost(shipId, t);
    const newTotalEnergy = currentEnergyCost + (component.energy_cost || 0);
    if (newTotalEnergy > ship.max_energy) {
      throw Object.assign(
        new Error(`Insufficient energy capacity. Need ${newTotalEnergy}, have ${ship.max_energy}`),
        { statusCode: 400 }
      );
    }

    // Deduct credits and install
    await user.update({ credits: user.credits - component.price }, { transaction: t });
    
    const shipComponent = await ShipComponent.create({
      ship_id: shipId,
      component_id: componentId,
      slot_index: currentCount,
      condition: 1.0
    }, { transaction: t });

    // Update ship stats
    await recalculateShipStats(ship, t);
    await t.commit();

    // Note: user.credits was already updated in the transaction
    return { success: true, ship_component_id: shipComponent.ship_component_id, new_balance: user.credits };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

/**
 * Uninstall a component from a ship (requires ship to be at a port)
 */
const uninstallComponent = async (userId, shipId, shipComponentId) => {
  const t = await sequelize.transaction();
  try {
    const ship = await Ship.findOne({
      where: { ship_id: shipId, owner_user_id: userId },
      transaction: t, lock: t.LOCK.UPDATE
    });
    if (!ship) throw Object.assign(new Error('Ship not found'), { statusCode: 404 });

    // Verify ship is at a port
    const port = await Port.findOne({
      where: { sector_id: ship.current_sector_id, is_active: true },
      transaction: t
    });
    if (!port) {
      throw Object.assign(new Error('Ship must be at a port to uninstall components'), { statusCode: 400 });
    }

    const shipComponent = await ShipComponent.findOne({
      where: { ship_component_id: shipComponentId, ship_id: shipId },
      include: [{ model: Component, as: 'component' }],
      transaction: t
    });
    if (!shipComponent) throw Object.assign(new Error('Component not installed'), { statusCode: 404 });

    // Refund 50% of component price based on condition
    const refund = Math.floor(shipComponent.component.price * 0.5 * shipComponent.condition);
    const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    await user.update({ credits: user.credits + refund }, { transaction: t });

    await shipComponent.destroy({ transaction: t });
    await recalculateShipStats(ship, t);
    await t.commit();

    // Note: user.credits was already updated in the transaction
    return { success: true, refund, new_balance: user.credits };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

/**
 * Recalculate ship stats based on installed components
 */
const recalculateShipStats = async (ship, transaction = null) => {
  const components = await ShipComponent.findAll({
    where: { ship_id: ship.ship_id, is_active: true },
    include: [{ model: Component, as: 'component' }],
    ...(transaction && { transaction })
  });

  // Get base stats from ship type
  const key = getShipTypeKey(ship.ship_type);
  const baseStats = config.shipTypes[key];

  let attackPower = 10; // base attack
  let defenseRating = 5; // base defense
  let speedBonus = 0;
  let shieldCapacity = baseStats.shields;
  let hullBonus = 0;
  let cargoBonus = 0;
  let energyCapacity = 100;

  for (const sc of components) {
    const comp = sc.component;
    const effectiveness = sc.condition;

    switch (comp.type) {
      case 'weapon':
        attackPower += Math.floor(comp.damage * effectiveness);
        break;
      case 'shield':
        shieldCapacity += Math.floor(comp.shield_capacity * effectiveness);
        break;
      case 'engine':
        speedBonus += Math.floor(comp.speed_bonus * effectiveness);
        break;
      case 'armor':
        hullBonus += Math.floor(comp.hull_bonus * effectiveness);
        defenseRating += Math.floor(comp.damage_reduction * 100 * effectiveness);
        break;
      case 'cargo_pod':
        cargoBonus += Math.floor(comp.cargo_capacity * effectiveness);
        break;
      case 'jump_drive':
        // Jump drives don't modify base stats — their effect is checked at jump time
        break;
    }
  }

  await ship.update({
    attack_power: attackPower,
    defense_rating: defenseRating,
    speed: 10 + speedBonus,
    max_shield_points: shieldCapacity,
    max_hull_points: baseStats.hull + hullBonus,
    cargo_capacity: baseStats.cargo + cargoBonus,
    max_energy: energyCapacity
  }, { transaction });

  return ship;
};

/**
 * Get ship design summary
 */
const getShipDesign = async (shipId, userId) => {
  const ship = await getShipWithComponents(shipId, userId);
  const slots = getShipSlots(ship.ship_type);
  const installed = await getInstalledSlotCounts(shipId);

  const componentsByType = {};
  for (const sc of ship.components) {
    const type = sc.component.type;
    if (!componentsByType[type]) componentsByType[type] = [];
    componentsByType[type].push({
      ship_component_id: sc.ship_component_id,
      name: sc.component.name,
      tier: sc.component.tier,
      condition: sc.condition,
      is_active: sc.is_active
    });
  }

  return {
    ship_id: ship.ship_id,
    ship_name: ship.name,
    ship_type: ship.ship_type,
    slots: Object.entries(slots).map(([type, max]) => ({
      type, max, used: installed[type] || 0
    })),
    components: componentsByType,
    stats: {
      hull: ship.hull_points,
      max_hull: ship.max_hull_points,
      shields: ship.shield_points,
      max_shields: ship.max_shield_points,
      attack: ship.attack_power,
      defense: ship.defense_rating,
      speed: ship.speed,
      cargo: ship.cargo_capacity
    }
  };
};

module.exports = {
  getShipTypeKey,
  getShipSlots,
  getAvailableComponents,
  getShipWithComponents,
  getInstalledSlotCounts,
  getTotalEnergyCost,
  installComponent,
  uninstallComponent,
  recalculateShipStats,
  getShipDesign
};

