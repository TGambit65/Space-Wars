import * as THREE from 'three';

const DEFAULT_VIEW_COSINE = 0.45;
const DEFAULT_MAX_DISTANCE = 3.2;

const reusablePlayer = new THREE.Vector3();
const reusableTarget = new THREE.Vector3();
const reusableForward = new THREE.Vector3();

export function findActiveTraversalInteraction({
  camera,
  playerPosition,
  interactions,
  maxDistance = DEFAULT_MAX_DISTANCE,
  minViewCosine = DEFAULT_VIEW_COSINE,
}) {
  if (!camera || !playerPosition || !Array.isArray(interactions) || interactions.length === 0) {
    return null;
  }

  reusablePlayer.set(playerPosition.x, playerPosition.y + 0.8, playerPosition.z);
  camera.getWorldDirection(reusableForward);

  let best = null;

  for (const interaction of interactions) {
    const radius = interaction.activationRadius ?? maxDistance;
    reusableTarget.set(interaction.position.x, interaction.position.y, interaction.position.z);
    const distance = reusablePlayer.distanceTo(reusableTarget);
    if (distance > radius) continue;

    const toTarget = reusableTarget.clone().sub(reusablePlayer).normalize();
    const alignment = reusableForward.dot(toTarget);
    if (alignment < (interaction.minViewCosine ?? minViewCosine)) continue;

    const score = distance - alignment * 0.5;
    if (!best || score < best.score) {
      best = {
        ...interaction,
        distance,
        alignment,
        score,
      };
    }
  }

  return best;
}
