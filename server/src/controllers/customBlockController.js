/**
 * Controller for custom block endpoints.
 */
const customBlockService = require('../services/customBlockService');

const getBlocks = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const result = await customBlockService.getBlocks(colonyId, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const placeBlock = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const { block_type, grid_x, grid_y, rotation, color, blocks } = req.body;

    // Bulk place if blocks array provided
    if (blocks) {
      if (!Array.isArray(blocks)) {
        return res.status(400).json({ success: false, data: null, message: 'blocks must be an array' });
      }
      if (blocks.length === 0) {
        return res.status(400).json({ success: false, data: null, message: 'blocks array must not be empty' });
      }
      for (const b of blocks) {
        if (!b.block_type || !Number.isInteger(b.grid_x) || !Number.isInteger(b.grid_y) || b.grid_x < 0 || b.grid_y < 0) {
          return res.status(400).json({ success: false, data: null, message: 'Each block requires block_type and valid grid_x, grid_y' });
        }
        if (b.rotation !== undefined && ![0, 90, 180, 270].includes(b.rotation)) {
          return res.status(400).json({ success: false, data: null, message: 'rotation must be 0, 90, 180, or 270' });
        }
        if (b.color && !/^#[0-9a-fA-F]{6}$/.test(b.color)) {
          return res.status(400).json({ success: false, data: null, message: 'color must be a valid hex color (#RRGGBB)' });
        }
      }
      const result = await customBlockService.bulkPlace(colonyId, req.userId, blocks);
      return res.json({ success: true, data: result });
    }

    // Single place
    if (!block_type || grid_x === undefined || grid_y === undefined) {
      return res.status(400).json({ success: false, data: null, message: 'block_type, grid_x, and grid_y are required' });
    }
    if (!Number.isInteger(grid_x) || !Number.isInteger(grid_y) || grid_x < 0 || grid_y < 0) {
      return res.status(400).json({ success: false, data: null, message: 'grid_x and grid_y must be non-negative integers' });
    }
    if (rotation !== undefined && ![0, 90, 180, 270].includes(rotation)) {
      return res.status(400).json({ success: false, data: null, message: 'rotation must be 0, 90, 180, or 270' });
    }
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return res.status(400).json({ success: false, data: null, message: 'color must be a valid hex color (#RRGGBB)' });
    }

    const result = await customBlockService.placeBlock(colonyId, req.userId, block_type, grid_x, grid_y, rotation, color);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const removeBlock = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const { block_id, block_ids } = req.body;

    // Bulk remove if block_ids array provided
    if (block_ids) {
      if (!Array.isArray(block_ids) || block_ids.length === 0) {
        return res.status(400).json({ success: false, data: null, message: 'block_ids must be a non-empty array' });
      }
      const result = await customBlockService.bulkRemove(colonyId, req.userId, block_ids);
      return res.json({ success: true, data: result });
    }

    // Single remove
    if (!block_id) {
      return res.status(400).json({ success: false, data: null, message: 'block_id or block_ids required' });
    }

    const result = await customBlockService.removeBlock(colonyId, req.userId, block_id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

module.exports = {
  getBlocks,
  placeBlock,
  removeBlock
};
