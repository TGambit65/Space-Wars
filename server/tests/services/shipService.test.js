/**
 * Ship Service Tests
 */
const shipService = require('../../src/services/shipService');
const { User, Ship, Sector, SectorConnection, PlayerProtectionState, ActionAuditLog, SectorInstanceAssignment } = require('../../src/models');
const { createTestUser, createTestSector, createTestShip, createSectorConnection, cleanDatabase } = require('../helpers');

describe('Ship Service', () => {
  let testUser, sector1, sector2, sector3, testShip;

  beforeAll(async () => {
    await cleanDatabase();

    // Create test sectors
    sector1 = await createTestSector({ name: 'Sector 1', x_coord: 0, y_coord: 0 });
    sector2 = await createTestSector({ name: 'Sector 2', x_coord: 1, y_coord: 0 });
    sector3 = await createTestSector({ name: 'Sector 3', x_coord: 2, y_coord: 0 });

    // Create connections: sector1 <-> sector2, sector2 <-> sector3
    // Note: Bidirectional connections are handled by is_bidirectional flag
    await createSectorConnection(sector1.sector_id, sector2.sector_id);
    await createSectorConnection(sector2.sector_id, sector3.sector_id);

    // Create test user and ship
    testUser = await createTestUser();
    testShip = await createTestShip(testUser.user_id, sector1.sector_id, { fuel: 100 });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('getUserShips', () => {
    it('should return all ships owned by user', async () => {
      const ships = await shipService.getUserShips(testUser.user_id);

      expect(ships).toBeInstanceOf(Array);
      expect(ships.length).toBeGreaterThan(0);
      expect(ships[0].owner_user_id).toBe(testUser.user_id);
    });

    it('should include current sector info', async () => {
      const ships = await shipService.getUserShips(testUser.user_id);

      expect(ships[0].currentSector).toBeDefined();
      expect(ships[0].currentSector.name).toBe('Sector 1');
    });

    it('should return empty array for user with no ships', async () => {
      const newUser = await createTestUser();
      const ships = await shipService.getUserShips(newUser.user_id);

      expect(ships).toEqual([]);
    });
  });

  describe('getShipById', () => {
    it('should return ship details', async () => {
      const ship = await shipService.getShipById(testShip.ship_id, testUser.user_id);

      expect(ship).toBeDefined();
      expect(ship.ship_id).toBe(testShip.ship_id);
      expect(ship.name).toBe(testShip.name);
    });

    it('should throw error for non-existent ship', async () => {
      await expect(shipService.getShipById('00000000-0000-0000-0000-000000000000', testUser.user_id))
        .rejects.toThrow('Ship not found');
    });

    it('should throw error when accessing another user\'s ship', async () => {
      const otherUser = await createTestUser();

      await expect(shipService.getShipById(testShip.ship_id, otherUser.user_id))
        .rejects.toThrow('Ship not found');
    });
  });

  describe('moveShip', () => {
    let moveUser, moveShip;

    beforeEach(async () => {
      moveUser = await createTestUser();
      moveShip = await createTestShip(moveUser.user_id, sector1.sector_id, { fuel: 100 });
    });

    it('should move ship to connected sector', async () => {
      const result = await shipService.moveShip(moveShip.ship_id, sector2.sector_id, moveUser.user_id);

      expect(result.current_sector_id).toBe(sector2.sector_id);
    });

    it('should consume fuel on movement', async () => {
      const initialFuel = moveShip.fuel;
      await shipService.moveShip(moveShip.ship_id, sector2.sector_id, moveUser.user_id);

      const updatedShip = await Ship.findByPk(moveShip.ship_id);
      expect(updatedShip.fuel).toBeLessThan(initialFuel);
    });

    it('should fail when moving to non-connected sector', async () => {
      await expect(shipService.moveShip(moveShip.ship_id, sector3.sector_id, moveUser.user_id))
        .rejects.toThrow('not adjacent');
    });

    it('should fail with not found when target sector does not exist', async () => {
      await expect(
        shipService.moveShip(moveShip.ship_id, '00000000-0000-0000-0000-000000000000', moveUser.user_id)
      ).rejects.toThrow('Target sector not found');
    });

    it('should fail when out of fuel', async () => {
      await moveShip.update({ fuel: 0 });

      await expect(shipService.moveShip(moveShip.ship_id, sector2.sector_id, moveUser.user_id))
        .rejects.toThrow('fuel');
    });

    it('should fail when ship is already in target sector', async () => {
      await expect(shipService.moveShip(moveShip.ship_id, sector1.sector_id, moveUser.user_id))
        .rejects.toThrow('already in');
    });

    it('should block movement into owner-restricted sectors', async () => {
      await sector2.update({
        zone_class: 'home',
        security_class: 'protected',
        access_mode: 'owner',
        owner_user_id: testUser.user_id
      });

      await expect(shipService.moveShip(moveShip.ship_id, sector2.sector_id, moveUser.user_id))
        .rejects.toThrow(/owner-restricted/i);

      await sector2.update({
        access_mode: 'public',
        owner_user_id: null
      });
    });

    it('should grant portal entry protection and record the movement audit log', async () => {
      const portalSource = await createTestSector({ name: 'Portal Source', type: 'Mid' });
      const portalDestination = await createTestSector({ name: 'Portal Destination', type: 'Fringe' });
      const portalUser = await createTestUser();
      const portalShip = await createTestShip(portalUser.user_id, portalSource.sector_id, { fuel: 100 });
      await createSectorConnection(portalSource.sector_id, portalDestination.sector_id, {
        connection_type: 'portal',
        lane_class: 'portal'
      });

      await shipService.moveShip(portalShip.ship_id, portalDestination.sector_id, portalUser.user_id);

      const protection = await PlayerProtectionState.findOne({ where: { user_id: portalUser.user_id } });
      expect(protection.travel_protection_until).not.toBeNull();
      expect(protection.travel_protection_reason).toBe('portal_entry');

      const auditLog = await ActionAuditLog.findOne({
        where: {
          user_id: portalUser.user_id,
          action_type: 'ship_travel',
          status: 'allow'
        }
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog.metadata.lane_class).toBe('portal');
    });

    it('should assign an instance when entering an instanced adventure sector', async () => {
      const source = await createTestSector({ name: 'Adventure Source', type: 'Outer' });
      const destination = await createTestSector({
        name: 'Adventure Destination',
        type: 'Unknown',
        zone_class: 'adventure',
        rule_flags: {
          instance_mode: 'instanced',
          instance_capacity: 1,
          max_instances: 1
        }
      });
      const adventureUser = await createTestUser();
      const adventureShip = await createTestShip(adventureUser.user_id, source.sector_id, { fuel: 100 });
      await createSectorConnection(source.sector_id, destination.sector_id);

      const movedShip = await shipService.moveShip(
        adventureShip.ship_id,
        destination.sector_id,
        adventureUser.user_id
      );

      expect(movedShip.dataValues.instance_assignment).toBeDefined();
      expect(movedShip.dataValues.instance_assignment.instance_key).toBe('inst-1');

      const assignment = await SectorInstanceAssignment.findOne({
        where: {
          user_id: adventureUser.user_id,
          sector_id: destination.sector_id,
          status: 'active'
        }
      });
      expect(assignment).not.toBeNull();
      expect(assignment.instance_key).toBe('inst-1');
    });
  });

  describe('getAdjacentSectors', () => {
    it('should return adjacent sectors', async () => {
      const adjacent = await shipService.getAdjacentSectors(sector1.sector_id);

      expect(adjacent).toBeInstanceOf(Array);
      expect(adjacent.length).toBeGreaterThan(0);
    });

    it('should include connection details', async () => {
      const adjacent = await shipService.getAdjacentSectors(sector1.sector_id);

      expect(adjacent[0]).toHaveProperty('sector');
      expect(adjacent[0]).toHaveProperty('connection_type');
      expect(adjacent[0]).toHaveProperty('connection_policy');
    });
  });

  describe('isAdjacent', () => {
    it('should return true for connected sectors', async () => {
      const result = await shipService.isAdjacent(sector1.sector_id, sector2.sector_id);

      expect(result).toBe(true);
    });

    it('should return false for non-connected sectors', async () => {
      const result = await shipService.isAdjacent(sector1.sector_id, sector3.sector_id);

      expect(result).toBe(false);
    });
  });
});
