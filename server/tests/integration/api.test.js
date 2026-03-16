/**
 * API Integration Tests
 */
const request = require('supertest');
const app = require('../../src/app');
const actionAuditService = require('../../src/services/actionAuditService');
const combatPolicyService = require('../../src/services/combatPolicyService');
const realtimeCombatService = require('../../src/services/realtimeCombatService');
const { User, Ship, Sector, Port, Commodity, PortCommodity, ShipCargo } = require('../../src/models');
const { createTestUser, createTestSector, createTestShip, createTestPort, createTestCommodity, addCommodityToPort, createSectorConnection, generateTestToken, cleanDatabase } = require('../helpers');

describe('API Integration Tests', () => {
  let testUser, testToken, testSector, testShip, testPort, testCommodity, adminUser, adminToken;

  beforeAll(async () => {
    await cleanDatabase();

    // Setup test environment
    testSector = await createTestSector({ name: 'API Test Sector', sector_type: 'Core' });
    testUser = await createTestUser({ username: 'apiuser', credits: 100000 });
    testShip = await createTestShip(testUser.user_id, testSector.sector_id, { name: 'API Test Ship' });
    testToken = generateTestToken(testUser);
    adminUser = await createTestUser({ username: 'apiadmin', is_admin: true });
    adminToken = generateTestToken(adminUser);

    // Setup trading environment
    testPort = await createTestPort(testSector.sector_id, { name: 'API Test Port' });
    testCommodity = await createTestCommodity({ name: 'APITestCommod', base_price: 100 });
    await addCommodityToPort(testPort.port_id, testCommodity.commodity_id, {
      quantity: 500, max_quantity: 1000, can_buy: true, can_sell: true
    });
  });

  afterAll(async () => {
    realtimeCombatService.stopCombatTick();
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

    describe('POST /api/auth/pvp-toggle', () => {
      it('should return toggle cooldown metadata and enforce cooldown on immediate retry', async () => {
        const first = await request(app)
          .post('/api/auth/pvp-toggle')
          .set('Authorization', `Bearer ${testToken}`);

        expect(first.status).toBe(200);
        expect(first.body.data).toHaveProperty('pvp_enabled', true);
        expect(first.body.data).toHaveProperty('cooldown_until');

        const second = await request(app)
          .post('/api/auth/pvp-toggle')
          .set('Authorization', `Bearer ${testToken}`);

        expect(second.status).toBe(409);
        expect(second.body.message).toMatch(/cool/i);
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
        expect(res.body.data.sector).toHaveProperty('policy_summary');
        expect(res.body.data.sector).not.toHaveProperty('owner_user_id');
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

    describe('GET /api/sectors/:sectorId (one-way adjacency)', () => {
      it('should not expose inbound-only one-way connections as exits', async () => {
        const origin = await createTestSector({ name: 'One Way Origin' });
        const destination = await createTestSector({ name: 'One Way Destination' });
        await createSectorConnection(origin.sector_id, destination.sector_id, {
          connection_type: 'portal',
          is_bidirectional: false
        });

        const reverseDetail = await request(app)
          .get(`/api/sectors/${destination.sector_id}`)
          .set('Authorization', `Bearer ${testToken}`);

        expect(reverseDetail.status).toBe(200);
        expect(reverseDetail.body.data.adjacentSectors).toHaveLength(0);

        const systemDetail = await request(app)
          .get(`/api/sectors/${destination.sector_id}/system`)
          .set('Authorization', `Bearer ${testToken}`);

        expect(systemDetail.status).toBe(200);
        expect(systemDetail.body.data.neighbors).toHaveLength(0);
      });
    });

    describe('GET /api/sectors/map', () => {
      it('should reflect updated sector policy after cache warmup', async () => {
        const first = await request(app).get('/api/sectors/map');

        expect(first.status).toBe(200);

        await testSector.update({
          access_mode: 'owner',
          owner_user_id: testUser.user_id
        });

        const second = await request(app).get('/api/sectors/map');

        expect(second.status).toBe(200);
        const system = second.body.data.systems.find(s => s.sector_id === testSector.sector_id);
        expect(system.policy_summary.access_mode).toBe('owner');
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

  describe('Combat Endpoints', () => {
    describe('POST /api/combat/realtime/attack-player/:shipId', () => {
      it('should deny PvP initiation in a protected sector', async () => {
        const defenderUser = await createTestUser({ username: 'protecteddefender1' });
        const defenderShip = await createTestShip(defenderUser.user_id, testSector.sector_id, {
          name: 'Protected Defender Ship'
        });

        const res = await request(app)
          .post(`/api/combat/realtime/attack-player/${testShip.ship_id}`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ defenderShipId: defenderShip.ship_id });

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/protected|not allowed/i);
      });

      it('should allow PvP after portal-entry protection expires', async () => {
        const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const frontierSector = await createTestSector({ name: 'Portal Combat Sector', type: 'Fringe' });
        const attacker = await createTestUser({ username: 'expiredguardattacker', faction: 'terran_alliance', created_at: oldDate });
        const defender = await createTestUser({ username: 'expiredguarddefender', faction: 'zythian_swarm', created_at: oldDate });
        const attackerShip = await createTestShip(attacker.user_id, frontierSector.sector_id, {
          name: 'Expired Guard Attacker Ship'
        });
        const defenderShip = await createTestShip(defender.user_id, frontierSector.sector_id, {
          name: 'Expired Guard Defender Ship'
        });
        const attackerToken = generateTestToken(attacker);

        await combatPolicyService.grantTravelProtection({
          userId: defender.user_id,
          durationMs: 60000,
          reason: 'portal_entry'
        });
        const defenderProtection = await require('../../src/models').PlayerProtectionState.findOne({
          where: { user_id: defender.user_id }
        });
        await defenderProtection.update({
          travel_protection_until: new Date(Date.now() - 1000)
        });

        const res = await request(app)
          .post(`/api/combat/realtime/attack-player/${attackerShip.ship_id}`)
          .set('Authorization', `Bearer ${attackerToken}`)
          .send({ defenderShipId: defenderShip.ship_id });

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('combat_id');
      });
    });
  });

  describe('Admin Endpoints', () => {
    describe('GET /api/admin/action-audit', () => {
      it('should return recent audit log entries for admins', async () => {
        await actionAuditService.record({
          userId: testUser.user_id,
          actionType: 'ship_travel',
          scopeType: 'ship',
          scopeId: testShip.ship_id,
          status: 'deny',
          reason: 'test_audit_visibility',
          metadata: {
            ship_id: testShip.ship_id
          }
        });

        const res = await request(app)
          .get('/api/admin/action-audit')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.logs).toBeInstanceOf(Array);
        expect(res.body.data.logs.some((log) => log.reason === 'test_audit_visibility')).toBe(true);
      });
    });
  });
});
