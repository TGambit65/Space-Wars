/**
 * Crew Service Tests
 */
const crewService = require('../../src/services/crewService');
const { Crew, Ship, User, Port } = require('../../src/models');
const { createTestUser, createTestSector, createTestShip, createTestPort, createTestCrew, cleanDatabase } = require('../helpers');

describe('Crew Service', () => {
  let testUser, testSector, testShip, testPort;

  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    testSector = await createTestSector({ name: 'Crew Test Sector' });
    testUser = await createTestUser({ credits: 50000 });
    testShip = await createTestShip(testUser.user_id, testSector.sector_id, { ship_type: 'Merchant Cruiser' });
    testPort = await createTestPort(testSector.sector_id, { name: 'Crew Port' });
  });

  describe('getCrewAtPort', () => {
    it('should return available crew at port', async () => {
      await createTestCrew(testPort.port_id, null, null, { name: 'Available Crew 1', species: 'Human' });
      await createTestCrew(testPort.port_id, null, null, { name: 'Available Crew 2', species: 'Vexian' });

      const crew = await crewService.getCrewAtPort(testPort.port_id);

      expect(crew.length).toBe(2);
      expect(crew[0]).toHaveProperty('crew_id');
      expect(crew[0]).toHaveProperty('name');
      expect(crew[0]).toHaveProperty('species');
      expect(crew[0]).toHaveProperty('hiring_fee');
    });

    it('should not return hired crew', async () => {
      await createTestCrew(testPort.port_id, null, null, { name: 'Available' });
      await createTestCrew(null, testUser.user_id, testShip.ship_id, { name: 'Hired' });

      const crew = await crewService.getCrewAtPort(testPort.port_id);

      expect(crew.length).toBe(1);
      expect(crew[0].name).toBe('Available');
    });

    it('should throw error for non-existent port', async () => {
      await expect(crewService.getCrewAtPort('00000000-0000-0000-0000-000000000000'))
        .rejects.toThrow('Port not found');
    });
  });

  describe('hireCrew', () => {
    let availableCrew;

    beforeEach(async () => {
      availableCrew = await createTestCrew(testPort.port_id, null, null, { 
        name: 'Hireable Crew', 
        species: 'Human',
        salary: 100 
      });
    });

    it('should successfully hire crew', async () => {
      const result = await crewService.hireCrew(availableCrew.crew_id, testShip.ship_id, testUser.user_id);

      expect(result).toHaveProperty('crew');
      expect(result.crew.owner_user_id).toBe(testUser.user_id);
      expect(result.crew.current_ship_id).toBe(testShip.ship_id);
      expect(result).toHaveProperty('hiring_fee');
    });

    it('should deduct hiring fee from user', async () => {
      const initialCredits = testUser.credits;
      await crewService.hireCrew(availableCrew.crew_id, testShip.ship_id, testUser.user_id);

      const updatedUser = await User.findByPk(testUser.user_id);
      expect(Number(updatedUser.credits)).toBeLessThan(initialCredits);
    });

    it('should throw error if crew not available', async () => {
      // Mark crew as already hired
      await availableCrew.update({ owner_user_id: testUser.user_id });

      await expect(crewService.hireCrew(availableCrew.crew_id, testShip.ship_id, testUser.user_id))
        .rejects.toThrow('Crew member not available for hire');
    });

    it('should throw error if insufficient credits', async () => {
      const poorUser = await createTestUser({ credits: 10 });
      const poorShip = await createTestShip(poorUser.user_id, testSector.sector_id);

      await expect(crewService.hireCrew(availableCrew.crew_id, poorShip.ship_id, poorUser.user_id))
        .rejects.toThrow('Insufficient credits');
    });

    it('should throw error if ship not at port sector', async () => {
      const otherSector = await createTestSector({ name: 'Far Sector' });
      const farShip = await createTestShip(testUser.user_id, otherSector.sector_id);

      await expect(crewService.hireCrew(availableCrew.crew_id, farShip.ship_id, testUser.user_id))
        .rejects.toThrow('Ship must be at the port');
    });
  });

  describe('assignRole', () => {
    let hiredCrew;

    beforeEach(async () => {
      hiredCrew = await createTestCrew(null, testUser.user_id, testShip.ship_id, { name: 'Assigned Crew' });
    });

    it('should assign a valid role', async () => {
      const result = await crewService.assignRole(hiredCrew.crew_id, 'PILOT', testUser.user_id);

      expect(result.assigned_role).toBe('Pilot');
    });

    it('should throw error for invalid role', async () => {
      await expect(crewService.assignRole(hiredCrew.crew_id, 'INVALID', testUser.user_id))
        .rejects.toThrow('Invalid role');
    });

    it('should throw error for crew not owned', async () => {
      const otherUser = await createTestUser();

      await expect(crewService.assignRole(hiredCrew.crew_id, 'PILOT', otherUser.user_id))
        .rejects.toThrow('Crew member not found or not owned');
    });
  });

  describe('getUserCrew', () => {
    it('should return empty array for user with no crew', async () => {
      const crew = await crewService.getUserCrew(testUser.user_id);
      expect(crew).toEqual([]);
    });

    it('should return hired crew', async () => {
      await createTestCrew(null, testUser.user_id, testShip.ship_id, { name: 'My Crew' });

      const crew = await crewService.getUserCrew(testUser.user_id);

      expect(crew.length).toBe(1);
      expect(crew[0].name).toBe('My Crew');
    });
  });

  describe('dismissCrew', () => {
    it('should dismiss a crew member', async () => {
      const crew = await createTestCrew(null, testUser.user_id, testShip.ship_id);

      const result = await crewService.dismissCrew(crew.crew_id, testUser.user_id);

      expect(result.message).toBe('Crew member dismissed');

      const dismissed = await Crew.findByPk(crew.crew_id);
      expect(dismissed.is_active).toBe(false);
      expect(dismissed.owner_user_id).toBeNull();
    });

    it('should throw error for non-existent crew', async () => {
      await expect(crewService.dismissCrew('00000000-0000-0000-0000-000000000000', testUser.user_id))
        .rejects.toThrow('Crew member not found');
    });
  });

  describe('getShipCrew', () => {
    it('should return ship crew information', async () => {
      await createTestCrew(null, testUser.user_id, testShip.ship_id, { name: 'Ship Crew 1' });
      await createTestCrew(null, testUser.user_id, testShip.ship_id, { name: 'Ship Crew 2' });

      const result = await crewService.getShipCrew(testShip.ship_id, testUser.user_id);

      expect(result.ship_id).toBe(testShip.ship_id);
      expect(result.crew.length).toBe(2);
      expect(result).toHaveProperty('crew_capacity');
      expect(result).toHaveProperty('current_crew', 2);
    });

    it('should throw error for non-existent ship', async () => {
      await expect(crewService.getShipCrew('00000000-0000-0000-0000-000000000000', testUser.user_id))
        .rejects.toThrow('Ship not found');
    });
  });

  describe('transferCrew', () => {
    let crew, targetShip;

    beforeEach(async () => {
      crew = await createTestCrew(null, testUser.user_id, testShip.ship_id, { name: 'Transfer Crew' });
      targetShip = await createTestShip(testUser.user_id, testSector.sector_id, { name: 'Target Ship' });
    });

    it('should transfer crew to another ship', async () => {
      const result = await crewService.transferCrew(crew.crew_id, targetShip.ship_id, testUser.user_id);

      expect(result.current_ship_id).toBe(targetShip.ship_id);
    });

    it('should throw error if ships in different sectors', async () => {
      const farSector = await createTestSector({ name: 'Far Sector' });
      const farShip = await createTestShip(testUser.user_id, farSector.sector_id);

      await expect(crewService.transferCrew(crew.crew_id, farShip.ship_id, testUser.user_id))
        .rejects.toThrow('Ships must be in the same sector');
    });

    it('should throw error if target ship at capacity', async () => {
      // Fighter has capacity of 1
      const fighterShip = await createTestShip(testUser.user_id, testSector.sector_id, { ship_type: 'Fighter' });
      await createTestCrew(null, testUser.user_id, fighterShip.ship_id, { name: 'Existing Crew' });

      await expect(crewService.transferCrew(crew.crew_id, fighterShip.ship_id, testUser.user_id))
        .rejects.toThrow('capacity reached');
    });
  });

  describe('processSalaries', () => {
    beforeEach(async () => {
      await createTestCrew(null, testUser.user_id, testShip.ship_id, { salary: 100 });
      // Set last_salary_tick to 25 hours ago
      await testUser.update({ last_salary_tick: new Date(Date.now() - 25 * 60 * 60 * 1000) });
    });

    it('should process salaries after 24 hours', async () => {
      const result = await crewService.processSalaries(testUser.user_id);

      expect(result.message).toBe('Salaries paid');
      expect(result).toHaveProperty('total_paid');
      expect(result).toHaveProperty('days_covered');
    });

    it('should not process if less than 24 hours', async () => {
      await testUser.update({ last_salary_tick: new Date() });

      const result = await crewService.processSalaries(testUser.user_id);

      expect(result.message).toBe('Salaries not due yet');
      expect(result).toHaveProperty('hours_until_due');
    });

    it('should accumulate debt if insufficient credits', async () => {
      await testUser.update({ credits: 0 });

      const result = await crewService.processSalaries(testUser.user_id);

      expect(result.message).toBe('Insufficient funds for full salary payment');
      expect(result).toHaveProperty('debt_accumulated');
    });
  });

  describe('paySalaryDebt', () => {
    beforeEach(async () => {
      await testUser.update({ crew_salary_due: 500, credits: 1000 });
    });

    it('should pay off salary debt', async () => {
      const result = await crewService.paySalaryDebt(testUser.user_id);

      expect(result.message).toBe('Salary debt paid');
      expect(result.amount_paid).toBe(500);
      expect(result.remaining_debt).toBe(0);
    });

    it('should pay partial debt if amount specified', async () => {
      const result = await crewService.paySalaryDebt(testUser.user_id, 200);

      expect(result.amount_paid).toBe(200);
      expect(result.remaining_debt).toBe(300);
    });

    it('should return message if no debt', async () => {
      await testUser.update({ crew_salary_due: 0 });

      const result = await crewService.paySalaryDebt(testUser.user_id);

      expect(result.message).toBe('No salary debt to pay');
    });

    it('should throw error if no credits to pay', async () => {
      await testUser.update({ credits: 0 });

      await expect(crewService.paySalaryDebt(testUser.user_id))
        .rejects.toThrow('Insufficient credits to pay debt');
    });
  });
});

