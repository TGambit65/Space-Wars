const { Port, PortCommodity, Commodity, Sector } = require('../models');
const pricingService = require('./pricingService');

/**
 * Get all ports, optionally filtered by sector
 */
const getAllPorts = async (sectorId = null) => {
  const whereClause = { is_active: true };
  if (sectorId) {
    whereClause.sector_id = sectorId;
  }

  const ports = await Port.findAll({
    where: whereClause,
    include: [{
      model: Sector,
      as: 'sector',
      attributes: ['sector_id', 'name', 'x_coord', 'y_coord', 'type']
    }],
    order: [['name', 'ASC']]
  });

  return ports;
};

/**
 * Get a single port by ID with full commodity information
 */
const getPortById = async (portId) => {
  const port = await Port.findByPk(portId, {
    include: [
      {
        model: Sector,
        as: 'sector',
        attributes: ['sector_id', 'name', 'x_coord', 'y_coord', 'type']
      },
      {
        model: PortCommodity,
        as: 'portCommodities',
        include: [{
          model: Commodity,
          as: 'commodity'
        }]
      }
    ]
  });

  if (!port) {
    const error = new Error('Port not found');
    error.statusCode = 404;
    throw error;
  }

  return port;
};

/**
 * Get port with formatted price information
 */
const getPortWithPrices = async (portId) => {
  const port = await getPortById(portId);
  
  const commodities = port.portCommodities.map(pc => 
    pricingService.getPriceInfo(pc, port)
  );

  return {
    port_id: port.port_id,
    name: port.name,
    type: port.type,
    description: port.description,
    tax_rate: port.tax_rate,
    allows_illegal: port.allows_illegal,
    sector: port.sector,
    commodities
  };
};

/**
 * Get ports in a specific sector
 */
const getPortsBySector = async (sectorId) => {
  // Verify sector exists
  const sector = await Sector.findByPk(sectorId);
  if (!sector) {
    const error = new Error('Sector not found');
    error.statusCode = 404;
    throw error;
  }

  const ports = await Port.findAll({
    where: { 
      sector_id: sectorId,
      is_active: true 
    },
    include: [{
      model: PortCommodity,
      as: 'portCommodities',
      include: [{
        model: Commodity,
        as: 'commodity'
      }]
    }]
  });

  return ports.map(port => ({
    port_id: port.port_id,
    name: port.name,
    type: port.type,
    description: port.description,
    tax_rate: port.tax_rate,
    allows_illegal: port.allows_illegal,
    commodity_count: port.portCommodities.length
  }));
};

/**
 * Get specific commodity at a port
 */
const getPortCommodity = async (portId, commodityId) => {
  const portCommodity = await PortCommodity.findOne({
    where: {
      port_id: portId,
      commodity_id: commodityId
    },
    include: [
      { model: Port, as: 'port' },
      { model: Commodity, as: 'commodity' }
    ]
  });

  if (!portCommodity) {
    const error = new Error('Commodity not available at this port');
    error.statusCode = 404;
    throw error;
  }

  return portCommodity;
};

/**
 * Update port commodity quantity (used after trades)
 */
const updatePortCommodityQuantity = async (portId, commodityId, quantityChange, transaction = null) => {
  const portCommodity = await PortCommodity.findOne({
    where: { port_id: portId, commodity_id: commodityId },
    ...(transaction && { transaction, lock: transaction.LOCK.UPDATE })
  });

  if (!portCommodity) {
    const error = new Error('Commodity not found at port');
    error.statusCode = 404;
    throw error;
  }

  const newQuantity = portCommodity.quantity + quantityChange;
  
  // Clamp to valid range
  const clampedQuantity = Math.max(0, Math.min(newQuantity, portCommodity.max_quantity));
  
  await portCommodity.update({ quantity: clampedQuantity }, { transaction });
  
  return portCommodity;
};

module.exports = {
  getAllPorts,
  getPortById,
  getPortWithPrices,
  getPortsBySector,
  getPortCommodity,
  updatePortCommodityQuantity
};

