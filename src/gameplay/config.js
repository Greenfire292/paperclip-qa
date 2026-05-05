const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  round: {
    start: 1,
    max: 7,
    rewardGoldBase: 4,
    rewardGoldPerRound: 1,
    bossRound: 7
  },
  crown: {
    startHealth: 40,
    minLossDamage: 2,
    lossDamagePerSurvivor: 2
  },
  shop: {
    startGold: 10,
    maxBenchSize: 8,
    rollSize: 3,
    rerollCost: 1
  },
  placement: {
    boardSlots: 12
  },
  synergy: {
    tier2: { threshold: 2, attackBonus: 2, healthBonus: 4 },
    tier3: { threshold: 3, attackBonus: 3, healthBonus: 6 }
  },
  timing: {
    turnDurationSeconds: 0.25,
    maxBattleSeconds: 20,
    statusTickIntervalSeconds: 0.5
  },
  rewards: {
    itemChoicesOnWin: 2,
    defaultItemPool: ['minor_potion', 'iron_scrap'],
    statusEffectChoicesOnWin: ['none']
  },
  encounters: {
    archetypes: {
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
    },
    schedule: [
      { round: 1, archetypeId: 'skirmish' },
      { round: 2, archetypeId: 'swarm' },
      { round: 3, archetypeId: 'elite' },
      { round: 4, archetypeId: 'skirmish' },
      { round: 5, archetypeId: 'swarm' },
      { round: 6, archetypeId: 'elite' },
      { round: 7, archetypeId: 'boss' }
    ]
  }
};

function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return base;
  if (!base || typeof base !== 'object') return override;

  const output = Array.isArray(base) ? base.slice() : { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && output[key] && typeof output[key] === 'object') {
      output[key] = deepMerge(output[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function loadGameplayConfig(configPath = path.join(process.cwd(), 'config', 'combat.config.json')) {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return deepMerge(DEFAULT_CONFIG, parsed);
  } catch (_error) {
    return { ...DEFAULT_CONFIG };
  }
}

module.exports = {
  DEFAULT_CONFIG,
  loadGameplayConfig,
  deepMerge
};
