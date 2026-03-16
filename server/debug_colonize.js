require('dotenv').config();
const { sequelize } = require('./src/config/database');
const { Ship, Sector, Planet } = require('./src/models');
const User = require('./src/models/User');

(async () => {
  await sequelize.authenticate();
  const user = await User.findOne({ where: { username: 'thoder' } });
  const ships = await Ship.findAll({ where: { owner_user_id: user.user_id } });

  for (const s of ships) {
    const sector = await Sector.findByPk(s.current_sector_id);
    console.log(s.name, '|', s.ship_type, '| sector_id:', s.current_sector_id, '| sector_exists:', sector !== null, '| active:', s.is_active);
  }

  // Check the colony ship specifically
  const colonyShip = ships.find(s => s.ship_type === 'Insta Colony Ship');
  if (colonyShip) {
    console.log('\nColony ship details:');
    console.log('  ship_id:', colonyShip.ship_id);
    console.log('  sector_id:', colonyShip.current_sector_id);
    console.log('  is_active:', colonyShip.is_active);
    console.log('  hull:', colonyShip.hull_points, '/', colonyShip.max_hull_points);

    // Check if the rescue pod is in the same sector
    const rescuePod = ships.find(s => s.name.includes('Rescue Pod'));
    if (rescuePod) {
      console.log('\nRescue pod sector:', rescuePod.current_sector_id);
      console.log('Colony ship sector:', colonyShip.current_sector_id);
      console.log('Same sector:', rescuePod.current_sector_id === colonyShip.current_sector_id);
    }
  }

  console.log('\nactive_ship_id:', user.active_ship_id);
  process.exit(0);
})();
