function stepCooldown(cooldownSeconds, deltaSeconds) {
  return Math.max(0, cooldownSeconds - deltaSeconds);
}

function accumulateTicks(accumulatorSeconds, deltaSeconds, intervalSeconds) {
  let total = accumulatorSeconds + deltaSeconds;
  let tickCount = 0;
  while (total + 1e-9 >= intervalSeconds) {
    tickCount += 1;
    total -= intervalSeconds;
  }
  return { tickCount, remainder: total };
}

function simulateDuration(totalSeconds, frameRate, onStep) {
  const dt = 1 / frameRate;
  let elapsed = 0;
  while (elapsed < totalSeconds) {
    const nextStep = Math.min(dt, totalSeconds - elapsed);
    onStep(nextStep);
    elapsed += nextStep;
  }
}

module.exports = {
  stepCooldown,
  accumulateTicks,
  simulateDuration
};
