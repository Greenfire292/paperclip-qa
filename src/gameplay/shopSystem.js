const ShopState = Object.freeze({
  PREP_OPEN: 'prep_open',
  PREP_LOCKED: 'prep_locked',
  ERROR: 'error'
});

const ShopEvent = Object.freeze({
  SHOP_ROLLED: 'SHOP_ROLLED',
  UNIT_PURCHASED: 'UNIT_PURCHASED',
  SHOP_LOCKED: 'SHOP_LOCKED',
  SHOP_UNLOCKED: 'SHOP_UNLOCKED',
  REROLL_REJECTED: 'REROLL_REJECTED',
  BUY_REJECTED: 'BUY_REJECTED',
  TX_REJECTED_DUPLICATE: 'TX_REJECTED_DUPLICATE'
});

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickByWeight(pool, rng) {
  const total = pool.reduce((sum, item) => sum + Math.max(0, Number(item.weight ?? 0)), 0);
  if (total <= 0) return null;
  let n = rng() * total;
  for (const item of pool) {
    n -= Math.max(0, Number(item.weight ?? 0));
    if (n <= 0) return item;
  }
  return pool[pool.length - 1] || null;
}

function makeUnit(entry, serial) {
  return {
    stockId: `stock-${serial}`,
    unitId: entry.unitId,
    cost: Number(entry.cost ?? 0),
    rarity: entry.rarity || 'common'
  };
}

function createShopMachine(config, catalog, seed = 1) {
  const rollSize = Math.max(1, Number(config?.shop?.rollSize ?? 3));
  const startGold = Math.max(0, Number(config?.shop?.startGold ?? 10));
  const rerollCost = Math.max(0, Number(config?.shop?.rerollCost ?? 1));

  return {
    state: ShopState.PREP_OPEN,
    config: { rollSize, startGold, rerollCost },
    catalog: Array.isArray(catalog) ? catalog.slice() : [],
    gold: startGold,
    shop: [],
    locked: false,
    stockSerial: 0,
    txLedger: {},
    events: [],
    rng: mulberry32(seed >>> 0)
  };
}

function emit(machine, type, payload) {
  machine.events.push({ type, payload: payload || null });
}

function beginPrepPhase(machine) {
  if (machine.locked && machine.shop.length > 0) {
    machine.state = ShopState.PREP_LOCKED;
    return machine;
  }
  machine.state = ShopState.PREP_OPEN;
  machine.shop = [];
  for (let i = 0; i < machine.config.rollSize; i += 1) {
    const picked = pickByWeight(machine.catalog, machine.rng);
    if (!picked) break;
    machine.stockSerial += 1;
    machine.shop.push(makeUnit(picked, machine.stockSerial));
  }
  emit(machine, ShopEvent.SHOP_ROLLED, { stockIds: machine.shop.map((s) => s.stockId) });
  return machine;
}

function applySpend(machine, txId, amount) {
  if (machine.txLedger[txId]) {
    emit(machine, ShopEvent.TX_REJECTED_DUPLICATE, { txId });
    return { ok: false, reason: 'DUPLICATE_TX' };
  }
  if (machine.gold < amount) {
    return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
  }
  machine.gold -= amount;
  machine.txLedger[txId] = { amount, type: 'debit' };
  return { ok: true };
}

function reroll(machine, txId) {
  const spend = applySpend(machine, txId, machine.config.rerollCost);
  if (!spend.ok) {
    emit(machine, ShopEvent.REROLL_REJECTED, { reason: spend.reason });
    return { ok: false, code: spend.reason, machine };
  }
  machine.locked = false;
  beginPrepPhase(machine);
  return { ok: true, machine };
}

function lockShop(machine, isLocked) {
  machine.locked = Boolean(isLocked);
  machine.state = machine.locked ? ShopState.PREP_LOCKED : ShopState.PREP_OPEN;
  emit(machine, machine.locked ? ShopEvent.SHOP_LOCKED : ShopEvent.SHOP_UNLOCKED, null);
  return machine;
}

function buy(machine, stockId, txId) {
  const idx = machine.shop.findIndex((x) => x && x.stockId === stockId);
  if (idx < 0) {
    emit(machine, ShopEvent.BUY_REJECTED, { reason: 'NOT_IN_STOCK', stockId });
    return { ok: false, code: 'NOT_IN_STOCK', machine };
  }
  const stock = machine.shop[idx];
  const spend = applySpend(machine, txId, stock.cost);
  if (!spend.ok) {
    emit(machine, ShopEvent.BUY_REJECTED, { reason: spend.reason, stockId });
    return { ok: false, code: spend.reason, machine };
  }

  machine.shop[idx] = null;
  emit(machine, ShopEvent.UNIT_PURCHASED, { stockId, unitId: stock.unitId, cost: stock.cost });
  return { ok: true, purchased: stock, machine };
}

module.exports = {
  ShopState,
  ShopEvent,
  createShopMachine,
  beginPrepPhase,
  reroll,
  lockShop,
  buy
};
