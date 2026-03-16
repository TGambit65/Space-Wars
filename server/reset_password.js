require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize } = require('./src/config/database');
const User = require('./src/models/User');

(async () => {
  await sequelize.authenticate();
  const user = await User.findOne({ where: { username: 'thoder' } });
  if (!user) {
    console.log('User thoder not found');
    process.exit(1);
  }
  console.log('Found user:', user.username, '| email:', user.email);

  const newPassword = 'Password@123';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(newPassword, salt);
  await user.update({ hashed_password: hash });

  // Verify it works
  const valid = await bcrypt.compare(newPassword, hash);
  console.log('Password reset successful. Verify:', valid);
  console.log('New password: Password@123');
  process.exit(0);
})();
