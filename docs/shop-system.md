# Shop System Implementation

## Purpose
Implements prep-phase shop generation, reroll, lock persistence, purchase stock consumption, and deterministic gold transactions.

## Module
`src/gameplay/shopSystem.js`

## Tunable Inputs (Config)
- `shop.startGold`
- `shop.rollSize`
- `shop.rerollCost`

If config values are missing, defaults come from `DEFAULT_CONFIG` in `src/gameplay/config.js`.

## State Machine
States:
- `prep_open`
- `prep_locked`
- `error` (fallback)

Valid transitions:
- `prep_open -> prep_open`: `beginPrepPhase` roll or successful reroll
- `prep_open -> prep_locked`: `lockShop(true)`
- `prep_locked -> prep_locked`: `beginPrepPhase` while locked with non-empty stock
- `prep_locked -> prep_open`: `lockShop(false)` or successful reroll
- `* -> error`: reserved for unexpected integration failures

Entry/exit actions:
- Entry `prep_open`: generate stock and emit `SHOP_ROLLED`
- Entry `prep_locked`: preserve prior stock
- Exit `prep_locked`: unlock event emission via `SHOP_UNLOCKED`

## Transaction Safety
All spends require `txId` and are written to `txLedger`.

Guards:
- Reject duplicate `txId` with `DUPLICATE_TX`
- Reject insufficient gold with `INSUFFICIENT_FUNDS`

Effects:
- Reroll: debits `rerollCost` once, rolls fresh stock
- Buy: debits unit cost once, consumes the stock slot (`null`)

## Events for UI/Analytics
- `SHOP_ROLLED`
- `UNIT_PURCHASED`
- `SHOP_LOCKED`
- `SHOP_UNLOCKED`
- `REROLL_REJECTED`
- `BUY_REJECTED`
- `TX_REJECTED_DUPLICATE`

## Tests
Covered in `tests/gameplay.test.js`:
- reroll odds boundary (zero-weight entry never rolls)
- insufficient funds reroll rejection
- duplicate transaction rejection
- lock persistence between prep phases
