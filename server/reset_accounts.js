const { User, Ship, ShipCargo, ShipComponent, CombatLog, Transaction, Message, sequelize } = require('./src/models');
const { connectDatabase } = require('./src/config/database');

async function resetAccounts() {
    try {
        await connectDatabase();
        console.log('Finding all users...');

        const users = await User.findAll();
        console.log(`Found ${users.length} users.`);

        if (users.length === 0) {
            console.log('No users to delete.');
            process.exit(0);
        }

        const transaction = await sequelize.transaction();

        try {
            console.log('Starting deletion process...');

            // Get all user IDs
            const userIds = users.map(u => u.user_id);

            // Get all ships owned by these users
            const ships = await Ship.findAll({
                where: { owner_user_id: userIds },
                transaction
            });
            const shipIds = ships.map(s => s.ship_id);
            console.log(`Found ${ships.length} ships to delete.`);

            // 1. Delete Ship Dependencies
            if (shipIds.length > 0) {
                // Ship Cargo
                const cargoDeleted = await ShipCargo.destroy({
                    where: { ship_id: shipIds },
                    transaction
                });
                console.log(`Deleted ${cargoDeleted} cargo items.`);

                // Ship Components (if model exists and imported)
                if (ShipComponent) {
                    const componentsDeleted = await ShipComponent.destroy({
                        where: { ship_id: shipIds },
                        transaction
                    });
                    console.log(`Deleted ${componentsDeleted} installed components.`);
                }

                // Combat Logs (where ship is attacker or defender)
                if (CombatLog) {
                    const combatLogsDeleted = await CombatLog.destroy({
                        where: {
                            [sequelize.Sequelize.Op.or]: [
                                { attacker_ship_id: shipIds },
                                { defender_ship_id: shipIds }
                            ]
                        },
                        transaction
                    });
                    console.log(`Deleted ${combatLogsDeleted} combat logs.`);
                }
            }

            // 2. Delete Ships
            if (shipIds.length > 0) {
                await Ship.destroy({ where: { ship_id: shipIds }, transaction });
                console.log(`Deleted ${ships.length} ships.`);
            }

            // 3. Delete other User Dependencies (Transactions, Messages if any, Colonies)
            if (Transaction) {
                const transDeleted = await Transaction.destroy({ where: { user_id: userIds }, transaction });
                console.log(`Deleted ${transDeleted} transactions.`);
            }

            // 4. Delete Users
            await User.destroy({ where: { user_id: userIds }, transaction });
            console.log(`Successfully deleted ${users.length} users: ${users.map(u => u.username).join(', ')}`);

            await transaction.commit();
            console.log('Reset complete.');

        } catch (err) {
            await transaction.rollback();
            throw err;
        }

    } catch (error) {
        console.error('Reset failed:', error);
        process.exit(1);
    }
    process.exit(0);
}

resetAccounts();
