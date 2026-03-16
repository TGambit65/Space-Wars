const { CommunityEvent, EventContribution, User, sequelize } = require('../models');
const { Op } = require('sequelize');

const getActiveEvents = async () => {
  const now = new Date();
  const events = await CommunityEvent.findAll({
    where: {
      status: 'active',
      starts_at: { [Op.lte]: now },
      ends_at: { [Op.gte]: now }
    },
    order: [['ends_at', 'ASC']]
  });

  return events;
};

const getAllEvents = async ({ page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;

  const { count, rows } = await CommunityEvent.findAndCountAll({
    include: [{
      model: EventContribution,
      as: 'contributions',
      attributes: []
    }],
    attributes: {
      include: [
        [sequelize.fn('COUNT', sequelize.col('contributions.contribution_id')), 'contribution_count']
      ]
    },
    group: ['CommunityEvent.event_id'],
    order: [['created_at', 'DESC']],
    offset,
    limit,
    subQuery: false
  });

  return {
    events: rows,
    total: count.length || 0,
    page,
    limit
  };
};

const createEvent = async (data) => {
  const event = await CommunityEvent.create({
    name: data.name,
    description: data.description,
    event_type: data.event_type,
    goal_type: data.goal_type,
    target_value: data.target_value,
    current_value: 0,
    rewards: data.rewards || {},
    faction_filter: data.faction_filter || null,
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    status: 'active'
  });

  return event;
};

const contribute = async (eventId, userId, amount) => {
  if (!amount || amount <= 0) {
    const error = new Error('Contribution amount must be positive');
    error.statusCode = 400;
    throw error;
  }

  const event = await CommunityEvent.findByPk(eventId);
  if (!event) {
    const error = new Error('Event not found');
    error.statusCode = 404;
    throw error;
  }

  if (event.status !== 'active') {
    const error = new Error('Event is not active');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  if (now < new Date(event.starts_at) || now > new Date(event.ends_at)) {
    const error = new Error('Event is not currently running');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await sequelize.transaction();

  try {
    // Find or create contribution record
    const [contribution, created] = await EventContribution.findOrCreate({
      where: { event_id: eventId, user_id: userId },
      defaults: { amount: 0 },
      transaction
    });

    await contribution.update(
      { amount: contribution.amount + amount },
      { transaction }
    );

    // Increment event's current_value
    await event.update(
      { current_value: event.current_value + amount },
      { transaction }
    );

    // Check if target reached
    if (event.current_value + amount >= event.target_value && event.status === 'active') {
      await event.update({ status: 'completed' }, { transaction });
    }

    await transaction.commit();

    await event.reload();
    return { contribution, event };
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

const getLeaderboard = async (eventId) => {
  const event = await CommunityEvent.findByPk(eventId);
  if (!event) {
    const error = new Error('Event not found');
    error.statusCode = 404;
    throw error;
  }

  const contributions = await EventContribution.findAll({
    where: { event_id: eventId },
    include: [{
      model: User,
      as: 'user',
      attributes: ['user_id', 'username']
    }],
    order: [['amount', 'DESC']],
    limit: 20
  });

  return contributions;
};

module.exports = {
  getActiveEvents,
  getAllEvents,
  createEvent,
  contribute,
  getLeaderboard
};
