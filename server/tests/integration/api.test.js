/**
 * API Integration Tests
 */
const request = require('supertest');
const app = require('../../src/app');
const { User, Ship, Sector, Port, Commodity, PortCommodity, ShipCargo } = require('../../src/models');
const { createTestUser, createTestSector, createTestShip, createTestPort, createTestCommodity, addCommodityToPort, createSectorConnection, generateTestToken, cleanDatabase } = require('../helpers');

describe('API Integration Tests', () => {
  let testUser, testToken, testSector, testShip, testPort, testCommodity;

  beforeAll(async () => {
    await cleanDatabase();

    // Setup test environment
    testSector = await createTestSector({ name: 'API Test Sector', sector_type: 'Core' });
    testUser = await createTestUser({ username: 'apiuser', credits: 100000 });
    testShip = await createTestShip(testUser.user_id, testSector.sector_id, { name: 'API Test Ship' });
    testToken = generateTestToken(testUser);

    // Setup trading environment
    testPort = await createTestPort(testSector.sector_id, { name: 'API Test Port' });
    testCommodity = await createTestCommodity({ name: 'APITestCommod', base_price: 100 });
    await addCommodityToPort(testPort.port_id, testCommodity.commodity_id, {
      quantity: 500, max_quantity: 1000, can_buy: true, can_sell: true
    });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('Auth Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ username: 'newuser123', email: 'new@test.com', password: 'Password123!' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('token');
        expect(res.body.data).toHaveProperty('user');
      });

      it('should reject invalid input', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ username: 'ab', email: 'invalid', password: '123' });

        expect(res.status).toBe(400);
      });
    });

    describe('POST /api/auth/login', () => {
      beforeAll(async () => {
        await request(app)
          .post('/api/auth/register')
          .send({ username: 'logintest', email: 'logintest@test.com', password: 'Testpass123!' });
      });

      it('should login with valid credentials', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ username: 'logintest', password: 'Testpass123!' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('token');
      });

      it('should reject invalid credentials', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ username: 'logintest', password: 'wrongpassword' });

        expect(res.status).toBe(401);
      });
    });

    describe('GET /api/auth/profile', () => {
      it('should return current user with valid token', async () => {
        const res = await request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${testToken}`);

        expect(res.status).toBe(200);
        // Profile returns user directly in data
        expect(res.body.data.username).toBe('apiuser');
      });

      it('should reject request without token', async () => {
        const res = await request(app).get('/api/auth/profile');

        expect(res.status).toBe(401);
      });
    });
  });

  describe('Ship Endpoints', () => {
    describe('GET /api/ships', () => {
      it('should return user ships', async () => {
        const res = await request(app)
          .get('/api/ships')
          .set('Authorization', `Bearer ${testToken}`);
        
        expect(res.status).toBe(200);
        expect(res.body.data.ships).toBeInstanceOf(Array);
      });
    });

    describe('GET /api/ships/:shipId', () => {
      it('should return ship details', async () => {
        const res = await request(app)
          .get(`/api/ships/${testShip.ship_id}`)
          .set('Authorization', `Bearer ${testToken}`);
        
        expect(res.status).toBe(200);
        expect(res.body.data.ship.name).toBe('API Test Ship');
      });
    });
  });

  describe('Sector Endpoints', () => {
    describe('GET /api/sectors/:sectorId', () => {
      it('should return sector details', async () => {
        const res = await request(app)
          .get(`/api/sectors/${testSector.sector_id}`)
          .set('Authorization', `Bearer ${testToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.sector.name).toBe('API Test Sector');
      });
    });

    describe('GET /api/sectors/:sectorId (includes ports)', () => {
      it('should return ports in sector', async () => {
        const res = await request(app)
          .get(`/api/sectors/${testSector.sector_id}`)
          .set('Authorization', `Bearer ${testToken}`);

        expect(res.status).toBe(200);
        // Ports are included in sector response
        expect(res.body.data.ports).toBeInstanceOf(Array);
      });
    });
  });

  describe('Port Endpoints', () => {
    describe('GET /api/ports/:id', () => {
      it('should return port details', async () => {
        const res = await request(app)
          .get(`/api/ports/${testPort.port_id}`)
          .set('Authorization', `Bearer ${testToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.port.name).toBe('API Test Port');
      });
    });

    describe('GET /api/ports/:id (includes commodities)', () => {
      it('should return port commodities', async () => {
        const res = await request(app)
          .get(`/api/ports/${testPort.port_id}`)
          .set('Authorization', `Bearer ${testToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.port).toHaveProperty('commodities');
      });
    });
  });

  describe('Trade Endpoints', () => {
    describe('GET /api/trade/cargo/:shipId', () => {
      it('should return ship cargo', async () => {
        const res = await request(app)
          .get(`/api/trade/cargo/${testShip.ship_id}`)
          .set('Authorization', `Bearer ${testToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('cargo_capacity');
      });
    });

    describe('POST /api/trade/buy', () => {
      it('should buy commodities', async () => {
        const res = await request(app)
          .post('/api/trade/buy')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            ship_id: testShip.ship_id,
            port_id: testPort.port_id,
            commodity_id: testCommodity.commodity_id,
            quantity: 5
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('transaction');
      });
    });
  });
});

