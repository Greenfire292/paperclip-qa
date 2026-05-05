const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { loadGameplayConfig, deepMerge, DEFAULT_CONFIG } = require('../src/gameplay/config');
const { RoundState, canTransition, transitionRoundState } = require('../src/gameplay/roundStateMachine');
const { accumulateTicks, simulateDuration } = require('../src/gameplay/time');
const { createCombatState, createUnitState } = require('../src/gameplay/combatState');
const {
  PlacementState,
  PlacementErrorCode,
  createPlacementMachine,
  placeUnitOnBench,
  beginDrag,
  resolveDrop,
  buildBattleSnapshot
} = require('../src/gameplay/placementPhase');
const {
  ShopState,
  ShopEvent,
  createShopMachine,
  beginPrepPhase,
  reroll,
  lockShop,
  buy
} = require('../src/gameplay/shopSystem');
const {
  EncounterState,
  canTransition: canTransitionEncounter,
  getEncounterForRound,
  createEncounterMachine,
  startBattle,
  resolveBattle,
  confirmRewards
} = require('../src/gameplay/encounterProgression');
const { createLoopOrchestrator, runLoop } = require('../src/gameplay/coreLoopOrchestrator');

test('config loader falls back to defaults when file missing', () => {
  const cfg = loadGameplayConfig('/tmp/does-not-exist.json');
  assert.equal(cfg.shop.startGold, DEFAULT_CONFIG.shop.startGold);
  assert.equal(cfg.crown.startHealth, DEFAULT_CONFIG.crown.startHealth);
});

test('config loader merges overrides from file', () => {
  const cfg = loadGameplayConfig(path.join(process.cwd(), 'config', 'combat.config.json'));
  assert.equal(cfg.shop.rerollCost, 1);
  assert.equal(cfg.round.max, 7);
});

test('deepMerge handles nested override boundaries', () => {
  const merged = deepMerge({ a: { b: 1, c: 2 } }, { a: { c: 9 } });
  assert.deepEqual(merged, { a: { b: 1, c: 9 } });
});

test('round state machine: valid transition from prep to battle with guards', () => {
  const next = transitionRoundState(
    { state: RoundState.PREP, data: { placedUnitCount: 1, crownHealth: 20 } },
    { type: 'START_BATTLE' }
  );
  assert.equal(next.state, RoundState.BATTLE);
  assert.equal(next.onEntry, 'startBattleClock');
});

test('round state machine: invalid transition falls back to error state', () => {
  const next = transitionRoundState(
    { state: RoundState.PREP, data: { placedUnitCount: 0, crownHealth: 20 } },
    { type: 'START_BATTLE' }
  );
  assert.equal(next.state, RoundState.ERROR);
  assert.equal(next.onEntry, 'emitInvalidTransition');
});

test('transition table is explicit and guards known transition', () => {
  assert.equal(canTransition(RoundState.BATTLE, RoundState.REWARDS), true);
  assert.equal(canTransition(RoundState.REWARDS, RoundState.BATTLE), false);
});

test('combat state schema includes serialization boundary metadata', () => {
  const unit = createUnitState({
    id: 'u1',
    name: 'Squire',
    family: 'Guard',
    boardSlot: 0,
    maxHealth: 36,
    attack: 7,
    attackIntervalSeconds: 1
  });
  const state = createCombatState({
    round: 1,
    crownHealth: 40,
    boardSlots: 12,
    units: [unit],
    configVersion: 'v1'
  });

  assert.equal(state.schemaVersion, 1);
  assert.deepEqual(state.serializationBoundary.saveFields.includes('units'), true);
  assert.deepEqual(state.serializationBoundary.runtimeOnlyFields.includes('elapsedSeconds'), true);
});

test('frame-rate independent tick accumulation is consistent at 30fps and 144fps', () => {
  let acc30 = 0;
  let ticks30 = 0;
  simulateDuration(10, 30, (dt) => {
    const result = accumulateTicks(acc30, dt, 0.5);
    acc30 = result.remainder;
    ticks30 += result.tickCount;
  });

  let acc144 = 0;
  let ticks144 = 0;
  simulateDuration(10, 144, (dt) => {
    const result = accumulateTicks(acc144, dt, 0.5);
    acc144 = result.remainder;
    ticks144 += result.tickCount;
  });

  assert.equal(ticks30, 20);
  assert.equal(ticks144, 20);
});

function testUnit(id, family = 'Guard') {
  return {
    id,
    name: `Unit-${id}`,
    family,
    maxHealth: 30,
    attack: 6,
    attackIntervalSeconds: 1
  };
}

test('placement: invalid drag target returns explicit reason code', () => {
  let machine = createPlacementMachine(DEFAULT_CONFIG);
  machine = placeUnitOnBench(machine, testUnit('a')).machine;

  const drag = beginDrag(machine, { type: 'bench', index: 0 });
  assert.equal(drag.ok, true);

  const dropped = resolveDrop(drag.machine, { type: 'void', index: 0 });
  assert.equal(dropped.ok, false);
  assert.equal(dropped.code, PlacementErrorCode.INVALID_TARGET_TYPE);
  assert.equal(dropped.machine.state, PlacementState.ERROR);
});

test('placement: full bench blocks board->bench move with reason code', () => {
  const cfg = deepMerge(DEFAULT_CONFIG, { shop: { maxBenchSize: 1 }, placement: { boardSlots: 2 } });
  let machine = createPlacementMachine(cfg);

  machine = placeUnitOnBench(machine, testUnit('bench-full')).machine;
  machine.context.board[0] = testUnit('board-unit');

  const drag = beginDrag(machine, { type: 'board', index: 0 });
  const dropped = resolveDrop(drag.machine, { type: 'bench' });

  assert.equal(dropped.ok, false);
  assert.equal(dropped.code, PlacementErrorCode.BENCH_FULL);
  assert.equal(dropped.machine.state, PlacementState.ERROR);
});

test('placement: swap between occupied board cells succeeds deterministically', () => {
  let machine = createPlacementMachine(deepMerge(DEFAULT_CONFIG, { placement: { boardSlots: 3 } }));
  machine.context.board[0] = testUnit('left');
  machine.context.board[1] = testUnit('right');

  const drag = beginDrag(machine, { type: 'board', index: 0 });
  const dropped = resolveDrop(drag.machine, { type: 'board', index: 1 }, { allowSwap: true });

  assert.equal(dropped.ok, true);
  assert.equal(dropped.machine.state, PlacementState.IDLE);
  assert.equal(dropped.machine.context.board[0].id, 'right');
  assert.equal(dropped.machine.context.board[1].id, 'left');
});

test('placement: battle snapshot is ordered by boardSlot and contract-shaped', () => {
  let machine = createPlacementMachine(deepMerge(DEFAULT_CONFIG, { placement: { boardSlots: 4 } }));
  machine.context.board[2] = testUnit('u2', 'Rangers');
  machine.context.board[0] = testUnit('u0', 'Guard');

  const snapshot = buildBattleSnapshot(machine);
  assert.equal(snapshot.boardSlots, 4);
  assert.equal(snapshot.placedUnitCount, 2);
  assert.deepEqual(snapshot.units.map((u) => u.boardSlot), [0, 2]);
  assert.deepEqual(snapshot.units.map((u) => u.id), ['u0', 'u2']);
});

const TEST_CATALOG = [
  { unitId: 'common_1', rarity: 'common', weight: 100, cost: 1 },
  { unitId: 'rare_1', rarity: 'rare', weight: 0, cost: 3 }
];

test('shop: roll respects odds boundary (zero weight never appears)', () => {
  const machine = createShopMachine(DEFAULT_CONFIG, TEST_CATALOG, 9);
  beginPrepPhase(machine);

  assert.equal(machine.shop.length, DEFAULT_CONFIG.shop.rollSize);
  assert.equal(machine.shop.every((item) => item.unitId === 'common_1'), true);
});

test('shop: insufficient funds blocks reroll and emits reject event', () => {
  const machine = createShopMachine(DEFAULT_CONFIG, TEST_CATALOG, 12);
  machine.gold = 0;
  beginPrepPhase(machine);

  const result = reroll(machine, 'tx-reroll-1');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INSUFFICIENT_FUNDS');
  assert.equal(machine.events.some((evt) => evt.type === ShopEvent.REROLL_REJECTED), true);
});

test('shop: transaction ledger prevents duplicate spend ids', () => {
  const machine = createShopMachine(DEFAULT_CONFIG, TEST_CATALOG, 11);
  beginPrepPhase(machine);
  const beforeGold = machine.gold;

  const first = reroll(machine, 'tx-dup-1');
  const second = reroll(machine, 'tx-dup-1');

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.code, 'DUPLICATE_TX');
  assert.equal(machine.gold, beforeGold - DEFAULT_CONFIG.shop.rerollCost);
});

test('shop: lock persists stock into next prep phase', () => {
  const machine = createShopMachine(DEFAULT_CONFIG, TEST_CATALOG, 15);
  beginPrepPhase(machine);
  const firstStockIds = machine.shop.map((item) => item.stockId);

  lockShop(machine, true);
  assert.equal(machine.state, ShopState.PREP_LOCKED);
  beginPrepPhase(machine);
  assert.deepEqual(machine.shop.map((item) => item.stockId), firstStockIds);
});

test('encounter: victory grants config-driven rewards and transitions to reward state', () => {
  let machine = createEncounterMachine(DEFAULT_CONFIG);
  machine = startBattle(machine, { placedUnitCount: 2 });
  machine = resolveBattle(machine, DEFAULT_CONFIG, { battleId: 'b-1', playerWon: true });

  assert.equal(machine.state, EncounterState.REWARD);
  assert.equal(machine.gold, DEFAULT_CONFIG.shop.startGold + DEFAULT_CONFIG.round.rewardGoldBase + DEFAULT_CONFIG.round.rewardGoldPerRound);
  assert.deepEqual(machine.pendingRewards.itemChoices.length, DEFAULT_CONFIG.rewards.itemChoicesOnWin);
});

test('encounter: duplicate battle resolution is idempotent', () => {
  let machine = createEncounterMachine(DEFAULT_CONFIG);
  machine = startBattle(machine, { placedUnitCount: 1 });
  machine = resolveBattle(machine, DEFAULT_CONFIG, { battleId: 'b-dup', playerWon: false, survivingEnemyCount: 2 });
  const afterFirst = { ...machine };
  machine = resolveBattle(machine, DEFAULT_CONFIG, { battleId: 'b-dup', playerWon: false, survivingEnemyCount: 4 });

  assert.equal(machine.idempotent, true);
  assert.equal(machine.crownHealth, afterFirst.crownHealth);
  assert.equal(machine.state, afterFirst.state);
});

test('encounter: partial-loss keeps run alive and subtracts crown by configured formula', () => {
  let machine = createEncounterMachine(DEFAULT_CONFIG);
  machine = startBattle(machine, { placedUnitCount: 1 });
  machine = resolveBattle(machine, DEFAULT_CONFIG, {
    battleId: 'b-partial',
    playerWon: false,
    survivingEnemyCount: 3
  });

  assert.equal(machine.state, EncounterState.PREP);
  assert.equal(machine.crownHealth, DEFAULT_CONFIG.crown.startHealth - (DEFAULT_CONFIG.crown.lossDamagePerSurvivor * 3));
});

test('encounter: defeat transitions to game over fail state', () => {
  const cfg = deepMerge(DEFAULT_CONFIG, { crown: { startHealth: 4, minLossDamage: 2, lossDamagePerSurvivor: 3 } });
  let machine = createEncounterMachine(cfg);
  machine = startBattle(machine, { placedUnitCount: 1 });
  machine = resolveBattle(machine, cfg, {
    battleId: 'b-defeat',
    playerWon: false,
    survivingEnemyCount: 2
  });

  assert.equal(machine.state, EncounterState.GAME_OVER);
  assert.equal(machine.runOutcome, 'failed');
  assert.equal(machine.crownHealth, 0);
});

test('encounter: boss-round victory satisfies boss gate and clears run', () => {
  const cfg = deepMerge(DEFAULT_CONFIG, { round: { start: 4, bossRound: 4, max: 4 } });
  let machine = createEncounterMachine(cfg);
  machine = startBattle(machine, { placedUnitCount: 2 });
  machine = resolveBattle(machine, cfg, { battleId: 'b-boss', playerWon: true });

  assert.equal(machine.state, EncounterState.GAME_OVER);
  assert.equal(machine.runOutcome, 'cleared');
});

test('encounter: schedule exposes 3 archetypes before boss in progression order', () => {
  const order = [1, 2, 3, 4, 5, 6, 7].map((round) => getEncounterForRound(DEFAULT_CONFIG, round).archetypeId);
  assert.deepEqual(order, ['skirmish', 'swarm', 'elite', 'skirmish', 'swarm', 'elite', 'boss']);
});

test('encounter: reward pacing supports six shop decision rounds before boss', () => {
  let machine = createEncounterMachine(DEFAULT_CONFIG);
  let rewardRounds = 0;
  for (let round = 1; round <= 6; round += 1) {
    machine = startBattle(machine, { placedUnitCount: 2 });
    machine = resolveBattle(machine, DEFAULT_CONFIG, { battleId: `b-wave-${round}`, playerWon: true });
    assert.equal(machine.state, EncounterState.REWARD);
    rewardRounds += 1;
    machine = confirmRewards(machine, DEFAULT_CONFIG, { rewardId: `r-wave-${round}` });
    assert.equal(machine.state, EncounterState.PREP);
  }

  machine = startBattle(machine, { placedUnitCount: 2 });
  machine = resolveBattle(machine, DEFAULT_CONFIG, { battleId: 'b-wave-7', playerWon: true });

  assert.equal(rewardRounds, 6);
  assert.equal(machine.state, EncounterState.GAME_OVER);
  assert.equal(machine.runOutcome, 'cleared');
});

test('encounter: reward confirmation advances round and rejects duplicate confirmations', () => {
  let machine = createEncounterMachine(DEFAULT_CONFIG);
  machine = startBattle(machine, { placedUnitCount: 2 });
  machine = resolveBattle(machine, DEFAULT_CONFIG, { battleId: 'b-reward', playerWon: true });
  machine = confirmRewards(machine, DEFAULT_CONFIG, { rewardId: 'r-1' });

  assert.equal(machine.state, EncounterState.PREP);
  assert.equal(machine.round, DEFAULT_CONFIG.round.start + 1);

  machine.state = EncounterState.REWARD;
  machine.pendingRewards = { rewardGold: 1, itemChoices: [], statusEffectChoices: [] };
  machine = confirmRewards(machine, DEFAULT_CONFIG, { rewardId: 'r-1' });
  assert.equal(machine.idempotent, true);
});

test('encounter transition table is explicit', () => {
  assert.equal(canTransitionEncounter(EncounterState.BATTLE, EncounterState.REWARD), true);
  assert.equal(canTransitionEncounter(EncounterState.REWARD, EncounterState.BATTLE), false);
});

test('core loop orchestrator runs at least 3 consecutive encounters', () => {
  const catalog = [
    { unitId: 'frontliner', rarity: 'common', weight: 100, cost: 1 },
    { unitId: 'striker', rarity: 'common', weight: 100, cost: 1 }
  ];
  const loop = createLoopOrchestrator(DEFAULT_CONFIG, {
    catalog,
    maxEncounters: 3,
    enemyFactory: () => [{ id: 'enemy-1', name: 'Dummy', hp: 1, atk: 0 }]
  });

  const result = runLoop(loop);
  assert.equal(result.ok, true);
  assert.equal(result.encountersCompleted, 3);
  assert.equal(result.loop.history.length, 3);
});

test('core loop orchestrator preserves placement->resolver->reward handoff contracts', () => {
  const loop = createLoopOrchestrator(DEFAULT_CONFIG, {
    catalog: [{ unitId: 'frontliner', rarity: 'common', weight: 100, cost: 1 }],
    maxEncounters: 1,
    enemyFactory: () => [{ id: 'enemy-1', name: 'Dummy', hp: 1, atk: 0 }]
  });

  const result = runLoop(loop);
  assert.equal(result.ok, true);
  const first = result.loop.history[0];

  assert.equal(typeof first.placementSnapshot.placedUnitCount, 'number');
  assert.equal(Array.isArray(first.placementSnapshot.units), true);
  assert.equal(typeof first.combatResult.winner, 'string');
  assert.equal(Array.isArray(first.combatResult.events), true);
  assert.equal(first.rewardConfirmed, true);
  assert.equal(['prep', 'game_over'].includes(result.loop.encounterMachine.state), true);
});
