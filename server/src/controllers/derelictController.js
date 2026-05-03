/**
 * derelictController — boarding endpoints for post-combat NPC wrecks
 * registered in derelictManifestService. Mirrors shipInteriorController
 * but reads from the derelict-manifest registry instead of the Ship
 * table since destroyed NPCs are never persisted as Ships.
 */

const derelictManifestService = require('../services/derelictManifestService');
const shipInteriorService = require('../services/shipInteriorService');
const lootAwardService = require('../services/lootAwardService');

async function getInterior(req, res) {
  try {
    const { derelictId } = req.params;
    if (!(await derelictManifestService.getManifest(derelictId))) {
      return res.status(404).json({ success: false, message: 'Derelict not found or expired' });
    }
    if (!(await derelictManifestService.isAuthorizedToBoard(derelictId, req.userId))) {
      return res.status(403).json({
        success: false,
        message: 'Only ships that fought the wreck or are in its sector can board it'
      });
    }
    const interior = await derelictManifestService.buildInteriorForUser(derelictId, req.userId);
    if (!interior) {
      return res.status(404).json({ success: false, message: 'Derelict not found or expired' });
    }
    res.json({ success: true, data: interior });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

async function lootCrate(req, res) {
  try {
    const { derelictId } = req.params;
    const { deckId, x, y } = req.body || {};
    if (!deckId || typeof x !== 'number' || typeof y !== 'number') {
      return res.status(400).json({ success: false, message: 'deckId, x, y required' });
    }

    const manifest = await derelictManifestService.getManifest(derelictId);
    if (!manifest) {
      return res.status(404).json({ success: false, message: 'Derelict not found or expired' });
    }

    if (!(await derelictManifestService.isAuthorizedToBoard(derelictId, req.userId))) {
      return res.status(403).json({
        success: false,
        message: 'Only ships that fought the wreck or are in its sector can board it'
      });
    }

    const crate = derelictManifestService.findCrate(manifest, deckId, x, y);
    if (!crate) {
      return res.status(400).json({ success: false, message: 'No loot crate at that tile' });
    }

    // Atomic claim BEFORE awarding so two concurrent requests for the same
    // crate cannot both pass the duplicate check and double-award.
    if (!(await derelictManifestService.claim(derelictId, req.userId, deckId, x, y))) {
      return res.status(400).json({ success: false, message: 'Crate already looted' });
    }

    // Use the manifest's pre-rolled crate contents so what the player saw
    // listed on the post-combat panel is exactly what they receive.
    const roll = crate.roll || shipInteriorService.rollCrateLoot(
      { ship_id: manifest.derelict_id, ship_type: manifest.ship_type },
      deckId, x, y
    );
    let result;
    try {
      result = await lootAwardService.awardRollToUser(req.userId, roll);
    } catch (e) {
      await derelictManifestService.releaseClaim(derelictId, req.userId, deckId, x, y);
      throw e;
    }
    if (result.error) {
      await derelictManifestService.releaseClaim(derelictId, req.userId, deckId, x, y);
      return res.status(result.error.statusCode).json({ success: false, message: result.error.message });
    }

    res.json({ success: true, data: { award: result.award, looted_key: `${deckId}:${x}:${y}` } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

module.exports = { getInterior, lootCrate };
