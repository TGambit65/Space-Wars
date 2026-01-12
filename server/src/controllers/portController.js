const portService = require('../services/portService');

const getAllPorts = async (req, res, next) => {
  try {
    const { sector_id } = req.query;
    const ports = await portService.getAllPorts(sector_id || null);
    res.json({
      success: true,
      data: {
        ports,
        count: ports.length
      }
    });
  } catch (error) {
    next(error);
  }
};

const getPortById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const port = await portService.getPortWithPrices(id);
    res.json({
      success: true,
      data: {
        port
      }
    });
  } catch (error) {
    next(error);
  }
};

const getPortsBySector = async (req, res, next) => {
  try {
    const { sectorId } = req.params;
    const ports = await portService.getPortsBySector(sectorId);
    res.json({
      success: true,
      data: {
        ports,
        count: ports.length
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPorts,
  getPortById,
  getPortsBySector
};

