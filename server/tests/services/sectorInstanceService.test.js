const sectorInstanceService = require('../../src/services/sectorInstanceService');
const { SectorInstanceAssignment } = require('../../src/models');
const { createTestUser, createTestSector, cleanDatabase } = require('../helpers');

describe('sectorInstanceService', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('assigns shared sectors to the primary instance', async () => {
    const user = await createTestUser();
    const sector = await createTestSector({ type: 'Mid' });

    const result = await sectorInstanceService.assignUserToSector({
      userId: user.user_id,
      sectorId: sector.sector_id
    });

    expect(result.instance_key).toBe('primary');
    expect(result.instance_mode).toBe('shared');
  });

  it('keeps the same sticky instance for repeat assignment', async () => {
    const user = await createTestUser();
    const sector = await createTestSector({
      type: 'Unknown',
      zone_class: 'adventure',
      rule_flags: {
        instance_mode: 'instanced',
        instance_capacity: 1,
        max_instances: 2
      }
    });

    const first = await sectorInstanceService.assignUserToSector({
      userId: user.user_id,
      sectorId: sector.sector_id
    });
    const second = await sectorInstanceService.assignUserToSector({
      userId: user.user_id,
      sectorId: sector.sector_id
    });

    expect(first.instance_key).toBe(second.instance_key);
  });

  it('denies entry when all instances are at capacity', async () => {
    const sector = await createTestSector({
      type: 'Unknown',
      zone_class: 'adventure',
      rule_flags: {
        instance_mode: 'instanced',
        instance_capacity: 1,
        max_instances: 2
      }
    });
    const user1 = await createTestUser({ username: 'instuser1' });
    const user2 = await createTestUser({ username: 'instuser2' });
    const user3 = await createTestUser({ username: 'instuser3' });

    const first = await sectorInstanceService.assignUserToSector({
      userId: user1.user_id,
      sectorId: sector.sector_id
    });
    const second = await sectorInstanceService.assignUserToSector({
      userId: user2.user_id,
      sectorId: sector.sector_id
    });

    expect(first.instance_key).toBe('inst-1');
    expect(second.instance_key).toBe('inst-2');

    await expect(
      sectorInstanceService.assignUserToSector({
        userId: user3.user_id,
        sectorId: sector.sector_id
      })
    ).rejects.toThrow(/capacity reached/i);
  });

  it('releases active assignments for the previous sector', async () => {
    const user = await createTestUser();
    const sector = await createTestSector();

    await sectorInstanceService.assignUserToSector({
      userId: user.user_id,
      sectorId: sector.sector_id
    });
    const released = await sectorInstanceService.releaseUserFromSector({
      userId: user.user_id,
      sectorId: sector.sector_id
    });

    expect(released).toBe(1);

    const assignment = await SectorInstanceAssignment.findOne({
      where: { user_id: user.user_id, sector_id: sector.sector_id }
    });
    expect(assignment.status).toBe('released');
  });
});
