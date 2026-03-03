const { Ship, Port, Commodity, PortCommodity, ShipCargo, Transaction, User, sequelize } = require('../models');
const pricingService = require('./pricingService');

/**
 * Get ship's current cargo
 */
const getShipCargo = async (shipId, userId) => {
  const ship = await Ship.findOne({
    where: { ship_id: shipId, owner_user_id: userId },
    include: [{
      model: ShipCargo,
      as: 'cargo',
      include: [{ model: Commodity, as: 'commodity' }]
    }]
  });

  if (!ship) {
    const error = new Error('Ship not found');
    error.statusCode = 404;
    throw error;
  }

  const cargoItems = ship.cargo.map(c => ({
    commodity_id: c.commodity_id,
    name: c.commodity.name,
    category: c.commodity.category,
    quantity: c.quantity,
    volume: c.quantity * c.commodity.volume_per_unit
  }));

  const usedCapacity = cargoItems.reduce((sum, item) => sum + item.volume, 0);

  return {
    ship_id: ship.ship_id,
    ship_name: ship.name,
    cargo_capacity: ship.cargo_capacity,
    used_capacity: usedCapacity,
    free_capacity: ship.cargo_capacity - usedCapacity,
    items: cargoItems
  };
};

/**
 * Calculate used cargo space for a ship
 */
const calculateUsedCargo = async (shipId, transaction = null) => {
  const cargoItems = await ShipCargo.findAll({
    where: { ship_id: shipId },
    include: [{ model: Commodity, as: 'commodity' }],
    ...(transaction && { transaction })
  });

  return cargoItems.reduce((sum, item) => 
    sum + (item.quantity * item.commodity.volume_per_unit), 0
  );
};

/**
 * Buy commodities from a port (player purchases from port)
 */
const buyCommodity = async (userId, shipId, portId, commodityId, quantity) => {
  const t = await sequelize.transaction();

  try {
    // Get user with lock
    const user = await User.findByPk(userId, { 
      transaction: t, 
      lock: t.LOCK.UPDATE 
    });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    // Get ship with lock and verify ownership
    const ship = await Ship.findOne({
      where: { ship_id: shipId, owner_user_id: userId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!ship) throw Object.assign(new Error('Ship not found'), { statusCode: 404 });

    // Get port
    const port = await Port.findByPk(portId, { transaction: t });
    if (!port || !port.is_active) {
      throw Object.assign(new Error('Port not found or inactive'), { statusCode: 404 });
    }

    // Verify ship is in same sector as port
    if (ship.current_sector_id !== port.sector_id) {
      throw Object.assign(new Error('Ship must be in the same sector as the port'), { statusCode: 400 });
    }

    // Get port commodity with lock
    const portCommodity = await PortCommodity.findOne({
      where: { port_id: portId, commodity_id: commodityId },
      include: [{ model: Commodity, as: 'commodity' }],
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!portCommodity) {
      throw Object.assign(new Error('Commodity not available at this port'), { statusCode: 404 });
    }
    if (!portCommodity.can_buy) {
      throw Object.assign(new Error('This port does not sell this commodity'), { statusCode: 400 });
    }

    // Check if commodity is legal or port allows illegal
    if (!portCommodity.commodity.is_legal && !port.allows_illegal) {
      throw Object.assign(new Error('This commodity is not sold at legal ports'), { statusCode: 400 });
    }

    // Check port has enough stock
    if (portCommodity.quantity < quantity) {
      throw Object.assign(new Error(`Insufficient stock. Available: ${portCommodity.quantity}`), { statusCode: 400 });
    }

    // Calculate price
    const unitPrice = pricingService.calculateSellPrice(
      portCommodity.commodity.base_price,
      portCommodity.quantity,
      portCommodity.max_quantity,
      portCommodity.commodity.volatility,
      portCommodity.sell_price_modifier
    );
    const { subtotal, tax, total } = pricingService.calculateTotalWithTax(unitPrice, quantity, port.tax_rate);

    // Check user has enough credits
    if (user.credits < total) {
      throw Object.assign(new Error(`Insufficient credits. Required: ${total}, Available: ${user.credits}`), { statusCode: 400 });
    }

    // Check cargo space
    const usedCargo = await calculateUsedCargo(shipId, t);
    const volumeNeeded = quantity * portCommodity.commodity.volume_per_unit;
    if (usedCargo + volumeNeeded > ship.cargo_capacity) {
      throw Object.assign(new Error(`Insufficient cargo space. Needed: ${volumeNeeded}, Available: ${ship.cargo_capacity - usedCargo}`), { statusCode: 400 });
    }

    // Execute trade
    await user.update({ credits: user.credits - total }, { transaction: t });
    await portCommodity.update({ quantity: portCommodity.quantity - quantity }, { transaction: t });

    // Add to ship cargo
    const [shipCargo] = await ShipCargo.findOrCreate({
      where: { ship_id: shipId, commodity_id: commodityId },
      defaults: { quantity: 0 },
      transaction: t
    });
    await shipCargo.update({ quantity: shipCargo.quantity + quantity }, { transaction: t });

    // Record transaction
    await Transaction.create({
      user_id: userId, ship_id: shipId, port_id: portId, commodity_id: commodityId,
      transaction_type: 'BUY', quantity, unit_price: unitPrice, tax_amount: tax, total_price: total
    }, { transaction: t });

    // Phase 5: Award XP for trading (1 XP per 100 credits traded)
    const tradeXP = Math.max(1, Math.floor(total / 100));
    try {
      const progressionService = require('./progressionService');
      await progressionService.awardXP(userId, tradeXP, 'trade', t);
    } catch (e) { /* XP failure should not block trade */ }

    await t.commit();

    // Phase 5: Update mission progress (outside transaction)
    try {
      const missionService = require('./missionService');
      await missionService.updateMissionProgress(userId, 'trade', { type: 'buy', total_value: total });
    } catch (e) { /* Mission progress failure should not block trade */ }

    return { success: true, quantity, unit_price: unitPrice, tax, total, new_balance: user.credits - total };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

/**
 * Sell commodities to a port (player sells to port)
 */
const sellCommodity = async (userId, shipId, portId, commodityId, quantity) => {
  const t = await sequelize.transaction();

  try {
    // Get user with lock
    const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    // Get ship with lock and verify ownership
    const ship = await Ship.findOne({
      where: { ship_id: shipId, owner_user_id: userId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!ship) throw Object.assign(new Error('Ship not found'), { statusCode: 404 });

    // Get port
    const port = await Port.findByPk(portId, { transaction: t });
    if (!port || !port.is_active) {
      throw Object.assign(new Error('Port not found or inactive'), { statusCode: 404 });
    }

    // Verify ship is in same sector as port
    if (ship.current_sector_id !== port.sector_id) {
      throw Object.assign(new Error('Ship must be in the same sector as the port'), { statusCode: 400 });
    }

    // Get port commodity with lock
    const portCommodity = await PortCommodity.findOne({
      where: { port_id: portId, commodity_id: commodityId },
      include: [{ model: Commodity, as: 'commodity' }],
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!portCommodity) {
      throw Object.assign(new Error('Commodity not traded at this port'), { statusCode: 404 });
    }
    if (!portCommodity.can_sell) {
      throw Object.assign(new Error('This port does not buy this commodity'), { statusCode: 400 });
    }

    // Check if commodity is legal or port allows illegal
    if (!portCommodity.commodity.is_legal && !port.allows_illegal) {
      throw Object.assign(new Error('This commodity cannot be sold at legal ports'), { statusCode: 400 });
    }

    // Get ship cargo
    const shipCargo = await ShipCargo.findOne({
      where: { ship_id: shipId, commodity_id: commodityId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!shipCargo || shipCargo.quantity < quantity) {
      const available = shipCargo ? shipCargo.quantity : 0;
      throw Object.assign(new Error(`Insufficient cargo. Available: ${available}`), { statusCode: 400 });
    }

    // Calculate price
    const unitPrice = pricingService.calculateBuyPrice(
      portCommodity.commodity.base_price,
      portCommodity.quantity,
      portCommodity.max_quantity,
      portCommodity.commodity.volatility,
      portCommodity.buy_price_modifier
    );
    const { subtotal, tax, total } = pricingService.calculateSaleRevenue(unitPrice, quantity, port.tax_rate);

    // Execute trade
    await user.update({ credits: Number(user.credits) + total }, { transaction: t });

    // Update port stock (capped at max)
    const newPortQty = Math.min(portCommodity.quantity + quantity, portCommodity.max_quantity);
    await portCommodity.update({ quantity: newPortQty }, { transaction: t });

    // Remove from ship cargo
    const newCargoQty = shipCargo.quantity - quantity;
    if (newCargoQty <= 0) {
      await shipCargo.destroy({ transaction: t });
    } else {
      await shipCargo.update({ quantity: newCargoQty }, { transaction: t });
    }

    // Record transaction
    await Transaction.create({
      user_id: userId, ship_id: shipId, port_id: portId, commodity_id: commodityId,
      transaction_type: 'SELL', quantity, unit_price: unitPrice, tax_amount: tax, total_price: total
    }, { transaction: t });

    // Phase 5: Award XP for trading (1 XP per 100 credits traded)
    const tradeXP = Math.max(1, Math.floor(total / 100));
    try {
      const progressionService = require('./progressionService');
      await progressionService.awardXP(userId, tradeXP, 'trade', t);
    } catch (e) { /* XP failure should not block trade */ }

    await t.commit();

    // Phase 5: Update mission progress (outside transaction - needs commodity name)
    try {
      const missionService = require('./missionService');
      await missionService.updateMissionProgress(userId, 'trade', {
        type: 'sell', total_value: total, port_id: portId,
        commodity_name: portCommodity.commodity.name, quantity
      });
    } catch (e) { /* Mission progress failure should not block trade */ }

    return { success: true, quantity, unit_price: unitPrice, tax, total, new_balance: Number(user.credits) + total };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

/**
 * Refuel ship at a port
 */
const refuelShip = async (userId, shipId, portId, amount = null) => {
  const t = await sequelize.transaction();

  try {
    const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    const ship = await Ship.findOne({
      where: { ship_id: shipId, owner_user_id: userId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!ship) throw Object.assign(new Error('Ship not found'), { statusCode: 404 });

    const port = await Port.findByPk(portId, { transaction: t });
    if (!port || !port.is_active) {
      throw Object.assign(new Error('Port not found or inactive'), { statusCode: 404 });
    }

    if (ship.current_sector_id !== port.sector_id) {
      throw Object.assign(new Error('Ship must be in the same sector as the port'), { statusCode: 400 });
    }

    // Find fuel commodity
    const fuelCommodity = await Commodity.findOne({ where: { name: 'Fuel' }, transaction: t });
    if (!fuelCommodity) throw Object.assign(new Error('Fuel commodity not found'), { statusCode: 500 });

    const portCommodity = await PortCommodity.findOne({
      where: { port_id: portId, commodity_id: fuelCommodity.commodity_id },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!portCommodity || !portCommodity.can_buy) {
      throw Object.assign(new Error('Fuel not available at this port'), { statusCode: 400 });
    }

    // Calculate how much fuel needed
    const fuelNeeded = ship.max_fuel - ship.fuel;
    const fuelToBuy = amount ? Math.min(amount, fuelNeeded) : fuelNeeded;

    if (fuelToBuy <= 0) {
      throw Object.assign(new Error('Ship fuel tank is already full'), { statusCode: 400 });
    }

    const availableFuel = Math.min(fuelToBuy, portCommodity.quantity);
    if (availableFuel <= 0) {
      throw Object.assign(new Error('No fuel available at this port'), { statusCode: 400 });
    }

    const unitPrice = pricingService.calculateSellPrice(
      fuelCommodity.base_price, portCommodity.quantity, portCommodity.max_quantity,
      fuelCommodity.volatility, portCommodity.sell_price_modifier
    );
    const { tax, total } = pricingService.calculateTotalWithTax(unitPrice, availableFuel, port.tax_rate);

    if (user.credits < total) {
      throw Object.assign(new Error(`Insufficient credits. Required: ${total}`), { statusCode: 400 });
    }

    await user.update({ credits: user.credits - total }, { transaction: t });
    await ship.update({ fuel: ship.fuel + availableFuel }, { transaction: t });
    await portCommodity.update({ quantity: portCommodity.quantity - availableFuel }, { transaction: t });

    await Transaction.create({
      user_id: userId, ship_id: shipId, port_id: portId, commodity_id: fuelCommodity.commodity_id,
      transaction_type: 'BUY', quantity: availableFuel, unit_price: unitPrice, tax_amount: tax, total_price: total
    }, { transaction: t });

    await t.commit();
    return { success: true, fuel_purchased: availableFuel, unit_price: unitPrice, total, new_fuel: ship.fuel + availableFuel, new_balance: user.credits - total };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

module.exports = { getShipCargo, calculateUsedCargo, buyCommodity, sellCommodity, refuelShip };

