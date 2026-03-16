const { User, sequelize } = require('./src/models');
const { connectDatabase } = require('./src/config/database');

async function checkUser() {
    await connectDatabase();
    const user = await User.findOne({ where: { username: 'Thoder' } });
    if (user) {
        console.log('User found:', user.toJSON());
        // Check if ship exists
        const ships = await user.getShips();
        console.log('Ships found:', ships.length);
        if (ships.length === 0) {
            console.log('User has no ships! Deleting orphaned user...');
            await user.destroy();
            console.log('Orphaned user deleted.');
        } else {
            console.log('User has ships. Not deleting.');
        }
    } else {
        console.log('User Thoder not found.');
    }
    process.exit(0);
}

checkUser().catch(err => console.error(err));
