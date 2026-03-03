const artifactService = require('../services/artifactService');

const getUserArtifacts = async (req, res, next) => {
  try {
    const artifacts = await artifactService.getUserArtifacts(req.user.user_id);
    res.json({ success: true, data: { artifacts } });
  } catch (error) {
    next(error);
  }
};

const equipArtifact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ship_id } = req.body;
    if (!ship_id) {
      return res.status(400).json({ success: false, message: 'ship_id is required' });
    }
    const artifact = await artifactService.equipArtifact(req.user.user_id, id, ship_id);
    res.json({ success: true, data: { artifact } });
  } catch (error) {
    next(error);
  }
};

const unequipArtifact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const artifact = await artifactService.unequipArtifact(req.user.user_id, id);
    res.json({ success: true, data: { artifact } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUserArtifacts, equipArtifact, unequipArtifact };
