/**
 * WaterRenderer — renders an animated semi-transparent water/lava plane
 * at sea level.
 *
 * Uses a large PlaneGeometry with a custom ShaderMaterial that applies
 * time-based UV animation for a gentle ripple effect.
 */

import * as THREE from 'three';

const DEFAULT_SEA_LEVEL = 40;
const PLANE_SIZE = 1024;

const WATER_VERTEX = /* glsl */ `
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;

    // Subtle vertex displacement for wave motion
    worldPos.y += sin(worldPos.x * 0.05 + uTime * 1.5) * 0.15;
    worldPos.y += cos(worldPos.z * 0.07 + uTime * 1.2) * 0.1;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const WATER_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uWaterColor;
  uniform float uAlpha;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    // Two scrolling wave patterns for a ripple effect
    vec2 uv1 = vWorldPos.xz * 0.02 + vec2(uTime * 0.03, uTime * 0.02);
    vec2 uv2 = vWorldPos.xz * 0.035 + vec2(-uTime * 0.02, uTime * 0.015);

    float wave1 = sin(uv1.x * 6.2831 + uv1.y * 6.2831) * 0.5 + 0.5;
    float wave2 = sin(uv2.x * 6.2831 - uv2.y * 3.1416) * 0.5 + 0.5;
    float combined = wave1 * 0.6 + wave2 * 0.4;

    // Brighten crests, darken troughs
    vec3 color = uWaterColor * (0.7 + combined * 0.6);

    // Add specular-like highlight on wave crests
    float highlight = pow(combined, 3.0) * 0.3;
    color += vec3(highlight);

    gl_FragColor = vec4(color, uAlpha);
  }
`;

export class WaterRenderer {
  /**
   * @param {THREE.Scene} scene
   * @param {{ waterColor?: THREE.Color, alpha?: number }} options
   */
  constructor(scene, options = {}) {
    this.scene = scene;

    const waterColor = options.waterColor || new THREE.Color(0x1a6090);
    const alpha = options.alpha ?? 0.35;

    const geometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, 64, 64);
    geometry.rotateX(-Math.PI / 2); // Lay flat on the XZ plane

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWaterColor: { value: new THREE.Vector3(waterColor.r, waterColor.g, waterColor.b) },
        uAlpha: { value: alpha },
      },
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.y = DEFAULT_SEA_LEVEL;
    this.mesh.renderOrder = 1; // Render after opaque geometry
    this.scene.add(this.mesh);
  }

  /**
   * Update the water animation.
   * @param {number} time — elapsed time in seconds (from THREE.Clock)
   */
  update(time) {
    this.material.uniforms.uTime.value = time;
  }

  /**
   * Move the water plane to a different Y level.
   * @param {number} y
   */
  setSeaLevel(y) {
    this.mesh.position.y = y;
  }

  /** Remove the water plane and free GPU resources. */
  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.material.dispose();
      this.mesh = null;
      this.material = null;
    }
  }
}
