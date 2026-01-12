const { Ship, ShipComponent, Component, User, Port, sequelize } = require('../models');
const config = require('../config');
const shipDesignerService = require('./shipDesignerService');

/**
 * Calculate repair cost for hull damage
 */
const calculateHullRepairCost = (ship) => {
  const damage = ship.max_hull_points - ship.hull_points;
  return damage * config.maintenance.hullRepairCostPerPoint;
};

/**
 * Calculate repair cost for a component
 */
const calculateComponentRepairCost = (shipComponent) => {
  const damagePercent = 1 - shipComponent.condition;
  return Math.floor(shipComponent.component.price * config.maintenance.componentRepairCostMultiplier * damagePercent);
};

/**
 * Get full repair estimate for a ship
 */
const getRepairEstimate = async (shipId, userId) => {
  const ship = await Ship.findOne({
    where: { ship_id: shipId, owner_user_id: userId },
    include: [{
      model: ShipComponent,
      as: 'components',
      include: [{ model: Component, as: 'component' }]
    }]
  });
  if (!ship) throw Object.assign(new Error('Ship not found'), { statusCode: 404 });

  const hullCost = calculateHullRepairCost(ship);
  const componentCosts = ship.components
    .filter(sc => sc.condition < 1.0)
    .map(sc => ({
      ship_component_id: sc.ship_component_id,
      name: sc.component.name,
      condition: sc.condition,
      repair_cost: calculateComponentRepairCost(sc)
    }));

  const totalComponentCost = componentCosts.reduce((sum, c) => sum + c.repair_cost, 0);

  return {
    ship_id: ship.ship_id,
    hull_damage: ship.max_hull_points - ship.hull_points,
    hull_repair_cost: hullCost,
    components_needing_repair: componentCosts,
    total_component_cost: totalComponentCost,
    total_cost: hullCost + totalComponentCost
  };
};

/**
 * Repair ship hull at a port
 */
const repairHull = async (userId, shipId, portId) => {
  const t = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    const ship = await Ship.findOne({
      where: { ship_id: shipId, owner_user_id: userId },
      transaction: t, lock: t.LOCK.UPDATE
    });
    if (!ship) throw Object.assign(new Error('Ship not found'), { statusCode: 404 });

    const port = await Port.findByPk(portId, { transaction: t });
    if (!port || !port.is_active) {
      throw Object.assign(new Error('Port not found'), { statusCode: 404 });
    }
    if (ship.current_sector_id !== port.sector_id) {
      throw Object.assign(new Error('Ship not at port'), { statusCode: 400 });
    }

    const cost = calculateHullRepairCost(ship);
    if (cost === 0) throw Object.assign(new Error('Hull is at full health'), { statusCode: 400 });
    if (user.credits < cost) {
      throw Object.assign(new Error(`Insufficient credits. Need ${cost}`), { statusCode: 400 });
    }

    await user.update({ credits: user.credits - cost }, { transaction: t });
    await ship.update({
      hull_points: ship.max_hull_points,
      last_maintenance_at: new Date()
    }, { transaction: t });

    await t.commit();
    // Note: user.credits was already updated in the transaction
    return { success: true, cost, hull_restored: ship.max_hull_points, new_balance: user.credits };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

/**
 * Repair a specific component
 */
const repairComponent = async (userId, shipId, shipComponentId, portId) => {
  const t = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    const ship = await Ship.findOne({
      where: { ship_id: shipId, owner_user_id: userId },
      transaction: t
    });
    if (!ship) throw Object.assign(new Error('Ship not found'), { statusCode: 404 });

    const port = await Port.findByPk(portId, { transaction: t });
    if (!port || !port.is_active || ship.current_sector_id !== port.sector_id) {
      throw Object.assign(new Error('Ship must be at a port'), { statusCode: 400 });
    }

    const shipComponent = await ShipComponent.findOne({
      where: { ship_component_id: shipComponentId, ship_id: shipId },
      include: [{ model: Component, as: 'component' }],
      transaction: t, lock: t.LOCK.UPDATE
    });
    if (!shipComponent) throw Object.assign(new Error('Component not found'), { statusCode: 404 });

    const cost = calculateComponentRepairCost(shipComponent);
    if (cost === 0) throw Object.assign(new Error('Component is at full condition'), { statusCode: 400 });
    if (user.credits < cost) {
      throw Object.assign(new Error(`Insufficient credits. Need ${cost}`), { statusCode: 400 });
    }

    await user.update({ credits: user.credits - cost }, { transaction: t });
    await shipComponent.update({ condition: 1.0 }, { transaction: t });

    // Recalculate ship stats
    await shipDesignerService.recalculateShipStats(ship, t);

    await t.commit();
    // Note: user.credits was already updated in the transaction
    return { success: true, cost, component: shipComponent.component.name, new_balance: user.credits };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

/**
 * Apply degradation to components after combat
 */
const degradeComponents = async (shipId, combatRounds, transaction = null) => {
  const degradation = combatRounds * config.maintenance.componentDegradationPerCombat;
  const minCondition = config.maintenance.minComponentCondition;

  // Use MAX for SQLite compatibility (GREATEST is not supported in SQLite)
  await ShipComponent.update(
    { condition: sequelize.literal(`MAX(${minCondition}, condition - ${degradation})`) },
    { where: { ship_id: shipId }, transaction }
  );
};

/**
 * Apply degradation after sector jump
 */
const degradeOnJump = async (shipId, transaction = null) => {
  const degradation = config.maintenance.componentDegradationPerJump;
  const minCondition = config.maintenance.minComponentCondition;

  // Use MAX for SQLite compatibility (GREATEST is not supported in SQLite)
  await ShipComponent.update(
    { condition: sequelize.literal(`MAX(${minCondition}, condition - ${degradation})`) },
    { where: { ship_id: shipId }, transaction }
  );
};

module.exports = {
  calculateHullRepairCost,
  calculateComponentRepairCost,
  getRepairEstimate,
  repairHull,
  repairComponent,
  degradeComponents,
  degradeOnJump
};

