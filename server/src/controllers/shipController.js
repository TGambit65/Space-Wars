const { validationResult } = require('express-validator');
const shipService = require('../services/shipService');

const getShips = async (req, res, next) => {
  try {
    const ships = await shipService.getUserShips(req.userId);

    res.json({
      success: true,
      data: {
        ships,
        count: ships.length
      }
    });
  } catch (error) {
    next(error);
  }
};

const getShipStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { shipId } = req.params;
    const status = await shipService.getShipStatus(shipId, req.userId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
};

const moveShip = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { shipId } = req.params;
    const { target_sector_id } = req.body;

    const ship = await shipService.moveShip(shipId, target_sector_id, req.userId);
    const adjacentSectors = await shipService.getAdjacentSectors(ship.current_sector_id);

    res.json({
      success: true,
      message: 'Ship moved successfully',
      data: {
        ship: ship.toJSON(),
        adjacentSectors
      }
    });
  } catch (error) {
    next(error);
  }
};

const getAdjacentSectors = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { shipId } = req.params;
    const ship = await shipService.getShipById(shipId, req.userId);
    const adjacentSectors = await shipService.getAdjacentSectors(ship.current_sector_id);

    res.json({
      success: true,
      data: {
        currentSector: ship.currentSector,
        adjacentSectors
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getShips,
  getShipStatus,
  moveShip,
  getAdjacentSectors
};

