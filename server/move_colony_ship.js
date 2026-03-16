require('dotenv').config();
const { sequelize } = require('./src/config/database');
const { Ship } = require('./src/models');
const User = require('./src/models/User');

(async () => {
  await sequelize.authenticate();
  const user = await User.findOne({ where: { username: 'thoder' } });
  const ships = await Ship.findAll({ where: { owner_user_id: user.user_id } });

  const rescuePod = ships.find(s => s.name.includes('Rescue Pod'));
  const colonyShip = ships.find(s => s.ship_type === 'Insta Colony Ship');

  if (rescuePod && colonyShip && rescuePod.current_sector_id !== colonyShip.current_sector_id) {
    await colonyShip.update({ current_sector_id: rescuePod.current_sector_id });
    console.log('Moved colony ship to same sector as rescue pod:', rescuePod.current_sector_id);
  } else {
    console.log('Ships already in same sector');
  }

  process.exit(0);
})();
