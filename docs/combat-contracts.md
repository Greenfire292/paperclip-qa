# Combat Contracts and Round State Model

Issue: [DON-15](/DON/issues/DON-15)

## Scope
This document defines gameplay-domain contracts for combat state, round lifecycle, and cross-system interfaces used by shop, placement, auto-battle, and UI.

## Tunable Configuration Source
All tunable gameplay values are loaded from `config/combat.config.json` via `loadGameplayConfig()` in `src/gameplay/config.js`.
If config loading fails, defaults from `DEFAULT_CONFIG` are used so runtime remains bootable.

## Combat State Schema
Primary schema factory: `createCombatState()` in `src/gameplay/combatState.js`.

Required fields:
- `schemaVersion`: integer contract version for save/load compatibility.
- `configVersion`: source config tag.
- `round`: current round index.
- `crownHealth`: run fail meter.
- `boardSlots`: capacity for placement validation.
- `units[]`: normalized unit state objects.
- `rewards[]`: reward options produced after successful rounds.

Unit schema factory: `createUnitState()`.

Required fields:
- `id`, `name`, `family`, `boardSlot`
- `maxHealth`, `health`, `attack`
- `attackIntervalSeconds`, `attackCooldownSeconds`
- `statusEffects[]`

## Round Lifecycle State Machine
State enum: `RoundState` in `src/gameplay/roundStateMachine.js`.

States:
- `prep`
- `battle`
- `rewards`
- `game_over`
- `error` (fallback state)

Valid transitions (explicit):
- `prep -> battle | game_over | error`
- `battle -> rewards | game_over | error`
- `rewards -> prep | game_over | error`
- `game_over -> error`
- `error -> prep`

Guard examples:
- `prep -> battle` requires `placedUnitCount > 0` and `crownHealth > 0`.
- `battle -> game_over` on loss where `crownHealthAfterLoss <= 0`.
- `rewards -> game_over` when `nextRound > maxRounds`.

Entry and exit actions are emitted per transition as event strings (`onEntry`, `onExit`) for adapter layers to consume.

## Frame-Rate Independence Contract
Time-dependent helpers in `src/gameplay/time.js` consume `deltaSeconds` and never assume fixed FPS.

Contract points:
- cooldown and tick systems advance by `deltaSeconds`.
- simulation helper `simulateDuration()` verifies equivalent outcomes at 30fps and 144fps.

## Serialization Boundary
Persist only deterministic gameplay fields from `serializationBoundary.saveFields`.
Do not persist runtime accumulator data in `runtimeOnlyFields`.

Save-safe fields include:
- run identity/versioning
- round/crown state
- board + unit state

Runtime-only fields include:
- elapsed/tick accumulators
- temporary transition action outputs

## System Interface Contracts
- Shop system consumes: `shop` config, bench capacity, currency updates.
- Placement system consumes: `boardSlots`, `units[].boardSlot`, transition guard inputs.
- Auto-battle consumes: unit combat stats + timing config.
- UI system consumes: `RoundState`, transition actions, reward payload.

No engine-specific APIs are referenced in gameplay-domain contracts.

## Placement Phase State Machine
Module: `src/gameplay/placementPhase.js`.

State enum:
- `idle`
- `dragging`
- `resolving`
- `error` (fallback state)

Valid transitions:
- `idle -> dragging | error`
- `dragging -> resolving | error`
- `resolving -> idle | error`
- `error -> idle`

Guard conditions:
- drag start requires valid source type (`board|bench`) and populated source cell/index.
- board drops require `target.index` within `[0, boardSlots)`.
- board-occupied drop requires swap enabled or emits `BOARD_SLOT_OCCUPIED`.
- bench destination requires `bench.length < maxBenchSize`.

Entry/exit actions are emitted on transition:
- entry examples: `captureDragSource`, `resolveDrop`, `emitPlacementUpdated`, `emitInvalidPlacementTransition`.
- exit examples: `unlockInput`, `clearDragSource`, `clearResolution`, `clearErrorState`.

Error reason codes:
- `UNIT_NOT_FOUND`
- `SOURCE_SLOT_EMPTY`
- `SOURCE_BENCH_EMPTY`
- `INVALID_TARGET_TYPE`
- `INVALID_TARGET_INDEX`
- `BOARD_SLOT_OCCUPIED`
- `BENCH_FULL`
- `INVALID_STATE`

Battle handoff contract:
- `buildBattleSnapshot()` emits deterministic snapshot: `{ boardSlots, placedUnitCount, units[] }`
- `units[]` is sorted by `boardSlot` to guarantee stable combat input ordering.
