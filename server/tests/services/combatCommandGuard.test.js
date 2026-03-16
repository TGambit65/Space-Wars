const {
  evaluateCombatCommand,
  resetCombatCommandGuardState
} = require('../../src/services/combatCommandGuard');

describe('combatCommandGuard', () => {
  beforeEach(() => {
    resetCombatCommandGuardState();
  });

  it('allows a normal command stream under the rate limit', () => {
    const first = evaluateCombatCommand({
      socketId: 'socket-a',
      combatId: 'combat-a',
      shipId: 'ship-a',
      sequence: 1,
      now: 1000
    });

    const second = evaluateCombatCommand({
      socketId: 'socket-a',
      combatId: 'combat-a',
      shipId: 'ship-a',
      sequence: 2,
      now: 1000
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });

  it('rejects stale command sequences', () => {
    evaluateCombatCommand({
      socketId: 'socket-a',
      combatId: 'combat-a',
      shipId: 'ship-a',
      sequence: 5,
      now: 1000
    });

    const stale = evaluateCombatCommand({
      socketId: 'socket-a',
      combatId: 'combat-a',
      shipId: 'ship-a',
      sequence: 5,
      now: 1000
    });

    expect(stale.allowed).toBe(false);
    expect(stale.reason).toBe('stale_sequence');
  });

  it('throttles commands that exceed the configured window', () => {
    let lastDecision = null;
    for (let i = 1; i <= 21; i += 1) {
      lastDecision = evaluateCombatCommand({
        socketId: 'socket-a',
        combatId: 'combat-a',
        shipId: 'ship-a',
        sequence: i,
        now: 1000
      });
    }

    expect(lastDecision.allowed).toBe(false);
    expect(lastDecision.status).toBe('throttle');
    expect(lastDecision.reason).toBe('combat_command_rate_limited');
  });

  it('shares throttle state across multiple sockets for the same player', () => {
    for (let i = 1; i <= 20; i += 1) {
      evaluateCombatCommand({
        actorId: 'user-a',
        socketId: `socket-${i % 2}`,
        combatId: 'combat-a',
        shipId: 'ship-a',
        sequence: i,
        now: 1000
      });
    }

    const lastDecision = evaluateCombatCommand({
      actorId: 'user-a',
      socketId: 'socket-b',
      combatId: 'combat-a',
      shipId: 'ship-a',
      sequence: 21,
      now: 1000
    });

    expect(lastDecision.allowed).toBe(false);
    expect(lastDecision.status).toBe('throttle');
  });
});
