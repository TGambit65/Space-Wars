/**
 * Ground Combat Service — manages ground unit training, garrison management,
 * defense policies, NPC raid defense, and player-initiated invasion combat.
 *
 * Phase 3A: NPC raid defense (PvE)
 * Phase 3B: Player invasion (PvP) — future
 */
const { Colony, ColonyBuilding, CustomBlock, GroundUnit, GroundCombatUnit, GroundCombatInstance, Planet, Ship, User, sequelize } = require('../models');
const { generateTerrain, isBuildable } = require('../utils/terrainGenerator');
const config = require('../config');
const { Op } = require('sequelize');
const raidProtectionService = require('./raidProtectionService');

// ============== Unit Training & Garrison ==============

/**
 * Train a new ground unit at a colony.
 */
async function trainUnit(colonyId, userId, unitType) {
  const unitConfig = config.groundCombat.unitTypes[unitType];
  if (!unitConfig) {
    throw Object.assign(new Error(`Unknown unit type: ${unitType}`), { statusCode: 400 });
  }

  const transaction = await sequelize.transaction();
  try {
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!colony) {
      throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
    }
    if (!colony.surface_initialized) {
      throw Object.assign(new Error('Surface must be initialized before training units'), { statusCode: 400 });
    }

    // Check for garrison barracks building (required for unit training)
    const hasBarracks = await ColonyBuilding.count({
      where: { colony_id: colonyId, building_type: 'GARRISON_BARRACKS', is_active: true },
      transaction
    });
    if (!hasBarracks) {
      throw Object.assign(new Error('Colony requires a Garrison Barracks to train units'), { statusCode: 400 });
    }

    // Check active combat lock
    const activeCombat = await GroundCombatInstance.findOne({
      where: { colony_id: colonyId, status: { [Op.in]: ['deploying', 'active'] } },
      transaction
    });
    if (activeCombat) {
      throw Object.assign(new Error('Cannot train units during active ground combat'), { statusCode: 409 });
    }

    // Check unit cap
    const unitCount = await GroundUnit.count({
      where: { colony_id: colonyId, owner_user_id: userId },
      transaction
    });
    if (unitCount >= config.groundCombat.maxUnitsPerColony) {
      throw Object.assign(new Error(`Maximum ${config.groundCombat.maxUnitsPerColony} units per colony`), { statusCode: 400 });
    }

    // Deduct credits
    const user = await User.findByPk(userId, { transaction, lock: true });
    if (Number(user.credits) < unitConfig.cost) {
      throw Object.assign(new Error('Insufficient credits'), { statusCode: 400 });
    }
    await user.update({ credits: Number(user.credits) - unitConfig.cost }, { transaction });

    const trainingUntil = new Date(Date.now() + unitConfig.trainTime * 1000);

    const unit = await GroundUnit.create({
      owner_user_id: userId,
      unit_type: unitType,
      hp_max: unitConfig.hp,
      hp_remaining: unitConfig.hp,
      colony_id: colonyId,
      training_until: trainingUntil
    }, { transaction });

    await transaction.commit();
    return unit.toJSON();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Get all ground units garrisoned at a colony.
 */
async function getGarrison(colonyId, userId) {
  const colony = await Colony.findOne({
    where: { colony_id: colonyId, user_id: userId }
  });
  if (!colony) {
    throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
  }

  const units = await GroundUnit.findAll({
    where: { colony_id: colonyId, owner_user_id: userId },
    order: [['createdAt', 'ASC']]
  });

  const now = new Date();
  return units.map(u => {
    const json = u.toJSON();
    json.is_trained = !u.training_until || new Date(u.training_until) <= now;
    json.training_remaining_ms = u.training_until
      ? Math.max(0, new Date(u.training_until).getTime() - now.getTime())
      : 0;
    const unitConfig = config.groundCombat.unitTypes[u.unit_type];
    json.config = unitConfig || {};
    return json;
  });
}

/**
 * Set the defense policy for a colony (AI behavior when attacked).
 */
async function setDefensePolicy(colonyId, userId, policy) {
  if (!config.groundCombat.defenderPolicies.includes(policy)) {
    throw Object.assign(new Error(`Invalid defense policy. Must be one of: ${config.groundCombat.defenderPolicies.join(', ')}`), { statusCode: 400 });
  }

  const colony = await Colony.findOne({
    where: { colony_id: colonyId, user_id: userId }
  });
  if (!colony) {
    throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
  }

  await colony.update({ defender_policy: policy });
  return { colony_id: colonyId, defender_policy: policy };
}

/**
 * Disband (delete) a ground unit. Partial refund.
 */
async function disbandUnit(colonyId, userId, unitId) {
  const transaction = await sequelize.transaction();
  try {
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!colony) {
      throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
    }

    const unit = await GroundUnit.findOne({
      where: { unit_id: unitId, colony_id: colonyId, owner_user_id: userId },
      transaction
    });
    if (!unit) {
      throw Object.assign(new Error('Unit not found at this colony'), { statusCode: 404 });
    }

    // Cannot disband units in active combat
    if (unit.combat_instance_id) {
      throw Object.assign(new Error('Cannot disband unit during active combat'), { statusCode: 409 });
    }

    // 25% refund
    const unitConfig = config.groundCombat.unitTypes[unit.unit_type];
    const refund = Math.floor((unitConfig?.cost || 0) * 0.25);
    if (refund > 0) {
      const user = await User.findByPk(userId, { transaction, lock: true });
      await user.update({ credits: Number(user.credits) + refund }, { transaction });
    }

    await unit.destroy({ transaction });
    await transaction.commit();
    return { disbanded: true, refund };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// ============== Combat: Initiation ==============

/**
 * Check if a colony has an active ground combat instance.
 */
async function hasActiveCombat(colonyId, transaction = null) {
  const opts = {
    where: { colony_id: colonyId, status: { [Op.in]: ['deploying', 'active'] } }
  };
  if (transaction) opts.transaction = transaction;
  const instance = await GroundCombatInstance.findOne(opts);
  return !!instance;
}

/**
 * Initiate a ground combat invasion (NPC raid or player attack).
 * For NPC raids: attackerUserId = null, npcRaid = true
 * For player attacks: requires ship in orbit + units aboard
 */
async function initiateInvasion(attackerUserId, colonyId, shipId = null, unitIds = [], isNpcRaid = false) {
  const transaction = await sequelize.transaction();
  try {
    const colony = await Colony.findOne({
      where: { colony_id: colonyId },
      include: [{ model: Planet, as: 'planet' }],
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!colony) {
      throw Object.assign(new Error('Colony not found'), { statusCode: 404 });
    }
    if (!colony.surface_initialized) {
      throw Object.assign(new Error('Colony surface not initialized'), { statusCode: 400 });
    }

    if (!isNpcRaid) {
      await raidProtectionService.authorizePlayerRaid({
        attackerUserId,
        colony,
        transaction
      });
    }

    // Check concurrent invasion lock
    const existing = await GroundCombatInstance.findOne({
      where: { colony_id: colonyId, status: { [Op.in]: ['deploying', 'active'] } },
      transaction
    });
    if (existing) {
      throw Object.assign(new Error('Colony already under attack'), { statusCode: 409 });
    }

    const planet = colony.planet;
    const { grid, width, height } = generateTerrain(colonyId, planet.planet_id, planet.type, planet.size);

    // Find landing zone tiles (edge tiles)
    const landingTiles = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === 'landing_zone') {
          landingTiles.push({ x, y });
        }
      }
    }
    if (landingTiles.length === 0) {
      // Fallback: use passable edge tiles
      const isPassable = (terrain) => config.colonySurface.terrainTypes[terrain]?.passable;
      for (let x = 0; x < width; x++) {
        if (isPassable(grid[0][x])) landingTiles.push({ x, y: 0 });
        if (isPassable(grid[height - 1][x])) landingTiles.push({ x, y: height - 1 });
      }
      for (let y = 1; y < height - 1; y++) {
        if (isPassable(grid[y][0])) landingTiles.push({ x: 0, y });
        if (isPassable(grid[y][width - 1])) landingTiles.push({ x: width - 1, y });
      }
    }

    let attackerUnits = [];
    let attacker;

    if (isNpcRaid) {
      // Generate NPC raid force
      const raidConfig = config.groundCombat.npcRaid;
      const raidSize = raidConfig.minRaidStrength + Math.floor(
        Math.random() * (raidConfig.maxRaidStrength - raidConfig.minRaidStrength + 1)
      );

      for (let i = 0; i < raidSize; i++) {
        const typeKey = raidConfig.unitTypes[Math.floor(Math.random() * raidConfig.unitTypes.length)];
        const unitCfg = config.groundCombat.unitTypes[typeKey];
        attackerUnits.push({
          unit_type: typeKey,
          hp_max: unitCfg.hp,
          hp_remaining: unitCfg.hp,
          attack: unitCfg.attack,
          defense: unitCfg.defense,
          speed: unitCfg.speed,
          range: unitCfg.range,
          source_unit_id: null // NPC units have no persistent source
        });
      }
    } else {
      // Player attack: validate ship and units
      if (!attackerUserId) {
        throw Object.assign(new Error('Attacker user ID required'), { statusCode: 400 });
      }
      if (colony.user_id === attackerUserId) {
        throw Object.assign(new Error('Cannot attack your own colony'), { statusCode: 400 });
      }
      if (!shipId) {
        throw Object.assign(new Error('Ship required for invasion'), { statusCode: 400 });
      }

      const ship = await Ship.findOne({
        where: { ship_id: shipId, owner_user_id: attackerUserId },
        transaction
      });
      if (!ship) {
        throw Object.assign(new Error('Ship not found or not owned'), { statusCode: 404 });
      }

      // Ship must be in same sector as planet
      if (ship.current_sector_id !== planet.sector_id) {
        throw Object.assign(new Error('Ship must be in the same sector as the target planet'), { statusCode: 400 });
      }

      if (!unitIds || unitIds.length === 0) {
        throw Object.assign(new Error('Must deploy at least one unit'), { statusCode: 400 });
      }

      const units = await GroundUnit.findAll({
        where: {
          unit_id: { [Op.in]: unitIds },
          owner_user_id: attackerUserId,
          ship_id: shipId,
          is_active: true
        },
        transaction
      });

      if (units.length !== unitIds.length) {
        throw Object.assign(new Error('Some units not found on the specified ship'), { statusCode: 400 });
      }

      // Check all units are trained
      const now = new Date();
      for (const u of units) {
        if (u.training_until && new Date(u.training_until) > now) {
          throw Object.assign(new Error(`Unit ${u.unit_id} is still training`), { statusCode: 400 });
        }
      }

      attacker = await User.findByPk(attackerUserId, { transaction });
      attackerUnits = units.map(u => {
        const unitCfg = config.groundCombat.unitTypes[u.unit_type];
        return {
          source_unit_id: u.unit_id,
          unit_type: u.unit_type,
          hp_max: u.hp_max,
          hp_remaining: u.hp_remaining,
          attack: unitCfg.attack,
          defense: unitCfg.defense,
          speed: unitCfg.speed,
          range: unitCfg.range
        };
      });
    }

    // Create combat instance
    const instance = await GroundCombatInstance.create({
      planet_id: planet.planet_id,
      colony_id: colonyId,
      attacker_id: isNpcRaid ? null : attackerUserId,
      defender_id: colony.user_id,
      attacker_ship_id: shipId,
      status: 'deploying',
      turn_number: 0,
      combat_log: [],
      defender_policy: colony.defender_policy || 'hold_the_line',
      started_at: new Date()
    }, { transaction });

    // Deploy attacker units on landing tiles
    const attackerCombatUnits = [];
    for (let i = 0; i < attackerUnits.length; i++) {
      const tile = landingTiles[i % landingTiles.length];
      const cu = await GroundCombatUnit.create({
        combat_instance_id: instance.instance_id,
        source_unit_id: attackerUnits[i].source_unit_id || null,
        owner_user_id: isNpcRaid ? null : attackerUserId,
        unit_type: attackerUnits[i].unit_type,
        side: 'attacker',
        grid_x: tile.x,
        grid_y: tile.y,
        hp_max: attackerUnits[i].hp_max,
        hp_remaining: attackerUnits[i].hp_remaining,
        attack: attackerUnits[i].attack,
        defense: attackerUnits[i].defense,
        speed: attackerUnits[i].speed,
        range: attackerUnits[i].range,
        status: 'active'
      }, { transaction });
      attackerCombatUnits.push(cu);
    }

    // Deploy defender garrison
    const defenderUnits = await GroundUnit.findAll({
      where: {
        colony_id: colonyId,
        owner_user_id: colony.user_id,
        is_active: true,
        combat_instance_id: null
      },
      transaction
    });

    // Filter out untrained units
    const now = new Date();
    const trainedDefenders = defenderUnits.filter(
      u => !u.training_until || new Date(u.training_until) <= now
    );

    // Place defenders near buildings (center of grid)
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const defenderPositions = getDefenderPositions(grid, width, height, cx, cy, trainedDefenders.length);

    const defenderCombatUnits = [];
    for (let i = 0; i < trainedDefenders.length; i++) {
      const u = trainedDefenders[i];
      const unitCfg = config.groundCombat.unitTypes[u.unit_type];
      const pos = defenderPositions[i] || { x: cx, y: cy };
      const cu = await GroundCombatUnit.create({
        combat_instance_id: instance.instance_id,
        source_unit_id: u.unit_id,
        owner_user_id: colony.user_id,
        unit_type: u.unit_type,
        side: 'defender',
        grid_x: pos.x,
        grid_y: pos.y,
        hp_max: u.hp_max,
        hp_remaining: u.hp_remaining,
        attack: unitCfg.attack,
        defense: unitCfg.defense,
        speed: unitCfg.speed,
        range: unitCfg.range,
        status: 'active'
      }, { transaction });
      defenderCombatUnits.push(cu);

      // Mark persistent unit as in combat
      await u.update({ combat_instance_id: instance.instance_id }, { transaction });
    }

    // Mark attacker persistent units as in combat (player attacks only)
    if (!isNpcRaid) {
      for (const unitData of attackerUnits) {
        if (unitData.source_unit_id) {
          await GroundUnit.update(
            { combat_instance_id: instance.instance_id, ship_id: null },
            { where: { unit_id: unitData.source_unit_id }, transaction }
          );
        }
      }
    }

    // Set status to active
    await instance.update({
      status: 'active',
      turn_number: 1,
      last_turn_at: new Date(),
      combat_log: [{ turn: 0, event: 'combat_started', attacker_count: attackerCombatUnits.length, defender_count: defenderCombatUnits.length }]
    }, { transaction });

    await transaction.commit();

    return {
      instance_id: instance.instance_id,
      status: 'active',
      turn_number: 1,
      attacker_units: attackerCombatUnits.length,
      defender_units: defenderCombatUnits.length,
      grid: { width, height }
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Find positions for defender units near grid center using spiral search.
 */
function getDefenderPositions(grid, width, height, cx, cy, count) {
  const positions = [];
  const used = new Set();

  for (let radius = 0; radius < Math.max(width, height) && positions.length < count; radius++) {
    for (let dy = -radius; dy <= radius && positions.length < count; dy++) {
      for (let dx = -radius; dx <= radius && positions.length < count; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        const terrain = grid[y]?.[x];
        if (!terrain) continue;
        const terrainConfig = config.colonySurface.terrainTypes[terrain];
        if (!terrainConfig?.passable) continue;
        const key = `${x},${y}`;
        if (used.has(key)) continue;
        used.add(key);
        positions.push({ x, y });
      }
    }
  }
  return positions;
}

// ============== Combat: State & Turns ==============

/**
 * Get the current state of a combat instance.
 */
async function getCombatState(combatInstanceId, userId) {
  const instance = await GroundCombatInstance.findByPk(combatInstanceId);
  if (!instance) {
    throw Object.assign(new Error('Combat instance not found'), { statusCode: 404 });
  }

  // Authorization: only attacker, defender, or colony owner can view
  // NPC raids have null attacker_id — colony owner (defender) can always view
  if (instance.attacker_id !== userId && instance.defender_id !== userId) {
    throw Object.assign(new Error('Not authorized to view this combat'), { statusCode: 403 });
  }

  const combatUnits = await GroundCombatUnit.findAll({
    where: { combat_instance_id: combatInstanceId },
    order: [['side', 'ASC'], ['createdAt', 'ASC']]
  });

  // Get terrain for the colony
  const colony = await Colony.findOne({
    where: { colony_id: instance.colony_id },
    include: [{ model: Planet, as: 'planet' }]
  });

  let terrain = null;
  if (colony?.planet) {
    const terrainData = generateTerrain(
      instance.colony_id, colony.planet.planet_id, colony.planet.type, colony.planet.size
    );
    terrain = { grid: terrainData.grid, width: terrainData.width, height: terrainData.height };
  }

  // Get buildings and blocks for cover info
  const [buildings, blocks] = await Promise.all([
    ColonyBuilding.findAll({
      where: { colony_id: instance.colony_id, grid_x: { [Op.ne]: null } }
    }),
    CustomBlock.findAll({
      where: { colony_id: instance.colony_id }
    })
  ]);

  return {
    instance: instance.toJSON(),
    units: combatUnits.map(u => u.toJSON()),
    terrain,
    buildings: buildings.map(b => ({
      building_id: b.building_id,
      building_type: b.building_type,
      grid_x: b.grid_x,
      grid_y: b.grid_y,
      footprint: config.colonySurface.buildingFootprints[b.building_type] || { w: 1, h: 1 },
      condition: b.condition
    })),
    blocks: blocks.map(b => ({
      block_id: b.block_id,
      block_type: b.block_type,
      grid_x: b.grid_x,
      grid_y: b.grid_y,
      hp: config.customBlocks.blockTypes[b.block_type]?.hp || 50
    }))
  };
}

/**
 * Process a combat turn. Attacker submits orders, defender AI acts based on policy.
 * Orders: [{ unit_id, action: 'move'|'attack', target_x, target_y, target_unit_id }]
 */
async function processCombatTurn(combatInstanceId, userId, orders) {
  const transaction = await sequelize.transaction();
  try {
    const instance = await GroundCombatInstance.findOne({
      where: { instance_id: combatInstanceId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!instance) {
      throw Object.assign(new Error('Combat instance not found'), { statusCode: 404 });
    }
    if (instance.status !== 'active') {
      throw Object.assign(new Error('Combat is not active'), { statusCode: 400 });
    }
    if (instance.attacker_id !== userId) {
      throw Object.assign(new Error('Only the attacker can submit orders'), { statusCode: 403 });
    }

    // Check global timer
    const elapsed = Date.now() - new Date(instance.started_at).getTime();
    if (elapsed > config.groundCombat.globalTimerMs) {
      // Auto-forfeit
      const result = await resolveCombat(instance, 'defender_won', 'Global timer expired', transaction);
      await transaction.commit();
      return result;
    }

    // Check max turns
    if (instance.turn_number >= instance.max_turns) {
      const result = await resolveCombat(instance, 'defender_won', 'Maximum turns exceeded', transaction);
      await transaction.commit();
      return result;
    }

    const combatUnits = await GroundCombatUnit.findAll({
      where: { combat_instance_id: combatInstanceId, status: 'active' },
      transaction
    });

    const attackerUnits = combatUnits.filter(u => u.side === 'attacker');
    const defenderUnits = combatUnits.filter(u => u.side === 'defender');

    // Get terrain and cover data
    const colony = await Colony.findOne({
      where: { colony_id: instance.colony_id },
      include: [{ model: Planet, as: 'planet' }],
      transaction
    });
    const { grid, width, height } = generateTerrain(
      instance.colony_id, colony.planet.planet_id, colony.planet.type, colony.planet.size
    );
    const buildings = await ColonyBuilding.findAll({
      where: { colony_id: instance.colony_id, grid_x: { [Op.ne]: null } },
      transaction
    });
    const blocks = await CustomBlock.findAll({
      where: { colony_id: instance.colony_id },
      transaction
    });

    const turnLog = [];

    // Reset turn flags
    for (const u of combatUnits) {
      await u.update({ has_moved: false, has_attacked: false }, { transaction });
    }

    // Process attacker orders
    if (Array.isArray(orders)) {
      for (const order of orders) {
        const unit = attackerUnits.find(u => u.id === order.unit_id);
        if (!unit || unit.status !== 'active') continue;

        if (order.action === 'move') {
          const moveResult = processMove(unit, order.target_x, order.target_y, grid, width, height, combatUnits, buildings, blocks);
          if (moveResult.success) {
            await unit.update({
              grid_x: order.target_x,
              grid_y: order.target_y,
              has_moved: true
            }, { transaction });
            turnLog.push({ type: 'move', unit_id: unit.id, side: 'attacker', to: { x: order.target_x, y: order.target_y } });
          }
        } else if (order.action === 'attack') {
          const target = combatUnits.find(u => u.id === order.target_unit_id && u.side === 'defender' && u.status === 'active');
          if (!target) continue;

          const attackResult = processAttack(unit, target, grid, buildings, blocks);
          await target.update({ hp_remaining: attackResult.target_hp }, { transaction });
          await unit.update({ has_attacked: true }, { transaction });

          turnLog.push({
            type: 'attack',
            attacker_id: unit.id,
            target_id: target.id,
            damage: attackResult.damage,
            target_hp: attackResult.target_hp,
            cover: attackResult.cover
          });

          if (attackResult.target_hp <= 0) {
            await target.update({ status: 'destroyed' }, { transaction });
            turnLog.push({ type: 'destroyed', unit_id: target.id, side: 'defender' });
          }
        }
      }
    }

    // Process defender AI turn
    const defenderLog = await processDefenderAI(
      instance.defender_policy, defenderUnits, attackerUnits,
      grid, width, height, buildings, blocks, combatUnits, transaction
    );
    turnLog.push(...defenderLog);

    // Process defense turret auto-fire
    const turretLog = await processTurretFire(
      instance.colony_id, attackerUnits, buildings, blocks, grid, transaction
    );
    turnLog.push(...turretLog);

    // Check victory conditions
    const activeAttackers = await GroundCombatUnit.count({
      where: { combat_instance_id: combatInstanceId, side: 'attacker', status: 'active' },
      transaction
    });
    const activeDefenders = await GroundCombatUnit.count({
      where: { combat_instance_id: combatInstanceId, side: 'defender', status: 'active' },
      transaction
    });

    if (activeAttackers === 0) {
      const result = await resolveCombat(instance, 'defender_won', 'All attackers eliminated', transaction, turnLog);
      await transaction.commit();
      return result;
    }
    if (activeDefenders === 0) {
      const result = await resolveCombat(instance, 'attacker_won', 'All defenders eliminated', transaction, turnLog);
      await transaction.commit();
      return result;
    }

    // Check garrison barracks capture (attacker unit on barracks tile = colony captured)
    const barracks = buildings.find(b => b.building_type === 'GARRISON_BARRACKS');
    if (barracks) {
      const ccFp = config.colonySurface.buildingFootprints.GARRISON_BARRACKS || { w: 2, h: 2 };
      const remainingAttackers = await GroundCombatUnit.findAll({
        where: { combat_instance_id: combatInstanceId, side: 'attacker', status: 'active' },
        transaction
      });
      const captured = remainingAttackers.some(u =>
        u.grid_x >= barracks.grid_x && u.grid_x < barracks.grid_x + ccFp.w &&
        u.grid_y >= barracks.grid_y && u.grid_y < barracks.grid_y + ccFp.h
      );
      if (captured) {
        const result = await resolveCombat(instance, 'attacker_won', 'Garrison barracks captured', transaction, turnLog);
        await transaction.commit();
        return result;
      }
    }

    // Advance turn
    const newLog = [...(instance.combat_log || []), { turn: instance.turn_number, events: turnLog }];
    await instance.update({
      turn_number: instance.turn_number + 1,
      last_turn_at: new Date(),
      combat_log: newLog
    }, { transaction });

    await transaction.commit();

    return {
      status: 'active',
      turn_number: instance.turn_number,
      turn_log: turnLog,
      active_attackers: activeAttackers,
      active_defenders: activeDefenders
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// ============== Combat: Movement & Attack Logic ==============

/**
 * Validate and process a movement order.
 */
function processMove(unit, targetX, targetY, grid, width, height, allUnits, buildings, blocks) {
  // Bounds check
  if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) {
    return { success: false, reason: 'Out of bounds' };
  }

  // Check terrain passability
  const terrain = grid[targetY]?.[targetX];
  const terrainConfig = config.colonySurface.terrainTypes[terrain];
  if (!terrainConfig?.passable) {
    return { success: false, reason: 'Terrain not passable' };
  }

  // Check movement range (Manhattan distance <= speed, accounting for terrain speed penalties)
  const distance = Math.abs(targetX - unit.grid_x) + Math.abs(targetY - unit.grid_y);
  if (distance > unit.speed) {
    return { success: false, reason: 'Target out of movement range' };
  }

  // Check collision with other units
  const occupied = allUnits.find(u => u.id !== unit.id && u.status === 'active' && u.grid_x === targetX && u.grid_y === targetY);
  if (occupied) {
    return { success: false, reason: 'Tile occupied by another unit' };
  }

  // Check collision with blocking structures
  for (const block of blocks) {
    const blockConfig = config.customBlocks.blockTypes[block.block_type];
    if (blockConfig?.blocks_movement && block.grid_x === targetX && block.grid_y === targetY) {
      return { success: false, reason: 'Tile blocked by structure' };
    }
  }

  // Check building footprint collision
  for (const building of buildings) {
    const fp = config.colonySurface.buildingFootprints[building.building_type];
    if (!fp) continue;
    if (targetX >= building.grid_x && targetX < building.grid_x + fp.w &&
        targetY >= building.grid_y && targetY < building.grid_y + fp.h) {
      return { success: false, reason: 'Tile occupied by building' };
    }
  }

  return { success: true };
}

/**
 * Calculate and apply attack damage.
 * damage = max(minDamage, attack * (100 / (100 + defense)) * cover_modifier * terrain_modifier)
 */
function processAttack(attacker, target, grid, buildings, blocks) {
  // Check range
  const distance = Math.abs(attacker.grid_x - target.grid_x) + Math.abs(attacker.grid_y - target.grid_y);
  if (distance > attacker.range) {
    return { damage: 0, target_hp: target.hp_remaining, cover: false, reason: 'Out of range' };
  }

  const rules = config.groundCombat.combatRules;

  // Cover check: is target adjacent to a wall/barricade/building?
  const hasCover = checkCover(target.grid_x, target.grid_y, buildings, blocks);

  // Terrain defense modifier
  const terrain = grid[target.grid_y]?.[target.grid_x];
  const terrainEffect = rules.terrainEffects[terrain] || { defense: 1.0 };
  const terrainDefMod = 1.0 / (terrainEffect.defense || 1.0);

  // Cover modifier
  const coverMod = hasCover ? (1.0 - rules.coverBonus) : 1.0;

  // Damage formula
  const rawDamage = attacker.attack * (100 / (100 + target.defense));
  const finalDamage = Math.max(rules.minDamage, Math.floor(rawDamage * coverMod * terrainDefMod));

  const newHp = Math.max(0, target.hp_remaining - finalDamage);

  return { damage: finalDamage, target_hp: newHp, cover: hasCover };
}

/**
 * Check if a tile has cover from adjacent buildings/blocks.
 */
function checkCover(gridX, gridY, buildings, blocks) {
  // Adjacent = Manhattan distance 1
  const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];

  for (const { dx, dy } of dirs) {
    const nx = gridX + dx;
    const ny = gridY + dy;

    // Check blocks that provide cover
    for (const block of blocks) {
      if (block.grid_x === nx && block.grid_y === ny) {
        const bc = config.customBlocks.blockTypes[block.block_type];
        if (bc?.blocks_movement || bc?.half_cover) {
          return true;
        }
      }
    }

    // Check building footprints
    for (const building of buildings) {
      const fp = config.colonySurface.buildingFootprints[building.building_type];
      if (!fp) continue;
      if (nx >= building.grid_x && nx < building.grid_x + fp.w &&
          ny >= building.grid_y && ny < building.grid_y + fp.h) {
        return true;
      }
    }
  }

  return false;
}

// ============== Defender AI ==============

/**
 * Process defender AI actions based on defense policy.
 */
async function processDefenderAI(policy, defenderUnits, attackerUnits, grid, width, height, buildings, blocks, allUnits, transaction) {
  const log = [];
  const activeDefenders = defenderUnits.filter(u => u.status === 'active');
  const activeAttackers = attackerUnits.filter(u => u.status === 'active');

  if (activeDefenders.length === 0 || activeAttackers.length === 0) return log;

  for (const defender of activeDefenders) {
    // Find nearest attacker
    let nearest = null;
    let nearestDist = Infinity;
    for (const att of activeAttackers) {
      const dist = Math.abs(defender.grid_x - att.grid_x) + Math.abs(defender.grid_y - att.grid_y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = att;
      }
    }
    if (!nearest) continue;

    // Can we attack?
    if (nearestDist <= defender.range) {
      const attackResult = processAttack(defender, nearest, grid, buildings, blocks);
      await nearest.update({ hp_remaining: attackResult.target_hp }, { transaction });
      await defender.update({ has_attacked: true }, { transaction });

      log.push({
        type: 'attack',
        attacker_id: defender.id,
        target_id: nearest.id,
        damage: attackResult.damage,
        target_hp: attackResult.target_hp,
        cover: attackResult.cover,
        side: 'defender'
      });

      if (attackResult.target_hp <= 0) {
        await nearest.update({ status: 'destroyed' }, { transaction });
        log.push({ type: 'destroyed', unit_id: nearest.id, side: 'attacker' });
        // Remove from active attackers
        const idx = activeAttackers.indexOf(nearest);
        if (idx >= 0) activeAttackers.splice(idx, 1);
      }
      continue;
    }

    // Movement based on policy
    let moveTarget = null;

    switch (policy) {
      case 'aggressive':
        // Move toward nearest attacker
        moveTarget = moveToward(defender, nearest.grid_x, nearest.grid_y, defender.speed, grid, width, height, allUnits, buildings, blocks);
        break;

      case 'fallback_to_center': {
        const cx = Math.floor(width / 2);
        const cy = Math.floor(height / 2);
        const distToCenter = Math.abs(defender.grid_x - cx) + Math.abs(defender.grid_y - cy);
        if (distToCenter > 3) {
          moveTarget = moveToward(defender, cx, cy, defender.speed, grid, width, height, allUnits, buildings, blocks);
        }
        break;
      }

      case 'guerrilla':
        // If enemy is close, move away; if far, move toward
        if (nearestDist <= 3) {
          // Move away
          const awayX = defender.grid_x + (defender.grid_x - nearest.grid_x);
          const awayY = defender.grid_y + (defender.grid_y - nearest.grid_y);
          moveTarget = moveToward(defender, awayX, awayY, defender.speed, grid, width, height, allUnits, buildings, blocks);
        } else {
          moveTarget = moveToward(defender, nearest.grid_x, nearest.grid_y, defender.speed, grid, width, height, allUnits, buildings, blocks);
        }
        break;

      case 'hold_the_line':
      default:
        // Only move if enemy is within range + 2, stay near buildings
        if (nearestDist <= defender.range + 2) {
          moveTarget = moveToward(defender, nearest.grid_x, nearest.grid_y, Math.min(defender.speed, 1), grid, width, height, allUnits, buildings, blocks);
        }
        break;
    }

    if (moveTarget) {
      await defender.update({ grid_x: moveTarget.x, grid_y: moveTarget.y, has_moved: true }, { transaction });
      log.push({ type: 'move', unit_id: defender.id, side: 'defender', to: moveTarget });

      // Try to attack after move
      const newDist = Math.abs(moveTarget.x - nearest.grid_x) + Math.abs(moveTarget.y - nearest.grid_y);
      if (newDist <= defender.range && activeAttackers.includes(nearest)) {
        const attackResult = processAttack(
          { ...defender.toJSON(), grid_x: moveTarget.x, grid_y: moveTarget.y },
          nearest, grid, buildings, blocks
        );
        await nearest.update({ hp_remaining: attackResult.target_hp }, { transaction });
        await defender.update({ has_attacked: true }, { transaction });

        log.push({
          type: 'attack',
          attacker_id: defender.id,
          target_id: nearest.id,
          damage: attackResult.damage,
          target_hp: attackResult.target_hp,
          cover: attackResult.cover,
          side: 'defender'
        });

        if (attackResult.target_hp <= 0) {
          await nearest.update({ status: 'destroyed' }, { transaction });
          log.push({ type: 'destroyed', unit_id: nearest.id, side: 'attacker' });
          const idx = activeAttackers.indexOf(nearest);
          if (idx >= 0) activeAttackers.splice(idx, 1);
        }
      }
    }
  }

  return log;
}

/**
 * Move unit up to maxSteps toward a target position using greedy pathfinding.
 */
function moveToward(unit, targetX, targetY, maxSteps, grid, width, height, allUnits, buildings, blocks) {
  let curX = unit.grid_x;
  let curY = unit.grid_y;
  const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];

  for (let step = 0; step < maxSteps; step++) {
    let bestX = curX;
    let bestY = curY;
    let bestDist = Math.abs(curX - targetX) + Math.abs(curY - targetY);

    // Create a virtual unit at current position for collision checks
    const virtualUnit = { ...unit, grid_x: curX, grid_y: curY };

    for (const { dx, dy } of dirs) {
      const nx = curX + dx;
      const ny = curY + dy;
      const moveResult = processMove(virtualUnit, nx, ny, grid, width, height, allUnits, buildings, blocks);
      if (moveResult.success) {
        const dist = Math.abs(nx - targetX) + Math.abs(ny - targetY);
        if (dist < bestDist) {
          bestDist = dist;
          bestX = nx;
          bestY = ny;
        }
      }
    }

    if (bestX === curX && bestY === curY) break; // stuck
    curX = bestX;
    curY = bestY;
  }

  if (curX !== unit.grid_x || curY !== unit.grid_y) {
    return { x: curX, y: curY };
  }
  return null;
}

// ============== Defense Turrets ==============

/**
 * Process automated defense turret fire.
 */
async function processTurretFire(colonyId, attackerUnits, buildings, blocks, grid, transaction) {
  const log = [];

  // Find defense grid buildings (auto-fire turrets)
  const turrets = buildings.filter(b => b.building_type === 'DEFENSE_GRID' && b.condition > 0);

  // Find turret mount blocks
  const turretMounts = blocks.filter(b => {
    const bc = config.customBlocks.blockTypes[b.block_type];
    return bc?.enables_turret;
  });

  const allTurretPositions = [
    ...turrets.map(t => ({ x: t.grid_x, y: t.grid_y, attack: 20, range: 4 })),
    ...turretMounts.map(t => ({ x: t.grid_x, y: t.grid_y, attack: 15, range: 3 }))
  ];

  const activeAttackers = attackerUnits.filter(u => u.status === 'active');

  for (const turret of allTurretPositions) {
    // Find nearest attacker in range
    let target = null;
    let minDist = Infinity;
    for (const att of activeAttackers) {
      const dist = Math.abs(turret.x - att.grid_x) + Math.abs(turret.y - att.grid_y);
      if (dist <= turret.range && dist < minDist) {
        minDist = dist;
        target = att;
      }
    }
    if (!target) continue;

    // Turret damage
    const rules = config.groundCombat.combatRules;
    const rawDamage = turret.attack * (100 / (100 + target.defense));
    const damage = Math.max(rules.minDamage, Math.floor(rawDamage));
    const newHp = Math.max(0, target.hp_remaining - damage);

    await target.update({ hp_remaining: newHp }, { transaction });

    log.push({
      type: 'turret_fire',
      turret_pos: { x: turret.x, y: turret.y },
      target_id: target.id,
      damage,
      target_hp: newHp
    });

    if (newHp <= 0) {
      await target.update({ status: 'destroyed' }, { transaction });
      log.push({ type: 'destroyed', unit_id: target.id, side: 'attacker' });
      const idx = activeAttackers.indexOf(target);
      if (idx >= 0) activeAttackers.splice(idx, 1);
    }
  }

  return log;
}

// ============== Combat Resolution ==============

/**
 * Resolve combat — write back HP to persistent units, cleanup.
 */
async function resolveCombat(instance, outcome, reason, transaction, turnLog = []) {
  // Get all combat units
  const combatUnits = await GroundCombatUnit.findAll({
    where: { combat_instance_id: instance.instance_id },
    transaction
  });

  // Write back HP to persistent GroundUnit records
  for (const cu of combatUnits) {
    if (cu.source_unit_id) {
      if (cu.status === 'destroyed') {
        // Mark persistent unit as destroyed
        await GroundUnit.update(
          { hp_remaining: 0, is_active: false, combat_instance_id: null },
          { where: { unit_id: cu.source_unit_id }, transaction }
        );
      } else {
        // Write back remaining HP, return to colony or ship
        const updateData = {
          hp_remaining: cu.hp_remaining,
          combat_instance_id: null
        };

        // Attackers return to ship, defenders stay at colony
        if (cu.side === 'attacker') {
          updateData.ship_id = instance.attacker_ship_id;
          updateData.colony_id = null;
        } else {
          updateData.colony_id = instance.colony_id;
          updateData.ship_id = null;
        }

        await GroundUnit.update(updateData, { where: { unit_id: cu.source_unit_id }, transaction });
      }
    }
  }

  // Apply building damage if attacker won (NPC raids)
  if (outcome === 'attacker_won') {
    const damagedBuildings = await ColonyBuilding.findAll({
      where: { colony_id: instance.colony_id, is_active: true },
      transaction
    });
    for (const b of damagedBuildings) {
      const dmg = 0.1 + Math.random() * 0.2; // 10-30% condition reduction
      const newCondition = Math.max(0, b.condition - dmg);
      await b.update({ condition: newCondition }, { transaction });
    }
  }

  // Update instance status
  const finalLog = [...(instance.combat_log || [])];
  if (turnLog.length > 0) {
    finalLog.push({ turn: instance.turn_number, events: turnLog });
  }
  finalLog.push({ turn: instance.turn_number, event: 'combat_resolved', outcome, reason });

  await instance.update({
    status: outcome,
    combat_log: finalLog,
    last_turn_at: new Date()
  }, { transaction });

  return {
    status: outcome,
    reason,
    turn_number: instance.turn_number,
    combat_log: finalLog
  };
}

/**
 * Retreat from combat (attacker only).
 */
async function retreat(combatInstanceId, userId) {
  const transaction = await sequelize.transaction();
  try {
    const instance = await GroundCombatInstance.findOne({
      where: { instance_id: combatInstanceId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!instance) {
      throw Object.assign(new Error('Combat instance not found'), { statusCode: 404 });
    }
    if (instance.status !== 'active' && instance.status !== 'deploying') {
      throw Object.assign(new Error('Combat is not active'), { statusCode: 400 });
    }
    if (instance.attacker_id !== userId) {
      throw Object.assign(new Error('Only the attacker can retreat'), { statusCode: 403 });
    }

    const result = await resolveCombat(instance, 'attacker_retreated', 'Attacker retreated', transaction);
    await transaction.commit();
    return result;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Get combat history for a colony.
 */
async function getCombatHistory(colonyId, userId) {
  const colony = await Colony.findOne({
    where: { colony_id: colonyId, user_id: userId }
  });
  if (!colony) {
    throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
  }

  const instances = await GroundCombatInstance.findAll({
    where: { colony_id: colonyId },
    order: [['createdAt', 'DESC']],
    limit: 20
  });

  return instances.map(i => ({
    instance_id: i.instance_id,
    status: i.status,
    turn_number: i.turn_number,
    started_at: i.started_at,
    defender_policy: i.defender_policy,
    updatedAt: i.updatedAt
  }));
}

/**
 * Trigger an NPC raid on a colony (called by raid service or cron).
 */
async function triggerNpcRaid(colonyId) {
  const colony = await Colony.findOne({
    where: { colony_id: colonyId },
    include: [{ model: Planet, as: 'planet' }]
  });
  if (!colony || !colony.surface_initialized) return null;

  // Check raid cooldown
  if (colony.last_raid) {
    const elapsed = Date.now() - new Date(colony.last_raid).getTime();
    if (elapsed < config.groundCombat.npcRaid.raidCooldownMs) return null;
  }

  // Check for active combat
  if (await hasActiveCombat(colonyId)) return null;

  const result = await initiateInvasion(null, colonyId, null, [], true);

  // Update last_raid timestamp
  await colony.update({ last_raid: new Date() });

  // Auto-resolve NPC raid: run combat turns until one side wins
  await autoResolveNpcRaid(result.instance_id);

  return result;
}

/**
 * Auto-resolve an NPC raid by simulating turns.
 * NPC raids have no live attacker — both sides are AI-controlled.
 */
async function autoResolveNpcRaid(instanceId) {
  const maxAutoTurns = config.groundCombat.maxTurns || 30;

  for (let turn = 0; turn < maxAutoTurns; turn++) {
    const transaction = await sequelize.transaction();
    try {
      const instance = await GroundCombatInstance.findOne({
        where: { instance_id: instanceId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!instance || instance.status !== 'active') {
        await transaction.rollback();
        return;
      }

      const combatUnits = await GroundCombatUnit.findAll({
        where: { combat_instance_id: instanceId, status: 'active' },
        transaction
      });

      const attackerUnits = combatUnits.filter(u => u.side === 'attacker');
      const defenderUnits = combatUnits.filter(u => u.side === 'defender');

      if (attackerUnits.length === 0 || defenderUnits.length === 0) {
        const outcome = attackerUnits.length === 0 ? 'defender_won' : 'attacker_won';
        await resolveCombat(instance, outcome, attackerUnits.length === 0 ? 'All attackers eliminated' : 'All defenders eliminated', transaction);
        await transaction.commit();
        return;
      }

      // Get terrain and structures
      const colony = await Colony.findOne({
        where: { colony_id: instance.colony_id },
        include: [{ model: Planet, as: 'planet' }],
        transaction
      });
      const { grid, width, height } = generateTerrain(
        instance.colony_id, colony.planet.planet_id, colony.planet.type, colony.planet.size
      );
      const buildings = await ColonyBuilding.findAll({
        where: { colony_id: instance.colony_id, grid_x: { [Op.ne]: null } },
        transaction
      });
      const blocks = await CustomBlock.findAll({
        where: { colony_id: instance.colony_id },
        transaction
      });

      const turnLog = [];

      // Reset turn flags
      for (const u of combatUnits) {
        await u.update({ has_moved: false, has_attacked: false }, { transaction });
      }

      // NPC attacker AI: aggressive — move toward and attack defenders
      for (const attacker of attackerUnits.filter(u => u.status === 'active')) {
        let nearest = null;
        let nearestDist = Infinity;
        for (const def of defenderUnits.filter(u => u.status === 'active')) {
          const dist = Math.abs(attacker.grid_x - def.grid_x) + Math.abs(attacker.grid_y - def.grid_y);
          if (dist < nearestDist) { nearestDist = dist; nearest = def; }
        }
        if (!nearest) continue;

        if (nearestDist <= attacker.range) {
          const attackResult = processAttack(attacker, nearest, grid, buildings, blocks);
          await nearest.update({ hp_remaining: attackResult.target_hp }, { transaction });
          await attacker.update({ has_attacked: true }, { transaction });
          turnLog.push({ type: 'attack', attacker_id: attacker.id, target_id: nearest.id, damage: attackResult.damage, side: 'attacker' });
          if (attackResult.target_hp <= 0) {
            await nearest.update({ status: 'destroyed' }, { transaction });
            turnLog.push({ type: 'destroyed', unit_id: nearest.id, side: 'defender' });
          }
        } else {
          const moveTarget = moveToward(attacker, nearest.grid_x, nearest.grid_y, attacker.speed, grid, width, height, combatUnits, buildings, blocks);
          if (moveTarget) {
            await attacker.update({ grid_x: moveTarget.x, grid_y: moveTarget.y, has_moved: true }, { transaction });
            turnLog.push({ type: 'move', unit_id: attacker.id, side: 'attacker', to: moveTarget });
          }
        }
      }

      // Defender AI
      const defenderLog = await processDefenderAI(
        instance.defender_policy, defenderUnits, attackerUnits,
        grid, width, height, buildings, blocks, combatUnits, transaction
      );
      turnLog.push(...defenderLog);

      // Turret fire
      const turretLog = await processTurretFire(
        instance.colony_id, attackerUnits, buildings, blocks, grid, transaction
      );
      turnLog.push(...turretLog);

      // Check victory
      const activeAttackers = await GroundCombatUnit.count({
        where: { combat_instance_id: instanceId, side: 'attacker', status: 'active' },
        transaction
      });
      const activeDefenders = await GroundCombatUnit.count({
        where: { combat_instance_id: instanceId, side: 'defender', status: 'active' },
        transaction
      });

      if (activeAttackers === 0) {
        await resolveCombat(instance, 'defender_won', 'All attackers eliminated', transaction, turnLog);
        await transaction.commit();
        return;
      }
      if (activeDefenders === 0) {
        await resolveCombat(instance, 'attacker_won', 'All defenders eliminated', transaction, turnLog);
        await transaction.commit();
        return;
      }

      // Advance turn
      const newLog = [...(instance.combat_log || []), { turn: instance.turn_number, events: turnLog }];
      await instance.update({
        turn_number: instance.turn_number + 1,
        last_turn_at: new Date(),
        combat_log: newLog
      }, { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  // Max turns reached — defender wins by default
  const transaction = await sequelize.transaction();
  try {
    const instance = await GroundCombatInstance.findOne({
      where: { instance_id: instanceId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (instance && instance.status === 'active') {
      await resolveCombat(instance, 'defender_won', 'Maximum turns exceeded (NPC raid)', transaction);
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

module.exports = {
  trainUnit,
  getGarrison,
  setDefensePolicy,
  disbandUnit,
  hasActiveCombat,
  initiateInvasion,
  getCombatState,
  processCombatTurn,
  retreat,
  getCombatHistory,
  triggerNpcRaid
};
