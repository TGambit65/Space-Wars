const missionService = require('../services/missionService');

const getAvailableMissions = async (req, res, next) => {
  try {
    const { portId } = req.params;
    const missions = await missionService.getAvailableMissions(portId, req.user.user_id);
    res.json({ success: true, data: { missions } });
  } catch (error) {
    next(error);
  }
};

const getActiveMissions = async (req, res, next) => {
  try {
    const missions = await missionService.getActiveMissions(req.user.user_id);
    res.json({ success: true, data: { missions } });
  } catch (error) {
    next(error);
  }
};

const acceptMission = async (req, res, next) => {
  try {
    const { missionId } = req.params;
    const pm = await missionService.acceptMission(req.user.user_id, missionId);
    res.json({ success: true, data: { player_mission: pm } });
  } catch (error) {
    next(error);
  }
};

const abandonMission = async (req, res, next) => {
  try {
    const { playerMissionId } = req.params;
    const pm = await missionService.abandonMission(req.user.user_id, playerMissionId);
    res.json({ success: true, data: { player_mission: pm } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAvailableMissions, getActiveMissions, acceptMission, abandonMission };
