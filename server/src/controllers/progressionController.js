const progressionService = require('../services/progressionService');

const getProgression = async (req, res, next) => {
  try {
    const data = await progressionService.getPlayerProgression(req.user.user_id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const upgradeSkill = async (req, res, next) => {
  try {
    const { skillName } = req.params;
    const result = await progressionService.upgradeSkill(req.user.user_id, skillName);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getTech = async (req, res, next) => {
  try {
    const available = await progressionService.getAvailableTechs(req.user.user_id);
    res.json({ success: true, data: { available } });
  } catch (error) {
    next(error);
  }
};

const startResearch = async (req, res, next) => {
  try {
    const { techName } = req.params;
    const research = await progressionService.startResearch(req.user.user_id, techName);
    res.json({ success: true, data: research });
  } catch (error) {
    next(error);
  }
};

const checkResearch = async (req, res, next) => {
  try {
    const completed = await progressionService.checkResearchCompletion(req.user.user_id);
    res.json({ success: true, data: { completed } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProgression, upgradeSkill, getTech, startResearch, checkResearch };
