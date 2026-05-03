const { Ship } = require('../models');
const shipInteriorService = require('../services/shipInteriorService');

async function getInterior(req, res) {
  try {
    const { shipId } = req.params;
    const mode = req.query.mode === 'derelict' ? 'derelict' : 'normal';
    const ship = await Ship.findByPk(shipId);
    if (!ship) {
      return res.status(404).json({ success: false, message: 'Ship not found' });
    }
    if (mode === 'normal') {
      if (ship.owner_user_id !== req.userId) {
        return res.status(403).json({ success: false, message: 'You do not own this ship' });
      }
    } else {
      // Derelict mode: ship must actually be derelict/abandoned (status 'destroyed' or no owner)
      // and the player must be in the same sector.
      const isDerelict = !ship.owner_user_id || ship.status === 'destroyed' || ship.status === 'derelict';
      if (!isDerelict) {
        return res.status(403).json({ success: false, message: 'Ship is not derelict' });
      }
      if (req.user) {
        if (req.user.current_sector_id && ship.sector_id && req.user.current_sector_id !== ship.sector_id) {
          return res.status(403).json({ success: false, message: 'You are not in the same sector as this derelict' });
        }
      }
    }
    const data = shipInteriorService.buildInterior(ship.toJSON(), { mode });
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

module.exports = { getInterior };
