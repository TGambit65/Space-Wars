const { Artifact, Ship, User } = require('../models');

/**
 * Equip an artifact onto a ship
 */
const equipArtifact = async (userId, artifactId, shipId) => {
  const artifact = await Artifact.findOne({
    where: { artifact_id: artifactId, owner_user_id: userId }
  });
  if (!artifact) {
    const error = new Error('Artifact not found or not owned');
    error.statusCode = 404;
    throw error;
  }

  if (artifact.equipped_ship_id) {
    const error = new Error('Artifact is already equipped');
    error.statusCode = 400;
    throw error;
  }

  const ship = await Ship.findOne({
    where: { ship_id: shipId, owner_user_id: userId }
  });
  if (!ship) {
    const error = new Error('Ship not found or not owned');
    error.statusCode = 404;
    throw error;
  }

  await artifact.update({ equipped_ship_id: shipId });
  return artifact;
};

/**
 * Unequip an artifact from a ship
 */
const unequipArtifact = async (userId, artifactId) => {
  const artifact = await Artifact.findOne({
    where: { artifact_id: artifactId, owner_user_id: userId }
  });
  if (!artifact) {
    const error = new Error('Artifact not found or not owned');
    error.statusCode = 404;
    throw error;
  }

  if (!artifact.equipped_ship_id) {
    const error = new Error('Artifact is not equipped');
    error.statusCode = 400;
    throw error;
  }

  await artifact.update({ equipped_ship_id: null });
  return artifact;
};

/**
 * Get all artifacts equipped on a ship
 */
const getEquippedArtifacts = async (shipId) => {
  return Artifact.findAll({
    where: { equipped_ship_id: shipId }
  });
};

/**
 * Get all artifacts owned by a user
 */
const getUserArtifacts = async (userId) => {
  return Artifact.findAll({
    where: { owner_user_id: userId }
  });
};

/**
 * Calculate aggregate artifact bonuses for a ship
 */
const calculateArtifactBonuses = async (shipId) => {
  const artifacts = await getEquippedArtifacts(shipId);
  const bonuses = {};

  for (const artifact of artifacts) {
    if (artifact.bonus_type) {
      bonuses[artifact.bonus_type] = (bonuses[artifact.bonus_type] || 0) + artifact.bonus_value;
    }
  }

  return bonuses;
};

module.exports = {
  equipArtifact,
  unequipArtifact,
  getEquippedArtifacts,
  getUserArtifacts,
  calculateArtifactBonuses
};
