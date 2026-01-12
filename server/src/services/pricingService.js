const config = require('../config');

/**
 * Calculate the current buy price (price at which port BUYS from player)
 * Higher when port has low stock (they want more)
 * 
 * @param {number} basePrice - Base commodity price
 * @param {number} quantity - Current stock at port
 * @param {number} maxQuantity - Maximum stock capacity
 * @param {number} volatility - Price volatility (0-1)
 * @param {number} portModifier - Port-specific price modifier
 * @returns {number} Current buy price
 */
const calculateBuyPrice = (basePrice, quantity, maxQuantity, volatility, portModifier = 1.0) => {
  const { economy } = config;
  
  // Stock ratio (0 = empty, 1 = full)
  const stockRatio = quantity / maxQuantity;
  
  // Price increases as stock decreases (port wants to buy more when low)
  // When stock is low, they pay MORE to attract sellers
  const supplyMultiplier = 1 + ((1 - stockRatio) * volatility);
  
  // Apply spread (buy price is always lower than sell price by spread amount)
  const spreadAdjustment = 1 - (economy.priceSpread / 2);
  
  // Calculate final price
  let price = basePrice * supplyMultiplier * spreadAdjustment * portModifier;
  
  // Clamp to min/max
  price = Math.max(
    basePrice * economy.minPriceMultiplier,
    Math.min(basePrice * economy.maxPriceMultiplier, price)
  );
  
  return Math.round(price);
};

/**
 * Calculate the current sell price (price at which port SELLS to player)
 * Higher when port has low stock (scarcity)
 * 
 * @param {number} basePrice - Base commodity price
 * @param {number} quantity - Current stock at port
 * @param {number} maxQuantity - Maximum stock capacity
 * @param {number} volatility - Price volatility (0-1)
 * @param {number} portModifier - Port-specific price modifier
 * @returns {number} Current sell price
 */
const calculateSellPrice = (basePrice, quantity, maxQuantity, volatility, portModifier = 1.0) => {
  const { economy } = config;
  
  // Stock ratio (0 = empty, 1 = full)
  const stockRatio = quantity / maxQuantity;
  
  // Price increases as stock decreases (scarcity drives up price)
  const supplyMultiplier = 1 + ((1 - stockRatio) * volatility);
  
  // Apply spread (sell price is always higher than buy price)
  const spreadAdjustment = 1 + (economy.priceSpread / 2);
  
  // Calculate final price
  let price = basePrice * supplyMultiplier * spreadAdjustment * portModifier;
  
  // Clamp to min/max
  price = Math.max(
    basePrice * economy.minPriceMultiplier,
    Math.min(basePrice * economy.maxPriceMultiplier, price)
  );
  
  return Math.round(price);
};

/**
 * Calculate total cost including tax for a purchase
 * 
 * @param {number} unitPrice - Price per unit
 * @param {number} quantity - Number of units
 * @param {number} taxRate - Tax rate (0-1)
 * @returns {object} { subtotal, tax, total }
 */
const calculateTotalWithTax = (unitPrice, quantity, taxRate) => {
  const subtotal = unitPrice * quantity;
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal + tax;
  
  return { subtotal, tax, total };
};

/**
 * Calculate total revenue from selling (tax is deducted from seller)
 * 
 * @param {number} unitPrice - Price per unit
 * @param {number} quantity - Number of units
 * @param {number} taxRate - Tax rate (0-1)
 * @returns {object} { subtotal, tax, total }
 */
const calculateSaleRevenue = (unitPrice, quantity, taxRate) => {
  const subtotal = unitPrice * quantity;
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal - tax; // Tax deducted from sale
  
  return { subtotal, tax, total };
};

/**
 * Get price information for a commodity at a port
 * 
 * @param {object} portCommodity - PortCommodity record with commodity data
 * @param {object} port - Port record
 * @returns {object} Price information
 */
const getPriceInfo = (portCommodity, port) => {
  const commodity = portCommodity.commodity;
  
  const buyPrice = portCommodity.can_sell ? calculateBuyPrice(
    commodity.base_price,
    portCommodity.quantity,
    portCommodity.max_quantity,
    commodity.volatility,
    portCommodity.buy_price_modifier
  ) : null;
  
  const sellPrice = portCommodity.can_buy ? calculateSellPrice(
    commodity.base_price,
    portCommodity.quantity,
    portCommodity.max_quantity,
    commodity.volatility,
    portCommodity.sell_price_modifier
  ) : null;
  
  return {
    commodity_id: commodity.commodity_id,
    name: commodity.name,
    category: commodity.category,
    base_price: commodity.base_price,
    buy_price: buyPrice,      // What port pays player (player sells)
    sell_price: sellPrice,    // What port charges player (player buys)
    quantity: portCommodity.quantity,
    max_quantity: portCommodity.max_quantity,
    can_buy: portCommodity.can_buy,
    can_sell: portCommodity.can_sell,
    tax_rate: port.tax_rate,
    volume_per_unit: commodity.volume_per_unit
  };
};

module.exports = {
  calculateBuyPrice,
  calculateSellPrice,
  calculateTotalWithTax,
  calculateSaleRevenue,
  getPriceInfo
};

