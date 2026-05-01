// ---------------------------------------------------------------------------
// event-bus.js — Simple pub/sub Event Bus
// ---------------------------------------------------------------------------
// Decouples application modules by allowing them to communicate through
// named events without direct references to one another.
//
// Exports (named): on, off, emit, once, AUTH_CHANGED, AUTH_SIGNED_IN,
// AUTH_SIGNED_OUT, NAV_UPDATE, ERROR
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Event name constants
// ---------------------------------------------------------------------------

/** Fired whenever the auth state transitions (sign-in *or* sign-out). */
export const AUTH_CHANGED = 'auth:changed';

/** Fired specifically after a successful sign-in. */
export const AUTH_SIGNED_IN = 'auth:signedIn';

/** Fired specifically after a sign-out. */
export const AUTH_SIGNED_OUT = 'auth:signedOut';

/** Fired when the active navigation / route should update. */
export const NAV_UPDATE = 'nav:update';

/** Fired for application-level errors (e.g. unhandled promise rejections). */
export const ERROR = 'app:error';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/**
 * Map of event name → array of listener objects.
 * Each listener object: { callback: Function, once: boolean }
 *
 * Using a plain object as the backing store keeps the implementation
 * dependency-free and straightforward.
 *
 * @type {Object<string, Array<{ callback: Function, once: boolean }>>}
 */
const listeners = {};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Subscribe to an event.  The callback will be invoked every time the event
 * is emitted until it is unsubscribed via {@link off}.
 *
 * @param {string}   eventName - Name of the event (use exported constants).
 * @param {Function} callback  - Function called with `(data)` when the event
 *                               is emitted.
 * @returns {Function} An unsubscribe function that calls {@link off} with the
 *                     same arguments.  Convenient for direct teardown.
 *
 * @example
 * const unsub = on(AUTH_SIGNED_IN, (user) => console.log(user));
 * // later...
 * unsub();
 */
export function on(eventName, callback) {
  ensureArray(eventName);
  listeners[eventName].push({ callback, once: false });
  return () => off(eventName, callback);
}

/**
 * Subscribe to an event for **one** emission only.  After the first
 * invocation the listener is automatically unsubscribed.
 *
 * @param {string}   eventName - Name of the event.
 * @param {Function} callback  - Function called with `(data)` once.
 * @returns {Function} An unsubscribe function (can be used to manually
 *                     remove the listener before it fires).
 */
export function once(eventName, callback) {
  ensureArray(eventName);
  listeners[eventName].push({ callback, once: true });
  return () => off(eventName, callback);
}

/**
 * Unsubscribe a previously registered listener.
 *
 * If called with a callback that was registered multiple times, **all**
 * matching registrations are removed.  If called with no callback, **all**
 * listeners for the event are cleared.
 *
 * @param {string}   eventName - Name of the event.
 * @param {Function} [callback] - The specific callback to remove.  If
 *                                omitted, every listener for `eventName` is
 *                                removed.
 */
export function off(eventName, callback) {
  if (!listeners[eventName]) return;

  if (!callback) {
    // Remove all listeners for this event
    delete listeners[eventName];
    return;
  }

  listeners[eventName] = listeners[eventName].filter(
    (entry) => entry.callback !== callback,
  );

  // Clean up empty arrays to avoid leaking memory
  if (listeners[eventName].length === 0) {
    delete listeners[eventName];
  }
}

/**
 * Emit (publish) an event, invoking every registered listener with the
 * provided data.  Listeners are invoked synchronously in registration order.
 *
 * "Once" listeners are automatically removed after invocation.  Errors thrown
 * inside individual listeners are caught and logged to `console.error` so
 * that one faulty listener does not prevent the remaining listeners from
 * executing.
 *
 * @param {string} eventName - Name of the event.
 * @param {*}      [data]    - Payload passed to each callback.
 *
 * @example
 * emit(AUTH_SIGNED_IN, { id: 1, email: '...' });
 */
export function emit(eventName, data) {
  const entries = listeners[eventName];
  if (!entries || entries.length === 0) return;

  // Iterate in reverse so we can safely remove "once" entries via splice
  // without disturbing the indices of entries we still need to process.
  for (let i = entries.length - 1; i >= 0; i--) {
    const { callback, once } = entries[i];

    try {
      callback(data);
    } catch (err) {
      console.error(
        `[EventBus] Error in listener for "${eventName}":`,
        err,
      );
    }

    if (once) {
      entries.splice(i, 1);
    }
  }

  // Clean up if all entries were "once" listeners
  if (entries.length === 0) {
    delete listeners[eventName];
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Ensure an array exists for the given event name in the `listeners` map.
 *
 * @param {string} eventName
 */
function ensureArray(eventName) {
  if (!listeners[eventName]) {
    listeners[eventName] = [];
  }
}
