const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PriceHistory = sequelize.define('PriceHistory', {
  price_history_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  port_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'ports', key: 'port_id' }
  },
  commodity_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'commodities', key: 'commodity_id' }
  },
  buy_price: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  sell_price: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  recorded_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'price_history',
  timestamps: false,
  indexes: [
    { fields: ['port_id', 'commodity_id', 'recorded_at'] },
    { fields: ['recorded_at'] }
  ]
});

module.exports = PriceHistory;
