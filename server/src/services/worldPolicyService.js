const { Op } = require('sequelize');
const { Sector, SectorConnection, User, CorporationAgreement } = require('../models');

const LEGACY_SECTOR_POLICY = {
  Core: {
    zone_class: 'core',
    security_class: 'protected',
    access_mode: 'public',
    rule_flags: {
      allow_pvp: false,
      allow_hostile_npcs: false,
      safe_harbor: true,
      reward_multiplier: 1,
      protected_entry_buffer_seconds: 0
    }
  },
  Inner: {
    zone_class: 'inner_ring',
    security_class: 'pve',
    access_mode: 'public',
    rule_flags: {
      allow_pvp: false,
      allow_hostile_npcs: true,
      reward_multiplier: 1.15
    }
  },
  Mid: {
    zone_class: 'mid_ring',
    security_class: 'pve',
    access_mode: 'public',
    rule_flags: {
      allow_pvp: false,
      allow_hostile_npcs: true,
      reward_multiplier: 1.25
    }
  },
  Outer: {
    zone_class: 'outer_ring',
    security_class: 'pve',
    access_mode: 'public',
    rule_flags: {
      allow_pvp: false,
      allow_hostile_npcs: true,
      reward_multiplier: 1.4
    }
  },
  Fringe: {
    zone_class: 'frontier',
    security_class: 'pvp',
    access_mode: 'public',
    rule_flags: {
      allow_pvp: true,
      allow_hostile_npcs: true,
      reward_multiplier: 1.75,
      tourist_pass_allowed: true
    }
  },
  Unknown: {
    zone_class: 'deep_space',
    security_class: 'pvp',
    access_mode: 'public',
    rule_flags: {
      allow_pvp: true,
      allow_hostile_npcs: true,
      reward_multiplier: 2.1,
      tourist_pass_allowed: false
    }
  }
};

const LEGACY_CONNECTION_POLICY = {
  standard: {
    lane_class: 'hyperlane',
    access_mode: 'public',
    rule_flags: {
      safe_route: false,
      public_transit: true
    }
  },
  wormhole: {
    lane_class: 'wormhole',
    access_mode: 'public',
    rule_flags: {
      safe_route: false,
      public_transit: true,
      instant_transit: true
    }
  },
  gate: {
    lane_class: 'gate',
    access_mode: 'public',
    rule_flags: {
      safe_route: false,
      public_transit: true
    }
  },
  portal: {
    lane_class: 'portal',
    access_mode: 'public',
    rule_flags: {
      safe_route: false,
      public_transit: true,
      instant_transit: true
    }
  }
};

const cloneRuleFlags = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return { ...value };
};

const buildDefaultSectorPolicy = (sectorLike = {}) => {
  const legacy = LEGACY_SECTOR_POLICY[sectorLike.type] || LEGACY_SECTOR_POLICY.Mid;
  const defaultAccessMode = sectorLike.owner_user_id || sectorLike.owner_corporation_id
    ? 'owner'
    : legacy.access_mode;

  return {
    zone_class: sectorLike.zone_class || legacy.zone_class,
    security_class: sectorLike.security_class || legacy.security_class,
    access_mode: sectorLike.access_mode || defaultAccessMode,
    owner_user_id: sectorLike.owner_user_id || null,
    owner_corporation_id: sectorLike.owner_corporation_id || null,
    rule_flags: {
      ...cloneRuleFlags(legacy.rule_flags),
      ...cloneRuleFlags(sectorLike.rule_flags)
    }
  };
};

const buildDefaultConnectionPolicy = (connectionLike = {}, fromSector = null, toSector = null) => {
  const legacy = LEGACY_CONNECTION_POLICY[connectionLike.connection_type] || LEGACY_CONNECTION_POLICY.standard;
  let laneClass = connectionLike.lane_class || legacy.lane_class;
  const fromPolicy = fromSector ? buildDefaultSectorPolicy(fromSector) : null;
  const toPolicy = toSector ? buildDefaultSectorPolicy(toSector) : null;

  if (
    laneClass === 'hyperlane' &&
    fromPolicy &&
    toPolicy &&
    fromPolicy.security_class === 'protected' &&
    toPolicy.security_class === 'protected'
  ) {
    laneClass = 'protected';
  }

  const ruleFlags = {
    ...cloneRuleFlags(legacy.rule_flags),
    ...cloneRuleFlags(connectionLike.rule_flags)
  };

  if (laneClass === 'protected') {
    ruleFlags.safe_route = true;
    ruleFlags.allow_pvp = false;
    ruleFlags.allow_hostile_npcs = false;
  }

  return {
    lane_class: laneClass,
    access_mode: connectionLike.access_mode || legacy.access_mode,
    rule_flags: ruleFlags
  };
};

const summarizeSectorPolicy = (sectorLike = {}) => {
  const policy = buildDefaultSectorPolicy(sectorLike);
  return {
    zone_class: policy.zone_class,
    security_class: policy.security_class,
    access_mode: policy.access_mode,
    has_owner: Boolean(policy.owner_user_id || policy.owner_corporation_id),
    owner_scope: policy.owner_corporation_id ? 'corporation' : (policy.owner_user_id ? 'user' : null),
    rule_flags: policy.rule_flags
  };
};

const summarizeConnectionPolicy = (connectionLike = {}, fromSector = null, toSector = null) => {
  const policy = buildDefaultConnectionPolicy(connectionLike, fromSector, toSector);
  return {
    lane_class: policy.lane_class,
    access_mode: policy.access_mode,
    rule_flags: policy.rule_flags
  };
};

const loadUserContext = async (userId, transaction = null) => {
  if (!userId) {
    return {
      user: null,
      alliedCorporationIds: new Set()
    };
  }

  const user = await User.findByPk(userId, {
    attributes: ['user_id', 'corporation_id', 'faction', 'is_admin'],
    transaction
  });

  const alliedCorporationIds = new Set();
  if (user?.corporation_id) {
    const agreements = await CorporationAgreement.findAll({
      where: {
        agreement_type: 'alliance',
        status: 'active',
        [Op.or]: [
          { proposer_corp_id: user.corporation_id },
          { target_corp_id: user.corporation_id }
        ]
      },
      attributes: ['proposer_corp_id', 'target_corp_id'],
      transaction
    });

    for (const agreement of agreements) {
      if (agreement.proposer_corp_id !== user.corporation_id) {
        alliedCorporationIds.add(agreement.proposer_corp_id);
      }
      if (agreement.target_corp_id !== user.corporation_id) {
        alliedCorporationIds.add(agreement.target_corp_id);
      }
    }
  }

  return { user, alliedCorporationIds };
};

const isAccessAllowed = (policy, userContext) => {
  const { user, alliedCorporationIds } = userContext;

  if (policy.access_mode === 'public') {
    return { allowed: true, reason: null };
  }

  if (user?.is_admin) {
    return { allowed: true, reason: null };
  }

  if (!user) {
    return { allowed: false, reason: 'Authentication required for this destination' };
  }

  if (policy.owner_user_id && policy.owner_user_id === user.user_id) {
    return { allowed: true, reason: null };
  }

  if (policy.access_mode === 'owner') {
    return { allowed: false, reason: 'This destination is owner-restricted' };
  }

  if (policy.access_mode === 'corporation') {
    if (policy.owner_corporation_id && policy.owner_corporation_id === user.corporation_id) {
      return { allowed: true, reason: null };
    }
    return { allowed: false, reason: 'This destination is corporation-restricted' };
  }

  if (policy.access_mode === 'corporation_allies') {
    if (policy.owner_corporation_id && policy.owner_corporation_id === user.corporation_id) {
      return { allowed: true, reason: null };
    }
    if (policy.owner_corporation_id && alliedCorporationIds.has(policy.owner_corporation_id)) {
      return { allowed: true, reason: null };
    }
    return { allowed: false, reason: 'This destination is restricted to a corporation and its allies' };
  }

  if (policy.access_mode === 'faction') {
    const allowedFactions = Array.isArray(policy.rule_flags.allowed_factions)
      ? policy.rule_flags.allowed_factions
      : (policy.rule_flags.allowed_faction ? [policy.rule_flags.allowed_faction] : []);
    if (allowedFactions.includes(user.faction)) {
      return { allowed: true, reason: null };
    }
    return { allowed: false, reason: 'This destination is faction-restricted' };
  }

  return { allowed: false, reason: 'This destination is locked' };
};

const evaluateTraversal = ({ connection, fromSector, toSector, userContext }) => {
  const toPolicy = buildDefaultSectorPolicy(toSector);
  const connectionPolicy = buildDefaultConnectionPolicy(connection, fromSector, toSector);
  const sectorAccess = isAccessAllowed(toPolicy, userContext);

  if (!sectorAccess.allowed) {
    return {
      allowed: false,
      failureReason: sectorAccess.reason,
      fromPolicy: buildDefaultSectorPolicy(fromSector),
      toPolicy,
      connectionPolicy
    };
  }

  const laneAccess = isAccessAllowed({
    ...connectionPolicy,
    owner_user_id: toPolicy.owner_user_id,
    owner_corporation_id: toPolicy.owner_corporation_id
  }, userContext);

  if (!laneAccess.allowed) {
    return {
      allowed: false,
      failureReason: laneAccess.reason,
      fromPolicy: buildDefaultSectorPolicy(fromSector),
      toPolicy,
      connectionPolicy
    };
  }

  return {
    allowed: true,
    failureReason: null,
    fromPolicy: buildDefaultSectorPolicy(fromSector),
    toPolicy,
    connectionPolicy
  };
};

const getAdjacentConnections = async (sectorId, transaction = null) => {
  return SectorConnection.findAll({
    where: {
      [Op.or]: [
        { sector_a_id: sectorId },
        { sector_b_id: sectorId, is_bidirectional: true }
      ]
    },
    include: [
      { model: Sector, as: 'sectorA' },
      { model: Sector, as: 'sectorB' }
    ],
    transaction
  });
};

const getAccessibleAdjacentSectors = async ({ sectorId, userId = null, transaction = null, includeRestricted = false } = {}) => {
  const [connections, userContext] = await Promise.all([
    getAdjacentConnections(sectorId, transaction),
    loadUserContext(userId, transaction)
  ]);

  return connections
    .map((connection) => {
      const fromSector = connection.sector_a_id === sectorId ? connection.sectorA : connection.sectorB;
      const adjacentSector = connection.sector_a_id === sectorId ? connection.sectorB : connection.sectorA;
      const traversal = evaluateTraversal({
        connection,
        fromSector,
        toSector: adjacentSector,
        userContext
      });

      return {
        sector: adjacentSector,
        connection_type: connection.connection_type,
        lane_class: traversal.connectionPolicy.lane_class,
        access_mode: traversal.toPolicy.access_mode,
        travel_time: connection.travel_time,
        rule_flags: traversal.connectionPolicy.rule_flags,
        sector_policy: summarizeSectorPolicy(adjacentSector),
        connection_policy: summarizeConnectionPolicy(connection, fromSector, adjacentSector),
        traversal_allowed: traversal.allowed,
        traversal_reason: traversal.failureReason
      };
    })
    .filter((item) => includeRestricted || item.traversal_allowed);
};

const resolveTraversal = async ({ fromSectorId, toSectorId, userId = null, transaction = null } = {}) => {
  const connection = await SectorConnection.findOne({
    where: {
      [Op.or]: [
        { sector_a_id: fromSectorId, sector_b_id: toSectorId },
        {
          sector_a_id: toSectorId,
          sector_b_id: fromSectorId,
          is_bidirectional: true
        }
      ]
    },
    include: [
      { model: Sector, as: 'sectorA' },
      { model: Sector, as: 'sectorB' }
    ],
    transaction
  });

  if (!connection) {
    const error = new Error('Target sector is not adjacent to current sector');
    error.statusCode = 400;
    throw error;
  }

  const [userContext, fromSector, toSector] = await Promise.all([
    loadUserContext(userId, transaction),
    connection.sector_a_id === fromSectorId ? connection.sectorA : connection.sectorB,
    connection.sector_a_id === fromSectorId ? connection.sectorB : connection.sectorA
  ]);

  const traversal = evaluateTraversal({
    connection,
    fromSector,
    toSector,
    userContext
  });

  if (!traversal.allowed) {
    const error = new Error(traversal.failureReason);
    error.statusCode = 403;
    throw error;
  }

  return {
    connection,
    fromSector,
    toSector,
    fromPolicy: traversal.fromPolicy,
    toPolicy: traversal.toPolicy,
    connectionPolicy: traversal.connectionPolicy
  };
};

module.exports = {
  buildDefaultSectorPolicy,
  buildDefaultConnectionPolicy,
  summarizeSectorPolicy,
  summarizeConnectionPolicy,
  loadUserContext,
  getAccessibleAdjacentSectors,
  resolveTraversal
};
