const assert = require('assert');
const { resolveCombat } = require('../combatResolver');

function run(name, fn) {
  try {
    fn();
    console.log('PASS', name);
  } catch (err) {
    console.error('FAIL', name);
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

run('deterministic output with same seed and board state', () => {
  const input = {
    seed: 42,
    allies: [{ id: 'a1', name: 'A1', hp: 20, atk: 7 }, { id: 'a2', name: 'A2', hp: 20, atk: 6 }],
    enemies: [{ id: 'e1', name: 'E1', hp: 18, atk: 5 }, { id: 'e2', name: 'E2', hp: 18, atk: 5 }],
  };
  const a = resolveCombat(input);
  const b = resolveCombat(input);
  assert.deepStrictEqual(a.events, b.events);
  assert.strictEqual(a.winner, b.winner);
});

run('determinism stress check is stable across repeated seeded runs', () => {
  const input = {
    seed: 99,
    allies: [
      { id: 'a1', hp: 18, atk: 6, speed: 2 },
      { id: 'a2', hp: 12, atk: 8, speed: 3, trigger: { type: 'on_death_damage', amount: 2 } },
      { id: 'a3', hp: 25, atk: 3, speed: 1 },
    ],
    enemies: [
      { id: 'e1', hp: 19, atk: 7, speed: 3 },
      { id: 'e2', hp: 10, atk: 4, speed: 1, trigger: { type: 'on_death_damage', amount: 1 } },
      { id: 'e3', hp: 15, atk: 5, speed: 2 },
    ],
  };

  const baseline = resolveCombat(input);
  for (let i = 0; i < 25; i++) {
    const runResult = resolveCombat(input);
    assert.deepStrictEqual(runResult.events, baseline.events);
    assert.strictEqual(runResult.winner, baseline.winner);
  }
});

run('simultaneous KO produces draw when both final units die same step', () => {
  const result = resolveCombat({
    seed: 7,
    allies: [{ id: 'a1', name: 'A1', hp: 10, atk: 10 }],
    enemies: [{ id: 'e1', name: 'E1', hp: 10, atk: 10 }],
  });
  assert.strictEqual(result.winner, 'draw');
  const koEvents = result.events.filter((e) => e.type === 'unit_ko');
  assert.strictEqual(koEvents.length >= 2, true);
});

run('no-target combat input exits cleanly with enemy win and combat_end only', () => {
  const result = resolveCombat({
    seed: 5,
    allies: [],
    enemies: [{ id: 'e1', hp: 12, atk: 3 }],
  });

  assert.strictEqual(result.winner, 'enemy');
  assert.strictEqual(result.events.length, 1);
  assert.strictEqual(result.events[0].type, 'combat_end');
});

run('target tie breaks by highest_atk then spawn_order', () => {
  const result = resolveCombat({
    seed: 11,
    params: { maxSteps: 1 },
    allies: [{ id: 'a1', hp: 10, atk: 3, speed: 1 }],
    enemies: [
      { id: 'e1', hp: 10, atk: 4, speed: 1 },
      { id: 'e2', hp: 10, atk: 7, speed: 1 },
    ],
  });

  const allyDamage = result.events.find((e) => e.type === 'damage' && e.sourceId === 'a1');
  assert.strictEqual(allyDamage.targetId, 'e2');
});

run('trigger order is stable by team then spawn order', () => {
  const result = resolveCombat({
    seed: 1,
    allies: [
      { id: 'a1', name: 'A1', hp: 1, atk: 0, trigger: { type: 'on_death_damage', amount: 1 } },
      { id: 'a2', name: 'A2', hp: 1, atk: 0, trigger: { type: 'on_death_damage', amount: 1 } },
    ],
    enemies: [
      { id: 'e1', name: 'E1', hp: 1, atk: 2 },
      { id: 'e2', name: 'E2', hp: 1, atk: 2 },
    ],
  });

  const fired = result.events.filter((e) => e.type === 'trigger_fired').map((e) => e.sourceId);
  assert.deepStrictEqual(fired.slice(0, 2), ['a1', 'a2']);
});

run('rapid KO trigger chain does not duplicate unit_ko events', () => {
  const result = resolveCombat({
    seed: 3,
    params: { maxSteps: 1 },
    allies: [
      { id: 'a1', hp: 1, atk: 0, trigger: { type: 'on_death_damage', amount: 2 } },
      { id: 'a2', hp: 1, atk: 0, trigger: { type: 'on_death_damage', amount: 2 } },
    ],
    enemies: [
      { id: 'e1', hp: 1, atk: 5, trigger: { type: 'on_death_damage', amount: 2 } },
      { id: 'e2', hp: 3, atk: 5 },
    ],
  });

  const koCounts = new Map();
  result.events
    .filter((e) => e.type === 'unit_ko')
    .forEach((e) => koCounts.set(e.unitId, (koCounts.get(e.unitId) || 0) + 1));

  for (const count of koCounts.values()) {
    assert.strictEqual(count, 1);
  }
});
