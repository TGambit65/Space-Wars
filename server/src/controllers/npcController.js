const npcService = require('../services/npcService');

/**
 * Get NPCs in a sector
 */
const getNPCsInSector = async (req, res, next) => {
  try {
    const { sectorId } = req.params;
    const npcs = await npcService.getNPCsInSector(sectorId);
    res.json({ success: true, npcs });
  } catch (error) {
    next(error);
  }
};

/**
 * Get NPC details
 */
const getNPCById = async (req, res, next) => {
  try {
    const { npcId } = req.params;
    const npc = await npcService.getNPCById(npcId);
    res.json({ success: true, npc });
  } catch (error) {
    next(error);
  }
};

/**
 * Spawn an NPC (admin/dev endpoint)
 */
const spawnNPC = async (req, res, next) => {
  try {
    const { sector_id, npc_type } = req.body;

    if (!sector_id) {
      return res.status(400).json({ success: false, error: 'sector_id required' });
    }

    const npc = await npcService.spawnNPC(sector_id, npc_type);
    res.json({ success: true, npc });
  } catch (error) {
    next(error);
  }
};

/**
 * Trigger NPC respawn (admin/scheduled)
 */
const respawnNPCs = async (req, res, next) => {
  try {
    const count = await npcService.respawnNPCs();
    res.json({ success: true, respawned_count: count });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNPCsInSector,
  getNPCById,
  spawnNPC,
  respawnNPCs
};

