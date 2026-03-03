const { cleanDatabase, createTestUser, createTestCorporation } = require('../helpers');
const corporationService = require('../../src/services/corporationService');
const { Corporation, CorporationMember, User } = require('../../src/models');

describe('Corporation Service', () => {
  let user;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser({ credits: 100000 });
  });

  describe('createCorporation', () => {
    it('should create a corporation and assign leader', async () => {
      const corp = await corporationService.createCorporation(user.user_id, 'Test Corp', 'TC', 'A test corp');
      expect(corp.name).toBe('Test Corp');
      expect(corp.tag).toBe('TC');
      expect(corp.leader_user_id).toBe(user.user_id);
      expect(corp.member_count).toBe(1);

      await user.reload();
      expect(user.corporation_id).toBe(corp.corporation_id);
      expect(Number(user.credits)).toBe(100000 - 50000);
    });

    it('should fail with insufficient credits', async () => {
      await user.update({ credits: 100 });
      await expect(
        corporationService.createCorporation(user.user_id, 'Corp', 'CP', null)
      ).rejects.toThrow('Insufficient credits');
    });

    it('should fail if already in a corporation', async () => {
      await corporationService.createCorporation(user.user_id, 'Corp1', 'C1', null);
      await expect(
        corporationService.createCorporation(user.user_id, 'Corp2', 'C2', null)
      ).rejects.toThrow('Already in a corporation');
    });

    it('should fail with invalid name length', async () => {
      await expect(
        corporationService.createCorporation(user.user_id, 'AB', 'TC', null)
      ).rejects.toThrow(/Corporation name must be/);
    });

    it('should fail with duplicate name', async () => {
      await corporationService.createCorporation(user.user_id, 'UniqueCorpName', 'UC1', null);
      const user2 = await createTestUser({ username: 'corpuser2', credits: 100000 });
      await expect(
        corporationService.createCorporation(user2.user_id, 'UniqueCorpName', 'UC2', null)
      ).rejects.toThrow('Corporation name or tag already taken');
    });
  });

  describe('joinCorporation', () => {
    let corp;

    beforeEach(async () => {
      corp = await corporationService.createCorporation(user.user_id, 'JoinCorp', 'JC', null);
    });

    it('should allow a user to join', async () => {
      const user2 = await createTestUser({ username: 'joiner' });
      await corporationService.joinCorporation(user2.user_id, corp.corporation_id);

      await corp.reload();
      expect(corp.member_count).toBe(2);

      await user2.reload();
      expect(user2.corporation_id).toBe(corp.corporation_id);
    });

    it('should fail if already in a corporation', async () => {
      const user2 = await createTestUser({ username: 'joiner2' });
      await corporationService.joinCorporation(user2.user_id, corp.corporation_id);
      await expect(
        corporationService.joinCorporation(user2.user_id, corp.corporation_id)
      ).rejects.toThrow('Already in a corporation');
    });

    it('should fail if corporation is full', async () => {
      await corp.update({ max_members: 1 });
      const user2 = await createTestUser({ username: 'joiner3' });
      await expect(
        corporationService.joinCorporation(user2.user_id, corp.corporation_id)
      ).rejects.toThrow('Corporation is full');
    });
  });

  describe('leaveCorporation', () => {
    it('should allow a member to leave', async () => {
      const corp = await corporationService.createCorporation(user.user_id, 'LeaveCorp', 'LC', null);
      const user2 = await createTestUser({ username: 'leaver' });
      await corporationService.joinCorporation(user2.user_id, corp.corporation_id);

      await corporationService.leaveCorporation(user2.user_id);
      await user2.reload();
      expect(user2.corporation_id).toBeNull();

      await corp.reload();
      expect(corp.member_count).toBe(1);
    });

    it('should fail if leader tries to leave', async () => {
      await corporationService.createCorporation(user.user_id, 'LeaderCorp', 'LDC', null);
      await expect(
        corporationService.leaveCorporation(user.user_id)
      ).rejects.toThrow(/Leader cannot leave/);
    });
  });

  describe('promoteMember', () => {
    it('should promote a member to officer', async () => {
      const corp = await corporationService.createCorporation(user.user_id, 'PromoCorp', 'PMC', null);
      const user2 = await createTestUser({ username: 'promotee' });
      await corporationService.joinCorporation(user2.user_id, corp.corporation_id);

      const member = await corporationService.promoteMember(user.user_id, user2.user_id, 'officer');
      expect(member.role).toBe('officer');
    });

    it('should fail if not a leader or officer', async () => {
      const corp = await corporationService.createCorporation(user.user_id, 'PromoCorp2', 'PM2', null);
      const user2 = await createTestUser({ username: 'promotee2' });
      await corporationService.joinCorporation(user2.user_id, corp.corporation_id);
      const user3 = await createTestUser({ username: 'promotee3' });
      await corporationService.joinCorporation(user3.user_id, corp.corporation_id);

      await expect(
        corporationService.promoteMember(user2.user_id, user3.user_id, 'officer')
      ).rejects.toThrow('Insufficient permissions');
    });

    it('should fail if target is not in same corp', async () => {
      await corporationService.createCorporation(user.user_id, 'PromoCorp3', 'PM3', null);
      const user2 = await createTestUser({ username: 'outsider' });
      await expect(
        corporationService.promoteMember(user.user_id, user2.user_id, 'officer')
      ).rejects.toThrow('Member not found');
    });
  });

  describe('transferLeadership', () => {
    it('should transfer leadership to another member', async () => {
      const corp = await corporationService.createCorporation(user.user_id, 'TransferCorp', 'TRC', null);
      const user2 = await createTestUser({ username: 'newleader' });
      await corporationService.joinCorporation(user2.user_id, corp.corporation_id);

      await corporationService.transferLeadership(user.user_id, user2.user_id);

      await corp.reload();
      expect(corp.leader_user_id).toBe(user2.user_id);

      const oldLeader = await CorporationMember.findOne({ where: { user_id: user.user_id } });
      expect(oldLeader.role).toBe('officer');

      const newLeader = await CorporationMember.findOne({ where: { user_id: user2.user_id } });
      expect(newLeader.role).toBe('leader');
    });
  });

  describe('disbandCorporation', () => {
    it('should disband and refund treasury', async () => {
      const corp = await corporationService.createCorporation(user.user_id, 'DisbandCorp', 'DC', null);
      await corporationService.contributeToTreasury(user.user_id, 5000);

      await corporationService.disbandCorporation(user.user_id);

      await corp.reload();
      expect(corp.is_active).toBe(false);

      await user.reload();
      // Started: 100000 - 50000 (creation) - 5000 (contributed) + 5000 (refund) = 50000
      expect(Number(user.credits)).toBe(50000);
      expect(user.corporation_id).toBeNull();
    });
  });

  describe('treasury operations', () => {
    let corp;

    beforeEach(async () => {
      corp = await corporationService.createCorporation(user.user_id, 'TreasuryCorp', 'TYC', null);
    });

    it('should contribute to treasury', async () => {
      const result = await corporationService.contributeToTreasury(user.user_id, 1000);
      expect(result.treasury).toBe(1000);
      expect(result.contribution).toBe(1000);
    });

    it('should withdraw from treasury (leader only)', async () => {
      await corporationService.contributeToTreasury(user.user_id, 5000);
      const result = await corporationService.withdrawFromTreasury(user.user_id, 2000);
      expect(result.treasury).toBe(3000);
    });

    it('should fail withdraw for non-leader', async () => {
      const user2 = await createTestUser({ username: 'nonleader' });
      await corporationService.joinCorporation(user2.user_id, corp.corporation_id);
      await expect(
        corporationService.withdrawFromTreasury(user2.user_id, 100)
      ).rejects.toThrow(/Not a leader/);
    });
  });

  describe('getCorporationLeaderboard', () => {
    it('should return corporations sorted by treasury', async () => {
      const corp1 = await corporationService.createCorporation(user.user_id, 'RichCorp', 'RC', null);
      await corporationService.contributeToTreasury(user.user_id, 10000);

      const user2 = await createTestUser({ username: 'lbuser2', credits: 100000 });
      const corp2 = await corporationService.createCorporation(user2.user_id, 'PoorCorp', 'PC', null);
      await corporationService.contributeToTreasury(user2.user_id, 1000);

      const leaderboard = await corporationService.getCorporationLeaderboard(10);
      expect(leaderboard.length).toBe(2);
      expect(leaderboard[0].name).toBe('RichCorp');
    });
  });
});
