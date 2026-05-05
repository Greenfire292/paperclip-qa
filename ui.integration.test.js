const assert = require('assert');
const pipeline = require('./ui_event_pipeline');

function testNoDataFallback() {
  const now = 1000;
  const result = pipeline.processCombatEvents([], now);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].type, 'fallback');
  assert.strictEqual(result[0].message, 'hud.events.fallback.no_data');
  assert.strictEqual(result[0].ts, now);
}

function testRapidBurstOrdering() {
  const now = 2000;
  const burst = [];
  for (let i = 0; i < 100; i += 1) {
    burst.push({ type: 'hit', message: 'log.hit', ts: now + (100 - i) });
  }
  const result = pipeline.processCombatEvents(burst, now);
  assert.strictEqual(result.length, 100);
  for (let i = 1; i < result.length; i += 1) {
    assert.ok(result[i - 1].ts <= result[i].ts, 'events must be sorted by timestamp');
  }
}

function testDelayedEventsFallback() {
  const now = 12000;
  const events = [{ type: 'hit', message: 'log.hit', ts: 7000 }];
  const result = pipeline.processCombatEvents(events, now);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[1].type, 'fallback');
  assert.strictEqual(result[1].message, 'hud.events.fallback.delayed');
}

function testHudViewModelNoData() {
  const vm = pipeline.buildHudViewModel({});
  assert.strictEqual(vm.gold, 0);
  assert.strictEqual(vm.crownHealth, 0);
  assert.strictEqual(vm.round, 0);
  assert.strictEqual(vm.roundPhase, 'hud.phase.prep');
  assert.strictEqual(vm.shopState, 'hud.shop.closed');
}

function testHudViewModelRoundPhases() {
  const rewardsVm = pipeline.buildHudViewModel({
    run: true,
    inCombat: false,
    shopOpen: false,
    rewards: [{ id: 1 }]
  });
  assert.strictEqual(rewardsVm.roundPhase, 'hud.phase.rewards');

  const transitionVm = pipeline.buildHudViewModel({
    run: true,
    inCombat: false,
    shopOpen: false,
    rewards: []
  });
  assert.strictEqual(transitionVm.roundPhase, 'hud.phase.transition');
}

function run() {
  testNoDataFallback();
  testRapidBurstOrdering();
  testDelayedEventsFallback();
  testHudViewModelNoData();
  testHudViewModelRoundPhases();
  console.log('ui.integration.test.js: all tests passed');
}

run();
