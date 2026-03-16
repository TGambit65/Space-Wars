const raidProtectionService = require('../../src/services/raidProtectionService');
const { ColonyRaidProtection } = require('../../src/models');
const { createTestUser, createTestSector, createTestPlanet, createTestColony, cleanDatabase } = require('../helpers');
const config = require('../../src/config');

describe('raidProtectionService', () => {
  let owner;
  let attacker;
  let sector;
  let planet;
  let colony;

  beforeEach(async () => {
    await cleanDatabase();
    owner = await createTestUser({
      username: 'raidowner1',
      last_login: new Date()
    });
    attacker = await createTestUser({
      username: 'raidattacker1',
      last_login: new Date()
    });
    sector = await createTestSector();
    planet = await createTestPlanet(sector.sector_id, { owner_user_id: owner.user_id });
    colony = await createTestColony(planet.planet_id, owner.user_id, {
      surface_initialized: true
    });
  });

  it('denies raids against offline-protected owners', async () => {
    await owner.update({
      last_login: new Date(Date.now() - config.antiCheat.raidOfflineThresholdMs - 1000)
    });

    await expect(
      raidProtectionService.authorizePlayerRaid({
        attackerUserId: attacker.user_id,
        colony
      })
    ).rejects.toThrow(/offline protection/i);
  });

  it('applies a raid cooldown after an allowed attack', async () => {
    await raidProtectionService.authorizePlayerRaid({
      attackerUserId: attacker.user_id,
      colony
    });

    await expect(
      raidProtectionService.authorizePlayerRaid({
        attackerUserId: attacker.user_id,
        colony
      })
    ).rejects.toThrow(/cooling down/i);
  });

  it('blocks repeated attacks from the same attacker within the abuse window', async () => {
    await raidProtectionService.authorizePlayerRaid({
      attackerUserId: attacker.user_id,
      colony
    });

    const state = await ColonyRaidProtection.findOne({
      where: { colony_id: colony.colony_id }
    });
    await state.update({
      raid_blocked_until: new Date(Date.now() - 1000),
      repeated_attack_count: config.antiCheat.maxRepeatedRaidAttacksPerWindow,
      repeated_attack_window_until: new Date(Date.now() + config.antiCheat.repeatedRaidWindowMs),
      last_attacker_id: attacker.user_id
    });

    await expect(
      raidProtectionService.authorizePlayerRaid({
        attackerUserId: attacker.user_id,
        colony
      })
    ).rejects.toThrow(/repeated raid attempts/i);
  });
});
