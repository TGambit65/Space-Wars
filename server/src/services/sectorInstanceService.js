const { Op } = require('sequelize');
const { Sector, SectorInstanceAssignment } = require('../models');
const config = require('../config');
const actionAuditService = require('./actionAuditService');

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getSectorInstancePolicy = (sector) => {
  const flags = sector?.rule_flags || {};
  const isAdventure = sector?.zone_class === 'adventure';
  const mode = flags.instance_mode || (isAdventure ? 'instanced' : 'shared');

  return {
    mode,
    instanceCapacity: parsePositiveInt(flags.instance_capacity, isAdventure ? 5 : 500),
    maxInstances: parsePositiveInt(flags.max_instances, isAdventure ? 10 : 1),
    ttlMs: parsePositiveInt(flags.instance_assignment_ttl_ms, config.antiCheat.sectorInstanceAssignmentTtlMs)
  };
};

const cleanupExpiredAssignments = async (sectorId = null, transaction = null) => {
  const where = {
    status: 'active',
    expires_at: {
      [Op.lte]: new Date()
    }
  };
  if (sectorId) {
    where.sector_id = sectorId;
  }

  await SectorInstanceAssignment.update(
    { status: 'expired', updated_at: new Date() },
    { where, transaction }
  );
};

const findActiveAssignment = async ({ userId, sectorId, transaction = null } = {}) => {
  if (!userId || !sectorId) {
    return null;
  }

  await cleanupExpiredAssignments(sectorId, transaction);

  return SectorInstanceAssignment.findOne({
    where: {
      user_id: userId,
      sector_id: sectorId,
      status: 'active',
      expires_at: {
        [Op.gt]: new Date()
      }
    },
    order: [['updated_at', 'DESC']],
    transaction
  });
};

const assignUserToSector = async ({
  userId,
  sectorId,
  transaction = null
} = {}) => {
  if (!userId || !sectorId) {
    return null;
  }

  const sector = await Sector.findByPk(sectorId, { transaction });
  if (!sector) {
    const error = new Error('Sector not found');
    error.statusCode = 404;
    throw error;
  }

  const policy = getSectorInstancePolicy(sector);
  const sticky = await findActiveAssignment({ userId, sectorId, transaction });
  const expiresAt = new Date(Date.now() + policy.ttlMs);

  if (sticky) {
    await sticky.update({
      expires_at: expiresAt,
      last_seen_at: new Date(),
      updated_at: new Date()
    }, { transaction });

    return {
      sector_id: sectorId,
      instance_key: sticky.instance_key,
      instance_mode: policy.mode,
      instance_capacity: policy.instanceCapacity
    };
  }

  let instanceKey = 'primary';

  if (policy.mode === 'instanced') {
    const activeAssignments = await SectorInstanceAssignment.findAll({
      where: {
        sector_id: sectorId,
        status: 'active',
        expires_at: {
          [Op.gt]: new Date()
        }
      },
      attributes: ['instance_key'],
      transaction
    });

    const occupancy = new Map();
    for (const assignment of activeAssignments) {
      occupancy.set(assignment.instance_key, (occupancy.get(assignment.instance_key) || 0) + 1);
    }

    const existingKeys = [...occupancy.keys()].sort();
    const availableKey = existingKeys.find((key) => (occupancy.get(key) || 0) < policy.instanceCapacity);
    if (availableKey) {
      instanceKey = availableKey;
    } else if (existingKeys.length < policy.maxInstances) {
      instanceKey = `inst-${existingKeys.length + 1}`;
    } else {
      await actionAuditService.record({
        userId,
        actionType: 'sector_instance_admission',
        scopeType: 'sector',
        scopeId: sectorId,
        status: 'deny',
        reason: 'sector_instance_capacity_reached',
        metadata: {
          sector_id: sectorId,
          instance_mode: policy.mode,
          max_instances: policy.maxInstances,
          instance_capacity: policy.instanceCapacity
        },
        transaction
      });
      const error = new Error('Sector instance capacity reached');
      error.statusCode = 429;
      throw error;
    }
  }

  const assignment = await SectorInstanceAssignment.create({
    sector_id: sectorId,
    user_id: userId,
    instance_key: instanceKey,
    status: 'active',
    expires_at: expiresAt,
    last_seen_at: new Date()
  }, { transaction });

  await actionAuditService.record({
    userId,
    actionType: 'sector_instance_admission',
    scopeType: 'sector',
    scopeId: sectorId,
    status: 'allow',
    reason: 'assigned',
    metadata: {
      sector_id: sectorId,
      instance_key: assignment.instance_key,
      instance_mode: policy.mode,
      instance_capacity: policy.instanceCapacity
    },
    transaction
  });

  return {
    sector_id: sectorId,
    instance_key: assignment.instance_key,
    instance_mode: policy.mode,
    instance_capacity: policy.instanceCapacity
  };
};

const releaseUserFromSector = async ({
  userId,
  sectorId,
  transaction = null
} = {}) => {
  if (!userId || !sectorId) {
    return 0;
  }

  const [count] = await SectorInstanceAssignment.update({
    status: 'released',
    expires_at: new Date(),
    updated_at: new Date()
  }, {
    where: {
      user_id: userId,
      sector_id: sectorId,
      status: 'active'
    },
    transaction
  });

  return count;
};

module.exports = {
  getSectorInstancePolicy,
  cleanupExpiredAssignments,
  findActiveAssignment,
  assignUserToSector,
  releaseUserFromSector
};
