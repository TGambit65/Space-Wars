/**
 * Controller for voxel block endpoints.
 */
const voxelService = require('../services/voxelService');

/**
 * Parse and validate an integer from input. Returns NaN if invalid.
 */
function safeInt(val) {
  if (val === undefined || val === null) return NaN;
  const n = Number(val);
  return Number.isFinite(n) ? Math.floor(n) : NaN;
}

const getChunkModifications = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const { cx, cz } = req.query;
    const parsedCx = safeInt(cx);
    const parsedCz = safeInt(cz);
    if (isNaN(parsedCx) || isNaN(parsedCz)) {
      return res.status(400).json({ success: false, data: null, message: 'cx and cz must be valid integers' });
    }
    const data = await voxelService.getChunkModifications(colonyId, parsedCx, parsedCz);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const placeBlock = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const chunk_x = safeInt(req.body.chunk_x);
    const chunk_z = safeInt(req.body.chunk_z);
    const local_x = safeInt(req.body.local_x);
    const local_y = safeInt(req.body.local_y);
    const local_z = safeInt(req.body.local_z);
    const block_type = safeInt(req.body.block_type);

    if ([chunk_x, chunk_z, local_x, local_y, local_z, block_type].some(isNaN)) {
      return res.status(400).json({
        success: false, data: null,
        message: 'chunk_x, chunk_z, local_x, local_y, local_z, and block_type must be valid integers'
      });
    }
    if (local_x < 0 || local_x > 15 || local_z < 0 || local_z > 15 || local_y < 0 || local_y > 127) {
      return res.status(400).json({ success: false, data: null, message: 'Local coordinates out of range' });
    }
    if (block_type < 0 || block_type > 255) {
      return res.status(400).json({ success: false, data: null, message: 'block_type must be 0-255' });
    }

    const data = await voxelService.placeBlock(colonyId, req.userId, {
      chunk_x, chunk_z, local_x, local_y, local_z, block_type
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const removeBlock = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const chunk_x = safeInt(req.body.chunk_x);
    const chunk_z = safeInt(req.body.chunk_z);
    const local_x = safeInt(req.body.local_x);
    const local_y = safeInt(req.body.local_y);
    const local_z = safeInt(req.body.local_z);

    if ([chunk_x, chunk_z, local_x, local_y, local_z].some(isNaN)) {
      return res.status(400).json({
        success: false, data: null,
        message: 'chunk_x, chunk_z, local_x, local_y, and local_z must be valid integers'
      });
    }
    if (local_x < 0 || local_x > 15 || local_z < 0 || local_z > 15 || local_y < 0 || local_y > 127) {
      return res.status(400).json({ success: false, data: null, message: 'Local coordinates out of range' });
    }

    const data = await voxelService.removeBlock(colonyId, req.userId, {
      chunk_x, chunk_z, local_x, local_y, local_z
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const bulkOperation = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const { operations } = req.body;
    if (!Array.isArray(operations)) {
      return res.status(400).json({ success: false, data: null, message: 'operations array required' });
    }
    const data = await voxelService.bulkOperation(colonyId, req.userId, operations);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

module.exports = { getChunkModifications, placeBlock, removeBlock, bulkOperation };
