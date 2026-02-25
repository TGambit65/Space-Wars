/**
 * Ship Designer Service Tests
 */
const { sequelize, User, Ship, Sector, Component, ShipComponent, Port } = require('../../src/models');
const shipDesignerService = require('../../src/services/shipDesignerService');
const { createTestUser, createTestSector, createTestShip, createTestPort, cleanDatabase } = require('../helpers');

describe('Ship Designer Service', () => {
  let testUser, testSector, testShip, testPort, weaponComponent, shieldComponent;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await cleanDatabase();

    testSector = await createTestSector();
    testUser = await createTestUser({ credits: 50000 });
    testPort = await createTestPort(testSector.sector_id);
    testShip = await createTestShip(testUser.user_id, testSector.sector_id, {
      ship_type: 'Scout',
      attack_power: 10,
      defense_rating: 5,
      speed: 10,
      max_energy: 100,
      energy: 100
    });

    // Create test components
    weaponComponent = await Component.create({
      name: 'Plasma Cannon',
      type: 'weapon',
      tier: 1,
      price: 2000,
      damage: 15,
      accuracy: 85,
      energy_cost: 10
    });

    shieldComponent = await Component.create({
      name: 'Energy Shield',
      type: 'shield',
      tier: 1,
      price: 1500,
      shield_capacity: 50,
      recharge_rate: 5,
      energy_cost: 8
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('getAvailableComponents', () => {
    it('should return all available components', async () => {
      const components = await shipDesignerService.getAvailableComponents();
      expect(components.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by type', async () => {
      const weapons = await shipDesignerService.getAvailableComponents('weapon');
      weapons.forEach(c => expect(c.type).toBe('weapon'));
    });
  });

  describe('getShipWithComponents', () => {
    it('should return ship with installed components', async () => {
      await ShipComponent.create({
        ship_id: testShip.ship_id,
        component_id: weaponComponent.component_id,
        slot_index: 0,
        condition: 1.0,
        is_active: true
      });

      const ship = await shipDesignerService.getShipWithComponents(testShip.ship_id, testUser.user_id);
      expect(ship.components).toHaveLength(1);
      expect(ship.components[0].component.name).toBe('Plasma Cannon');
    });

    it('should throw error for non-existent ship', async () => {
      await expect(shipDesignerService.getShipWithComponents('00000000-0000-0000-0000-000000000000', testUser.user_id))
        .rejects.toThrow('Ship not found');
    });
  });

  describe('getShipSlots', () => {
    it('should return slot configuration for ship type', () => {
      const slots = shipDesignerService.getShipSlots('Scout');

      expect(slots).toHaveProperty('weapon');
      expect(slots).toHaveProperty('shield');
      expect(slots).toHaveProperty('engine');
    });
  });

  describe('installComponent', () => {
    it('should install component on ship', async () => {
      const result = await shipDesignerService.installComponent(
        testUser.user_id,
        testShip.ship_id,
        weaponComponent.component_id
      );

      expect(result.success).toBe(true);
      expect(result.ship_component_id).toBeDefined();
    });

    it('should deduct credits from user', async () => {
      const initialCredits = testUser.credits;

      await shipDesignerService.installComponent(
        testUser.user_id,
        testShip.ship_id,
        weaponComponent.component_id
      );

      await testUser.reload();
      expect(testUser.credits).toBeLessThan(initialCredits);
    });

    it('should throw error with insufficient credits', async () => {
      await testUser.update({ credits: 10 });

      await expect(shipDesignerService.installComponent(
        testUser.user_id,
        testShip.ship_id,
        weaponComponent.component_id
      )).rejects.toThrow(/Insufficient credits/);
    });

    it('should throw error when ship not at port', async () => {
      const otherSector = await createTestSector({ name: 'Empty Sector' });
      await testShip.update({ current_sector_id: otherSector.sector_id });

      await expect(shipDesignerService.installComponent(
        testUser.user_id,
        testShip.ship_id,
        weaponComponent.component_id
      )).rejects.toThrow('Ship must be at a port');
    });
  });

  describe('uninstallComponent', () => {
    let installedComponent;

    beforeEach(async () => {
      installedComponent = await ShipComponent.create({
        ship_id: testShip.ship_id,
        component_id: weaponComponent.component_id,
        slot_index: 0,
        condition: 1.0,
        is_active: true
      });
    });

    it('should remove component from ship', async () => {
      await shipDesignerService.uninstallComponent(
        testUser.user_id,
        testShip.ship_id,
        installedComponent.ship_component_id
      );

      const components = await ShipComponent.findAll({
        where: { ship_id: testShip.ship_id }
      });
      expect(components).toHaveLength(0);
    });

    it('should refund partial credits', async () => {
      const initialCredits = testUser.credits;

      const result = await shipDesignerService.uninstallComponent(
        testUser.user_id,
        testShip.ship_id,
        installedComponent.ship_component_id
      );

      expect(result.refund).toBeGreaterThan(0);
      await testUser.reload();
      expect(testUser.credits).toBeGreaterThan(initialCredits);
    });
  });

  describe('recalculateShipStats', () => {
    beforeEach(async () => {
      await ShipComponent.create({
        ship_id: testShip.ship_id,
        component_id: weaponComponent.component_id,
        slot_index: 0,
        condition: 1.0,
        is_active: true
      });
    });

    it('should update ship stats based on components', async () => {
      await shipDesignerService.recalculateShipStats(testShip);
      await testShip.reload();

      // Base attack is 10, weapon adds 15 damage
      expect(testShip.attack_power).toBe(10 + 15);
    });

    it('should not count inactive components', async () => {
      await ShipComponent.update(
        { is_active: false },
        { where: { ship_id: testShip.ship_id } }
      );

      await shipDesignerService.recalculateShipStats(testShip);
      await testShip.reload();

      // Base attack only
      expect(testShip.attack_power).toBe(10);
    });
  });

  describe('getShipDesign', () => {
    it('should return ship design summary', async () => {
      await ShipComponent.create({
        ship_id: testShip.ship_id,
        component_id: weaponComponent.component_id,
        slot_index: 0,
        condition: 1.0,
        is_active: true
      });

      const design = await shipDesignerService.getShipDesign(testShip.ship_id, testUser.user_id);

      expect(design.ship_id).toBe(testShip.ship_id);
      expect(design.ship_type).toBe('Scout');
      expect(design.slots).toBeDefined();
      expect(design.components).toBeDefined();
      expect(design.stats).toBeDefined();
    });
  });
});

