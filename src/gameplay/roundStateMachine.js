const RoundState = Object.freeze({
  PREP: 'prep',
  BATTLE: 'battle',
  REWARDS: 'rewards',
  GAME_OVER: 'game_over',
  ERROR: 'error'
});

const VALID_TRANSITIONS = Object.freeze({
  [RoundState.PREP]: [RoundState.BATTLE, RoundState.GAME_OVER, RoundState.ERROR],
  [RoundState.BATTLE]: [RoundState.REWARDS, RoundState.GAME_OVER, RoundState.ERROR],
  [RoundState.REWARDS]: [RoundState.PREP, RoundState.GAME_OVER, RoundState.ERROR],
  [RoundState.GAME_OVER]: [RoundState.ERROR],
  [RoundState.ERROR]: [RoundState.PREP]
});

function canTransition(from, to) {
  return VALID_TRANSITIONS[from] && VALID_TRANSITIONS[from].includes(to);
}

function transitionRoundState(machine, event) {
  const { state, data } = machine;
  const next = { ...machine, lastEvent: event.type };

  switch (state) {
    case RoundState.PREP:
      if (event.type === 'START_BATTLE' && data.placedUnitCount > 0 && data.crownHealth > 0) {
        return { ...next, state: RoundState.BATTLE, onExit: 'lockShop', onEntry: 'startBattleClock' };
      }
      break;
    case RoundState.BATTLE:
      if (event.type === 'BATTLE_RESOLVED' && event.playerWon === true) {
        return { ...next, state: RoundState.REWARDS, onExit: 'stopBattleClock', onEntry: 'generateRewards' };
      }
      if (event.type === 'BATTLE_RESOLVED' && event.playerWon === false && event.crownHealthAfterLoss <= 0) {
        return { ...next, state: RoundState.GAME_OVER, onExit: 'stopBattleClock', onEntry: 'emitRunFailed' };
      }
      if (event.type === 'BATTLE_RESOLVED' && event.playerWon === false && event.crownHealthAfterLoss > 0) {
        return { ...next, state: RoundState.PREP, onExit: 'stopBattleClock', onEntry: 'startNextPrep' };
      }
      break;
    case RoundState.REWARDS:
      if (event.type === 'REWARD_CONFIRMED' && event.nextRound <= event.maxRounds) {
        return { ...next, state: RoundState.PREP, onExit: 'clearRewardChoices', onEntry: 'startNextPrep' };
      }
      if (event.type === 'REWARD_CONFIRMED' && event.nextRound > event.maxRounds) {
        return { ...next, state: RoundState.GAME_OVER, onExit: 'clearRewardChoices', onEntry: 'emitRunCleared' };
      }
      break;
    case RoundState.GAME_OVER:
      if (event.type === 'RESET_RUN') {
        return { ...next, state: RoundState.PREP, onExit: 'clearRunSummary', onEntry: 'initializeRun' };
      }
      break;
    case RoundState.ERROR:
      if (event.type === 'RESET_RUN') {
        return { ...next, state: RoundState.PREP, onExit: 'clearError', onEntry: 'initializeRun' };
      }
      break;
    default:
      break;
  }

  return { ...next, state: RoundState.ERROR, onEntry: 'emitInvalidTransition' };
}

module.exports = {
  RoundState,
  VALID_TRANSITIONS,
  canTransition,
  transitionRoundState
};
