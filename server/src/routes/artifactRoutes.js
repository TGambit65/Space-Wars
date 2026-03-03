const express = require('express');
const router = express.Router();
const artifactController = require('../controllers/artifactController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', artifactController.getUserArtifacts);
router.post('/:id/equip', artifactController.equipArtifact);
router.post('/:id/unequip', artifactController.unequipArtifact);

module.exports = router;
