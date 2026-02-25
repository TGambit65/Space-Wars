
import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5080/api', // Backend port
    validateStatus: () => true // Don't throw on error status
});

async function run() {
    const username = `CommanderDeb${Math.floor(Math.random() * 1000)}`;
    const password = 'Password@123';

    console.log(`Registering ${username}...`);

    // Register
    const regRes = await api.post('/auth/register', {
        username,
        password,
        email: `${username}@test.com`
    });

    console.log('Register Status:', regRes.status);
    console.log('Register Data:', regRes.data);

    if (regRes.status !== 201 && regRes.status !== 200) {
        console.error('Registration failed');
        return;
    }

    const token = regRes.data.data?.token;
    if (!token) {
        console.error('No token received');
        return;
    }

    console.log('Token received. Length:', token.length);

    // Get Ships
    console.log('Fetching ships...');
    const shipsRes = await api.get('/ships', {
        headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Ships Status:', shipsRes.status);
    const shipsData = shipsRes.data;
    if (shipsData.data && shipsData.data.ships && shipsData.data.ships.length > 0) {
        const ship = shipsData.data.ships[0];
        console.log('--- SHIP KEYS DEBUG ---');
        console.log(Object.keys(ship));
        console.log('--- SHIP DEBUG ---');
        console.log(`Ship ID: ${ship.ship_id}`);
        console.log(`Name: ${ship.name}`);
        console.log(`Ship Type: ${ship.ship_type} (Type: ${typeof ship.ship_type})`);
        console.log(`Current Sector ID: ${ship.current_sector_id}`);
        console.log('Current Sector Object:', JSON.stringify(ship.currentSector, null, 2));
        console.log('------------------');

        // Verify getById specifically
        console.log('Fetching exact ship details via getById...');
        const detailRes = await api.get(`/ships/${ship.ship_id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Detail Status:', detailRes.status);
        const detailData = detailRes.data.data;
        // Check structure. Controller getShipStatus returns { ship: ..., adjacentSectors: ... }
        // So ship object is detailData.ship
        const detailShip = detailData.ship;
        console.log('Detail Ship Object Keys:', Object.keys(detailShip));
        console.log('Detail Ship Current Sector:', JSON.stringify(detailShip.currentSector || detailShip.current_sector, null, 2));
    } else {
        console.log('No ships found in response.');
    }
}

run();
