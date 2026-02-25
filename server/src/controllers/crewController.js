const crewService = require('../services/crewService');

/**
 * GET /api/crew/port/:portId
 * Get available crew at a port
 */
const getCrewAtPort = async (req, res, next) => {
  try {
    const { portId } = req.params;
    const crew = await crewService.getCrewAtPort(portId);
    res.json(crew);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/crew/hire
 * Hire a crew member
 */
const hireCrew = async (req, res, next) => {
  try {
    const { crew_id, ship_id } = req.body;
    const userId = req.user.user_id;

    if (!crew_id || !ship_id) {
      return res.status(400).json({ error: 'crew_id and ship_id are required' });
    }

    const result = await crewService.hireCrew(crew_id, ship_id, userId);
    res.status(201).json({
      message: 'Crew member hired successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/crew/:crewId/assign
 * Assign a role to a crew member
 */
const assignRole = async (req, res, next) => {
  try {
    const { crewId } = req.params;
    const { role } = req.body;
    const userId = req.user.user_id;

    if (!role) {
      return res.status(400).json({ error: 'role is required' });
    }

    const crew = await crewService.assignRole(crewId, role, userId);
    res.json({
      message: 'Role assigned successfully',
      crew
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/crew
 * Get all crew hired by the current user
 */
const getUserCrew = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const crew = await crewService.getUserCrew(userId);
    res.json(crew);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/crew/ship/:shipId
 * Get crew on a specific ship
 */
const getShipCrew = async (req, res, next) => {
  try {
    const { shipId } = req.params;
    const userId = req.user.user_id;
    const result = await crewService.getShipCrew(shipId, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/crew/:crewId
 * Dismiss a crew member
 */
const dismissCrew = async (req, res, next) => {
  try {
    const { crewId } = req.params;
    const userId = req.user.user_id;
    const result = await crewService.dismissCrew(crewId, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/crew/:crewId/transfer
 * Transfer crew member to another ship
 */
const transferCrew = async (req, res, next) => {
  try {
    const { crewId } = req.params;
    const { target_ship_id } = req.body;
    const userId = req.user.user_id;

    if (!target_ship_id) {
      return res.status(400).json({ error: 'target_ship_id is required' });
    }

    const crew = await crewService.transferCrew(crewId, target_ship_id, userId);
    res.json({
      message: 'Crew member transferred successfully',
      crew
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/crew/salaries/process
 * Process salary payments
 */
const processSalaries = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const result = await crewService.processSalaries(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/crew/salaries/pay-debt
 * Pay off salary debt
 */
const paySalaryDebt = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const userId = req.user.user_id;
    const result = await crewService.paySalaryDebt(userId, amount);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCrewAtPort,
  hireCrew,
  assignRole,
  getUserCrew,
  getShipCrew,
  dismissCrew,
  transferCrew,
  processSalaries,
  paySalaryDebt
};

