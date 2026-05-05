const PlacementState = Object.freeze({
  IDLE: 'idle',
  DRAGGING: 'dragging',
  RESOLVING: 'resolving',
  ERROR: 'error'
});

const PlacementErrorCode = Object.freeze({
  UNIT_NOT_FOUND: 'UNIT_NOT_FOUND',
  SOURCE_SLOT_EMPTY: 'SOURCE_SLOT_EMPTY',
  SOURCE_BENCH_EMPTY: 'SOURCE_BENCH_EMPTY',
  INVALID_TARGET_TYPE: 'INVALID_TARGET_TYPE',
  INVALID_TARGET_INDEX: 'INVALID_TARGET_INDEX',
  BOARD_SLOT_OCCUPIED: 'BOARD_SLOT_OCCUPIED',
  BENCH_FULL: 'BENCH_FULL',
  INVALID_STATE: 'INVALID_STATE'
});

const VALID_TRANSITIONS = Object.freeze({
  [PlacementState.IDLE]: [PlacementState.DRAGGING, PlacementState.ERROR],
  [PlacementState.DRAGGING]: [PlacementState.RESOLVING, PlacementState.ERROR],
  [PlacementState.RESOLVING]: [PlacementState.IDLE, PlacementState.ERROR],
  [PlacementState.ERROR]: [PlacementState.IDLE]
});

function createPlacementContext(config) {
  const boardSlots = Number(config?.placement?.boardSlots ?? config?.board?.slots ?? 12);
  const maxBenchSize = Number(config?.shop?.maxBenchSize ?? 8);

  return {
    boardSlots,
    maxBenchSize,
    board: Array(boardSlots).fill(null),
    bench: [],
    drag: null,
    lastError: null,
    onEntry: null,
    onExit: null
  };
}

function canTransition(from, to) {
  return VALID_TRANSITIONS[from] && VALID_TRANSITIONS[from].includes(to);
}

function transition(machine, to, actions) {
  if (!canTransition(machine.state, to)) {
    return {
      ...machine,
      state: PlacementState.ERROR,
      context: {
        ...machine.context,
        lastError: PlacementErrorCode.INVALID_STATE,
        onExit: machine.context.onExit,
        onEntry: 'emitInvalidPlacementTransition'
      }
    };
  }

  return {
    ...machine,
    state: to,
    context: {
      ...machine.context,
      onExit: actions.onExit,
      onEntry: actions.onEntry
    }
  };
}

function createPlacementMachine(config) {
  return {
    state: PlacementState.IDLE,
    context: createPlacementContext(config)
  };
}

function placeUnitOnBench(machine, unit) {
  if (machine.context.bench.length >= machine.context.maxBenchSize) {
    return { ok: false, code: PlacementErrorCode.BENCH_FULL, machine };
  }

  const nextContext = {
    ...machine.context,
    bench: machine.context.bench.concat([{ ...unit }]),
    lastError: null
  };

  return { ok: true, code: null, machine: { ...machine, context: nextContext } };
}

function beginDrag(machine, source) {
  if (machine.state !== PlacementState.IDLE) {
    return { ok: false, code: PlacementErrorCode.INVALID_STATE, machine: transition(machine, PlacementState.ERROR, { onEntry: 'emitInvalidPlacementTransition', onExit: null }) };
  }

  const next = transition(machine, PlacementState.DRAGGING, { onEntry: 'captureDragSource', onExit: 'unlockInput' });
  const ctx = next.context;

  if (source.type === 'board') {
    if (source.index < 0 || source.index >= ctx.boardSlots) {
      return { ok: false, code: PlacementErrorCode.INVALID_TARGET_INDEX, machine: { ...next, state: PlacementState.ERROR, context: { ...ctx, lastError: PlacementErrorCode.INVALID_TARGET_INDEX } } };
    }
    if (!ctx.board[source.index]) {
      return { ok: false, code: PlacementErrorCode.SOURCE_SLOT_EMPTY, machine: { ...next, state: PlacementState.ERROR, context: { ...ctx, lastError: PlacementErrorCode.SOURCE_SLOT_EMPTY } } };
    }
  } else if (source.type === 'bench') {
    if (source.index < 0 || source.index >= ctx.bench.length) {
      return { ok: false, code: PlacementErrorCode.SOURCE_BENCH_EMPTY, machine: { ...next, state: PlacementState.ERROR, context: { ...ctx, lastError: PlacementErrorCode.SOURCE_BENCH_EMPTY } } };
    }
  } else {
    return { ok: false, code: PlacementErrorCode.INVALID_TARGET_TYPE, machine: { ...next, state: PlacementState.ERROR, context: { ...ctx, lastError: PlacementErrorCode.INVALID_TARGET_TYPE } } };
  }

  return {
    ok: true,
    code: null,
    machine: {
      ...next,
      context: {
        ...ctx,
        drag: source,
        lastError: null
      }
    }
  };
}

function removeFromSource(context, source) {
  if (source.type === 'board') {
    const unit = context.board[source.index];
    const board = context.board.slice();
    board[source.index] = null;
    return { unit, board, bench: context.bench.slice() };
  }

  const bench = context.bench.slice();
  const unit = bench.splice(source.index, 1)[0];
  return { unit, board: context.board.slice(), bench };
}

function resolveDrop(machine, target, options = { allowSwap: true }) {
  if (machine.state !== PlacementState.DRAGGING || !machine.context.drag) {
    return { ok: false, code: PlacementErrorCode.INVALID_STATE, machine: transition(machine, PlacementState.ERROR, { onEntry: 'emitInvalidPlacementTransition', onExit: null }) };
  }

  const resolving = transition(machine, PlacementState.RESOLVING, { onEntry: 'resolveDrop', onExit: 'clearDragSource' });
  const ctx = resolving.context;
  const source = ctx.drag;

  if (target.type !== 'board' && target.type !== 'bench' && target.type !== 'sell') {
    return { ok: false, code: PlacementErrorCode.INVALID_TARGET_TYPE, machine: { ...resolving, state: PlacementState.ERROR, context: { ...ctx, lastError: PlacementErrorCode.INVALID_TARGET_TYPE } } };
  }

  if (target.type === 'board' && (target.index < 0 || target.index >= ctx.boardSlots)) {
    return { ok: false, code: PlacementErrorCode.INVALID_TARGET_INDEX, machine: { ...resolving, state: PlacementState.ERROR, context: { ...ctx, lastError: PlacementErrorCode.INVALID_TARGET_INDEX } } };
  }

  const extracted = removeFromSource(ctx, source);
  if (!extracted.unit) {
    return { ok: false, code: PlacementErrorCode.UNIT_NOT_FOUND, machine: { ...resolving, state: PlacementState.ERROR, context: { ...ctx, lastError: PlacementErrorCode.UNIT_NOT_FOUND } } };
  }

  let { board, bench } = extracted;

  if (target.type === 'board') {
    if (board[target.index]) {
      if (!options.allowSwap) {
        return { ok: false, code: PlacementErrorCode.BOARD_SLOT_OCCUPIED, machine: { ...resolving, state: PlacementState.ERROR, context: { ...ctx, lastError: PlacementErrorCode.BOARD_SLOT_OCCUPIED } } };
      }
      const displaced = board[target.index];
      board[target.index] = extracted.unit;
      if (source.type === 'board') {
        board[source.index] = displaced;
      } else {
        if (bench.length >= ctx.maxBenchSize) {
          return { ok: false, code: PlacementErrorCode.BENCH_FULL, machine: { ...resolving, state: PlacementState.ERROR, context: { ...ctx, lastError: PlacementErrorCode.BENCH_FULL } } };
        }
        bench.push(displaced);
      }
    } else {
      board[target.index] = extracted.unit;
    }
  }

  if (target.type === 'bench') {
    if (bench.length >= ctx.maxBenchSize) {
      return { ok: false, code: PlacementErrorCode.BENCH_FULL, machine: { ...resolving, state: PlacementState.ERROR, context: { ...ctx, lastError: PlacementErrorCode.BENCH_FULL } } };
    }
    bench.push(extracted.unit);
  }

  const idle = transition(
    { ...resolving, context: { ...ctx, board, bench, drag: null, lastError: null } },
    PlacementState.IDLE,
    { onEntry: 'emitPlacementUpdated', onExit: 'clearResolution' }
  );

  return { ok: true, code: null, machine: idle };
}

function clearPlacementError(machine) {
  if (machine.state !== PlacementState.ERROR) return machine;
  return transition(
    {
      ...machine,
      context: {
        ...machine.context,
        drag: null,
        lastError: null
      }
    },
    PlacementState.IDLE,
    { onEntry: 'clearPlacementError', onExit: 'clearErrorState' }
  );
}

function buildBattleSnapshot(machine) {
  const units = machine.context.board
    .map((unit, index) => {
      if (!unit) return null;
      return {
        id: unit.id,
        name: unit.name,
        family: unit.family,
        boardSlot: index,
        maxHealth: unit.maxHealth,
        attack: unit.attack,
        attackIntervalSeconds: unit.attackIntervalSeconds
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.boardSlot - b.boardSlot);

  return {
    boardSlots: machine.context.boardSlots,
    placedUnitCount: units.length,
    units
  };
}

module.exports = {
  PlacementState,
  PlacementErrorCode,
  VALID_TRANSITIONS,
  createPlacementMachine,
  placeUnitOnBench,
  beginDrag,
  resolveDrop,
  clearPlacementError,
  buildBattleSnapshot,
  canTransition
};
