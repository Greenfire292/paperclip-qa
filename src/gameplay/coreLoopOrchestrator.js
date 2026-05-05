const { createEncounterMachine, startBattle, resolveBattle, confirmRewards, EncounterState } = require('./encounterProgression');
const { createPlacementMachine, placeUnitOnBench, buildBattleSnapshot } = require('./placementPhase');
const { createShopMachine, beginPrepPhase, lockShop } = require('./shopSystem');
const { resolveCombat } = require('../../combatResolver');

function createUnitFromCatalog(entry, idSuffix) {
  return {
    id: `${entry.unitId}-${idSuffix}`,
    name: entry.unitId,
    family: entry.rarity || 'common',
    maxHealth: 20,
    attack: 8,
    attackIntervalSeconds: 1
  };
}

function createLoopOrchestrator(config, options = {}) {
  const catalog = Array.isArray(options.catalog) ? options.catalog : [];
  const seed = Number(options.seed ?? 1);
  const maxEncounters = Number(options.maxEncounters ?? 3);
  const enemyFactory = typeof options.enemyFactory === 'function'
    ? options.enemyFactory
    : ((round) => [{ id: `enemy-${round}-1`, name: 'Enemy', hp: 8 + round, atk: 2 }]);

  let placementMachine = createPlacementMachine(config);
  const encounterMachine = createEncounterMachine(config);
  const shopMachine = createShopMachine(config, catalog, seed);
  beginPrepPhase(shopMachine);

  let autoUnitSerial = 0;
  const targetPlacements = Math.min(2, placementMachine.context.boardSlots, placementMachine.context.maxBenchSize);
  for (let i = 0; i < targetPlacements; i += 1) {
    const firstStock = shopMachine.shop[i] || shopMachine.shop.find(Boolean);
    if (!firstStock) break;
    autoUnitSerial += 1;
    const unit = createUnitFromCatalog(firstStock, autoUnitSerial);
    const placementResult = placeUnitOnBench(placementMachine, unit);
    placementMachine = placementResult.machine;
    const openSlot = placementMachine.context.board.findIndex((value) => value === null);
    if (openSlot >= 0) {
      placementMachine.context.board[openSlot] = placementMachine.context.bench.shift();
    }
  }

  return {
    config,
    maxEncounters,
    encounterMachine,
    placementMachine,
    shopMachine,
    history: [],
    battleSerial: 0,
    rewardSerial: 0,
    enemyFactory
  };
}

function stepEncounter(loop) {
  const prepSnapshot = buildBattleSnapshot(loop.placementMachine);
  const startState = startBattle(loop.encounterMachine, { placedUnitCount: prepSnapshot.placedUnitCount });
  if (startState.state === EncounterState.ERROR) {
    return { ok: false, code: 'START_BATTLE_FAILED', machine: startState };
  }

  lockShop(loop.shopMachine, true);
  loop.battleSerial += 1;
  const enemies = loop.enemyFactory(startState.round);
  const allies = prepSnapshot.units.map((u) => ({
    id: u.id,
    name: u.name,
    hp: u.maxHealth,
    maxHp: u.maxHealth,
    atk: u.attack
  }));
  const combatResult = resolveCombat({
    seed: loop.battleSerial,
    allies,
    enemies
  });

  const survivingEnemyCount = combatResult.enemies.filter((unit) => unit.hp > 0).length;
  let nextState = resolveBattle(startState, loop.config, {
    battleId: `battle-${loop.battleSerial}`,
    playerWon: combatResult.winner === 'ally',
    survivingEnemyCount
  });

  const record = {
    round: startState.round,
    placementSnapshot: prepSnapshot,
    combatResult,
    postBattleState: nextState.state
  };

  if (nextState.state === EncounterState.REWARD) {
    loop.rewardSerial += 1;
    nextState = confirmRewards(nextState, loop.config, { rewardId: `reward-${loop.rewardSerial}` });
    record.rewardConfirmed = true;
    record.postRewardState = nextState.state;
  }

  loop.encounterMachine = nextState;
  loop.history.push(record);
  lockShop(loop.shopMachine, loop.encounterMachine.state === EncounterState.BATTLE);

  return { ok: true, machine: loop.encounterMachine, record };
}

function runLoop(loop) {
  let encountersCompleted = 0;
  while (encountersCompleted < loop.maxEncounters && loop.encounterMachine.state !== EncounterState.GAME_OVER && loop.encounterMachine.state !== EncounterState.ERROR) {
    const step = stepEncounter(loop);
    if (!step.ok) return { ok: false, reason: step.code, loop };
    encountersCompleted += 1;
  }
  return {
    ok: loop.encounterMachine.state !== EncounterState.ERROR,
    encountersCompleted,
    finalState: loop.encounterMachine.state,
    runOutcome: loop.encounterMachine.runOutcome,
    loop
  };
}

module.exports = {
  createLoopOrchestrator,
  stepEncounter,
  runLoop
};
