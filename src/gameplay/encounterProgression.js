const EncounterState = Object.freeze({
  PREP: 'prep',
  BATTLE: 'battle',
  REWARD: 'reward',
  GAME_OVER: 'game_over',
  ERROR: 'error'
});

const VALID_TRANSITIONS = Object.freeze({
  [EncounterState.PREP]: [EncounterState.BATTLE, EncounterState.ERROR],
  [EncounterState.BATTLE]: [EncounterState.REWARD, EncounterState.PREP, EncounterState.GAME_OVER, EncounterState.ERROR],
  [EncounterState.REWARD]: [EncounterState.PREP, EncounterState.GAME_OVER, EncounterState.ERROR],
  [EncounterState.GAME_OVER]: [EncounterState.ERROR],
  [EncounterState.ERROR]: [EncounterState.PREP]
});

const DEFAULT_ENCOUNTER_ARCHETYPES = Object.freeze({
  skirmish: {
    id: 'skirmish',
    displayName: 'Vanguard Skirmish',
    enemyCountBase: 3,
    enemyHealthBase: 20,
    enemyAttackBase: 5,
    perRoundHealthScale: 4,
    perRoundAttackScale: 1,
    rewardGoldMultiplier: 1
  },
  swarm: {
    id: 'swarm',
    displayName: 'Swarm Rush',
    enemyCountBase: 5,
    enemyHealthBase: 14,
    enemyAttackBase: 4,
    perRoundHealthScale: 3,
    perRoundAttackScale: 1,
    rewardGoldMultiplier: 1.05
  },
  elite: {
    id: 'elite',
    displayName: 'Elite Patrol',
    enemyCountBase: 2,
    enemyHealthBase: 30,
    enemyAttackBase: 8,
    perRoundHealthScale: 6,
    perRoundAttackScale: 2,
    rewardGoldMultiplier: 1.15
  },
  boss: {
    id: 'boss',
    displayName: 'Crownbreaker Prime',
    enemyCountBase: 1,
    enemyHealthBase: 160,
    enemyAttackBase: 15,
    perRoundHealthScale: 12,
    perRoundAttackScale: 2,
    rewardGoldMultiplier: 0
  }
});

const DEFAULT_ENCOUNTER_SCHEDULE = Object.freeze([
  { round: 1, archetypeId: 'skirmish' },
  { round: 2, archetypeId: 'swarm' },
  { round: 3, archetypeId: 'elite' },
  { round: 4, archetypeId: 'skirmish' },
  { round: 5, archetypeId: 'swarm' },
  { round: 6, archetypeId: 'elite' },
  { round: 7, archetypeId: 'boss' }
]);

function canTransition(from, to) {
  return Boolean(VALID_TRANSITIONS[from] && VALID_TRANSITIONS[from].includes(to));
}

function normalizeEncounterConfig(config) {
  const sourceArchetypes = config?.encounters?.archetypes;
  const sourceSchedule = config?.encounters?.schedule;
  const archetypes = sourceArchetypes && typeof sourceArchetypes === 'object'
    ? sourceArchetypes
    : DEFAULT_ENCOUNTER_ARCHETYPES;
  const schedule = Array.isArray(sourceSchedule) && sourceSchedule.length > 0
    ? sourceSchedule
    : DEFAULT_ENCOUNTER_SCHEDULE;
  return { archetypes, schedule };
}

function getEncounterForRound(config, round) {
  const { archetypes, schedule } = normalizeEncounterConfig(config);
  const entry = schedule.find((item) => Number(item?.round) === Number(round));
  if (!entry) {
    return null;
  }
  const archetypeId = String(entry.archetypeId || '');
  const archetype = archetypes[archetypeId];
  if (!archetype) {
    return null;
  }
  return {
    round: Number(round),
    archetypeId,
    ...archetype
  };
}

function createEncounterMachine(config) {
  const startRound = Number(config?.round?.start ?? 1);
  const startCrownHealth = Number(config?.crown?.startHealth ?? 40);
  const startGold = Number(config?.shop?.startGold ?? 10);
  return {
    state: EncounterState.PREP,
    round: startRound,
    crownHealth: startCrownHealth,
    gold: startGold,
    pendingRewards: null,
    currentEncounter: getEncounterForRound(config, startRound),
    seenBattleIds: {},
    seenRewardIds: {},
    lastError: null,
    runOutcome: null,
    onEntry: 'initializeRun',
    onExit: null
  };
}

function buildVictoryRewards(config, round, encounter) {
  const base = Number(config?.round?.rewardGoldBase ?? 4);
  const perRound = Number(config?.round?.rewardGoldPerRound ?? 1);
  const itemChoices = Math.max(0, Number(config?.rewards?.itemChoicesOnWin ?? 2));
  const itemPool = Array.isArray(config?.rewards?.defaultItemPool) ? config.rewards.defaultItemPool : [];
  const statusChoices = Array.isArray(config?.rewards?.statusEffectChoicesOnWin) ? config.rewards.statusEffectChoicesOnWin : [];
  const goldMultiplier = Number(encounter?.rewardGoldMultiplier ?? 1);

  return {
    rewardGold: Math.floor((base + (perRound * round)) * goldMultiplier),
    itemChoices: itemPool.slice(0, itemChoices),
    statusEffectChoices: statusChoices.slice(),
    encounterId: encounter?.id || null,
    encounterName: encounter?.displayName || null
  };
}

function startBattle(machine, event) {
  if (machine.state !== EncounterState.PREP) {
    return { ...machine, state: EncounterState.ERROR, lastError: 'INVALID_STATE', onEntry: 'emitInvalidTransition', onExit: null };
  }
  const placedUnitCount = Number(event?.placedUnitCount ?? 0);
  if (placedUnitCount <= 0 || machine.crownHealth <= 0 || !machine.currentEncounter) {
    return { ...machine, state: EncounterState.ERROR, lastError: 'FAILED_GUARD', onEntry: 'emitInvalidTransition', onExit: null };
  }
  return { ...machine, state: EncounterState.BATTLE, lastError: null, onEntry: 'startBattleClock', onExit: 'lockShop' };
}

function resolveBattle(machine, config, event) {
  const battleId = String(event?.battleId ?? '');
  if (battleId && machine.seenBattleIds[battleId]) {
    return { ...machine, idempotent: true };
  }
  if (machine.state !== EncounterState.BATTLE) {
    return { ...machine, state: EncounterState.ERROR, lastError: 'INVALID_STATE', onEntry: 'emitInvalidTransition', onExit: null };
  }
  if (!battleId) {
    return { ...machine, state: EncounterState.ERROR, lastError: 'MISSING_BATTLE_ID', onEntry: 'emitInvalidTransition', onExit: null };
  }

  const seenBattleIds = { ...machine.seenBattleIds, [battleId]: true };
  const playerWon = Boolean(event?.playerWon);
  const bossRound = Number(config?.round?.bossRound ?? config?.round?.max ?? 1);
  const encounter = machine.currentEncounter || getEncounterForRound(config, machine.round);

  if (playerWon) {
    const rewards = buildVictoryRewards(config, machine.round, encounter);
    const isBossVictory = machine.round >= bossRound;
    if (isBossVictory) {
      return {
        ...machine,
        state: EncounterState.GAME_OVER,
        seenBattleIds,
        runOutcome: 'cleared',
        pendingRewards: null,
        gold: machine.gold + rewards.rewardGold,
        onEntry: 'emitRunCleared',
        onExit: 'stopBattleClock'
      };
    }
    return {
      ...machine,
      state: EncounterState.REWARD,
      seenBattleIds,
      pendingRewards: rewards,
      gold: machine.gold + rewards.rewardGold,
      onEntry: 'generateRewards',
      onExit: 'stopBattleClock'
    };
  }

  const survivingEnemyCount = Math.max(0, Number(event?.survivingEnemyCount ?? 0));
  const minLossDamage = Number(config?.crown?.minLossDamage ?? 2);
  const lossDamagePerSurvivor = Number(config?.crown?.lossDamagePerSurvivor ?? 2);
  const damage = Math.max(minLossDamage, survivingEnemyCount * lossDamagePerSurvivor);
  const nextCrown = machine.crownHealth - damage;
  if (nextCrown <= 0) {
    return {
      ...machine,
      state: EncounterState.GAME_OVER,
      seenBattleIds,
      crownHealth: 0,
      runOutcome: 'failed',
      onEntry: 'emitRunFailed',
      onExit: 'stopBattleClock'
    };
  }

  return {
    ...machine,
    state: EncounterState.PREP,
    seenBattleIds,
    crownHealth: nextCrown,
    pendingRewards: null,
    onEntry: 'startNextPrep',
    onExit: 'stopBattleClock'
  };
}

function confirmRewards(machine, config, event) {
  if (machine.state !== EncounterState.REWARD) {
    return { ...machine, state: EncounterState.ERROR, lastError: 'INVALID_STATE', onEntry: 'emitInvalidTransition', onExit: null };
  }
  const rewardId = String(event?.rewardId ?? '');
  if (!rewardId) {
    return { ...machine, state: EncounterState.ERROR, lastError: 'MISSING_REWARD_ID', onEntry: 'emitInvalidTransition', onExit: null };
  }
  if (machine.seenRewardIds[rewardId]) {
    return { ...machine, idempotent: true };
  }
  const seenRewardIds = { ...machine.seenRewardIds, [rewardId]: true };
  const nextRound = machine.round + 1;
  const maxRound = Number(config?.round?.max ?? 1);
  if (nextRound > maxRound) {
    return {
      ...machine,
      state: EncounterState.GAME_OVER,
      seenRewardIds,
      pendingRewards: null,
      round: nextRound,
      runOutcome: 'cleared',
      currentEncounter: null,
      onEntry: 'emitRunCleared',
      onExit: 'clearRewardChoices'
    };
  }
  return {
    ...machine,
    state: EncounterState.PREP,
    seenRewardIds,
    pendingRewards: null,
    round: nextRound,
    currentEncounter: getEncounterForRound(config, nextRound),
    onEntry: 'startNextPrep',
    onExit: 'clearRewardChoices'
  };
}

module.exports = {
  EncounterState,
  VALID_TRANSITIONS,
  DEFAULT_ENCOUNTER_ARCHETYPES,
  DEFAULT_ENCOUNTER_SCHEDULE,
  canTransition,
  getEncounterForRound,
  createEncounterMachine,
  startBattle,
  resolveBattle,
  confirmRewards
};
