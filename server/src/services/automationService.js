const { AutomatedTask, Ship, User, Port, Sector, SectorConnection } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const config = require('../config');

/**
 * Create a trade route automation
 */
const createTradeRoute = async (userId, shipId, waypoints) => {
  await validateAutomation(userId, shipId);

  if (!waypoints || waypoints.length < 2) {
    const error = new Error('Trade route requires at least 2 waypoints');
    error.statusCode = 400;
    throw error;
  }

  // Validate waypoint structure
  for (const wp of waypoints) {
    if (!wp || !wp.sector_id) {
      const error = new Error('Each waypoint must have a sector_id');
      error.statusCode = 400;
      throw error;
    }
  }

  // Validate all waypoint sectors exist
  for (const wp of waypoints) {
    const sector = await Sector.findByPk(wp.sector_id);
    if (!sector) {
      const error = new Error(`Sector not found: ${wp.sector_id}`);
      error.statusCode = 400;
      throw error;
    }
  }

  const task = await AutomatedTask.create({
    user_id: userId,
    ship_id: shipId,
    task_type: 'trade_route',
    status: 'active',
    task_config: { waypoints },
    current_step: 0,
    total_steps: waypoints.length,
    required_tech: 'BASIC_AUTOMATION'
  });

  return task;
};

/**
 * Create a mining run automation
 */
const createMiningRun = async (userId, shipId, colonyId, returnPortId) => {
  await validateAutomation(userId, shipId);

  const task = await AutomatedTask.create({
    user_id: userId,
    ship_id: shipId,
    task_type: 'mining_run',
    status: 'active',
    task_config: { colonyId, returnPortId },
    current_step: 0,
    total_steps: 4, // travel to colony, mine, travel to port, sell
    required_tech: 'BASIC_AUTOMATION'
  });

  return task;
};

/**
 * Validate automation prerequisites
 */
const validateAutomation = async (userId, shipId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Check tech requirement
  const progressionService = require('./progressionService');
  const hasTech = await progressionService.hasCompletedTech(userId, 'BASIC_AUTOMATION');
  if (!hasTech) {
    const error = new Error('Requires BASIC_AUTOMATION tech');
    error.statusCode = 400;
    throw error;
  }

  const ship = await Ship.findOne({
    where: { ship_id: shipId, owner_user_id: userId }
  });
  if (!ship) {
    const error = new Error('Ship not found or not owned');
    error.statusCode = 404;
    throw error;
  }

  // Check max active tasks
  const activeCount = await AutomatedTask.count({
    where: { user_id: userId, status: 'active' }
  });
  if (activeCount >= config.automation.maxActiveTasksPerUser) {
    const error = new Error(`Maximum active automation tasks reached (${config.automation.maxActiveTasksPerUser})`);
    error.statusCode = 400;
    throw error;
  }

  // Check ship not already assigned to automation
  const existingTask = await AutomatedTask.findOne({
    where: { ship_id: shipId, status: 'active' }
  });
  if (existingTask) {
    const error = new Error('Ship already has an active automation task');
    error.statusCode = 400;
    throw error;
  }
};

/**
 * Pause an automation task
 */
const pauseTask = async (userId, taskId) => {
  const task = await AutomatedTask.findOne({
    where: { task_id: taskId, user_id: userId, status: 'active' }
  });
  if (!task) {
    const error = new Error('Active task not found');
    error.statusCode = 404;
    throw error;
  }

  await task.update({ status: 'paused' });
  return task;
};

/**
 * Resume a paused task
 */
const resumeTask = async (userId, taskId) => {
  const task = await AutomatedTask.findOne({
    where: { task_id: taskId, user_id: userId, status: 'paused' }
  });
  if (!task) {
    const error = new Error('Paused task not found');
    error.statusCode = 404;
    throw error;
  }

  await task.update({ status: 'active' });
  return task;
};

/**
 * Cancel an automation task
 */
const cancelTask = async (userId, taskId) => {
  const task = await AutomatedTask.findOne({
    where: { task_id: taskId, user_id: userId, status: { [Op.in]: ['active', 'paused'] } }
  });
  if (!task) {
    const error = new Error('Task not found');
    error.statusCode = 404;
    throw error;
  }

  await task.update({ status: 'cancelled' });
  return task;
};

/**
 * Get active tasks for a user
 */
const getActiveTasks = async (userId) => {
  return AutomatedTask.findAll({
    where: { user_id: userId, status: { [Op.in]: ['active', 'paused'] } },
    include: [{ model: Ship, as: 'ship', attributes: ['ship_id', 'name', 'ship_type'] }]
  });
};

/**
 * Process all active automation tasks (called from tick service)
 */
const processAutomationTick = async () => {
  const activeTasks = await AutomatedTask.findAll({
    where: { status: 'active' },
    include: [{ model: Ship, as: 'ship' }]
  });

  for (const task of activeTasks) {
    try {
      await executeStep(task);
    } catch (err) {
      await task.update({
        status: 'error',
        error_message: err.message
      });
    }
  }
};

/**
 * Execute one step of an automation task
 */
const executeStep = async (task) => {
  const ship = task.ship || await Ship.findByPk(task.ship_id);
  if (!ship || !ship.is_active) {
    throw Object.assign(new Error('Ship is inactive or destroyed'), { statusCode: 400 });
  }

  switch (task.task_type) {
    case 'trade_route':
      await executeTradeRouteStep(task, ship);
      break;
    case 'mining_run':
      await executeMiningRunStep(task, ship);
      break;
    case 'patrol_route':
      await executePatrolStep(task, ship);
      break;
    default:
      throw Object.assign(new Error(`Unknown task type: ${task.task_type}`), { statusCode: 500 });
  }

  await task.update({ last_executed_at: new Date() });
};

/**
 * Execute one step of a trade route
 */
const executeTradeRouteStep = async (task, ship) => {
  const waypoints = task.task_config.waypoints;
  const currentWaypoint = waypoints[task.current_step % waypoints.length];

  // Move ship to next waypoint sector if not already there
  if (ship.current_sector_id !== currentWaypoint.sector_id) {
    // Validate sector connectivity
    const connection = await SectorConnection.findOne({
      where: {
        [Op.or]: [
          { sector_a_id: ship.current_sector_id, sector_b_id: currentWaypoint.sector_id },
          { sector_a_id: currentWaypoint.sector_id, sector_b_id: ship.current_sector_id }
        ]
      }
    });
    if (!connection) {
      throw Object.assign(new Error('No route between current sector and waypoint'), { statusCode: 400 });
    }

    // Check fuel
    const fuelCost = Math.ceil(1 * config.automation.fuelMultiplier);
    if (ship.fuel < fuelCost) {
      throw Object.assign(new Error('Insufficient fuel'), { statusCode: 400 });
    }

    await ship.update({
      current_sector_id: currentWaypoint.sector_id,
      fuel: ship.fuel - fuelCost
    });
  }

  // Advance step
  const nextStep = task.current_step + 1;
  if (nextStep >= task.total_steps) {
    const runsCompleted = task.runs_completed + 1;
    if (task.max_runs > 0 && runsCompleted >= task.max_runs) {
      await task.update({ status: 'completed', runs_completed: runsCompleted, current_step: 0 });
    } else {
      await task.update({ runs_completed: runsCompleted, current_step: 0 });
    }
  } else {
    await task.update({ current_step: nextStep });
  }
};

/**
 * Execute one step of a mining run
 */
const executeMiningRunStep = async (task, ship) => {
  // Simplified: just advance steps (full mining logic deferred)
  const nextStep = task.current_step + 1;
  if (nextStep >= task.total_steps) {
    const runsCompleted = task.runs_completed + 1;
    if (task.max_runs > 0 && runsCompleted >= task.max_runs) {
      await task.update({ status: 'completed', runs_completed: runsCompleted, current_step: 0 });
    } else {
      await task.update({ runs_completed: runsCompleted, current_step: 0 });
    }
  } else {
    await task.update({ current_step: nextStep });
  }
};

/**
 * Execute one step of a patrol route
 */
const executePatrolStep = async (task, ship) => {
  // Same step-advance pattern
  const nextStep = task.current_step + 1;
  if (nextStep >= task.total_steps) {
    const runsCompleted = task.runs_completed + 1;
    if (task.max_runs > 0 && runsCompleted >= task.max_runs) {
      await task.update({ status: 'completed', runs_completed: runsCompleted, current_step: 0 });
    } else {
      await task.update({ runs_completed: runsCompleted, current_step: 0 });
    }
  } else {
    await task.update({ current_step: nextStep });
  }
};

module.exports = {
  createTradeRoute,
  createMiningRun,
  pauseTask,
  resumeTask,
  cancelTask,
  getActiveTasks,
  processAutomationTick,
  executeStep
};
