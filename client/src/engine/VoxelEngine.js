/**
 * VoxelEngine — top-level class managing the Three.js voxel scene.
 *
 * Owns the renderer, camera, lighting, and delegates chunk/sky/water
 * rendering to dedicated sub-systems.
 */

import * as THREE from 'three';
import { ChunkManager } from './ChunkManager.js';
import { createTextureAtlas } from './TextureAtlas.js';
import { BLOCKS } from './BlockRegistry.js';
import { createVoxelMaterial } from './shaders/voxelShader.js';
import { SkyRenderer, getSkyPalette } from './SkyRenderer.js';
import { WaterRenderer } from './WaterRenderer.js';

const DEFAULT_RENDER_DISTANCE = 8;
const BLOCKS_PER_CHUNK = 16; // CHUNK_SIZE

export class VoxelEngine {
  constructor() {
    this.container = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.chunkManager = null;
    this.skyRenderer = null;
    this.waterRenderer = null;
    this.atlas = null;
    this.material = null;
    this.sunLight = null;
    this.hemiLight = null;
    this.animFrameId = null;
    this.clock = new THREE.Clock();
    this.renderDistance = DEFAULT_RENDER_DISTANCE;
    this.sunAngle = 0;
    this.disposed = false;
  }

  /**
   * Initialize the engine and attach it to a DOM container.
   * @param {HTMLElement} container — the DOM element to render into
   * @param {object} colonyData — colony info including planetType, seed, etc.
   */
  init(container, colonyData) {
    this.container = container;
    this.disposed = false;

    const planetType = colonyData?.planetType || 'Terran';
    const seed = colonyData?.seed || 42;
    this.renderDistance = colonyData?.renderDistance || DEFAULT_RENDER_DISTANCE;
    const biomeGrid = colonyData?.biomeGrid || null;
    const serverDeltas = colonyData?.serverDeltas || null;
    const spawnChunk = colonyData?.spawnChunk || null;
    const showWater = colonyData?.showWater !== false;
    const skyPalette = getSkyPalette(planetType);

    // --- Scene ---
    this.scene = new THREE.Scene();
    const topColor = new THREE.Color(skyPalette.top);
    const horizonColor = new THREE.Color(skyPalette.horizon);
    const bottomColor = new THREE.Color(skyPalette.bottom);
    const fogColor = horizonColor.clone().lerp(bottomColor, 0.22);
    this.scene.background = fogColor.clone();

    // --- Camera ---
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 2000);
    this.camera.position.set(0, 80, 0);

    // --- Renderer ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    container.appendChild(this.renderer.domElement);

    // --- Lighting ---
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.85);
    this.sunLight.position.set(200, 300, 150);
    this.scene.add(this.sunLight);

    this.hemiLight = new THREE.HemisphereLight(0xc9eeff, 0x29384d, 0.78);
    this.scene.add(this.hemiLight);

    // --- Texture Atlas ---
    this.atlas = createTextureAtlas(BLOCKS);

    // --- Fog ---
    const fogNear = this.renderDistance * 0.82 * BLOCKS_PER_CHUNK;
    const fogFar = this.renderDistance * 1.28 * BLOCKS_PER_CHUNK;
    this.scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);

    // --- Voxel Material ---
    this.material = createVoxelMaterial(
      this.atlas.texture,
      fogColor,
      fogNear,
      fogFar
    );

    // --- Chunk Manager ---
    this.chunkManager = new ChunkManager(
      this.scene,
      this.material,
      this.renderDistance
    );
    this.chunkManager.init(seed, planetType, biomeGrid, serverDeltas, spawnChunk);

    // --- Sky ---
    this.skyRenderer = new SkyRenderer(this.scene, planetType);

    // --- Water ---
    if (showWater) {
      this.waterRenderer = new WaterRenderer(this.scene, {
        waterColor: horizonColor.clone().lerp(bottomColor, 0.35),
        alpha: 0.16,
      });
    } else {
      this.waterRenderer = null;
    }

    // --- Resize listener ---
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);

    // --- Start animation loop ---
    this._animate();
  }

  /** Internal animation loop. */
  _animate() {
    if (this.disposed) return;
    this.animFrameId = requestAnimationFrame(() => this._animate());

    const dt = this.clock.getDelta();
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Per-frame update — called by the animation loop.
   * @param {number} dt — delta time in seconds
   */
  update(dt) {
    // Update chunk loading/unloading based on camera position
    if (this.chunkManager) {
      this.chunkManager.updatePlayerPosition(
        this.camera.position.x,
        this.camera.position.z
      );
      this.chunkManager.update();
    }

    // Animate water
    if (this.waterRenderer) {
      this.waterRenderer.update(this.clock.elapsedTime);
    }

    // Slow sun rotation
    if (this.sunLight) {
      this.sunAngle += dt * 0.01;
      const radius = 300;
      this.sunLight.position.set(
        Math.cos(this.sunAngle) * radius,
        300,
        Math.sin(this.sunAngle) * radius
      );
    }
  }

  /**
   * Called by PlayerController to inform the engine of the player position.
   * Drives chunk loading around the player.
   */
  setPlayerPosition(x, y, z) {
    if (this.chunkManager) {
      this.chunkManager.updatePlayerPosition(x, z);
    }
  }

  /** @returns {ChunkManager} */
  getChunkManager() {
    return this.chunkManager;
  }

  /** @returns {THREE.Scene} */
  getScene() {
    return this.scene;
  }

  /** @returns {THREE.PerspectiveCamera} */
  getCamera() {
    return this.camera;
  }

  /** @returns {THREE.WebGLRenderer} */
  getRenderer() {
    return this.renderer;
  }

  setLandingSiteHighlights(primary = null, secondary = null) {
    if (!this.material?.uniforms) return;

    const setUniformSet = (suffix, config) => {
      const origin = this.material.uniforms[`uHighlightOrigin${suffix}`].value;
      const color = this.material.uniforms[`uHighlightColor${suffix}`].value;
      const radius = this.material.uniforms[`uHighlightRadius${suffix}`];
      const intensity = this.material.uniforms[`uHighlightIntensity${suffix}`];

      if (!config) {
        origin.set(0, 0, 0);
        color.set(0, 0, 0);
        radius.value = 0;
        intensity.value = 0;
        return;
      }

      origin.set(config.x, config.y, config.z);
      const highlightColor = new THREE.Color(config.color);
      color.set(highlightColor.r, highlightColor.g, highlightColor.b);
      radius.value = config.radius;
      intensity.value = config.intensity;
    };

    setUniformSet('A', primary);
    setUniformSet('B', secondary);
  }

  /** Handle container / window resize. */
  resize() {
    if (!this.container || !this.camera || !this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /** Full cleanup — call when unmounting. */
  dispose() {
    this.disposed = true;

    if (this.animFrameId != null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      this._onResize = null;
    }

    if (this.chunkManager) {
      this.chunkManager.dispose();
      this.chunkManager = null;
    }

    if (this.skyRenderer) {
      this.skyRenderer.dispose();
      this.skyRenderer = null;
    }

    if (this.waterRenderer) {
      this.waterRenderer.dispose();
      this.waterRenderer = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.container && this.renderer.domElement.parentNode === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;

    // Dispose GPU resources
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    if (this.atlas && this.atlas.texture) {
      this.atlas.texture.dispose();
      this.atlas = null;
    }

    this.container = null;
  }
}
