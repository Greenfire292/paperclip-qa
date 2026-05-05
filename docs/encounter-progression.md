# Encounter Progression and Reward Loop

Issue: [DON-25](/DON/issues/DON-25)

## Module
`src/gameplay/encounterProgression.js`

## Purpose
Controls the `prep -> battle -> reward` gameplay loop, including:
- deterministic encounter progression per round
- post-battle reward generation
- crown damage and fail-state progression
- boss-round gate and run clear
- idempotent handling of duplicate battle/reward events

## Config-Driven Tunables
All tunable values come from `config/combat.config.json` via `loadGameplayConfig()`.
Fallback defaults are provided in `DEFAULT_CONFIG`.

Values consumed:
- `round.start`
- `round.max`
- `round.bossRound`
- `round.rewardGoldBase`
- `round.rewardGoldPerRound`
- `crown.startHealth`
- `crown.minLossDamage`
- `crown.lossDamagePerSurvivor`
- `shop.startGold`
- `rewards.itemChoicesOnWin`
- `rewards.defaultItemPool`
- `rewards.statusEffectChoicesOnWin`
- `encounters.archetypes.*`
- `encounters.schedule[]`

## Encounter Content Pack v1
Three non-boss archetypes and one boss are data-defined in config:
- `skirmish`: balanced baseline encounter
- `swarm`: high-count lower-stat pressure encounter
- `elite`: low-count high-stat duel encounter
- `boss`: single tuned boss (`Crownbreaker Prime`)

Default deterministic schedule for progression order:
- round 1: `skirmish`
- round 2: `swarm`
- round 3: `elite`
- round 4: `skirmish`
- round 5: `swarm`
- round 6: `elite`
- round 7: `boss`

This yields six reward/shop decision cycles before the boss.

## State Machine
State enum:
- `prep`
- `battle`
- `reward`
- `game_over`
- `error` (fallback)

Valid transitions:
- `prep -> battle | error`
- `battle -> reward | prep | game_over | error`
- `reward -> prep | game_over | error`
- `game_over -> error`
- `error -> prep`

## Transition Guards and Actions
`START_BATTLE`:
- Guards: `placedUnitCount > 0`, `crownHealth > 0`, and encounter exists for the round
- Exit action: `lockShop`
- Entry action: `startBattleClock`

`BATTLE_RESOLVED` (win):
- Guard: valid `battleId`, state `battle`
- Reward generated from config and encounter reward multiplier
- Non-boss: `battle -> reward` with `generateRewards`
- Boss round: `battle -> game_over` with `emitRunCleared`

`BATTLE_RESOLVED` (loss):
- Crown damage formula:
  `max(crown.minLossDamage, survivingEnemyCount * crown.lossDamagePerSurvivor)`
- If crown <= 0: `battle -> game_over` with `emitRunFailed`
- Else: `battle -> prep` with `startNextPrep`

`REWARD_CONFIRMED`:
- Guard: valid `rewardId`, state `reward`
- If next round exceeds `round.max`: `reward -> game_over` with `emitRunCleared`
- Else: `reward -> prep`, increment round, and load next scheduled encounter

## Idempotency and Safety
- Duplicate `battleId` is ignored without mutating machine state.
- Duplicate `rewardId` is ignored without mutating machine state.
- Unexpected state/event combinations transition to `error`.

This keeps round progression safe for retried network/event delivery.

## Tests
Covered in `tests/gameplay.test.js`:
- reward output and transition from config values
- duplicate battle idempotency
- partial-loss crown damage and continuation
- defeat fail-state transition
- boss-round clear-state transition
- reward confirmation round advancement and duplicate rejection
- deterministic encounter schedule order (`skirmish/swarm/elite/.../boss`)
- six-round reward pacing before boss clear
- explicit transition table checks
