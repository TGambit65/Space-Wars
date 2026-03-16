require('dotenv').config();
const { sequelize } = require('./src/config/database');
const User = require('./src/models/User');
const { Ship } = require('./src/models');

(async () => {
  await sequelize.authenticate();
  const user = await User.findOne({ where: { username: 'thoder' } });
  const ships = await Ship.findAll({ where: { owner_user_id: user.user_id } });
  for (const s of ships) {
    if (s.is_active === false) {
      await s.update({ is_active: true, hull_points: s.max_hull_points });
      console.log('Revived:', s.name, '| hull:', s.max_hull_points + '/' + s.max_hull_points);
    } else {
      console.log('Already active:', s.name);
    }
  }
  console.log('\nAll ships operational!');
  process.exit(0);
})();
