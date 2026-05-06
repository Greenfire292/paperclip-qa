(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RuntimeAdapter = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WINDOWS_DESKTOP_RUNTIME = 'windows-desktop';

  function unsupportedRuntimeMessage(runtimeId) {
    return 'Unsupported runtime "' + runtimeId + '". Only "' + WINDOWS_DESKTOP_RUNTIME + '" is enabled in this milestone.';
  }

  function assertDomElement(dom, id) {
    if (!dom || typeof dom.getElementById !== 'function') {
      throw new Error('Runtime adapter requires a DOM document with getElementById for startup/input initialization.');
    }
    var node = dom.getElementById(id);
    if (!node) {
      throw new Error('Runtime adapter could not bind input action for missing element id: ' + id);
    }
    return node;
  }

  function createWindowsDesktopAdapter(dependencies) {
    var deps = dependencies || {};
    var dom = deps.dom;
    var storage = deps.storage;

    return {
      runtimeId: WINDOWS_DESKTOP_RUNTIME,
      lifecycle: {
        onBoot: function onBoot(bootFn) {
          if (typeof bootFn !== 'function') {
            throw new Error('lifecycle.onBoot requires a callback function.');
          }
          bootFn();
        }
      },
      input: {
        bindClick: function bindClick(elementId, handler) {
          var node = assertDomElement(dom, elementId);
          node.onclick = handler;
        }
      },
      storage: {
        resolveSaveRoot: function resolveSaveRoot() {
          var key = 'donchitos.saveRoot';
          if (storage && typeof storage.getItem === 'function') {
            var existing = storage.getItem(key);
            if (existing) return existing;
            var defaultRoot = 'C:\\Users\\Player\\AppData\\Local\\Donchitos\\Saves';
            if (typeof storage.setItem === 'function') {
              storage.setItem(key, defaultRoot);
            }
            return defaultRoot;
          }
          return 'C:\\Users\\Player\\AppData\\Local\\Donchitos\\Saves';
        }
      }
    };
  }

  function createRuntimeAdapter(options) {
    var opts = options || {};
    var runtimeId = opts.runtimeId || WINDOWS_DESKTOP_RUNTIME;

    if (runtimeId !== WINDOWS_DESKTOP_RUNTIME) {
      var err = new Error(unsupportedRuntimeMessage(runtimeId));
      err.code = 'UNSUPPORTED_RUNTIME';
      throw err;
    }

    return createWindowsDesktopAdapter(opts.dependencies);
  }

  return {
    WINDOWS_DESKTOP_RUNTIME: WINDOWS_DESKTOP_RUNTIME,
    createRuntimeAdapter: createRuntimeAdapter,
    unsupportedRuntimeMessage: unsupportedRuntimeMessage
  };
});
