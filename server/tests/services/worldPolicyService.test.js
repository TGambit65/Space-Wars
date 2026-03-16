const worldPolicyService = require('../../src/services/worldPolicyService');
const { Corporation, CorporationAgreement } = require('../../src/models');
const { createTestUser, createTestSector, createSectorConnection, cleanDatabase } = require('../helpers');

describe('World Policy Service', () => {
  let ownerUser;
  let allyUser;
  let outsiderUser;
  let ownerCorp;
  let allyCorp;
  let publicCore;
  let ownerHome;

  beforeAll(async () => {
    await cleanDatabase();

    ownerUser = await createTestUser({ username: 'policyowner' });
    allyUser = await createTestUser({ username: 'policyally' });
    outsiderUser = await createTestUser({ username: 'policyoutsider' });

    ownerCorp = await Corporation.create({
      name: `Owner Corp ${Date.now()}`,
      tag: `OC${Date.now().toString().slice(-4)}`,
      leader_user_id: ownerUser.user_id
    });
    allyCorp = await Corporation.create({
      name: `Ally Corp ${Date.now()}`,
      tag: `AC${Date.now().toString().slice(-4)}`,
      leader_user_id: allyUser.user_id
    });

    await ownerUser.update({ corporation_id: ownerCorp.corporation_id });
    await allyUser.update({ corporation_id: allyCorp.corporation_id });

    publicCore = await createTestSector({
      name: 'Policy Core',
      type: 'Core',
      zone_class: 'core',
      security_class: 'protected',
      access_mode: 'public'
    });
    ownerHome = await createTestSector({
      name: 'Owner Home',
      type: 'Outer',
      zone_class: 'home',
      security_class: 'protected',
      access_mode: 'corporation_allies',
      owner_user_id: ownerUser.user_id,
      owner_corporation_id: ownerCorp.corporation_id,
      rule_flags: { safe_harbor: true }
    });

    await createSectorConnection(publicCore.sector_id, ownerHome.sector_id, {
      connection_type: 'standard'
    });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  it('derives protected core policy from legacy sectors', () => {
    const policy = worldPolicyService.summarizeSectorPolicy({ type: 'Core' });

    expect(policy.zone_class).toBe('core');
    expect(policy.security_class).toBe('protected');
    expect(policy.rule_flags.allow_pvp).toBe(false);
  });

  it('marks core-to-core standard links as protected lanes', () => {
    const lane = worldPolicyService.summarizeConnectionPolicy(
      { connection_type: 'standard' },
      { type: 'Core' },
      { type: 'Core' }
    );

    expect(lane.lane_class).toBe('protected');
    expect(lane.rule_flags.safe_route).toBe(true);
  });

  it('supports portal travel metadata', () => {
    const lane = worldPolicyService.summarizeConnectionPolicy({
      connection_type: 'portal'
    });

    expect(lane.lane_class).toBe('portal');
    expect(lane.rule_flags.instant_transit).toBe(true);
  });

  it('filters restricted adjacent sectors for outsiders', async () => {
    const neighbors = await worldPolicyService.getAccessibleAdjacentSectors({
      sectorId: publicCore.sector_id,
      userId: outsiderUser.user_id
    });

    expect(neighbors).toHaveLength(0);

    const withRestricted = await worldPolicyService.getAccessibleAdjacentSectors({
      sectorId: publicCore.sector_id,
      userId: outsiderUser.user_id,
      includeRestricted: true
    });

    expect(withRestricted).toHaveLength(1);
    expect(withRestricted[0].traversal_allowed).toBe(false);
    expect(withRestricted[0].traversal_reason).toMatch(/restricted/i);
  });

  it('allows allied corporations through corporation_allies sectors', async () => {
    await CorporationAgreement.create({
      proposer_corp_id: ownerCorp.corporation_id,
      target_corp_id: allyCorp.corporation_id,
      agreement_type: 'alliance',
      status: 'active'
    });

    const neighbors = await worldPolicyService.getAccessibleAdjacentSectors({
      sectorId: publicCore.sector_id,
      userId: allyUser.user_id
    });

    expect(neighbors).toHaveLength(1);
    expect(neighbors[0].traversal_allowed).toBe(true);
  });
});
