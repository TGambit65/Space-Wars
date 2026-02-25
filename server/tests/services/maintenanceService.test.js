/**
 * Maintenance Service Tests
 */
const { sequelize, User, Ship, Sector, Component, ShipComponent, Port } = require('../../src/models');
const maintenanceService = require('../../src/services/maintenanceService');
const { createTestUser, createTestSector, createTestShip, createTestPort, cleanDatabase } = require('../helpers');

describe('Maintenance Service', () => {
  let testUser, testSector, testShip, testPort, testComponent;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await cleanDatabase();

    testSector = await createTestSector();
    testUser = await createTestUser({ credits: 50000 });
    testPort = await createTestPort(testSector.sector_id);
    testShip = await createTestShip(testUser.user_id, testSector.sector_id, {
      hull_points: 50,
      max_hull_points: 100,
      shield_points: 25,
      max_shield_points: 50
    });

    // Create a test component
    testComponent = await Component.create({
      name: 'Test Laser',
      type: 'weapon',
      tier: 1,
      price: 1000,
      damage: 10,
      accuracy: 80,
      energy_cost: 5
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('calculateHullRepairCost', () => {
    it('should calculate repair cost based on damage', () => {
      const cost = maintenanceService.calculateHullRepairCost(testShip);
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });

    it('should return 0 when hull is full', async () => {
      await testShip.update({ hull_points: 100 });
      const cost = maintenanceService.calculateHullRepairCost(testShip);
      expect(cost).toBe(0);
    });

    it('should cost more for more damage', async () => {
      await testShip.update({ hull_points: 80 });
      const lowDamageCost = maintenanceService.calculateHullRepairCost(testShip);

      await testShip.update({ hull_points: 20 });
      const highDamageCost = maintenanceService.calculateHullRepairCost(testShip);

      expect(highDamageCost).toBeGreaterThan(lowDamageCost);
    });
  });

  describe('calculateComponentRepairCost', () => {
    it('should calculate cost based on condition', async () => {
      const shipComponent = await ShipComponent.create({
        ship_id: testShip.ship_id,
        component_id: testComponent.component_id,
        slot_index: 0,
        condition: 0.5,
        is_active: true
      });

      // Reload with component association
      const sc = await ShipComponent.findByPk(shipComponent.ship_component_id, {
        include: [{ model: Component, as: 'component' }]
      });

      const cost = maintenanceService.calculateComponentRepairCost(sc);
      expect(cost).toBeGreaterThan(0);
    });

    it('should return 0 when component is perfect', async () => {
      const shipComponent = await ShipComponent.create({
        ship_id: testShip.ship_id,
        component_id: testComponent.component_id,
        slot_index: 0,
        condition: 1.0,
        is_active: true
      });

      const sc = await ShipComponent.findByPk(shipComponent.ship_component_id, {
        include: [{ model: Component, as: 'component' }]
      });

      const cost = maintenanceService.calculateComponentRepairCost(sc);
      expect(cost).toBe(0);
    });
  });

  describe('getRepairEstimate', () => {
    it('should return repair estimate for ship', async () => {
      // Install a damaged component
      await ShipComponent.create({
        ship_id: testShip.ship_id,
        component_id: testComponent.component_id,
        slot_index: 0,
        condition: 0.5,
        is_active: true
      });

      const estimate = await maintenanceService.getRepairEstimate(testShip.ship_id, testUser.user_id);

      expect(estimate).toHaveProperty('hull_repair_cost');
      expect(estimate).toHaveProperty('components_needing_repair');
      expect(estimate).toHaveProperty('total_cost');
      expect(estimate.hull_repair_cost).toBeGreaterThan(0);
    });
  });

  describe('repairHull', () => {
    it('should repair hull and deduct credits', async () => {
      const initialCredits = testUser.credits;

      const result = await maintenanceService.repairHull(
        testUser.user_id,
        testShip.ship_id,
        testPort.port_id
      );

      expect(result.success).toBe(true);
      expect(result.hull_restored).toBe(100);
      await testUser.reload();
      expect(testUser.credits).toBeLessThan(initialCredits);
    });

    it('should throw error when ship is not at port', async () => {
      const otherSector = await createTestSector({ name: 'Other' });
      await testShip.update({ current_sector_id: otherSector.sector_id });

      await expect(maintenanceService.repairHull(testUser.user_id, testShip.ship_id, testPort.port_id))
        .rejects.toThrow('Ship not at port');
    });

    it('should throw error with insufficient credits', async () => {
      await testUser.update({ credits: 0 });

      await expect(maintenanceService.repairHull(testUser.user_id, testShip.ship_id, testPort.port_id))
        .rejects.toThrow(/Insufficient credits/);
    });
  });

  describe('repairComponent', () => {
    let installedComponent;

    beforeEach(async () => {
      installedComponent = await ShipComponent.create({
        ship_id: testShip.ship_id,
        component_id: testComponent.component_id,
        slot_index: 0,
        condition: 0.5,
        is_active: true
      });
    });

    it('should repair component to full condition', async () => {
      const result = await maintenanceService.repairComponent(
        testUser.user_id,
        testShip.ship_id,
        installedComponent.ship_component_id,
        testPort.port_id
      );

      expect(result.success).toBe(true);
    });
  });

  describe('repairAll', () => {
    beforeEach(async () => {
      await ShipComponent.create({
        ship_id: testShip.ship_id,
        component_id: testComponent.component_id,
        slot_index: 0,
        condition: 0.5,
        is_active: true
      });
    });

    it('should repair hull and all components', async () => {
      const result = await maintenanceService.repairAll(
        testUser.user_id,
        testShip.ship_id,
        testPort.port_id
      );

      expect(result.success).toBe(true);
      expect(result.components_repaired).toBeGreaterThanOrEqual(1);
      expect(result.total_cost).toBeGreaterThan(0);
    });

    it('should return zero cost when nothing needs repair', async () => {
      await testShip.update({ hull_points: 100 });
      await ShipComponent.update(
        { condition: 1.0 },
        { where: { ship_id: testShip.ship_id } }
      );

      const result = await maintenanceService.repairAll(
        testUser.user_id,
        testShip.ship_id,
        testPort.port_id
      );

      expect(result.cost).toBe(0);
    });
  });

  describe('restoreShieldsAtPort', () => {
    it('should restore shields to full', async () => {
      await testShip.update({ shield_points: 10 });

      const result = await maintenanceService.restoreShieldsAtPort(testShip.ship_id);

      expect(result.shield_points).toBe(50);
    });
  });

  describe('degradeComponents', () => {
    beforeEach(async () => {
      await ShipComponent.create({
        ship_id: testShip.ship_id,
        component_id: testComponent.component_id,
        slot_index: 0,
        condition: 1.0,
        is_active: true
      });
    });

    it('should reduce component condition', async () => {
      await maintenanceService.degradeComponents(testShip.ship_id, 5);

      const component = await ShipComponent.findOne({
        where: { ship_id: testShip.ship_id }
      });

      expect(component.condition).toBeLessThan(1.0);
    });
  });

  describe('degradeOnJump', () => {
    beforeEach(async () => {
      await ShipComponent.create({
        ship_id: testShip.ship_id,
        component_id: testComponent.component_id,
        slot_index: 0,
        condition: 1.0,
        is_active: true
      });
    });

    it('should degrade components on sector jump', async () => {
      await maintenanceService.degradeOnJump(testShip.ship_id);

      const component = await ShipComponent.findOne({
        where: { ship_id: testShip.ship_id }
      });

      expect(component.condition).toBeLessThan(1.0);
    });
  });
});

