const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { Sector, SectorConnection } = require('../models');
const worldPolicyService = require('./worldPolicyService');

const ensureColumn = async (tableName, tableDefinition, columnName, definition) => {
  if (!tableDefinition[columnName]) {
    await sequelize.getQueryInterface().addColumn(tableName, columnName, definition);
    return true;
  }
  return false;
};

const ensureIndex = async (tableName, indexName, fields) => {
  const existingIndexes = await sequelize.getQueryInterface().showIndex(tableName);
  if (existingIndexes.some((index) => index.name === indexName)) {
    return false;
  }
  await sequelize.getQueryInterface().addIndex(tableName, fields, { name: indexName });
  return true;
};

const patchSectorSchema = async () => {
  const tableName = 'sectors';
  const tableDefinition = await sequelize.getQueryInterface().describeTable(tableName);
  let schemaChanged = false;

  schemaChanged = await ensureColumn(tableName, tableDefinition, 'zone_class', {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'core'
  }) || schemaChanged;
  schemaChanged = await ensureColumn(tableName, tableDefinition, 'security_class', {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pve'
  }) || schemaChanged;
  schemaChanged = await ensureColumn(tableName, tableDefinition, 'access_mode', {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'public'
  }) || schemaChanged;
  schemaChanged = await ensureColumn(tableName, tableDefinition, 'owner_user_id', {
    type: DataTypes.UUID,
    allowNull: true
  }) || schemaChanged;
  schemaChanged = await ensureColumn(tableName, tableDefinition, 'owner_corporation_id', {
    type: DataTypes.UUID,
    allowNull: true
  }) || schemaChanged;
  schemaChanged = await ensureColumn(tableName, tableDefinition, 'rule_flags', {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {}
  }) || schemaChanged;

  await ensureIndex(tableName, 'sectors_zone_class', ['zone_class']);
  await ensureIndex(tableName, 'sectors_security_class', ['security_class']);
  await ensureIndex(tableName, 'sectors_access_mode', ['access_mode']);
  await ensureIndex(tableName, 'sectors_owner_user_id', ['owner_user_id']);
  await ensureIndex(tableName, 'sectors_owner_corporation_id', ['owner_corporation_id']);

  return schemaChanged;
};

const patchConnectionSchema = async () => {
  const tableName = 'sector_connections';
  const tableDefinition = await sequelize.getQueryInterface().describeTable(tableName);
  let schemaChanged = false;

  schemaChanged = await ensureColumn(tableName, tableDefinition, 'lane_class', {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'hyperlane'
  }) || schemaChanged;
  schemaChanged = await ensureColumn(tableName, tableDefinition, 'access_mode', {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'public'
  }) || schemaChanged;
  schemaChanged = await ensureColumn(tableName, tableDefinition, 'rule_flags', {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {}
  }) || schemaChanged;

  await ensureIndex(tableName, 'sector_connections_lane_class', ['lane_class']);
  await ensureIndex(tableName, 'sector_connections_access_mode', ['access_mode']);

  return schemaChanged;
};

const backfillSectorPolicies = async () => {
  const sectors = await Sector.findAll({
    attributes: [
      'sector_id',
      'type',
      'zone_class',
      'security_class',
      'access_mode',
      'owner_user_id',
      'owner_corporation_id',
      'rule_flags'
    ]
  });

  for (const sector of sectors) {
    const policy = worldPolicyService.buildDefaultSectorPolicy(sector);
    const existingFlags = sector.rule_flags && typeof sector.rule_flags === 'object' ? sector.rule_flags : {};
    const needsUpdate =
      sector.zone_class !== policy.zone_class ||
      sector.security_class !== policy.security_class ||
      sector.access_mode !== policy.access_mode ||
      JSON.stringify(existingFlags) !== JSON.stringify(policy.rule_flags);

    if (needsUpdate) {
      await sector.update({
        zone_class: policy.zone_class,
        security_class: policy.security_class,
        access_mode: policy.access_mode,
        rule_flags: policy.rule_flags
      });
    }
  }
};

const backfillConnectionPolicies = async () => {
  const connections = await SectorConnection.findAll({
    include: [
      { model: Sector, as: 'sectorA', attributes: ['sector_id', 'type', 'zone_class', 'security_class', 'access_mode', 'rule_flags'] },
      { model: Sector, as: 'sectorB', attributes: ['sector_id', 'type', 'zone_class', 'security_class', 'access_mode', 'rule_flags'] }
    ]
  });

  for (const connection of connections) {
    const policy = worldPolicyService.buildDefaultConnectionPolicy(connection, connection.sectorA, connection.sectorB);
    const existingFlags = connection.rule_flags && typeof connection.rule_flags === 'object' ? connection.rule_flags : {};
    const needsUpdate =
      connection.lane_class !== policy.lane_class ||
      connection.access_mode !== policy.access_mode ||
      JSON.stringify(existingFlags) !== JSON.stringify(policy.rule_flags);

    if (needsUpdate) {
      await connection.update({
        lane_class: policy.lane_class,
        access_mode: policy.access_mode,
        rule_flags: policy.rule_flags
      });
    }
  }
};

const ensureNewTables = async () => {
  const { AgentAccount, AgentActionLog } = require('../models');
  // Create tables if they don't exist (no-op if already present)
  await AgentAccount.sync();
  await AgentActionLog.sync();
};

const ensureSprintWorldSchema = async () => {
  const sectorSchemaChanged = await patchSectorSchema();
  const connectionSchemaChanged = await patchConnectionSchema();

  if (sectorSchemaChanged) {
    await backfillSectorPolicies();
  }

  if (connectionSchemaChanged || sectorSchemaChanged) {
    await backfillConnectionPolicies();
  }

  await ensureNewTables();
};

module.exports = {
  ensureSprintWorldSchema
};
