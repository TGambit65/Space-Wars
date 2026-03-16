const { User, sequelize } = require('./src/models');
const { connectDatabase } = require('./src/config/database');

async function checkUserCount() {
    await connectDatabase();
    const users = await User.findAll();
    console.log(`Total Users: ${users.length}`);
    users.forEach(u => console.log(`- ${u.username} (${u.email})`));
    process.exit(0);
}

checkUserCount().catch(err => console.error(err));
