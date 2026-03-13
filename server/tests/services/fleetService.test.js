const { createTestUser, createTestSector, createTestShip, createSectorConnection, createTestFleet, cleanDatabase } = require('../helpers');
const fleetService = require('../../src/services/fleetService');
const { Ship, Fleet } = require('../../src/models');

beforeEach(async () => {
  await cleanDatabase();
});

describe('fleetService', () => {
  describe('createFleet', () => {
    it('should create a fleet with ships', async () => {
      const user = await createTestUser();
      const sector = await createTestSector();
      const ship1 = await createTestShip(user.user_id, sector.sector_id);
      const ship2 = await createTestShip(user.user_id, sector.sector_id);

      const fleet = await fleetService.createFleet(user.user_id, 'Alpha Fleet', [ship1.ship_id, ship2.ship_id]);

      expect(fleet.name).toBe('Alpha Fleet');
      expect(fleet.ships.length).toBe(2);
    });

    it('should reject empty name', async () => {
      const user = await createTestUser();
      const sector = await createTestSector();
      const ship = await createTestShip(user.user_id, sector.sector_id);

      await expect(fleetService.createFleet(user.user_id, '', [ship.ship_id]))
        .rejects.toThrow('Fleet name is required');
    });

    it('should reject empty ship list', async () => {
      const user = await createTestUser();

      await expect(fleetService.createFleet(user.user_id, 'Fleet', []))
        .rejects.toThrow('At least one ship is required');
    });

    it('should reject ships already in a fleet', async () => {
      const user = await createTestUser();
      const sector = await createTestSector();
      const ship = await createTestShip(user.user_id, sector.sector_id);
      await createTestFleet(user.user_id, [ship.ship_id]);

      await expect(fleetService.createFleet(user.user_id, 'Fleet 2', [ship.ship_id]))
        .rejects.toThrow(/already in a fleet/);
    });

    it('should reject exceeding max fleets per player', async () => {
      const user = await createTestUser();
      const sector = await createTestSector();

      for (let i = 0; i < 5; i++) {
        const s = await createTestShip(user.user_id, sector.sector_id);
        await createTestFleet(user.user_id, [s.ship_id], { name: `Fleet ${i}` });
      }

      const extraShip = await createTestShip(user.user_id, sector.sector_id);
      await expect(fleetService.createFleet(user.user_id, 'Fleet 6', [extraShip.ship_id]))
        .rejects.toThrow(/maximum/i);
    });

    it('should reject ships not owned by user', async () => {
      const user1 = await createTestUser({ username: 'user1' });
      const user2 = await createTestUser({ username: 'user2' });
      const sector = await createTestSector();
      const ship = await createTestShip(user2.user_id, sector.sector_id);

      await expect(fleetService.createFleet(user1.user_id, 'Fleet', [ship.ship_id]))
        .rejects.toThrow(/not found/);
    });
  });

  describe('getUserFleets', () => {
    it('should return active fleets with ships', async () => {
      const user = await createTestUser();
      const sector = await createTestSector();
      const ship = await createTestShip(user.user_id, sector.sector_id);
      await createTestFleet(user.user_id, [ship.ship_id], { name: 'My Fleet' });

      const fleets = await fleetService.getUserFleets(user.user_id);

      expect(fleets.length).toBe(1);
      expect(fleets[0].name).toBe('My Fleet');
      expect(fleets[0].ships.length).toBe(1);
    });

    it('should not return disbanded fleets', async () => {
      const user = await createTestUser();
      const sector = await createTestSector();
      const ship = await createTestShip(user.user_id, sector.sector_id);
      await createTestFleet(user.user_id, [ship.ship_id], { is_active: false });

      const fleets = await fleetService.getUserFleets(user.user_id);
      expect(fleets.length).toBe(0);
    });
  });

  describe('renameFleet', () => {
    it('should rename a fleet', async () => {
      const user = await createTestUser();
      const sector = await createTestSector();
      const ship = await createTestShip(user.user_id, sector.sector_id);
      const fleet = await createTestFleet(user.user_id, [ship.ship_id], { name: 'Old Name' });

      const updated = await fleetService.renameFleet(fleet.fleet_id, user.user_id, 'New Name');
      expect(updated.name).toBe('New Name');
    });

    it('should reject renaming another user\'s fleet', async () => {
      const user1 = await createTestUser({ username: 'user1' });
      const user2 = await createTestUser({ username: 'user2' });
      const sector = await createTestSector();
      const ship = await createTestShip(user1.user_id, sector.sector_id);
      const fleet = await createTestFleet(user1.user_id, [ship.ship_id]);

      await expect(fleetService.renameFleet(fleet.fleet_id, user2.user_id, 'Hack'))
        .rejects.toThrow('Fleet not found');
    });
  });

  describe('addShipsToFleet', () => {
    it('should add ships to a fleet', async () => {
      const user = await createTestUser();
      const sector = await createTestSector();
      const ship1 = await createTestShip(user.user_id, sector.sector_id);
      const ship2 = await createTestShip(user.user_id, sector.sector_id);
      const fleet = await createTestFleet(user.user_id, [ship1.ship_id]);

      const result = await fleetService.addShipsToFleet(fleet.fleet_id, user.user_id, [ship2.ship_id]);
      expect(result.ships.length).toBe(2);
    });

    it('should reject exceeding max ships per fleet', async () => {
      const user = await createTestUser();
      const sector = await createTestSector();
      const shipsInFleet = [];
      for (let i = 0; i < 10; i++) {
        const s = await createTestShip(user.user_id, sector.sector_id);
        shipsInFleet.push(s.ship_id);
      }
      const fleet = await createTestFleet(user.user_id, shipsInFleet);
      const extraShip = await createTestShip(user.user_id, sector.sector_id);

      await expect(fleetService.addShipsToFleet(fleet.fleet_id, user.user_id, [extraShip.ship_id]))
        .rejects.toThrow(/exceed maximum/i);
    });
  });

  describe('removeShipsFromFleet', () => {
    it('should remove ships from a fleet', async () => {
      const user = await createTestUser();
      const sector = await createTestSector();
      const ship1 = await createTestShip(user.user_id, sector.sector_id);
      const ship2 = await createTestShip(user.user_id, sector.sector_id);
      const fleet = await createTestFleet(user.user_id, [ship1.ship_id, ship2.ship_id]);

      const result = await fleetService.removeShipsFromFleet(fleet.fleet_id, user.user_id, [ship1.ship_id]);
      expect(result.ships.length).toBe(1);
    });

    it('should auto-disband if all ships removed', async () => {
      const user = await createTestUser();
      const sector = await createTestSector();
      const ship = await createTestShip(user.user_id, sector.sector_id);
      const fleet = await createTestFleet(user.user_id, [ship.ship_id]);

      const result = await fleetService.removeShipsFromFleet(fleet.fleet_id, user.user_id, [ship.ship_id]);
      expect(result.disbanded).toBe(true);

      const dbFleet = await Fleet.findByPk(fleet.fleet_id);
      expect(dbFleet.is_active).toBe(false);
    });
  });

  describe('disbandFleet', () => {
    it('should disband a fleet and unassign all ships', async () => {
      const user = await createTestUser();
      const sector = await createTestSector();
      const ship1 = await createTestShip(user.user_id, sector.sector_id);
      const ship2 = await createTestShip(user.user_id, sector.sector_id);
      const fleet = await createTestFleet(user.user_id, [ship1.ship_id, ship2.ship_id]);

      await fleetService.disbandFleet(fleet.fleet_id, user.user_id);

      const dbFleet = await Fleet.findByPk(fleet.fleet_id);
      expect(dbFleet.is_active).toBe(false);

      const s1 = await Ship.findByPk(ship1.ship_id);
      const s2 = await Ship.findByPk(ship2.ship_id);
      expect(s1.fleet_id).toBeNull();
      expect(s2.fleet_id).toBeNull();
    });
  });

  describe('moveFleet', () => {
    it('should move all ships in a fleet to an adjacent sector', async () => {
      const user = await createTestUser();
      const sectorA = await createTestSector({ name: 'Sector A' });
      const sectorB = await createTestSector({ name: 'Sector B' });
      await createSectorConnection(sectorA.sector_id, sectorB.sector_id);

      const ship1 = await createTestShip(user.user_id, sectorA.sector_id, { fuel: 50 });
      const ship2 = await createTestShip(user.user_id, sectorA.sector_id, { fuel: 50 });
      const fleet = await createTestFleet(user.user_id, [ship1.ship_id, ship2.ship_id]);

      const result = await fleetService.moveFleet(fleet.fleet_id, sectorB.sector_id, user.user_id);

      expect(result.moved.length).toBe(2);
      expect(result.failed.length).toBe(0);

      const s1 = await Ship.findByPk(ship1.ship_id);
      expect(s1.current_sector_id).toBe(sectorB.sector_id);
    });

    it('should skip ships with insufficient fuel', async () => {
      const user = await createTestUser();
      const sectorA = await createTestSector({ name: 'Sector A' });
      const sectorB = await createTestSector({ name: 'Sector B' });
      await createSectorConnection(sectorA.sector_id, sectorB.sector_id);

      const ship1 = await createTestShip(user.user_id, sectorA.sector_id, { fuel: 50 });
      const ship2 = await createTestShip(user.user_id, sectorA.sector_id, { fuel: 0 });
      const fleet = await createTestFleet(user.user_id, [ship1.ship_id, ship2.ship_id]);

      const result = await fleetService.moveFleet(fleet.fleet_id, sectorB.sector_id, user.user_id);

      expect(result.moved.length).toBe(1);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].reason).toMatch(/fuel/i);
    });

    it('should skip ships not adjacent to target', async () => {
      const user = await createTestUser();
      const sectorA = await createTestSector({ name: 'Sector A' });
      const sectorB = await createTestSector({ name: 'Sector B' });
      const sectorC = await createTestSector({ name: 'Sector C' });
      await createSectorConnection(sectorA.sector_id, sectorB.sector_id);
      // sectorC is not connected to sectorB

      const ship1 = await createTestShip(user.user_id, sectorA.sector_id, { fuel: 50 });
      const ship2 = await createTestShip(user.user_id, sectorC.sector_id, { fuel: 50 });
      const fleet = await createTestFleet(user.user_id, [ship1.ship_id, ship2.ship_id]);

      const result = await fleetService.moveFleet(fleet.fleet_id, sectorB.sector_id, user.user_id);

      expect(result.moved.length).toBe(1);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].reason).toMatch(/adjacent/i);
    });

    it('should skip ships in combat', async () => {
      const user = await createTestUser();
      const sectorA = await createTestSector({ name: 'Sector A' });
      const sectorB = await createTestSector({ name: 'Sector B' });
      await createSectorConnection(sectorA.sector_id, sectorB.sector_id);

      const ship1 = await createTestShip(user.user_id, sectorA.sector_id, { fuel: 50 });
      const ship2 = await createTestShip(user.user_id, sectorA.sector_id, { fuel: 50, in_combat: true });
      const fleet = await createTestFleet(user.user_id, [ship1.ship_id, ship2.ship_id]);

      const result = await fleetService.moveFleet(fleet.fleet_id, sectorB.sector_id, user.user_id);

      expect(result.moved.length).toBe(1);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].reason).toMatch(/combat/i);
    });

    it('should reject if fleet not found', async () => {
      const user = await createTestUser();
      const sector = await createTestSector();

      await expect(fleetService.moveFleet('00000000-0000-0000-0000-000000000000', sector.sector_id, user.user_id))
        .rejects.toThrow('Fleet not found');
    });
  });
});
