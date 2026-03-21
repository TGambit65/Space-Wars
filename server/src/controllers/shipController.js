const { validationResult } = require('express-validator');
const shipService = require('../services/shipService');
const crewBonusService = require('../services/crewBonusService');
const { User } = require('../models');

const getShips = async (req, res, next) => {
  try {
    let ships = await shipService.getUserShips(req.userId);
    let user = await User.findByPk(req.userId, { attributes: ['active_ship_id'] });

    // Auto-grant rescue ship if all ships are destroyed
    const hasLiveShip = ships.some(s => s.is_active !== false);
    if (ships.length > 0 && !hasLiveShip) {
      const rescueShip = await shipService.grantRescueShip(req.userId);
      ships = await shipService.getUserShips(req.userId);
      user = await User.findByPk(req.userId, { attributes: ['active_ship_id'] });
    }

    res.json({
      success: true,
      data: {
        ships,
        active_ship_id: user?.active_ship_id || null,
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
    const adjacentSectors = await shipService.getAdjacentSectors(ship.current_sector_id, req.userId);

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
    const adjacentSectors = await shipService.getAdjacentSectors(ship.current_sector_id, req.userId);

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

const getCrewEffectiveness = async (req, res, next) => {
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

    // Verify ship ownership
    await shipService.getShipStatus(shipId, req.userId);

    // Get crew effectiveness
    const effectiveness = await crewBonusService.getCrewEffectivenessSummary(shipId);

    res.json({
      success: true,
      data: effectiveness
    });
  } catch (error) {
    next(error);
  }
};

const activateShip = async (req, res, next) => {
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
    const ship = await shipService.activateShip(shipId, req.userId);

    res.json({
      success: true,
      message: 'Ship activated',
      data: { ship }
    });
  } catch (error) {
    next(error);
  }
};

const jumpDrive = async (req, res, next) => {
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

    const result = await shipService.jumpDrive(shipId, target_sector_id, req.userId);

    res.json({
      success: true,
      message: `Jump drive activated! Traveled ${result.jump_details.distance} units to ${result.ship.currentSector?.name || 'target sector'}`,
      data: {
        ship: result.ship.toJSON(),
        jump_details: result.jump_details
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
  jumpDrive,
  getAdjacentSectors,
  getCrewEffectiveness,
  activateShip
};
