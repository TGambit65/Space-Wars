/**
 * SkyRenderer — renders a gradient sky dome based on the colony's planet type.
 *
 * Uses a large inverted sphere with a custom shader that paints a
 * trilinear gradient (top → horizon → bottom) driven by the vertex Y
 * coordinate.
 */

import * as THREE from 'three';

/**
 * Sky color palettes per planet type.
 * Each has three stops: top (zenith), horizon, and bottom (nadir).
 */
const SKY_PALETTES = {
  Terran:      { top: '#001133', horizon: '#4488cc', bottom: '#88bbee' },
  Desert:      { top: '#1a0800', horizon: '#cc6600', bottom: '#ffaa44' },
  Ice:         { top: '#000d1a', horizon: '#6699cc', bottom: '#aaccee' },
  Volcanic:    { top: '#1a0000', horizon: '#993300', bottom: '#ff4400' },
  Oceanic:     { top: '#000022', horizon: '#003366', bottom: '#0066aa' },
  Jungle:      { top: '#001100', horizon: '#226633', bottom: '#44aa55' },
  Barren:      { top: '#0a0a0a', horizon: '#333333', bottom: '#666666' },
  // Fallback for Toxic, Crystalline, Gas Giant, etc.
  _default:    { top: '#0a000d', horizon: '#442266', bottom: '#773399' },
};

const SKY_VERTEX = /* glsl */ `
  varying float vY;

  void main() {
    vY = normalize(position).y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uTopColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uBottomColor;

  varying float vY;

  void main() {
    // vY ranges from -1 (bottom) through 0 (horizon) to +1 (top)
    vec3 color;
    if (vY >= 0.0) {
      // Upper half: horizon → top
      color = mix(uHorizonColor, uTopColor, vY);
    } else {
      // Lower half: horizon → bottom
      color = mix(uHorizonColor, uBottomColor, -vY);
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

export class SkyRenderer {
  /**
   * @param {THREE.Scene} scene
   * @param {string} planetType — e.g. 'Terran', 'Desert', 'Volcanic', etc.
   */
  constructor(scene, planetType) {
    this.scene = scene;

    const palette = SKY_PALETTES[planetType] || SKY_PALETTES._default;

    const topColor = new THREE.Color(palette.top);
    const horizonColor = new THREE.Color(palette.horizon);
    const bottomColor = new THREE.Color(palette.bottom);

    const geometry = new THREE.SphereGeometry(500, 32, 16);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTopColor: { value: new THREE.Vector3(topColor.r, topColor.g, topColor.b) },
        uHorizonColor: { value: new THREE.Vector3(horizonColor.r, horizonColor.g, horizonColor.b) },
        uBottomColor: { value: new THREE.Vector3(bottomColor.r, bottomColor.g, bottomColor.b) },
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.renderOrder = -1; // Render before everything else
    this.scene.add(this.mesh);
  }

  /** Remove the sky dome from the scene and free GPU resources. */
  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
  }
}
