/**
 * voxelShader — creates a THREE.ShaderMaterial for voxel chunk rendering.
 *
 * Features:
 *   - Texture atlas sampling
 *   - Per-vertex ambient occlusion
 *   - Manual distance fog (matches scene fog range)
 *   - Alpha-test discard for transparent pixels
 */

import * as THREE from 'three';

const VERTEX_SHADER = /* glsl */ `
  attribute float aAO;

  varying vec2 vUv;
  varying float vAO;
  varying float vFogDepth;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vAO = aAO;
    vNormal = normalize(normalMatrix * normal);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vFogDepth = -mvPosition.z;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  varying vec2 vUv;
  varying float vAO;
  varying float vFogDepth;
  varying vec3 vNormal;

  void main() {
    vec4 texColor = texture2D(uAtlas, vUv);

    // Discard fully transparent pixels
    if (texColor.a < 0.1) discard;

    vec3 lightDir = normalize(vec3(0.45, 0.85, 0.25));
    float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
    float lighting = 0.55 + diffuse * 0.65;

    // Apply ambient occlusion and a simple directional light so terrain reads clearly.
    vec3 color = texColor.rgb * vAO * lighting;
    color = min(color * 1.15, vec3(1.0));

    // Apply distance fog
    float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
    color = mix(color, uFogColor, fogFactor);

    gl_FragColor = vec4(color, texColor.a);
  }
`;

/**
 * Create a ShaderMaterial configured for voxel chunk rendering.
 *
 * @param {THREE.Texture} atlasTexture — the block texture atlas
 * @param {THREE.Color} fogColor — color to fade into at distance
 * @param {number} fogNear — distance where fog begins
 * @param {number} fogFar — distance where fog is fully opaque
 * @returns {THREE.ShaderMaterial}
 */
export function createVoxelMaterial(atlasTexture, fogColor, fogNear, fogFar) {
  // Ensure the atlas uses nearest-neighbor filtering for crisp pixels
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.generateMipmaps = false;

  const fogColorVec = fogColor instanceof THREE.Color
    ? fogColor
    : new THREE.Color(fogColor);

  return new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: atlasTexture },
      uFogColor: { value: new THREE.Vector3(fogColorVec.r, fogColorVec.g, fogColorVec.b) },
      uFogNear: { value: fogNear },
      uFogFar: { value: fogFar },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: THREE.FrontSide,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    fog: false, // We handle fog manually in the shader
  });
}
