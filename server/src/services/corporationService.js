const { Corporation, CorporationMember, User } = require('../models');
const { sequelize } = require('../config/database');
const config = require('../config');

/**
 * Create a new corporation
 */
const createCorporation = async (userId, name, tag, description) => {
  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (user.corporation_id) {
    const error = new Error('Already in a corporation');
    error.statusCode = 400;
    throw error;
  }

  // Validate name/tag
  if (!name || name.length < config.corporations.nameMinLength || name.length > config.corporations.nameMaxLength) {
    const error = new Error(`Corporation name must be ${config.corporations.nameMinLength}-${config.corporations.nameMaxLength} characters`);
    error.statusCode = 400;
    throw error;
  }
  if (!tag || tag.length < config.corporations.tagMinLength || tag.length > config.corporations.tagMaxLength) {
    const error = new Error(`Corporation tag must be ${config.corporations.tagMinLength}-${config.corporations.tagMaxLength} characters`);
    error.statusCode = 400;
    throw error;
  }

  // Check credits
  if (Number(user.credits) < config.corporations.creationCost) {
    const error = new Error('Insufficient credits');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    const corp = await Corporation.create({
      name,
      tag,
      description: description || null,
      leader_user_id: userId,
      treasury: 0,
      member_count: 1,
      max_members: config.corporations.maxMembers,
      is_active: true
    }, { transaction });

    await CorporationMember.create({
      corporation_id: corp.corporation_id,
      user_id: userId,
      role: 'leader',
      joined_at: new Date(),
      contribution: 0
    }, { transaction });

    await user.update({
      credits: Number(user.credits) - config.corporations.creationCost,
      corporation_id: corp.corporation_id
    }, { transaction });

    await transaction.commit();
    return corp;
  } catch (err) {
    await transaction.rollback();
    // Handle unique constraint violations
    if (err.name === 'SequelizeUniqueConstraintError') {
      const error = new Error('Corporation name or tag already taken');
      error.statusCode = 400;
      throw error;
    }
    throw err;
  }
};

/**
 * Get corporation by ID
 */
const getCorporation = async (corpId) => {
  const corp = await Corporation.findByPk(corpId, {
    include: [
      { model: User, as: 'leader', attributes: ['user_id', 'username'] },
      { model: CorporationMember, as: 'corporationMembers', include: [{ model: User, as: 'user', attributes: ['user_id', 'username'] }] }
    ]
  });
  if (!corp) {
    const error = new Error('Corporation not found');
    error.statusCode = 404;
    throw error;
  }
  return corp;
};

/**
 * Get corporation by user
 */
const getCorporationByUser = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user || !user.corporation_id) return null;
  return getCorporation(user.corporation_id);
};

/**
 * Join a corporation
 */
const joinCorporation = async (userId, corpId) => {
  const transaction = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction, lock: true });
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (user.corporation_id) {
      const error = new Error('Already in a corporation');
      error.statusCode = 400;
      throw error;
    }

    const corp = await Corporation.findByPk(corpId, { transaction, lock: true });
    if (!corp || !corp.is_active) {
      const error = new Error('Corporation not found');
      error.statusCode = 404;
      throw error;
    }

    if (corp.member_count >= corp.max_members) {
      const error = new Error('Corporation is full');
      error.statusCode = 400;
      throw error;
    }

    await CorporationMember.create({
      corporation_id: corpId,
      user_id: userId,
      role: 'member',
      joined_at: new Date()
    }, { transaction });

    await corp.update({ member_count: corp.member_count + 1 }, { transaction });
    await user.update({ corporation_id: corpId }, { transaction });

    await transaction.commit();
    return corp.reload();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Leave a corporation
 */
const leaveCorporation = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user || !user.corporation_id) {
    const error = new Error('Not in a corporation');
    error.statusCode = 400;
    throw error;
  }

  const corp = await Corporation.findByPk(user.corporation_id);
  if (corp && corp.leader_user_id === userId) {
    const error = new Error('Leader cannot leave. Transfer leadership first or disband.');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    await CorporationMember.destroy({
      where: { corporation_id: user.corporation_id, user_id: userId },
      transaction
    });

    if (corp) {
      await corp.update({ member_count: Math.max(0, corp.member_count - 1) }, { transaction });
    }

    await user.update({ corporation_id: null }, { transaction });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Promote a member to a new role
 */
const promoteMember = async (leaderId, targetUserId, newRole) => {
  const leaderMember = await CorporationMember.findOne({
    where: { user_id: leaderId, role: { [require('sequelize').Op.in]: ['leader', 'officer'] } }
  });
  if (!leaderMember) {
    const error = new Error('Insufficient permissions');
    error.statusCode = 403;
    throw error;
  }

  // Only leaders can promote to officer
  if (newRole === 'officer' && leaderMember.role !== 'leader') {
    const error = new Error('Only leaders can promote to officer');
    error.statusCode = 403;
    throw error;
  }

  const targetMember = await CorporationMember.findOne({
    where: { corporation_id: leaderMember.corporation_id, user_id: targetUserId }
  });
  if (!targetMember) {
    const error = new Error('Member not found');
    error.statusCode = 404;
    throw error;
  }

  await targetMember.update({ role: newRole });
  return targetMember;
};

/**
 * Transfer leadership to another member
 */
const transferLeadership = async (leaderId, newLeaderId) => {
  const leaderMember = await CorporationMember.findOne({
    where: { user_id: leaderId, role: 'leader' }
  });
  if (!leaderMember) {
    const error = new Error('Not a leader');
    error.statusCode = 403;
    throw error;
  }

  const newLeaderMember = await CorporationMember.findOne({
    where: { corporation_id: leaderMember.corporation_id, user_id: newLeaderId }
  });
  if (!newLeaderMember) {
    const error = new Error('Target member not found');
    error.statusCode = 404;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    await leaderMember.update({ role: 'officer' }, { transaction });
    await newLeaderMember.update({ role: 'leader' }, { transaction });
    await Corporation.update(
      { leader_user_id: newLeaderId },
      { where: { corporation_id: leaderMember.corporation_id }, transaction }
    );
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Disband a corporation (leader only, refund treasury)
 */
const disbandCorporation = async (leaderId) => {
  const corp = await Corporation.findOne({ where: { leader_user_id: leaderId, is_active: true } });
  if (!corp) {
    const error = new Error('Not a leader of an active corporation');
    error.statusCode = 403;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    // Refund treasury to leader
    if (Number(corp.treasury) > 0) {
      const leader = await User.findByPk(leaderId, { transaction });
      await leader.update({ credits: Number(leader.credits) + Number(corp.treasury) }, { transaction });
    }

    // Remove all members
    const members = await CorporationMember.findAll({
      where: { corporation_id: corp.corporation_id },
      transaction
    });
    for (const member of members) {
      await User.update({ corporation_id: null }, { where: { user_id: member.user_id }, transaction });
    }
    await CorporationMember.destroy({ where: { corporation_id: corp.corporation_id }, transaction });

    await corp.update({ is_active: false, member_count: 0 }, { transaction });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Contribute credits to corporation treasury
 */
const contributeToTreasury = async (userId, amount) => {
  if (amount <= 0) {
    const error = new Error('Amount must be positive');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findByPk(userId);
  if (!user || !user.corporation_id) {
    const error = new Error('Not in a corporation');
    error.statusCode = 400;
    throw error;
  }

  if (Number(user.credits) < amount) {
    const error = new Error('Insufficient credits');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    await user.update({ credits: Number(user.credits) - amount }, { transaction });

    const corp = await Corporation.findByPk(user.corporation_id, { transaction });
    await corp.update({ treasury: Number(corp.treasury) + amount }, { transaction });

    const member = await CorporationMember.findOne({
      where: { corporation_id: user.corporation_id, user_id: userId },
      transaction
    });
    if (member) {
      await member.update({ contribution: Number(member.contribution) + amount }, { transaction });
    }

    await transaction.commit();
    await corp.reload();
    await member?.reload();
    return { treasury: Number(corp.treasury), contribution: Number(member?.contribution || 0) };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Withdraw from treasury (leader only)
 */
const withdrawFromTreasury = async (userId, amount) => {
  if (amount <= 0) {
    const error = new Error('Amount must be positive');
    error.statusCode = 400;
    throw error;
  }

  const corp = await Corporation.findOne({ where: { leader_user_id: userId, is_active: true } });
  if (!corp) {
    const error = new Error('Not a leader of an active corporation');
    error.statusCode = 403;
    throw error;
  }

  if (Number(corp.treasury) < amount) {
    const error = new Error('Insufficient treasury funds');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction });
    await user.update({ credits: Number(user.credits) + amount }, { transaction });
    await corp.update({ treasury: Number(corp.treasury) - amount }, { transaction });
    await transaction.commit();
    await corp.reload();
    return { treasury: Number(corp.treasury) };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Get corporation leaderboard
 */
const getCorporationLeaderboard = async (limit = 10) => {
  return Corporation.findAll({
    where: { is_active: true },
    order: [['treasury', 'DESC']],
    limit,
    include: [{ model: User, as: 'leader', attributes: ['user_id', 'username'] }]
  });
};

module.exports = {
  createCorporation,
  getCorporation,
  getCorporationByUser,
  joinCorporation,
  leaveCorporation,
  promoteMember,
  transferLeadership,
  disbandCorporation,
  contributeToTreasury,
  withdrawFromTreasury,
  getCorporationLeaderboard
};
