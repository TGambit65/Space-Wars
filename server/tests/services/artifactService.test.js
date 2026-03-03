const { cleanDatabase, createTestUser, createTestSector, createTestShip, createTestPlanet, createTestArtifact } = require('../helpers');
const artifactService = require('../../src/services/artifactService');

describe('Artifact Service', () => {
  let user, sector, ship, planet, artifact;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser();
    sector = await createTestSector();
    ship = await createTestShip(user.user_id, sector.sector_id);
    planet = await createTestPlanet(sector.sector_id);
    artifact = await createTestArtifact(planet.planet_id, {
      owner_user_id: user.user_id,
      is_discovered: true,
      bonus_type: 'navigation',
      bonus_value: 0.15
    });
  });

  describe('equipArtifact', () => {
    it('should equip an artifact to a ship', async () => {
      const result = await artifactService.equipArtifact(user.user_id, artifact.artifact_id, ship.ship_id);
      expect(result.equipped_ship_id).toBe(ship.ship_id);
    });

    it('should fail if artifact not owned', async () => {
      const other = await createTestUser({ username: 'otheruser' });
      await expect(
        artifactService.equipArtifact(other.user_id, artifact.artifact_id, ship.ship_id)
      ).rejects.toThrow('Artifact not found or not owned');
    });

    it('should fail if already equipped', async () => {
      await artifactService.equipArtifact(user.user_id, artifact.artifact_id, ship.ship_id);
      await expect(
        artifactService.equipArtifact(user.user_id, artifact.artifact_id, ship.ship_id)
      ).rejects.toThrow('Artifact is already equipped');
    });

    it('should fail if ship not owned', async () => {
      const other = await createTestUser({ username: 'otheruser2' });
      const otherShip = await createTestShip(other.user_id, sector.sector_id);
      await expect(
        artifactService.equipArtifact(user.user_id, artifact.artifact_id, otherShip.ship_id)
      ).rejects.toThrow('Ship not found or not owned');
    });
  });

  describe('unequipArtifact', () => {
    it('should unequip an artifact', async () => {
      await artifactService.equipArtifact(user.user_id, artifact.artifact_id, ship.ship_id);
      const result = await artifactService.unequipArtifact(user.user_id, artifact.artifact_id);
      expect(result.equipped_ship_id).toBeNull();
    });

    it('should fail if not equipped', async () => {
      await expect(
        artifactService.unequipArtifact(user.user_id, artifact.artifact_id)
      ).rejects.toThrow('Artifact is not equipped');
    });
  });

  describe('getEquippedArtifacts', () => {
    it('should return equipped artifacts on a ship', async () => {
      await artifactService.equipArtifact(user.user_id, artifact.artifact_id, ship.ship_id);
      const equipped = await artifactService.getEquippedArtifacts(ship.ship_id);
      expect(equipped).toHaveLength(1);
      expect(equipped[0].artifact_id).toBe(artifact.artifact_id);
    });
  });

  describe('getUserArtifacts', () => {
    it('should return all artifacts owned by user', async () => {
      const artifacts = await artifactService.getUserArtifacts(user.user_id);
      expect(artifacts).toHaveLength(1);
    });
  });

  describe('calculateArtifactBonuses', () => {
    it('should aggregate bonuses from equipped artifacts', async () => {
      await artifactService.equipArtifact(user.user_id, artifact.artifact_id, ship.ship_id);

      const artifact2 = await createTestArtifact(planet.planet_id, {
        owner_user_id: user.user_id,
        is_discovered: true,
        bonus_type: 'navigation',
        bonus_value: 0.10
      });
      await artifactService.equipArtifact(user.user_id, artifact2.artifact_id, ship.ship_id);

      const bonuses = await artifactService.calculateArtifactBonuses(ship.ship_id);
      expect(bonuses.navigation).toBeCloseTo(0.25);
    });

    it('should return empty for ship with no equipped artifacts', async () => {
      const bonuses = await artifactService.calculateArtifactBonuses(ship.ship_id);
      expect(Object.keys(bonuses)).toHaveLength(0);
    });
  });
});
