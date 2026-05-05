function createUnitState(unitConfig) {
  return {
    id: unitConfig.id,
    name: unitConfig.name,
    family: unitConfig.family,
    boardSlot: unitConfig.boardSlot,
    maxHealth: unitConfig.maxHealth,
    health: unitConfig.maxHealth,
    attack: unitConfig.attack,
    attackIntervalSeconds: unitConfig.attackIntervalSeconds,
    attackCooldownSeconds: 0,
    statusEffects: []
  };
}

function createCombatState({ round, crownHealth, boardSlots, units, configVersion }) {
  return {
    schemaVersion: 1,
    configVersion: configVersion || 'default',
    round,
    crownHealth,
    elapsedSeconds: 0,
    boardSlots,
    units,
    rewards: [],
    serializationBoundary: {
      saveFields: ['schemaVersion', 'configVersion', 'round', 'crownHealth', 'units', 'boardSlots'],
      runtimeOnlyFields: ['elapsedSeconds']
    }
  };
}

module.exports = {
  createUnitState,
  createCombatState
};
