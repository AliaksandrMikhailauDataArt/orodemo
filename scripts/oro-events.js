/**
 * Lightweight event bus for cross-block communication.
 * Replaces @dropins/tools/event-bus.js.
 */

const listeners = {};
const lastPayloads = {};

/**
 * Subscribe to an event.
 * @param {string} name - Event name
 * @param {Function} cb - Callback
 * @param {Object} [options]
 * @param {boolean} [options.eager] - If true and a payload was already emitted, fire immediately
 * @returns {{ off: Function }} Unsubscribe handle
 */
export function on(name, cb, options = {}) {
  if (!listeners[name]) listeners[name] = [];
  listeners[name].push(cb);

  if (options.eager && name in lastPayloads) {
    try { cb(lastPayloads[name]); } catch (_) { /* noop */ }
  }

  return {
    off() {
      const arr = listeners[name];
      if (!arr) return;
      const idx = arr.indexOf(cb);
      if (idx !== -1) arr.splice(idx, 1);
    },
  };
}

/**
 * Emit an event with a payload.
 * @param {string} name - Event name
 * @param {*} payload - Data to pass to listeners
 */
export function emit(name, payload) {
  lastPayloads[name] = payload;
  const arr = listeners[name];
  if (!arr) return;
  arr.forEach((cb) => {
    try { cb(payload); } catch (_) { /* noop */ }
  });
}

/**
 * Get the last emitted payload for an event.
 * @param {string} name - Event name
 * @returns {*} Last payload or undefined
 */
export function lastPayload(name) {
  return lastPayloads[name];
}

export const events = { on, emit, lastPayload };
