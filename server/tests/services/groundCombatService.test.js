const { Colony, ColonyBuilding, GroundUnit, GroundCombatUnit, GroundCombatInstance } = require('../../src/models');
const groundCombatService = require('../../src/services/groundCombatService');
const { createTestUser, createTestSector, createTestPlanet, createTestColony, createTestBuilding, createTestGroundUnit, cleanDatabase } = require('../helpers');
const config = require('../../src/config');

let testUser, testSector, testPlanet, testColony;

beforeEach(async () => {
  await cleanDatabase();

  testUser = await createTestUser({ credits: 1000000, last_login: new Date() });
  testSector = await createTestSector();
  testPlanet = await createTestPlanet(testSector.sector_id, {
    type: 'Terran',
    size: 5,
    owner_user_id: testUser.user_id
  });
  testColony = await createTestColony(testPlanet.planet_id, testUser.user_id, {
    population: 5000,
    infrastructure_level: 5,
    surface_initialized: true
  });

  // Add a command center (required for training)
  await createTestBuilding(testColony.colony_id, {
    building_type: 'GARRISON_BARRACKS',
    grid_x: 10,
    grid_y: 10,
    is_active: true
  });
});

// ============== Training ==============

describe('trainUnit', () => {
  test('should train a militia unit', async () => {
    const unit = await groundCombatService.trainUnit(
      testColony.colony_id, testUser.user_id, 'militia'
    );

    expect(unit.unit_type).toBe('militia');
    expect(unit.hp_max).toBe(config.groundCombat.unitTypes.militia.hp);
    expect(unit.hp_remaining).toBe(config.groundCombat.unitTypes.militia.hp);
    expect(unit.colony_id).toBe(testColony.colony_id);
    expect(unit.training_until).toBeTruthy();

    // Verify credits deducted
    await testUser.reload();
    expect(Number(testUser.credits)).toBe(1000000 - config.groundCombat.unitTypes.militia.cost);
  });

  test('should train different unit types', async () => {
    for (const unitType of Object.keys(config.groundCombat.unitTypes)) {
      const unit = await groundCombatService.trainUnit(
        testColony.colony_id, testUser.user_id, unitType
      );
      expect(unit.unit_type).toBe(unitType);
      expect(unit.hp_max).toBe(config.groundCombat.unitTypes[unitType].hp);
    }
  });

  test('should reject unknown unit type', async () => {
    await expect(
      groundCombatService.trainUnit(testColony.colony_id, testUser.user_id, 'nonexistent')
    ).rejects.toThrow('Unknown unit type');
  });

  test('should reject without garrison barracks', async () => {
    await ColonyBuilding.destroy({ where: { colony_id: testColony.colony_id } });
    await expect(
      groundCombatService.trainUnit(testColony.colony_id, testUser.user_id, 'militia')
    ).rejects.toThrow('Garrison Barracks');
  });

  test('should reject when unit cap is reached', async () => {
    // Create 50 units to reach cap
    const units = [];
    for (let i = 0; i < config.groundCombat.maxUnitsPerColony; i++) {
      units.push({
        owner_user_id: testUser.user_id,
        unit_type: 'militia',
        hp_max: 50,
        hp_remaining: 50,
        colony_id: testColony.colony_id
      });
    }
    await GroundUnit.bulkCreate(units);

    await expect(
      groundCombatService.trainUnit(testColony.colony_id, testUser.user_id, 'militia')
    ).rejects.toThrow('Maximum');
  });

  test('should reject with insufficient credits', async () => {
    await testUser.update({ credits: 0 });
    await expect(
      groundCombatService.trainUnit(testColony.colony_id, testUser.user_id, 'militia')
    ).rejects.toThrow('Insufficient credits');
  });

  test('should reject on uninitialized surface', async () => {
    await testColony.update({ surface_initialized: false });
    await expect(
      groundCombatService.trainUnit(testColony.colony_id, testUser.user_id, 'militia')
    ).rejects.toThrow('Surface must be initialized');
  });

  test('should reject for non-owner', async () => {
    const otherUser = await createTestUser({ username: 'other' });
    await expect(
      groundCombatService.trainUnit(testColony.colony_id, otherUser.user_id, 'militia')
    ).rejects.toThrow('Colony not found or not owned');
  });
});

// ============== Garrison ==============

describe('getGarrison', () => {
  test('should return empty garrison', async () => {
    const garrison = await groundCombatService.getGarrison(testColony.colony_id, testUser.user_id);
    expect(garrison).toEqual([]);
  });

  test('should return units with training status', async () => {
    await createTestGroundUnit(testColony.colony_id, testUser.user_id, { unit_type: 'militia' });
    await createTestGroundUnit(testColony.colony_id, testUser.user_id, {
      unit_type: 'marines',
      training_until: new Date(Date.now() + 60000) // still training
    });

    const garrison = await groundCombatService.getGarrison(testColony.colony_id, testUser.user_id);
    expect(garrison).toHaveLength(2);
    expect(garrison[0].is_trained).toBe(true);
    expect(garrison[1].is_trained).toBe(false);
    expect(garrison[1].training_remaining_ms).toBeGreaterThan(0);
  });

  test('should reject for non-owner', async () => {
    const otherUser = await createTestUser({ username: 'other' });
    await expect(
      groundCombatService.getGarrison(testColony.colony_id, otherUser.user_id)
    ).rejects.toThrow('Colony not found or not owned');
  });
});

// ============== Defense Policy ==============

describe('setDefensePolicy', () => {
  test('should set valid defense policy', async () => {
    for (const policy of config.groundCombat.defenderPolicies) {
      const result = await groundCombatService.setDefensePolicy(
        testColony.colony_id, testUser.user_id, policy
      );
      expect(result.defender_policy).toBe(policy);
    }

    await testColony.reload();
    expect(testColony.defender_policy).toBe('guerrilla'); // last policy set
  });

  test('should reject invalid policy', async () => {
    await expect(
      groundCombatService.setDefensePolicy(testColony.colony_id, testUser.user_id, 'invalid')
    ).rejects.toThrow('Invalid defense policy');
  });

  test('should reject for non-owner', async () => {
    const otherUser = await createTestUser({ username: 'other' });
    await expect(
      groundCombatService.setDefensePolicy(testColony.colony_id, otherUser.user_id, 'aggressive')
    ).rejects.toThrow('Colony not found or not owned');
  });
});

// ============== Disband ==============

describe('disbandUnit', () => {
  test('should disband a unit with partial refund', async () => {
    const unit = await createTestGroundUnit(testColony.colony_id, testUser.user_id, { unit_type: 'militia' });
    const expectedRefund = Math.floor(config.groundCombat.unitTypes.militia.cost * 0.25);

    const initialCredits = Number(testUser.credits);
    const result = await groundCombatService.disbandUnit(
      testColony.colony_id, testUser.user_id, unit.unit_id
    );

    expect(result.disbanded).toBe(true);
    expect(result.refund).toBe(expectedRefund);

    await testUser.reload();
    expect(Number(testUser.credits)).toBe(initialCredits + expectedRefund);

    const found = await GroundUnit.findByPk(unit.unit_id);
    expect(found).toBeNull();
  });

  test('should reject for non-existent unit', async () => {
    await expect(
      groundCombatService.disbandUnit(testColony.colony_id, testUser.user_id, '00000000-0000-0000-0000-000000000000')
    ).rejects.toThrow('Unit not found');
  });
});

// ============== NPC Raid ==============

describe('triggerNpcRaid', () => {
  test('should initiate and auto-resolve NPC raid on colony', async () => {
    // Add some defender units
    await createTestGroundUnit(testColony.colony_id, testUser.user_id, { unit_type: 'militia' });
    await createTestGroundUnit(testColony.colony_id, testUser.user_id, { unit_type: 'marines' });

    const result = await groundCombatService.triggerNpcRaid(testColony.colony_id);

    expect(result).toBeTruthy();
    // NPC raids are auto-resolved — result is the initial state returned by initiateInvasion
    expect(result.attacker_units).toBeGreaterThanOrEqual(config.groundCombat.npcRaid.minRaidStrength);
    expect(result.attacker_units).toBeLessThanOrEqual(config.groundCombat.npcRaid.maxRaidStrength);
    expect(result.defender_units).toBe(2);

    // Verify combat was auto-resolved (no longer active)
    const instance = await GroundCombatInstance.findByPk(result.instance_id);
    expect(['defender_won', 'attacker_won']).toContain(instance.status);
  });

  test('should skip raid if surface not initialized', async () => {
    await testColony.update({ surface_initialized: false });
    const result = await groundCombatService.triggerNpcRaid(testColony.colony_id);
    expect(result).toBeNull();
  });

  test('should allow second raid after first auto-resolves', async () => {
    // First raid auto-resolves
    await groundCombatService.triggerNpcRaid(testColony.colony_id);
    // Bypass cooldown for test
    await Colony.update({ last_raid: new Date(0) }, { where: { colony_id: testColony.colony_id } });
    const result = await groundCombatService.triggerNpcRaid(testColony.colony_id);
    // Second raid should succeed since first resolved
    expect(result).toBeTruthy();
  });
});

// ============== Combat State ==============

describe('getCombatState', () => {
  test('should return full combat state for player invasion', async () => {
    // Use a player invasion (not NPC raid) so combat stays active
    const attacker = await createTestUser({ username: 'attacker', credits: 1000000 });
    const attackerShip = await require('../../src/models').Ship.create({
      owner_user_id: attacker.user_id,
      current_sector_id: testSector.sector_id,
      ship_type: 'Fighter', name: 'Invader',
      hull_strength: 200, max_hull: 200, shields: 100, max_shields: 100,
      fuel: 100, max_fuel: 100, cargo_capacity: 50
    });
    const attackerUnit = await GroundUnit.create({
      owner_user_id: attacker.user_id, unit_type: 'marines',
      hp_max: 100, hp_remaining: 100, ship_id: attackerShip.ship_id, is_active: true
    });
    await createTestGroundUnit(testColony.colony_id, testUser.user_id, { unit_type: 'militia' });

    const invasion = await groundCombatService.initiateInvasion(
      attacker.user_id, testColony.colony_id, attackerShip.ship_id, [attackerUnit.unit_id]
    );

    const state = await groundCombatService.getCombatState(invasion.instance_id, testUser.user_id);

    expect(state.instance).toBeTruthy();
    expect(state.instance.status).toBe('active');
    expect(state.units.length).toBeGreaterThan(0);
    expect(state.terrain).toBeTruthy();
    expect(state.terrain.grid).toBeTruthy();
    expect(state.buildings).toBeTruthy();
    expect(state.blocks).toBeTruthy();
  });

  test('should return resolved combat state', async () => {
    await createTestGroundUnit(testColony.colony_id, testUser.user_id, { unit_type: 'militia' });
    const raid = await groundCombatService.triggerNpcRaid(testColony.colony_id);

    // NPC raid is auto-resolved
    const state = await groundCombatService.getCombatState(raid.instance_id, testUser.user_id);
    expect(state.instance).toBeTruthy();
    expect(['defender_won', 'attacker_won']).toContain(state.instance.status);
  });

  test('should reject unauthorized user', async () => {
    const raid = await groundCombatService.triggerNpcRaid(testColony.colony_id);
    const otherUser = await createTestUser({ username: 'other' });
    await expect(
      groundCombatService.getCombatState(raid.instance_id, otherUser.user_id)
    ).rejects.toThrow('Not authorized');
  });
});

// ============== Combat Turn Processing ==============

describe('processCombatTurn', () => {
  test('should process player-initiated combat turn', async () => {
    // Set up a player-vs-player scenario
    const attacker = await createTestUser({ username: 'attacker', credits: 1000000 });
    const attackerSector = testSector; // same sector as planet
    const attackerShip = await require('../../src/models').Ship.create({
      owner_user_id: attacker.user_id,
      current_sector_id: attackerSector.sector_id,
      ship_type: 'Fighter',
      name: 'Invader',
      hull_strength: 200, max_hull: 200,
      shields: 100, max_shields: 100,
      fuel: 100, max_fuel: 100,
      cargo_capacity: 50
    });

    // Create attacker units on ship
    const attackerUnit = await GroundUnit.create({
      owner_user_id: attacker.user_id,
      unit_type: 'marines',
      hp_max: 100, hp_remaining: 100,
      ship_id: attackerShip.ship_id,
      is_active: true
    });

    // Add defender garrison
    await createTestGroundUnit(testColony.colony_id, testUser.user_id, { unit_type: 'militia' });

    // Initiate player invasion
    const invasion = await groundCombatService.initiateInvasion(
      attacker.user_id, testColony.colony_id, attackerShip.ship_id, [attackerUnit.unit_id]
    );

    // Process a turn with empty orders
    const result = await groundCombatService.processCombatTurn(
      invasion.instance_id, attacker.user_id, []
    );

    expect(result.turn_number).toBeGreaterThan(1);
  });

  test('should reject non-attacker submitting orders', async () => {
    const attacker = await createTestUser({ username: 'attacker', credits: 1000000 });
    const attackerShip = await require('../../src/models').Ship.create({
      owner_user_id: attacker.user_id,
      current_sector_id: testSector.sector_id,
      ship_type: 'Fighter', name: 'Invader',
      hull_strength: 200, max_hull: 200, shields: 100, max_shields: 100,
      fuel: 100, max_fuel: 100, cargo_capacity: 50
    });
    const attackerUnit = await GroundUnit.create({
      owner_user_id: attacker.user_id, unit_type: 'marines',
      hp_max: 100, hp_remaining: 100, ship_id: attackerShip.ship_id, is_active: true
    });
    await createTestGroundUnit(testColony.colony_id, testUser.user_id, { unit_type: 'militia' });

    const invasion = await groundCombatService.initiateInvasion(
      attacker.user_id, testColony.colony_id, attackerShip.ship_id, [attackerUnit.unit_id]
    );

    const otherUser = await createTestUser({ username: 'other' });
    await expect(
      groundCombatService.processCombatTurn(invasion.instance_id, otherUser.user_id, [])
    ).rejects.toThrow('Only the attacker');
  });
});

// ============== Retreat ==============

describe('retreat', () => {
  test('should allow attacker to retreat', async () => {
    const attacker = await createTestUser({ username: 'attacker', credits: 1000000 });
    const attackerShip = await require('../../src/models').Ship.create({
      owner_user_id: attacker.user_id,
      current_sector_id: testSector.sector_id,
      ship_type: 'Fighter', name: 'Invader',
      hull_strength: 200, max_hull: 200, shields: 100, max_shields: 100,
      fuel: 100, max_fuel: 100, cargo_capacity: 50
    });
    const attackerUnit = await GroundUnit.create({
      owner_user_id: attacker.user_id, unit_type: 'marines',
      hp_max: 100, hp_remaining: 100, ship_id: attackerShip.ship_id, is_active: true
    });
    await createTestGroundUnit(testColony.colony_id, testUser.user_id, { unit_type: 'militia' });

    const invasion = await groundCombatService.initiateInvasion(
      attacker.user_id, testColony.colony_id, attackerShip.ship_id, [attackerUnit.unit_id]
    );

    const result = await groundCombatService.retreat(invasion.instance_id, attacker.user_id);
    expect(result.status).toBe('attacker_retreated');
    expect(result.reason).toBe('Attacker retreated');
  });

  test('should reject non-attacker retreat', async () => {
    const attacker = await createTestUser({ username: 'attacker', credits: 1000000 });
    const attackerShip = await require('../../src/models').Ship.create({
      owner_user_id: attacker.user_id,
      current_sector_id: testSector.sector_id,
      ship_type: 'Fighter', name: 'Invader',
      hull_strength: 200, max_hull: 200, shields: 100, max_shields: 100,
      fuel: 100, max_fuel: 100, cargo_capacity: 50
    });
    const attackerUnit = await GroundUnit.create({
      owner_user_id: attacker.user_id, unit_type: 'marines',
      hp_max: 100, hp_remaining: 100, ship_id: attackerShip.ship_id, is_active: true
    });

    const invasion = await groundCombatService.initiateInvasion(
      attacker.user_id, testColony.colony_id, attackerShip.ship_id, [attackerUnit.unit_id]
    );

    const otherUser = await createTestUser({ username: 'other' });
    await expect(
      groundCombatService.retreat(invasion.instance_id, otherUser.user_id)
    ).rejects.toThrow('Only the attacker');
  });
});

// ============== Combat Lock ==============

describe('hasActiveCombat', () => {
  test('should return false for colony without combat', async () => {
    const result = await groundCombatService.hasActiveCombat(testColony.colony_id);
    expect(result).toBe(false);
  });

  test('should return true during active player invasion', async () => {
    // Use player invasion which stays active (not auto-resolved like NPC raids)
    const attacker = await createTestUser({ username: 'attacker', credits: 1000000 });
    const attackerShip = await require('../../src/models').Ship.create({
      owner_user_id: attacker.user_id,
      current_sector_id: testSector.sector_id,
      ship_type: 'Fighter', name: 'Invader',
      hull_strength: 200, max_hull: 200, shields: 100, max_shields: 100,
      fuel: 100, max_fuel: 100, cargo_capacity: 50
    });
    const attackerUnit = await GroundUnit.create({
      owner_user_id: attacker.user_id, unit_type: 'marines',
      hp_max: 100, hp_remaining: 100, ship_id: attackerShip.ship_id, is_active: true
    });
    await createTestGroundUnit(testColony.colony_id, testUser.user_id, { unit_type: 'militia' });

    await groundCombatService.initiateInvasion(
      attacker.user_id, testColony.colony_id, attackerShip.ship_id, [attackerUnit.unit_id]
    );

    const result = await groundCombatService.hasActiveCombat(testColony.colony_id);
    expect(result).toBe(true);
  });

  test('should return false after NPC raid auto-resolves', async () => {
    await createTestGroundUnit(testColony.colony_id, testUser.user_id, { unit_type: 'militia' });
    await groundCombatService.triggerNpcRaid(testColony.colony_id);

    // NPC raids are auto-resolved
    const result = await groundCombatService.hasActiveCombat(testColony.colony_id);
    expect(result).toBe(false);
  });
});

// ============== Combat History ==============

describe('getCombatHistory', () => {
  test('should return empty history', async () => {
    const history = await groundCombatService.getCombatHistory(testColony.colony_id, testUser.user_id);
    expect(history).toEqual([]);
  });

  test('should return combat history', async () => {
    // NPC raids are now auto-resolved
    const raid = await groundCombatService.triggerNpcRaid(testColony.colony_id);

    const history = await groundCombatService.getCombatHistory(testColony.colony_id, testUser.user_id);
    expect(history).toHaveLength(1);
    expect(history[0].instance_id).toBe(raid.instance_id);
    expect(['defender_won', 'attacker_won']).toContain(history[0].status);
  });
});
