(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.UIEventPipeline = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normalizeCombatEvent(event, index, nowMs, lastTs) {
    var safeEvent = event || {};
    var timestamp = typeof safeEvent.ts === 'number' ? safeEvent.ts : nowMs + index;
    var late = typeof lastTs === 'number' && timestamp < lastTs;

    return {
      type: safeEvent.type || 'unknown',
      message: safeEvent.message || 'hud.event.unknown',
      payload: safeEvent.payload || null,
      ts: timestamp,
      late: late
    };
  }

  function processCombatEvents(events, nowMs) {
    if (!Array.isArray(events) || events.length === 0) {
      return [{
        type: 'fallback',
        message: 'hud.events.fallback.no_data',
        payload: null,
        ts: nowMs,
        late: false
      }];
    }

    var normalized = [];
    for (var i = 0; i < events.length; i += 1) {
      var item = normalizeCombatEvent(events[i], i, nowMs, null);
      normalized.push(item);
    }

    normalized.sort(function (a, b) { return a.ts - b.ts; });
    var lastTs = null;
    for (var j = 0; j < normalized.length; j += 1) {
      var event = normalized[j];
      event.late = typeof lastTs === 'number' && event.ts < lastTs;
      lastTs = event.ts;
    }

    // Add a synthetic warning event when combat telemetry appears stale.
    // This keeps UI readable when burst processing lands with large gaps.
    var newestTs = normalized[normalized.length - 1].ts;
    if (nowMs - newestTs > 2000) {
      normalized.push({
        type: 'fallback',
        message: 'hud.events.fallback.delayed',
        payload: { delayMs: nowMs - newestTs },
        ts: nowMs,
        late: false
      });
    }

    return normalized;
  }

  function computeSynergyCounts(boardUnits) {
    var counts = {};
    var units = Array.isArray(boardUnits) ? boardUnits : [];
    for (var i = 0; i < units.length; i += 1) {
      var unit = units[i];
      if (!unit || !unit.fam) continue;
      counts[unit.fam] = (counts[unit.fam] || 0) + 1;
    }
    return counts;
  }

  function buildHudViewModel(gameState) {
    var state = gameState || {};
    var board = Array.isArray(state.board) ? state.board.filter(Boolean) : [];

    var phase = 'hud.phase.prep';
    if (state.inCombat) {
      phase = 'hud.phase.battle';
    } else if (Array.isArray(state.rewards) && state.rewards.length > 0) {
      phase = 'hud.phase.rewards';
    } else if (state.run && state.shopOpen === false) {
      phase = 'hud.phase.transition';
    }

    return {
      gold: typeof state.gold === 'number' ? state.gold : 0,
      crownHealth: typeof state.crown === 'number' ? state.crown : 0,
      round: typeof state.round === 'number' ? state.round : 0,
      roundPhase: phase,
      shopState: state.shopOpen ? 'hud.shop.open' : 'hud.shop.closed',
      synergy: computeSynergyCounts(board)
    };
  }

  return {
    normalizeCombatEvent: normalizeCombatEvent,
    processCombatEvents: processCombatEvents,
    computeSynergyCounts: computeSynergyCounts,
    buildHudViewModel: buildHudViewModel
  };
});
