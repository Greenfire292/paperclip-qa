# Combat AI Edge-Case Log

## Scope
Wave 2 sanity pass for `DON-26` covering target selection stability, no-target handling, and rapid KO trigger chains.

## Verified Cases
- `REPRO-TARGET-TIE-001`: target tie on HP resolves by `highest_atk`, then `spawn_order`.
- `REPRO-NO-TARGET-001`: empty ally/enemy side exits safely with `combat_end` and no step damage events.
- `REPRO-RAPID-KO-001`: chained `on_death_damage` trigger sequences resolve deterministically.
- `REPRO-DUP-KO-001`: each unit now emits at most one `unit_ko` event even when multiple trigger hits land after lethal damage.
- `REPRO-DETERMINISM-001`: repeated seeded runs preserve identical event streams and winner outcome.

## Open Defects
- `OPEN-MAXSTEPS-DRAW-001`: when `maxSteps` is reached with both sides alive, winner remains `draw` without timeout metadata.
  - Status: open by design for prototype scope.
  - Suggested follow-up: emit `combat_timeout` event for analytics and balancing diagnostics.
