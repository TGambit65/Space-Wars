const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User, Ship, Sector, Commodity, ShipCargo } = require('../models');
const { getStartingSector } = require('./universeGenerator');
const config = require('../config');

const generateToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id, username: user.username },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

const registerUser = async (username, email, password) => {
  // Check if user exists
  const existingUser = await User.findOne({
    where: {
      [Op.or]: [{ username }, { email }]
    }
  });

  if (existingUser) {
    const field = existingUser.username === username ? 'username' : 'email';
    const error = new Error(`${field} already exists`);
    error.statusCode = 409;
    throw error;
  }

  // Create user
  const user = await User.create({
    username,
    email,
    hashed_password: password
  });

  // Get starting sector
  let startingSector = await getStartingSector();
  
  if (!startingSector) {
    // If no starting sector exists, find any sector
    startingSector = await Sector.findOne();
    
    if (!startingSector) {
      const error = new Error('No sectors available. Universe may not be initialized.');
      error.statusCode = 500;
      throw error;
    }
  }

  // Create default ship for user (sanitize ship name)
  const sanitizedUsername = username.replace(/[<>&"']/g, '');
  const ship = await Ship.create({
    owner_user_id: user.user_id,
    current_sector_id: startingSector.sector_id,
    ship_type: 'Scout',
    name: `${sanitizedUsername}'s Scout`
  });

  // Give starting cargo to new player
  const startingCargo = config.economy?.startingCargo || {};
  for (const [commodityName, quantity] of Object.entries(startingCargo)) {
    const commodity = await Commodity.findOne({ where: { name: commodityName } });
    if (commodity) {
      await ShipCargo.create({
        ship_id: ship.ship_id,
        commodity_id: commodity.commodity_id,
        quantity: quantity
      });
    }
  }

  // Generate token
  const token = generateToken(user);

  return {
    user: user.toJSON(),
    ship: ship.toJSON(),
    startingSector: startingSector.toJSON(),
    token
  };
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

