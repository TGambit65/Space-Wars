const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User, Ship, Sector, Commodity, ShipCargo, sequelize } = require('../models');
const { getStartingSector } = require('./universeGenerator');
const { discoverSectorAndNeighbors } = require('./discoveryService');
const config = require('../config');

const generateToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id, username: user.username },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

const registerUser = async (username, email, password, faction = 'terran_alliance') => {
  const transaction = await sequelize.transaction();

  try {
    // Validate faction
    const factionConfig = config.factions[faction];
    if (!factionConfig) {
      const error = new Error('Invalid faction');
      error.statusCode = 400;
      throw error;
    }

    // Check if user exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }]
      },
      transaction
    });

    if (existingUser) {
      const field = existingUser.username === username ? 'username' : 'email';
      const error = new Error(`${field} already exists`);
      error.statusCode = 409;
      throw error;
    }

    console.log(`[AUTH] Creating user ${username} (faction: ${faction})...`);

    // Create user with faction-specific starting credits
    const user = await User.create({
      username,
      email,
      hashed_password: password,
      faction,
      credits: factionConfig.startingCredits
    }, { transaction });

    console.log(`[AUTH] User created: ${user.user_id}. Finding starting sector...`);

    // Get starting sector
    let startingSector = await getStartingSector();

    if (!startingSector) {
      // If no starting sector exists, try to find ANY sector
      startingSector = await Sector.findOne({ transaction });

      if (!startingSector) {
        throw new Error('No sectors available. Universe not initialized.');
      }
    }

    console.log(`[AUTH] Starting sector found: ${startingSector.sector_id}. Creating ship...`);

    // Create default ship for user based on faction starting ship
    const sanitizedUsername = username.replace(/[<>&"']/g, '');
    const startingShipType = factionConfig.startingShip || 'Scout';
    const ship = await Ship.create({
      owner_user_id: user.user_id,
      current_sector_id: startingSector.sector_id,
      ship_type: startingShipType,
      name: `${sanitizedUsername}'s ${startingShipType}`
    }, { transaction });

    // Create starter colony ship for new player
    const colonyShip = await Ship.create({
      owner_user_id: user.user_id,
      current_sector_id: startingSector.sector_id,
      ship_type: 'Insta Colony Ship',
      name: `${sanitizedUsername}'s Colony Ship`
    }, { transaction });

    console.log(`[AUTH] Ships created: ${ship.ship_id}, ${colonyShip.ship_id}. Adding starting cargo...`);

    // Give starting cargo to new player
    const startingCargo = config.economy?.startingCargo || {};
    for (const [commodityName, quantity] of Object.entries(startingCargo)) {
      const commodity = await Commodity.findOne({ where: { name: commodityName }, transaction });
      if (commodity) {
        await ShipCargo.create({
          ship_id: ship.ship_id,
          commodity_id: commodity.commodity_id,
          quantity: quantity
        }, { transaction });
      }
    }

    // Discover starting sector and neighbors (fog of war)
    await discoverSectorAndNeighbors(user.user_id, startingSector.sector_id, transaction);
    console.log(`[AUTH] Starting sector discovered with neighbors`);

    // Initialize faction standings
    try {
      const factionService = require('./factionService');
      await factionService.initializeStandings(user.user_id, faction, transaction);
      console.log(`[AUTH] Faction standings initialized`);
    } catch (e) { /* Faction init failure should not block registration */ }

    // Generate token
    const token = generateToken(user);

    await transaction.commit();
    console.log(`[AUTH] Registration complete for ${username}`);

    return {
      user: user.toJSON(),
      ship: ship.toJSON(),
      startingSector: startingSector.toJSON(),
      token
    };
  } catch (error) {
    await transaction.rollback();
    console.error(`[AUTH] Registration failed: ${error.message}`);
    // Re-throw specific status codes, otherwise 500
    if (!error.statusCode) error.statusCode = 500;
    throw error;
  }
};

const loginUser = async (username, password, clientIp = 'unknown') => {
  // Find user by username or email
  const user = await User.findOne({
    where: {
      [Op.or]: [
        { username },
        { email: username }
      ]
    }
  });

  if (!user) {
    // Log failed attempt (user not found) - same message to prevent enumeration
    console.warn(`[AUTH] Failed login attempt for non-existent user: ${username} from IP: ${clientIp}`);
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  // Validate password
  const isValid = await user.validatePassword(password);

  if (!isValid) {
    // Log failed attempt (wrong password)
    console.warn(`[AUTH] Failed login attempt for user: ${user.user_id} from IP: ${clientIp}`);
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  // Update last login
  await user.update({ last_login: new Date() });

  // Log successful login
  console.info(`[AUTH] Successful login for user: ${user.user_id} from IP: ${clientIp}`);

  // Generate token
  const token = generateToken(user);

  return {
    user: user.toJSON(),
    token
  };
};

const getUserProfile = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [{
      model: Ship,
      as: 'ships',
      include: [{
        model: Sector,
        as: 'currentSector'
      }]
    }]
  });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return user.toJSON();
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  generateToken
};

