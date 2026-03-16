const factionService = require('../services/factionService');
const factionWarService = require('../services/factionWarService');

const listFactions = async (req, res, next) => {
  try {
    const factions = await factionService.listFactions();
    res.json({ success: true, data: factions });
  } catch (error) {
    next(error);
  }
};

const getStandings = async (req, res, next) => {
  try {
    const standings = await factionService.getStandings(req.userId);
    res.json({ success: true, data: standings });
  } catch (error) {
    next(error);
  }
};

const getLeaderboard = async (req, res, next) => {
  try {
    const leaderboard = await factionService.getLeaderboard();
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    next(error);
  }
};

const getWars = async (req, res, next) => {
  try {
    const wars = await factionWarService.getWars();
    res.json({ success: true, data: wars });
  } catch (error) {
    next(error);
  }
};

const getActiveWar = async (req, res, next) => {
  try {
    const wars = await factionWarService.getActiveWars();
    res.json({ success: true, data: wars });
  } catch (error) {
    next(error);
  }
};

module.exports = { listFactions, getStandings, getLeaderboard, getWars, getActiveWar };
