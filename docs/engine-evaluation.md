# Engine Evaluation and Recommendation (Prototype Scope)

## Scope Constraints
- 2D only
- Windows PC target
- Single-player only
- Offline only (no backend)
- Fast iteration over long-term flexibility
- Placeholder art acceptable

## Comparison Matrix

| Criteria | Godot 4 | Unity | Unreal Engine 5 |
|---|---|---|---|
| 2D workflow fit | Native 2D scene/node pipeline; fast setup | Strong 2D support, but project overhead is higher | Primarily 3D-first workflow; 2D feasible but heavier |
| Team iteration speed | Very high for prototype loops | High, but editor/package complexity can slow setup | Moderate to low for this scope due to engine weight |
| Windows PC deployment | Straightforward exports | Mature deployment pipeline | Mature deployment pipeline |
| Performance requirements (2D) | Easily meets likely budget if scoped cleanly | Easily meets likely budget if scoped cleanly | Meets requirements, but with unnecessary overhead |
| Asset/content pipeline | Simple folder/scene flow; low ceremony | Flexible but can become process-heavy quickly | Powerful, but excessive for placeholder-heavy prototype |
| Ecosystem/community | Strong and growing; sufficient for prototype needs | Very large ecosystem and tooling marketplace | Large ecosystem, strongest for high-end 3D use cases |
| Technical risk for this prototype | Low | Medium (tooling/process bloat risk) | High (overengineering/perf/tooling overhead risk) |

## Recommendation
Use **Godot 4** for this prototype.

### Why This Is the Best Fit
- Matches the 2D-only requirement without 3D-first complexity.
- Maximizes iteration speed for gameplay and content tests.
- Keeps project setup and maintenance lean for a small-scope, offline, single-player target.
- Supports readable, modular code and data-driven authoring with minimal pipeline overhead.
- Aligns with directive to avoid reopening engine selection unless a severe blocker appears.

## Technical Principles for Prototype

### 1) Modular Code
- Separate systems by responsibility: combat, economy, progression, UI, content loading.
- Keep gameplay logic in reusable components/services, not monolithic scene scripts.
- Prefer explicit interfaces/signals between systems over deep node coupling.

### 2) Readable Implementation
- Consistent naming and folder conventions by feature domain.
- Small scripts with single responsibility; avoid “god objects”.
- Lightweight coding standards: linting, basic unit checks where practical.

### 3) Simple Content Pipeline
- Author content as plain data resources (or JSON where appropriate), loaded by thin runtime adapters.
- Keep placeholder asset import rules minimal and deterministic.
- Avoid custom toolchains until a recurring pain point is measured.

### 4) Data-Driven Units and Synergies (Practical Scope)
- Define units and synergy effects in data tables/resources.
- Implement a validation pass at load time to catch bad references/values.
- Reserve scripting extensions for exceptional behavior only.

## Initial Project Setup Plan
1. Create base Godot 4 project structure by domain (`scenes`, `scripts`, `data`, `ui`, `assets`).
2. Implement bootstrap loop with deterministic game-state container.
3. Add content schema for units/synergies and loader/validator.
4. Build one vertical slice: draft, combat resolution, post-round rewards.
5. Add lightweight profiling checkpoints (CPU frame time and memory snapshots).
6. Lock scope gates before adding any advanced systems.

## Technical Risks and Overengineering Avoidance

### Risk: Architecture bloat too early
- Mitigation: enforce vertical-slice-first delivery; no generic frameworks without concrete reuse.

### Risk: Data model complexity exceeds prototype needs
- Mitigation: start with minimal schema and version only when a real migration need appears.

### Risk: Premature optimization
- Mitigation: set practical budgets and profile only hotspots observed in playtests.

### Risk: Tooling/process drag
- Mitigation: keep CI and editor tooling minimal until team size or defect rate justifies expansion.

## Engine Re-evaluation Trigger (Severe Blocker Only)
Reopen engine choice only if one of these occurs:
- Reproducible blocker with no viable workaround in acceptable timeframe.
- Platform requirement changes beyond Windows PC 2D prototype scope.
- Measured performance/capability gap that materially blocks milestone delivery.
