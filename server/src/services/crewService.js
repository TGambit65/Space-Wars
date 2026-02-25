const { Crew, Ship, User, Port, sequelize } = require('../models');
const config = require('../config');

/**
 * Get available crew at a port
 */
const getCrewAtPort = async (portId) => {
  const port = await Port.findByPk(portId);
  if (!port) {
    throw Object.assign(new Error('Port not found'), { statusCode: 404 });
  }

  const crew = await Crew.findAll({
    where: {
      port_id: portId,
      owner_user_id: null,
      is_active: true
    }
  });

  return crew.map(c => ({
    crew_id: c.crew_id,
    name: c.name,
    species: c.species,
    level: c.level,
    salary: c.salary,
    hiring_fee: c.salary * config.crew.hiringFeeMultiplier,
    bonuses: config.crewSpecies[c.species.toUpperCase().replace(' ', '_')]?.bonuses || {}
  }));
};

/**
 * Hire a crew member
 */
const hireCrew = async (crewId, shipId, userId) => {
  const transaction = await sequelize.transaction();

  try {
    // Get crew member
    const crew = await Crew.findOne({
      where: { crew_id: crewId, owner_user_id: null, is_active: true },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!crew) {
      throw Object.assign(new Error('Crew member not available for hire'), { statusCode: 404 });
    }

    // Get ship
    const ship = await Ship.findOne({
      where: { ship_id: shipId, owner_user_id: userId },
      transaction,
      include: [{ model: Crew, as: 'crew' }]
    });

    if (!ship) {
      throw Object.assign(new Error('Ship not found'), { statusCode: 404 });
    }

    // Check if ship is at the port where crew is available
    const port = await Port.findByPk(crew.port_id, { transaction });
    if (port && port.sector_id !== ship.current_sector_id) {
      throw Object.assign(new Error('Ship must be at the port where the crew member is available'), { statusCode: 400 });
    }

    // Check crew capacity
    const shipTypeKey = ship.ship_type.toUpperCase().replace(/ /g, '_');
    const crewCapacity = config.crewCapacity[shipTypeKey] || 2;
    const currentCrew = ship.crew ? ship.crew.length : 0;

    if (currentCrew >= crewCapacity) {
      throw Object.assign(new Error(`Ship crew capacity reached (${crewCapacity})`), { statusCode: 400 });
    }

    // Get user and check credits
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    const hiringFee = crew.salary * config.crew.hiringFeeMultiplier;

    if (user.credits < hiringFee) {
      throw Object.assign(new Error(`Insufficient credits. Hiring fee is ${hiringFee} credits.`), { statusCode: 400 });
    }

    // Deduct hiring fee
    await user.update({ credits: user.credits - hiringFee }, { transaction });

    // Assign crew to ship and user
    await crew.update({
      owner_user_id: userId,
      current_ship_id: shipId,
      port_id: null
    }, { transaction });

    await transaction.commit();

    return {
      crew,
      hiring_fee: hiringFee,
      remaining_credits: user.credits - hiringFee
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Assign a role to a crew member
 */
const assignRole = async (crewId, role, userId) => {
  const validRoles = Object.keys(config.crewRoles);
  if (!validRoles.includes(role.toUpperCase())) {
    throw Object.assign(new Error(`Invalid role. Valid roles: ${validRoles.join(', ')}`), { statusCode: 400 });
  }

  const crew = await Crew.findOne({
    where: { crew_id: crewId, owner_user_id: userId }
  });

  if (!crew) {
    throw Object.assign(new Error('Crew member not found or not owned by you'), { statusCode: 404 });
  }

  const roleName = config.crewRoles[role.toUpperCase()].name;
  await crew.update({ assigned_role: roleName });

  return crew;
};

/**
 * Get all crew members hired by a user
 */
const getUserCrew = async (userId) => {
  const crew = await Crew.findAll({
    where: { owner_user_id: userId, is_active: true },
    include: [{ model: Ship, as: 'ship', attributes: ['ship_id', 'name'] }]
  });

  return crew;
};

/**
 * Get crew on a specific ship
 */
const getShipCrew = async (shipId, userId) => {
  const ship = await Ship.findOne({
    where: { ship_id: shipId, owner_user_id: userId }
  });

  if (!ship) {
    throw Object.assign(new Error('Ship not found'), { statusCode: 404 });
  }

  const crew = await Crew.findAll({
    where: { current_ship_id: shipId, is_active: true }
  });

  const shipTypeKey = ship.ship_type.toUpperCase().replace(/ /g, '_');
  const crewCapacity = config.crewCapacity[shipTypeKey] || 2;

  return {
    ship_id: shipId,
    ship_name: ship.name,
    crew_capacity: crewCapacity,
    current_crew: crew.length,
    crew: crew
  };
};

/**
 * Dismiss a crew member
 */
const dismissCrew = async (crewId, userId) => {
  const crew = await Crew.findOne({
    where: { crew_id: crewId, owner_user_id: userId }
  });

  if (!crew) {
    throw Object.assign(new Error('Crew member not found'), { statusCode: 404 });
  }

  // Crew member becomes inactive (leaves service)
  await crew.update({
    owner_user_id: null,
    current_ship_id: null,
    assigned_role: null,
    is_active: false
  });

  return { message: 'Crew member dismissed' };
};

/**
 * Transfer crew member to another ship
 */
const transferCrew = async (crewId, targetShipId, userId) => {
  const transaction = await sequelize.transaction();

  try {
    const crew = await Crew.findOne({
      where: { crew_id: crewId, owner_user_id: userId },
      transaction
    });

    if (!crew) {
      throw Object.assign(new Error('Crew member not found'), { statusCode: 404 });
    }

    const targetShip = await Ship.findOne({
      where: { ship_id: targetShipId, owner_user_id: userId },
      include: [{ model: Crew, as: 'crew' }],
      transaction
    });

    if (!targetShip) {
      throw Object.assign(new Error('Target ship not found'), { statusCode: 404 });
    }

    // Ships must be in the same sector for crew transfer
    if (crew.current_ship_id) {
      const currentShip = await Ship.findByPk(crew.current_ship_id, { transaction });
      if (currentShip && currentShip.current_sector_id !== targetShip.current_sector_id) {
        throw Object.assign(new Error('Ships must be in the same sector for crew transfer'), { statusCode: 400 });
      }
    }

    // Check target ship capacity
    const shipTypeKey = targetShip.ship_type.toUpperCase().replace(/ /g, '_');
    const crewCapacity = config.crewCapacity[shipTypeKey] || 2;
    const currentCrew = targetShip.crew ? targetShip.crew.length : 0;

    if (currentCrew >= crewCapacity) {
      throw Object.assign(new Error(`Target ship crew capacity reached (${crewCapacity})`), { statusCode: 400 });
    }

    await crew.update({ current_ship_id: targetShipId }, { transaction });
    await transaction.commit();

    return crew;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Calculate and process salary payments
 */
const processSalaries = async (userId) => {
  const transaction = await sequelize.transaction();

  try {
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    const now = new Date();
    const lastTick = new Date(user.last_salary_tick || now);
    const hoursPassed = (now - lastTick) / (1000 * 60 * 60);

    // Only process if at least 24 hours have passed
    if (hoursPassed < 24) {
      await transaction.commit();
      return {
        message: 'Salaries not due yet',
        hours_until_due: Math.ceil(24 - hoursPassed)
      };
    }

    // Get all hired crew
    const crew = await Crew.findAll({
      where: { owner_user_id: userId, is_active: true },
      transaction
    });

    const totalSalary = crew.reduce((sum, c) => sum + c.salary, 0) * config.crew.salaryMultiplier;
    const daysPassed = Math.floor(hoursPassed / 24);
    const totalDue = totalSalary * daysPassed;

    if (user.credits >= totalDue) {
      // Pay salaries
      await user.update({
        credits: user.credits - totalDue,
        crew_salary_due: 0,
        last_salary_tick: now
      }, { transaction });

      await transaction.commit();
      return {
        message: 'Salaries paid',
        total_paid: totalDue,
        days_covered: daysPassed,
        remaining_credits: user.credits - totalDue
      };
    } else {
      // Accumulate debt
      const unpaidAmount = totalDue - user.credits;
      await user.update({
        credits: 0,
        crew_salary_due: user.crew_salary_due + unpaidAmount,
        last_salary_tick: now
      }, { transaction });

      await transaction.commit();
      return {
        message: 'Insufficient funds for full salary payment',
        partial_paid: user.credits,
        debt_accumulated: unpaidAmount,
        total_debt: user.crew_salary_due + unpaidAmount
      };
    }
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Pay off salary debt
 */
const paySalaryDebt = async (userId, amount = null) => {
  const transaction = await sequelize.transaction();

  try {
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });

    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    if (user.crew_salary_due === 0) {
      await transaction.commit();
      return { message: 'No salary debt to pay' };
    }

    const payAmount = amount ? Math.min(amount, user.crew_salary_due, user.credits) : Math.min(user.crew_salary_due, user.credits);

    if (payAmount <= 0) {
      throw Object.assign(new Error('Insufficient credits to pay debt'), { statusCode: 400 });
    }

    const newCredits = user.credits - payAmount;
    const newDebt = user.crew_salary_due - payAmount;

    await user.update({
      credits: newCredits,
      crew_salary_due: newDebt
    }, { transaction });

    await transaction.commit();

    return {
      message: 'Salary debt paid',
      amount_paid: payAmount,
      remaining_debt: newDebt,
      remaining_credits: newCredits
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
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

