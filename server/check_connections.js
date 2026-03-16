require('dotenv').config();
const { sequelize } = require('./src/config/database');
const { Sector, SectorConnection } = require('./src/models');
const { Op } = require('sequelize');

(async () => {
  await sequelize.authenticate();
  const sector = await Sector.findOne({ where: { name: 'Epsilon Centauri XV' } });
  if (!sector) { console.log('Sector not found'); process.exit(0); }
  console.log('Sector ID:', sector.sector_id);
  console.log('Star class:', sector.star_class);

  const conns = await SectorConnection.findAll({
    where: {
      [Op.or]: [
        { sector_a_id: sector.sector_id },
        { sector_b_id: sector.sector_id }
      ]
    },
    include: [
      { model: Sector, as: 'sectorA', attributes: ['name', 'star_class'] },
      { model: Sector, as: 'sectorB', attributes: ['name', 'star_class'] }
    ]
  });

  console.log('Connections:', conns.length);
  for (const c of conns) {
    const other = c.sector_a_id === sector.sector_id ? c.sectorB : c.sectorA;
    console.log(' ->', other?.name, '| type:', c.connection_type, '| bidir:', c.is_bidirectional, '| travel:', c.travel_time);
  }
  process.exit(0);
})();
