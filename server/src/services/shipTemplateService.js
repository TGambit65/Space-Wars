const { ShipDesignTemplate } = require('../models');

const MAX_TEMPLATES_PER_USER = 20;

const saveTemplate = async (userId, name, shipType, components, notes) => {
  // Check template limit
  const count = await ShipDesignTemplate.count({ where: { user_id: userId } });
  if (count >= MAX_TEMPLATES_PER_USER) {
    const error = new Error(`Maximum of ${MAX_TEMPLATES_PER_USER} templates per user`);
    error.statusCode = 400;
    throw error;
  }

  const template = await ShipDesignTemplate.create({
    user_id: userId,
    name,
    ship_type: shipType,
    components: components || [],
    notes: notes || ''
  });

  return template;
};

const getUserTemplates = async (userId) => {
  const templates = await ShipDesignTemplate.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']]
  });

  return templates;
};

const loadTemplate = async (templateId, userId) => {
  const template = await ShipDesignTemplate.findByPk(templateId);

  if (!template) {
    const error = new Error('Template not found');
    error.statusCode = 404;
    throw error;
  }

  if (template.user_id !== userId) {
    const error = new Error('You do not own this template');
    error.statusCode = 403;
    throw error;
  }

  return template;
};

const deleteTemplate = async (templateId, userId) => {
  const template = await ShipDesignTemplate.findByPk(templateId);

  if (!template) {
    const error = new Error('Template not found');
    error.statusCode = 404;
    throw error;
  }

  if (template.user_id !== userId) {
    const error = new Error('You do not own this template');
    error.statusCode = 403;
    throw error;
  }

  await template.destroy();

  return { message: 'Template deleted' };
};

module.exports = {
  saveTemplate,
  getUserTemplates,
  loadTemplate,
  deleteTemplate
};
