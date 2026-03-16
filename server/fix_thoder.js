require('dotenv').config();
const { sequelize } = require('./src/config/database');
const { Ship } = require('./src/models');
const User = require('./src/models/User');

(async () => {
  await sequelize.authenticate();
  const user = await User.findOne({ where: { username: 'thoder' } });
  const ships = await Ship.findAll({ where: { owner_user_id: user.user_id } });

  // Revive any dead ships
  for (const s of ships) {
    if (s.is_active === false || s.hull_points === 0) {
      await s.update({ is_active: true, hull_points: s.max_hull_points });
      console.log('Revived:', s.name);
    }
  }

  // Fix active_ship_id — point to the rescue pod (or first active ship)
  const rescuePod = ships.find(s => s.name.includes('Rescue Pod'));
  const activeShip = rescuePod || ships.find(s => s.is_active !== false);
  if (activeShip) {
    await user.update({ active_ship_id: activeShip.ship_id });
    console.log('Set active_ship_id to:', activeShip.name);
  }

  console.log('Done!');
  process.exit(0);
})();
