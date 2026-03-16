const combatPolicyService = require('../../src/services/combatPolicyService');
const {
  ActionAuditLog,
  PlayerProtectionState
} = require('../../src/models');
const {
  createTestUser,
  createTestSector,
  createTestShip,
  cleanDatabase
} = require('../helpers');

describe('combatPolicyService', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('togglePvp', () => {
    it('sets a cooldown and records an audit log', async () => {
      const user = await createTestUser();

      const result = await combatPolicyService.togglePvp({ userId: user.user_id });

      expect(result.pvp_enabled).toBe(true);
      expect(result.cooldown_until).toBeInstanceOf(Date);

      const protection = await PlayerProtectionState.findOne({ where: { user_id: user.user_id } });
      expect(protection).not.toBeNull();
      expect(protection.pvp_toggle_cooldown_until).not.toBeNull();

      const auditLog = await ActionAuditLog.findOne({
        where: { user_id: user.user_id, action_type: 'pvp_toggle', status: 'allow' }
      });
      expect(auditLog).not.toBeNull();
    });

    it('denies toggling during the cooldown window', async () => {
      const user = await createTestUser();

      await combatPolicyService.togglePvp({ userId: user.user_id });

      await expect(
        combatPolicyService.togglePvp({ userId: user.user_id })
      ).rejects.toThrow(/cooling down/i);
    });
  });

  describe('authorizePvpInitiation', () => {
    it('denies PvP inside protected sectors', async () => {
      const attacker = await createTestUser({ username: 'guardattacker1' });
      const defender = await createTestUser({ username: 'guarddefender1' });
      const protectedSector = await createTestSector({ type: 'Core' });
      const attackerShip = await createTestShip(attacker.user_id, protectedSector.sector_id);
      const defenderShip = await createTestShip(defender.user_id, protectedSector.sector_id);

      await expect(
        combatPolicyService.authorizePvpInitiation({
          attackerShipId: attackerShip.ship_id,
          defenderShipId: defenderShip.ship_id,
          attackerUserId: attacker.user_id
        })
      ).rejects.toThrow(/not allowed|protected sector/i);

      const auditLog = await ActionAuditLog.findOne({
        where: { user_id: attacker.user_id, action_type: 'pvp_initiation', status: 'deny' }
      });
      expect(auditLog).not.toBeNull();
    });

    it('allows same-faction PvP in PvP sectors only when both players opted in', async () => {
      const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const attacker = await createTestUser({ username: 'frontierattk1', faction: 'terran_alliance', pvp_enabled: true, created_at: oldDate });
      const defender = await createTestUser({ username: 'frontierdef1', faction: 'terran_alliance', pvp_enabled: true, created_at: oldDate });
      const frontierSector = await createTestSector({ type: 'Fringe' });
      const attackerShip = await createTestShip(attacker.user_id, frontierSector.sector_id);
      const defenderShip = await createTestShip(defender.user_id, frontierSector.sector_id);

      const result = await combatPolicyService.authorizePvpInitiation({
        attackerShipId: attackerShip.ship_id,
        defenderShipId: defenderShip.ship_id,
        attackerUserId: attacker.user_id
      });

      expect(result.attackerShip.ship_id).toBe(attackerShip.ship_id);
      expect(result.defenderShip.ship_id).toBe(defenderShip.ship_id);

      const attackerProtection = await PlayerProtectionState.findOne({ where: { user_id: attacker.user_id } });
      expect(attackerProtection.hostility_until).not.toBeNull();
    });

    it('denies attacks against a target under travel protection', async () => {
      const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const attacker = await createTestUser({ username: 'travelattacker1', faction: 'zythian_swarm', created_at: oldDate });
      const defender = await createTestUser({ username: 'traveldefender1', faction: 'terran_alliance', created_at: oldDate });
      const frontierSector = await createTestSector({ type: 'Fringe' });
      const attackerShip = await createTestShip(attacker.user_id, frontierSector.sector_id);
      const defenderShip = await createTestShip(defender.user_id, frontierSector.sector_id);

      await combatPolicyService.grantTravelProtection({
        userId: defender.user_id,
        durationMs: 60000,
        reason: 'portal_entry'
      });

      await expect(
        combatPolicyService.authorizePvpInitiation({
          attackerShipId: attackerShip.ship_id,
          defenderShipId: defenderShip.ship_id,
          attackerUserId: attacker.user_id
        })
      ).rejects.toThrow(/entry protection|portal entry protection|temporary entry protection/i);
    });

    it('allows a protected arrival to become the first aggressor and removes protection for retaliation', async () => {
      const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const arrival = await createTestUser({ username: 'portalarrival1', faction: 'zythian_swarm', created_at: oldDate });
      const defender = await createTestUser({ username: 'portaldefender1', faction: 'terran_alliance', created_at: oldDate });
      const frontierSector = await createTestSector({ type: 'Fringe' });
      const arrivalShip = await createTestShip(arrival.user_id, frontierSector.sector_id);
      const defenderShip = await createTestShip(defender.user_id, frontierSector.sector_id);

      await combatPolicyService.grantTravelProtection({
        userId: arrival.user_id,
        durationMs: 60000,
        reason: 'portal_entry'
      });

      await expect(
        combatPolicyService.authorizePvpInitiation({
          attackerShipId: defenderShip.ship_id,
          defenderShipId: arrivalShip.ship_id,
          attackerUserId: defender.user_id
        })
      ).rejects.toThrow(/portal entry protection|entry protection/i);

      const firstStrike = await combatPolicyService.authorizePvpInitiation({
        attackerShipId: arrivalShip.ship_id,
        defenderShipId: defenderShip.ship_id,
        attackerUserId: arrival.user_id
      });

      expect(firstStrike.attackerShip.ship_id).toBe(arrivalShip.ship_id);

      const retaliation = await combatPolicyService.authorizePvpInitiation({
        attackerShipId: defenderShip.ship_id,
        defenderShipId: arrivalShip.ship_id,
        attackerUserId: defender.user_id
      });

      expect(retaliation.attackerShip.ship_id).toBe(defenderShip.ship_id);
    });
  });
});
