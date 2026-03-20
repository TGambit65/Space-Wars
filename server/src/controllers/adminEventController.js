const communityEventService = require('../services/communityEventService');
const { CommunityEvent } = require('../models');

/**
 * GET /api/admin/events
 * All events, paginated.
 * Query: ?page=1&limit=20
 */
const getEvents = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

    const result = await communityEventService.getAllEvents({ page, limit });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/events
 * Create a new community event.
 * Body: { name, description, event_type, goal_type, target_value, rewards, starts_at, ends_at, faction_filter }
 */
const createEvent = async (req, res, next) => {
  try {
    const { name, description, event_type, goal_type, target_value, rewards, starts_at, ends_at, faction_filter } = req.body;

    if (!name || !event_type || !goal_type || !target_value || !starts_at || !ends_at) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, event_type, goal_type, target_value, starts_at, ends_at'
      });
    }

    const event = await communityEventService.createEvent({
      name, description, event_type, goal_type, target_value,
      rewards, starts_at, ends_at, faction_filter
    });

    res.json({ success: true, data: { event } });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/events/:id/end
 * Force-end an event (set status to 'ended').
 */
const endEvent = async (req, res, next) => {
  try {
    const event = await CommunityEvent.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    await event.update({ status: 'ended', ends_at: new Date() });
    res.json({ success: true, data: { event } });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/events/:id
 * Delete an event.
 */
const deleteEvent = async (req, res, next) => {
  try {
    const event = await CommunityEvent.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    await event.destroy();
    res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEvents,
  createEvent,
  endEvent,
  deleteEvent
};
