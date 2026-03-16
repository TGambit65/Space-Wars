const { Outpost, User, Sector, sequelize } = require('../models');
const config = require('../config');

const buildOutpost = async (userId, sectorId, outpostType, name) => {
  const typeConfig = config.outpostTypes[outpostType];
  if (!typeConfig) {
    const error = new Error(`Invalid outpost type: ${outpostType}`);
    error.statusCode = 400;
    throw error;
  }

  const sector = await Sector.findByPk(sectorId);
  if (!sector) {
    const error = new Error('Sector not found');
    error.statusCode = 404;
    throw error;
  }

  const transaction = await sequelize.transaction();

  try {
    const user = await User.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (user.credits < typeConfig.buildCost) {
      const error = new Error(`Insufficient credits. Building costs ${typeConfig.buildCost} credits.`);
      error.statusCode = 400;
      throw error;
    }

    const outpost = await Outpost.create({
      user_id: userId,
      sector_id: sectorId,
      outpost_type: outpostType,
      name: name || typeConfig.name,
      level: 1,
      corporation_id: user.corporation_id || null
    }, { transaction });

    await user.update(
      { credits: user.credits - typeConfig.buildCost },
      { transaction }
    );

    await transaction.commit();

    await outpost.reload({
      include: [{ model: Sector, as: 'sector' }]
    });

    return outpost;
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

const getUserOutposts = async (userId) => {
  const outposts = await Outpost.findAll({
    where: { user_id: userId },
    include: [{
      model: Sector,
      as: 'sector',
      attributes: ['sector_id', 'name']
    }],
    order: [['created_at', 'DESC']]
  });

  return outposts;
};

const upgradeOutpost = async (outpostId, userId) => {
  const transaction = await sequelize.transaction();

  try {
    const outpost = await Outpost.findByPk(outpostId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!outpost) {
      const error = new Error('Outpost not found');
      error.statusCode = 404;
      throw error;
    }

    if (outpost.user_id !== userId) {
      const error = new Error('You do not own this outpost');
      error.statusCode = 403;
      throw error;
    }

    const typeConfig = config.outpostTypes[outpost.outpost_type];
    if (!typeConfig) {
      const error = new Error('Invalid outpost type configuration');
      error.statusCode = 500;
      throw error;
    }

    if (outpost.level >= typeConfig.maxLevel) {
      const error = new Error('Outpost is already at maximum level');
      error.statusCode = 400;
      throw error;
    }

    const upgradeCost = outpost.level * typeConfig.buildCost;

    const user = await User.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (user.credits < upgradeCost) {
      const error = new Error(`Insufficient credits. Upgrade costs ${upgradeCost} credits.`);
      error.statusCode = 400;
      throw error;
    }

    await outpost.update({ level: outpost.level + 1 }, { transaction });
    await user.update({ credits: user.credits - upgradeCost }, { transaction });

    await transaction.commit();

    await outpost.reload();
    return outpost;
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

const destroyOutpost = async (outpostId, userId) => {
  const outpost = await Outpost.findByPk(outpostId);

  if (!outpost) {
    const error = new Error('Outpost not found');
    error.statusCode = 404;
    throw error;
  }

  if (outpost.user_id !== userId) {
    const error = new Error('You do not own this outpost');
    error.statusCode = 403;
    throw error;
  }

  await outpost.destroy();

  return { message: 'Outpost destroyed' };
};

const getOutpostsInSector = async (sectorId) => {
  const outposts = await Outpost.findAll({
    where: { sector_id: sectorId },
    include: [{
      model: User,
      as: 'owner',
      attributes: ['user_id', 'username']
    }],
    order: [['level', 'DESC']]
  });

  return outposts;
};

module.exports = {
  buildOutpost,
  getUserOutposts,
  upgradeOutpost,
  destroyOutpost,
  getOutpostsInSector
};
