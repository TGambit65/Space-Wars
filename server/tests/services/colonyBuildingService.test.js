const colonyBuildingService = require('../../src/services/colonyBuildingService');
const { createTestUser, createTestSector, createTestPlanet, createTestColony, createTestBuilding, cleanDatabase } = require('../helpers');
const { ColonyBuilding, TechResearch } = require('../../src/models');

describe('ColonyBuildingService', () => {
  let user, sector, planet, colony;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser({ credits: 500000 });
    sector = await createTestSector();
    planet = await createTestPlanet(sector.sector_id, { type: 'Volcanic' });
    colony = await createTestColony(planet.planet_id, user.user_id, {
      population: 1000,
      infrastructure_level: 5
    });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('constructBuilding', () => {
    it('should construct a building successfully', async () => {
      const building = await colonyBuildingService.constructBuilding(
        user.user_id, colony.colony_id, 'SURFACE_MINE'
      );

      expect(building).toBeDefined();
      expect(building.building_type).toBe('SURFACE_MINE');
      expect(building.is_active).toBe(true);
      expect(building.condition).toBe(1.0);
      expect(building.level).toBe(1);

      // Check credits were deducted
      await user.reload();
      expect(Number(user.credits)).toBe(500000 - 25000);
    });

    it('should reject construction with insufficient credits', async () => {
      await user.update({ credits: 100 });

      await expect(
        colonyBuildingService.constructBuilding(user.user_id, colony.colony_id, 'SURFACE_MINE')
      ).rejects.toThrow('Insufficient credits');
    });

    it('should reject construction when infrastructure is too low', async () => {
      await colony.update({ infrastructure_level: 1 });

      await expect(
        colonyBuildingService.constructBuilding(user.user_id, colony.colony_id, 'RESEARCH_LAB')
      ).rejects.toThrow('Requires infrastructure level 4');
    });

    it('should reject construction when max per colony is reached', async () => {
      // SPACEPORT has maxPerColony of 1
      await createTestBuilding(colony.colony_id, { building_type: 'SPACEPORT', workforce: 50 });

      await expect(
        colonyBuildingService.constructBuilding(user.user_id, colony.colony_id, 'SPACEPORT')
      ).rejects.toThrow('Maximum 1 of this building per colony');
    });

    it('should reject construction with insufficient population for workforce', async () => {
      await colony.update({ population: 10 });

      await expect(
        colonyBuildingService.constructBuilding(user.user_id, colony.colony_id, 'SURFACE_MINE')
      ).rejects.toThrow('Insufficient population for workforce');
    });

    it('should reject invalid building type', async () => {
      await expect(
        colonyBuildingService.constructBuilding(user.user_id, colony.colony_id, 'INVALID_TYPE')
      ).rejects.toThrow('Invalid building type');
    });

    it('should reject construction when tech prerequisite is not met', async () => {
      await colony.update({ infrastructure_level: 6 });

      await expect(
        colonyBuildingService.constructBuilding(user.user_id, colony.colony_id, 'QUANTUM_EXTRACTOR')
      ).rejects.toThrow(/Requires tech/);
    });
  });

  describe('upgradeBuilding', () => {
    it('should upgrade a building to next tier', async () => {
      const building = await createTestBuilding(colony.colony_id, {
        building_type: 'SURFACE_MINE',
        level: 1,
        workforce: 50
      });

      const upgraded = await colonyBuildingService.upgradeBuilding(user.user_id, building.building_id);

      expect(upgraded.building_type).toBe('DEEP_CORE_DRILL');
      expect(upgraded.level).toBe(2);
      expect(upgraded.condition).toBe(1.0);
    });

    it('should reject upgrade when building has no upgrade path', async () => {
      const building = await createTestBuilding(colony.colony_id, {
        building_type: 'REFINERY',
        level: 2,
        workforce: 70
      });

      await expect(
        colonyBuildingService.upgradeBuilding(user.user_id, building.building_id)
      ).rejects.toThrow('This building cannot be upgraded');
    });

    it('should reject upgrade with insufficient credits', async () => {
      await user.update({ credits: 100 });
      const building = await createTestBuilding(colony.colony_id, {
        building_type: 'SURFACE_MINE',
        level: 1,
        workforce: 50
      });

      await expect(
        colonyBuildingService.upgradeBuilding(user.user_id, building.building_id)
      ).rejects.toThrow('Insufficient credits');
    });

    it('should reject upgrade when not owned', async () => {
      const other = await createTestUser({ username: 'other' });
      const building = await createTestBuilding(colony.colony_id, {
        building_type: 'SURFACE_MINE',
        level: 1,
        workforce: 50
      });

      await expect(
        colonyBuildingService.upgradeBuilding(other.user_id, building.building_id)
      ).rejects.toThrow('Colony not owned by user');
    });
  });

  describe('demolishBuilding', () => {
    it('should demolish a building and refund 50%', async () => {
      const building = await createTestBuilding(colony.colony_id, {
        building_type: 'SURFACE_MINE',
        level: 1,
        workforce: 50
      });

      const initialCredits = Number(user.credits);
      const result = await colonyBuildingService.demolishBuilding(user.user_id, building.building_id);

      expect(result.refund).toBe(12500); // 50% of 25000
      await user.reload();
      expect(Number(user.credits)).toBe(initialCredits + 12500);

      // Building should be gone
      const found = await ColonyBuilding.findByPk(building.building_id);
      expect(found).toBeNull();
    });

    it('should reject demolish when not owned', async () => {
      const other = await createTestUser({ username: 'other2' });
      const building = await createTestBuilding(colony.colony_id);

      await expect(
        colonyBuildingService.demolishBuilding(other.user_id, building.building_id)
      ).rejects.toThrow('Colony not owned by user');
    });
  });

  describe('toggleBuilding', () => {
    it('should deactivate a building', async () => {
      const building = await createTestBuilding(colony.colony_id, { is_active: true });

      const result = await colonyBuildingService.toggleBuilding(user.user_id, building.building_id, false);
      expect(result.is_active).toBe(false);
    });

    it('should activate a building', async () => {
      const building = await createTestBuilding(colony.colony_id, { is_active: false });

      const result = await colonyBuildingService.toggleBuilding(user.user_id, building.building_id, true);
      expect(result.is_active).toBe(true);
    });
  });

  describe('repairBuilding', () => {
    it('should repair a damaged building', async () => {
      const building = await createTestBuilding(colony.colony_id, { condition: 0.5 });

      const result = await colonyBuildingService.repairBuilding(user.user_id, building.building_id);

      expect(result.building.condition).toBe(1.0);
      expect(result.repairCost).toBeGreaterThan(0);
    });

    it('should reject repair when building is at full condition', async () => {
      const building = await createTestBuilding(colony.colony_id, { condition: 1.0 });

      await expect(
        colonyBuildingService.repairBuilding(user.user_id, building.building_id)
      ).rejects.toThrow('Building is already at full condition');
    });
  });

  describe('getAvailableBuildings', () => {
    it('should return available buildings filtered by infrastructure', async () => {
      await colony.update({ infrastructure_level: 1 });

      const available = await colonyBuildingService.getAvailableBuildings(user.user_id, colony.colony_id);

      // At infra level 1, tier 1 extraction buildings should be available
      const surfaceMine = available.find(b => b.building_type === 'SURFACE_MINE');
      expect(surfaceMine).toBeDefined();
      expect(surfaceMine.canBuild).toBe(true);

      // Research Lab requires infra 4, should not be buildable
      const lab = available.find(b => b.building_type === 'RESEARCH_LAB');
      expect(lab).toBeDefined();
      expect(lab.canBuild).toBe(false);
      expect(lab.reasons).toContain('Requires infrastructure level 4');
    });

    it('should filter by tech requirements', async () => {
      await colony.update({ infrastructure_level: 6 });

      const available = await colonyBuildingService.getAvailableBuildings(user.user_id, colony.colony_id);

      // Quantum Extractor requires ADVANCED_COLONIES tech
      const quantum = available.find(b => b.building_type === 'QUANTUM_EXTRACTOR');
      expect(quantum).toBeDefined();
      expect(quantum.canBuild).toBe(false);
      expect(quantum.reasons.some(r => r.includes('Requires tech'))).toBe(true);
    });

    it('should allow building when tech prerequisite is met', async () => {
      await colony.update({ infrastructure_level: 6 });
      await TechResearch.create({
        user_id: user.user_id,
        tech_name: 'ADVANCED_COLONIES',
        is_completed: true,
        started_at: new Date(),
        credits_spent: 15000
      });

      const available = await colonyBuildingService.getAvailableBuildings(user.user_id, colony.colony_id);

      const quantum = available.find(b => b.building_type === 'QUANTUM_EXTRACTOR');
      expect(quantum).toBeDefined();
      expect(quantum.canBuild).toBe(true);
    });
  });

  describe('getColonyBuildings', () => {
    it('should return buildings with config details', async () => {
      await createTestBuilding(colony.colony_id, { building_type: 'SURFACE_MINE' });

      const buildings = await colonyBuildingService.getColonyBuildings(colony.colony_id);

      expect(buildings).toHaveLength(1);
      expect(buildings[0].config).toBeDefined();
      expect(buildings[0].config.name).toBe('Surface Mine');
      expect(buildings[0].config.category).toBe('extraction');
    });
  });

  describe('processProductionTick', () => {
    it('should produce extraction outputs', async () => {
      await createTestBuilding(colony.colony_id, {
        building_type: 'SURFACE_MINE',
        is_active: true,
        condition: 1.0
      });

      const { sequelize } = require('../../src/models');
      const transaction = await sequelize.transaction();

      try {
        const generatedResources = [];
        const colonyWithPlanet = await colony.reload({
          include: [{ model: require('../../src/models').Planet, as: 'planet' }],
          transaction
        });

        const result = await colonyBuildingService.processProductionTick(
          colony.colony_id, 1, generatedResources, transaction, colonyWithPlanet
        );

        await transaction.commit();

        expect(result.production).toHaveLength(1);
        expect(result.production[0].status).toBe('active');
        // Volcanic planet gives 1.5x bonus for Surface Mine: floor(20 * 1.0 * 1.5 * 1.4) = 42
        // (infrastructure_level=5 gives bonus of 1 + (5-1)*0.1 = 1.4)
        expect(result.production[0].outputs['Ore']).toBeGreaterThan(0);

        // Check generatedResources was modified
        const oreEntry = generatedResources.find(r => r.resource_type === 'Ore');
        expect(oreEntry).toBeDefined();
        expect(oreEntry.amount).toBeGreaterThan(0);
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    });

    it('should consume inputs for manufacturing buildings', async () => {
      await createTestBuilding(colony.colony_id, {
        building_type: 'SOLAR_ARRAY',
        is_active: true,
        condition: 1.0,
        workforce: 20
      });
      await createTestBuilding(colony.colony_id, {
        building_type: 'REFINERY',
        is_active: true,
        condition: 1.0,
        workforce: 70
      });

      const { sequelize } = require('../../src/models');
      const transaction = await sequelize.transaction();

      try {
        // Pre-populate with Ore from extraction
        const generatedResources = [
          { resource_type: 'Ore', amount: 50, remaining: 9950 }
        ];
        const colonyWithPlanet = await colony.reload({
          include: [{ model: require('../../src/models').Planet, as: 'planet' }],
          transaction
        });

        const result = await colonyBuildingService.processProductionTick(
          colony.colony_id, 1, generatedResources, transaction, colonyWithPlanet
        );

        await transaction.commit();

        // Refinery should have consumed Ore and produced Refined Metals
        const refineryOutput = result.production.find(p => p.building_type === 'REFINERY');
        expect(refineryOutput).toBeDefined();
        expect(refineryOutput.status).toBe('active');
        expect(refineryOutput.outputs['Refined Metals']).toBeGreaterThan(0);

        // Ore should have been reduced
        const oreEntry = generatedResources.find(r => r.resource_type === 'Ore');
        expect(oreEntry.amount).toBeLessThan(50);
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    });

    it('should skip manufacturing when no inputs available', async () => {
      await createTestBuilding(colony.colony_id, {
        building_type: 'SOLAR_ARRAY',
        is_active: true,
        condition: 1.0,
        workforce: 20
      });
      await createTestBuilding(colony.colony_id, {
        building_type: 'REFINERY',
        is_active: true,
        condition: 1.0,
        workforce: 70
      });

      const { sequelize } = require('../../src/models');
      const transaction = await sequelize.transaction();

      try {
        const generatedResources = []; // No Ore available
        const colonyWithPlanet = await colony.reload({
          include: [{ model: require('../../src/models').Planet, as: 'planet' }],
          transaction
        });

        const result = await colonyBuildingService.processProductionTick(
          colony.colony_id, 1, generatedResources, transaction, colonyWithPlanet
        );

        await transaction.commit();

        const refineryOutput = result.production.find(p => p.building_type === 'REFINERY');
        expect(refineryOutput).toBeDefined();
        expect(refineryOutput.status).toBe('no_inputs');
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    });

    it('should degrade building condition per tick', async () => {
      const building = await createTestBuilding(colony.colony_id, {
        building_type: 'SURFACE_MINE',
        is_active: true,
        condition: 1.0
      });

      const { sequelize } = require('../../src/models');
      const transaction = await sequelize.transaction();

      try {
        const generatedResources = [];
        const colonyWithPlanet = await colony.reload({
          include: [{ model: require('../../src/models').Planet, as: 'planet' }],
          transaction
        });

        await colonyBuildingService.processProductionTick(
          colony.colony_id, 1, generatedResources, transaction, colonyWithPlanet
        );

        await transaction.commit();

        await building.reload();
        expect(building.condition).toBeCloseTo(0.99, 2);
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    });

    it('should not produce when power is insufficient', async () => {
      // Refinery needs 80 power, no power generation buildings
      await createTestBuilding(colony.colony_id, {
        building_type: 'REFINERY',
        is_active: true,
        condition: 1.0,
        workforce: 70
      });

      const { sequelize } = require('../../src/models');
      const transaction = await sequelize.transaction();

      try {
        const generatedResources = [
          { resource_type: 'Ore', amount: 50, remaining: 9950 }
        ];
        const colonyWithPlanet = await colony.reload({
          include: [{ model: require('../../src/models').Planet, as: 'planet' }],
          transaction
        });

        const result = await colonyBuildingService.processProductionTick(
          colony.colony_id, 1, generatedResources, transaction, colonyWithPlanet
        );

        await transaction.commit();

        const refineryOutput = result.production.find(p => p.building_type === 'REFINERY');
        expect(refineryOutput).toBeDefined();
        expect(refineryOutput.status).toBe('no_power');
        expect(result.powerBalance).toBeLessThan(0);
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    });
  });
});
