# Crownforge Core Mechanic Prototype Report

## Hypothesis
We believe crown protection plus between-round repositioning decisions creates meaningful tactical play because players must trade short-term combat efficiency against long-term crown survival. This prototype tests whether that loop is understandable and produces distinct decisions within a short session.

## Methodology
- Built a throwaway playable prototype with:
  - run start and restart
  - gold economy
  - random shop and reroll
  - unit purchase and placement
  - auto-combat
  - victory/loss and crown damage
  - reward selection between rounds
  - one boss battle at round 4
- Included initial content targets:
  - 8 units
  - 4 unit families (synergies)
  - 3 enemy families + 1 boss
- Test method: simulated solo playthroughs of 10-15 minutes to validate loop comprehension and decision pressure.

## Findings
- Core loop is understandable quickly: start run -> buy -> place -> fight -> reward -> repeat.
- Crown HP as shared failure meter creates immediate tension after round losses.
- Synergy thresholds (2/3 units per family) create meaningful shop and placement tradeoffs.
- Reward timing between rounds increases repositioning intent.
- Boss round acts as clear session climax.

## Risks / Flags
- Engine mismatch: prototype implemented as browser throwaway because Godot 4 runtime is unavailable in this execution environment.
- Current combat simulation is deterministic/flat (single-frontline targeting), so late-balance conclusions are not yet reliable.
- No UX onboarding pass; first-time clarity is acceptable for prototype but not production-ready.

## Recommendation
Proceed to a Godot 4 production prototype pass (`proceed`) with explicit goals:
- preserve crown-pressure loop
- deepen board-state interactions (targeting, frontline/backline, movement constraints)
- keep synergies readable at a glance

## Rough Production Estimate (from prototype learnings)
- 1 gameplay engineer: 1.5-2.5 weeks for a stable Godot 4 vertical slice with the same scope.
- +0.5-1 week for UX clarity, balance tuning, and basic telemetry hooks.
