// ---------------------------------------------------------------------------
// session-store.js — Pure Session Storage Abstraction
// ---------------------------------------------------------------------------
// Isolates all direct sessionStorage access behind a clean, testable class.
// This module has zero dependencies — it only talks to the Web Storage API.
//
// Exports (default):
//   SessionStore
// ---------------------------------------------------------------------------

/** Storage key used in sessionStorage. */
const STORAGE_KEY = 'currentUser';

/**
 * Pure abstraction over `sessionStorage` for user session data.
 *
 * **Single Responsibility:** Read / write / clear the currently authenticated
 * user from `sessionStorage`.  No Supabase calls, no UI logic.
 *
 * Designed for constructor-based DI — the container can register this class
 * directly without any factory wrapper.
 */
export default class SessionStore {
  // -----------------------------------------------------------------------
  // Public read methods
  // -----------------------------------------------------------------------

  /**
   * Retrieve the stored user object (parsed from JSON) or `null` when there
   * is no active session.
   *
   * @returns {object|null} The user object with at least `email`, `name`, and
   *                        `role` properties, or `null`.
   */
  getUser() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      // Corrupted data — treat as not authenticated and clean up.
      this.clearUser();
      return null;
    }
  }

  /**
   * Persist a user object to sessionStorage as JSON.
   *
   * @param {object} user - An object with at least `email`, `name`, and
   *                        `role` properties.
   */
  setUser(user) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  /**
   * Remove the user object from sessionStorage (sign-out).
   */
  clearUser() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  // -----------------------------------------------------------------------
  // Derived convenience methods
  // -----------------------------------------------------------------------

  /**
   * Whether a user is currently stored (i.e. an active session exists).
   *
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.getUser() !== null;
  }

  /**
   * Whether the stored user has the `"admin"` role.
   *
   * @returns {boolean}
   */
  isAdmin() {
    const user = this.getUser();
    return user !== null && user.role === 'admin';
  }

  /**
   * Return a human-readable display name for the current user.
   *
   * Resolution order:
   *   1. `user.name` (if truthy)
   *   2. The portion of `user.email` before the `@` sign
   *   3. The literal string `"Guest"` when no user is stored
   *
   * @returns {string}
   */
  getDisplayName() {
    const user = this.getUser();
    if (!user) return 'Guest';

    if (user.name && user.name.trim().length > 0) {
      return user.name.trim();
    }

    if (user.email && user.email.includes('@')) {
      return user.email.split('@')[0];
    }

    return 'Guest';
  }
}
