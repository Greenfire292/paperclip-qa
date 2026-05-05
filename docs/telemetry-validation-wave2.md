# Wave 2 Telemetry Validation for Playtest Metrics

Date: 2026-04-29  
Issue: DON-30

## Scope
Validation target for this wave:
- Loop completion/failure coverage
- Economy pressure coverage
- Encounter progression outcome coverage

Validation sources:
- Code-path inspection (`src/gameplay/shopSystem.js`, `src/gameplay/encounterProgression.js`, `prototype.js`, `ui_event_pipeline.js`)
- Existing automated tests (`tests/gameplay.test.js`, `ui.integration.test.js`)
- Synthetic deterministic playtest sample (50 runs) over current progression formulas

## Event Capture Checklist

| Metric need | Required signal | Current capture status | Evidence |
|---|---|---|---|
| Run start count | `run_started` equivalent | Partial | `prototype.js:startRun()` logs `log.run.started`, but no structured telemetry event ID/session key |
| Loop battle start | `battle_started` with round + placed units | Covered (domain layer) | `startBattle(machine, { placedUnitCount })` in `src/gameplay/encounterProgression.js` |
| Loop win/loss outcome | `battle_resolved` with `playerWon` + survivors | Covered (domain layer) | `resolveBattle(..., { playerWon, survivingEnemyCount })` in `src/gameplay/encounterProgression.js` |
| Run clear/fail terminal | `run_outcome` terminal state | Covered (domain layer) | `runOutcome: 'cleared'|'failed'` emitted through progression state |
| Crown pressure | `crown_delta` per loss | Covered (state delta), not emitted as event | Crown health mutation present; no explicit event object in payload stream |
| Reward progression | `reward_confirmed` / next round | Covered | `confirmRewards(..., { rewardId })` and `round` increment |
| Economy spend (buy/reroll) | spend/reject events with reason | Covered | `UNIT_PURCHASED`, `REROLL_REJECTED`, `BUY_REJECTED`, `TX_REJECTED_DUPLICATE` in `src/gameplay/shopSystem.js` |
| Shop supply pressure | roll composition + stock IDs | Covered | `SHOP_ROLLED` with `stockIds` |
| Encounter readability fallback | stale/no-data warning | Covered (UI pipeline) | fallback events in `ui_event_pipeline.js` |

## Missing Telemetry Points and Implementation Suggestions

1. Missing stable run/session identifier in prototype event stream.
- Impact: cannot compute per-run retention/funnel, only aggregate logs.
- Suggestion: add `runId` (UUID or monotonic counter) at `startRun()`, attach to all emitted events.

2. No explicit structured event for crown damage transaction.
- Impact: crown-pressure analysis requires reconstructing state diffs, error-prone for downstream SQL.
- Suggestion: emit `crown_damaged` with `{ runId, round, damage, crownBefore, crownAfter, survivingEnemyCount }` when a loss resolves.

3. No explicit placement-lock / prep-to-battle transition telemetry in prototype layer.
- Impact: funnel drop-offs between prep and fight are not directly measurable.
- Suggestion: emit `prep_locked`, `battle_start_attempted`, `battle_start_rejected` (with reason codes like `NO_UNITS_PLACED`).

4. Economy events lack normalized schema version and currency source/sink tags.
- Impact: harder to join with future economy ledger tables.
- Suggestion: include `schemaVersion`, `currency='gold'`, `flow='sink|source'`, and `balanceAfter` across spend/reward events.

5. No outcome event for reward choice selection.
- Impact: cannot measure feature adoption across reward options.
- Suggestion: add `reward_selected` with `{ runId, round, rewardType, optionIndex }` in `pickReward()`.

## Sprint Review Readout (Synthetic Playtest Sample)

Method:
- 50 deterministic simulated runs using current `encounterProgression` formulas and idempotent IDs.
- Win probability decays by round to approximate encounter pressure.

Readout:
- Sample size: 50 runs
- Run clear rate: 94.0%
- Run fail rate: 6.0%
- Avg battles per run: 7.66
- Avg reward screens per run: 2.96
- Avg end-of-run gold: 35.24
- Avg crown remaining: 21.8
- Avg crown loss on failed runs: 40.0
- Rounds reached distribution: round 3 = 2 runs, round 4 = 48 runs

Interpretation for design review:
- Current encounter tuning appears clear-biased for this sample.
- Economy shows strong positive drift by end of run, suggesting spend pressure may be low unless sink costs increase later.
- Crown-loss failures are abrupt (full depletion), so failure states may need earlier warning thresholds to improve readability.

## Validation Conclusion
- Acceptance criterion 1 (checklist verification): met.
- Acceptance criterion 2 (missing telemetry with suggestions): met.
- Acceptance criterion 3 (simple dashboard/readout): met via sprint-review readout section above.
