(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CombatResolver = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = {
    maxSteps: 80,
    targetPriority: ['lowest_hp', 'highest_atk', 'spawn_order'],
    initiative: ['speed', 'spawn_order'],
    seed: 1,
  };

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function rand() {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function stableCompare(a, b, rules) {
    for (const rule of rules) {
      if (rule === 'speed') {
        const av = a.speed == null ? 1 : a.speed;
        const bv = b.speed == null ? 1 : b.speed;
        if (av !== bv) return bv - av;
      }
      if (rule === 'lowest_hp') {
        if (a.hp !== b.hp) return a.hp - b.hp;
      }
      if (rule === 'highest_atk') {
        if (a.atk !== b.atk) return b.atk - a.atk;
      }
      if (rule === 'spawn_order') {
        if (a.spawnOrder !== b.spawnOrder) return a.spawnOrder - b.spawnOrder;
      }
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }

  function alive(units) {
    return units.filter((u) => u.hp > 0);
  }

  function normalize(units, team) {
    return units.map((u, i) => ({
      id: u.id || (team + '_' + i),
      name: u.name || (team + ' Unit ' + i),
      team,
      hp: u.hp,
      maxHp: u.maxHp == null ? u.hp : u.maxHp,
      atk: u.atk,
      speed: u.speed == null ? 1 : u.speed,
      fam: u.fam || null,
      trigger: u.trigger || null,
      spawnOrder: i,
    }));
  }

  function emit(events, type, payload) {
    events.push(Object.assign({ type }, payload));
  }

  function pickActor(teamUnits, ptr, initiativeRules) {
    const living = alive(teamUnits).slice().sort((a, b) => stableCompare(a, b, initiativeRules));
    if (!living.length) return [null, ptr];
    return [living[ptr % living.length], ptr + 1];
  }

  function pickTarget(candidates, rules) {
    return alive(candidates).slice().sort((a, b) => stableCompare(a, b, rules))[0] || null;
  }

  function markUnitKo(unit, step, events, by, via) {
    if (unit.hp > 0 || unit.deadAtStep) return false;
    unit.deadAtStep = step;
    emit(events, 'unit_ko', { step, unitId: unit.id, by, via });
    return true;
  }

  function collectNewDeaths(units, step, events, by, via) {
    const deaths = [];
    for (const unit of units) {
      if (markUnitKo(unit, step, events, by, via)) {
        deaths.push(unit);
      }
    }
    return deaths;
  }

  function processTriggers(initialDeaths, allies, enemies, events, step) {
    const pending = initialDeaths.slice();

    while (pending.length > 0) {
      const ordered = pending.splice(0).sort((a, b) => {
        if (a.team !== b.team) return a.team === 'ally' ? -1 : 1;
        return a.spawnOrder - b.spawnOrder;
      });

      for (const unit of ordered) {
        const enemyTeam = unit.team === 'ally' ? enemies : allies;
        if (unit.trigger && unit.trigger.type === 'on_death_damage' && unit.trigger.amount > 0) {
          const target = pickTarget(enemyTeam, ['lowest_hp', 'spawn_order']);
          if (!target) continue;
          target.hp -= unit.trigger.amount;
          emit(events, 'trigger_fired', {
            step,
            sourceId: unit.id,
            targetId: target.id,
            amount: unit.trigger.amount,
            triggerType: unit.trigger.type,
          });
          if (markUnitKo(target, step, events, unit.id, 'trigger')) {
            pending.push(target);
          }
        }
      }
    }
  }

  function resolveCombat(input) {
    const cfg = Object.assign({}, DEFAULTS, input && input.params ? input.params : {});
    const rng = mulberry32(input && input.seed != null ? input.seed : cfg.seed);
    const events = [];
    const allies = normalize((input && input.allies) || [], 'ally');
    const enemies = normalize((input && input.enemies) || [], 'enemy');
    let aPtr = 0;
    let ePtr = 0;

    for (let step = 1; step <= cfg.maxSteps; step++) {
      const aAlive = alive(allies);
      const eAlive = alive(enemies);
      if (!aAlive.length || !eAlive.length) break;

      const [aActor, nextAPtr] = pickActor(allies, aPtr, cfg.initiative);
      const [eActor, nextEPtr] = pickActor(enemies, ePtr, cfg.initiative);
      aPtr = nextAPtr;
      ePtr = nextEPtr;
      if (!aActor || !eActor) break;

      const aTarget = pickTarget(enemies, cfg.targetPriority);
      const eTarget = pickTarget(allies, cfg.targetPriority);
      if (!aTarget || !eTarget) break;

      emit(events, 'step_start', { step, allyActorId: aActor.id, enemyActorId: eActor.id });

      const jitterA = Math.floor(rng() * 1);
      const jitterE = Math.floor(rng() * 1);
      const aDmg = aActor.atk + jitterA;
      const eDmg = eActor.atk + jitterE;

      aTarget.hp -= aDmg;
      eTarget.hp -= eDmg;

      emit(events, 'damage', { step, sourceId: aActor.id, targetId: aTarget.id, amount: aDmg });
      emit(events, 'damage', { step, sourceId: eActor.id, targetId: eTarget.id, amount: eDmg });

      const deaths = collectNewDeaths(allies.concat(enemies), step, events, 'combat', 'damage');
      processTriggers(deaths, allies, enemies, events, step);
    }

    const allyAlive = alive(allies).length;
    const enemyAlive = alive(enemies).length;
    let winner = 'draw';
    if (allyAlive > 0 && enemyAlive === 0) winner = 'ally';
    if (enemyAlive > 0 && allyAlive === 0) winner = 'enemy';

    emit(events, 'combat_end', { winner, allyAlive, enemyAlive });

    return {
      winner,
      allies,
      enemies,
      events,
      seed: input && input.seed != null ? input.seed : cfg.seed,
    };
  }

  return { resolveCombat, DEFAULTS };
}));
