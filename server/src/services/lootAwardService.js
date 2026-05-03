/**
 * lootAwardService — shared award logic for crate loot rolls produced by
 * shipInteriorService.rollCrateLoot. Used by both the live-ship boarding
 * controller (shipInteriorController) and the derelict-manifest boarding
 * controller (derelictController) so the same crate roll resolves to the
 * same award shape regardless of which surface fired it.
 *
 * Returns { award, error }. When error is set the caller should respond
 * with the included statusCode + message; award is null. Otherwise award
 * is { type, label, ... } describing what was granted.
 */

const { Op } = require('sequelize');
const { User, Ship, ShipCargo, Commodity, Component, ShipComponent } = require('../models');

const awardRollToUser = async (userId, roll) => {
  if (!roll || !roll.type) {
    return { error: { statusCode: 400, message: 'Invalid loot roll' }, award: null };
  }

  if (roll.type === 'credits') {
    const user = await User.findByPk(userId);
    if (!user) return { error: { statusCode: 404, message: 'User not found' }, award: null };
    user.credits = (user.credits || 0) + roll.amount;
    await user.save();
    return { award: { type: 'credits', amount: roll.amount, label: `${roll.amount} credits` } };
  }

  if (roll.type === 'commodity') {
    const playerShip = await Ship.findOne({
      where: { owner_user_id: userId, is_active: true }
    });
    if (!playerShip) {
      return { error: { statusCode: 400, message: 'No active ship to receive cargo' }, award: null };
    }
    const commodities = await Commodity.findAll({ where: { is_legal: true } });
    if (commodities.length === 0) {
      return { error: { statusCode: 500, message: 'No commodities available in universe' }, award: null };
    }
    const commodity = commodities[Math.floor(roll._selector * commodities.length) % commodities.length];

    const cargoRows = await ShipCargo.findAll({
      where: { ship_id: playerShip.ship_id },
      include: [{ model: Commodity, as: 'commodity' }]
    });
    const usedCapacity = cargoRows.reduce((sum, r) => sum + r.quantity * (r.commodity?.volume_per_unit || 1), 0);
    const free = Math.max(0, (playerShip.cargo_capacity || 0) - usedCapacity);
    const maxQty = Math.floor(free / (commodity.volume_per_unit || 1));
    if (maxQty <= 0) {
      return { error: { statusCode: 400, message: 'Cargo bay is full' }, award: null };
    }
    const quantity = Math.min(roll.quantity, maxQty);

    const existing = await ShipCargo.findOne({
      where: { ship_id: playerShip.ship_id, commodity_id: commodity.commodity_id }
    });
    if (existing) {
      existing.quantity += quantity;
      await existing.save();
    } else {
      await ShipCargo.create({
        ship_id: playerShip.ship_id,
        commodity_id: commodity.commodity_id,
        quantity
      });
    }
    return {
      award: {
        type: 'commodity',
        commodity_id: commodity.commodity_id,
        commodity_name: commodity.name,
        quantity,
        label: `${quantity} × ${commodity.name}`
      }
    };
  }

  if (roll.type === 'component') {
    const playerShip = await Ship.findOne({
      where: { owner_user_id: userId, is_active: true }
    });
    if (!playerShip) {
      return { error: { statusCode: 400, message: 'No active ship to receive component' }, award: null };
    }
    const components = await Component.findAll({ where: { tier: roll.tier } });
    const pool = components.length > 0
      ? components
      : await Component.findAll({ where: { tier: { [Op.lte]: roll.tier } } });
    if (pool.length === 0) {
      return { error: { statusCode: 500, message: 'No components available in universe' }, award: null };
    }
    const component = pool[Math.floor(roll._selector * pool.length) % pool.length];

    const existing = await ShipComponent.findAll({
      where: { ship_id: playerShip.ship_id, component_id: component.component_id }
    });
    const slot = existing.reduce((m, c) => Math.max(m, c.slot_index + 1), 0);
    await ShipComponent.create({
      ship_id: playerShip.ship_id,
      component_id: component.component_id,
      slot_index: slot,
      condition: 0.6 + Math.random() * 0.3,
      is_active: false
    });
    return {
      award: {
        type: 'component',
        component_id: component.component_id,
        component_name: component.name,
        tier: component.tier,
        label: `${component.name} (T${component.tier})`
      }
    };
  }

  return { error: { statusCode: 400, message: `Unknown loot type: ${roll.type}` }, award: null };
};

module.exports = { awardRollToUser };
