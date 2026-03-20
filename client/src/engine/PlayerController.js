import { FirstPersonTraversalController } from './FirstPersonTraversalController.js';

export class PlayerController extends FirstPersonTraversalController {
  constructor(camera, chunkManager, domElement, options = {}) {
    super(camera, chunkManager, domElement, {
      profileId: 'colony_surface',
      ...options,
    });
  }
}

export { FirstPersonTraversalController } from './FirstPersonTraversalController.js';
