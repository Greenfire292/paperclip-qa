const test = require('node:test');
const assert = require('node:assert/strict');
const runtimeAdapter = require('../runtime_adapter');

test('selects windows desktop runtime adapter by default', () => {
  const storage = new Map();
  const adapter = runtimeAdapter.createRuntimeAdapter({
    dependencies: {
      dom: {
        getElementById(id) {
          return { id, onclick: null };
        }
      },
      storage: {
        getItem(key) {
          return storage.has(key) ? storage.get(key) : null;
        },
        setItem(key, value) {
          storage.set(key, value);
        }
      }
    }
  });

  assert.equal(adapter.runtimeId, runtimeAdapter.WINDOWS_DESKTOP_RUNTIME);
  assert.equal(adapter.storage.resolveSaveRoot().includes('Donchitos\\Saves'), true);
});

test('fails fast for unsupported runtime ids', () => {
  assert.throws(
    () => runtimeAdapter.createRuntimeAdapter({ runtimeId: 'mobile-ios' }),
    (err) => {
      assert.equal(err.code, 'UNSUPPORTED_RUNTIME');
      assert.match(err.message, /Unsupported runtime "mobile-ios"/);
      return true;
    }
  );
});
