const { ActionAuditLog } = require('../models');

const record = async ({
  userId = null,
  actionType,
  scopeType,
  scopeId = null,
  status,
  reason = null,
  ipAddress = null,
  metadata = {},
  transaction = null
} = {}) => {
  if (!actionType || !scopeType || !status) {
    return null;
  }

  return ActionAuditLog.create({
    user_id: userId,
    action_type: actionType,
    scope_type: scopeType,
    scope_id: scopeId,
    status,
    reason,
    ip_address: ipAddress,
    metadata
  }, { transaction });
};

const listRecent = async ({
  userId = null,
  actionType = null,
  scopeType = null,
  scopeId = null,
  status = null,
  limit = 50
} = {}) => {
  const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const where = {};

  if (userId) where.user_id = userId;
  if (actionType) where.action_type = actionType;
  if (scopeType) where.scope_type = scopeType;
  if (scopeId) where.scope_id = scopeId;
  if (status) where.status = status;

  return ActionAuditLog.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: normalizedLimit
  });
};

module.exports = {
  record,
  listRecent
};
