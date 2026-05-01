// ---------------------------------------------------------------------------
// router.js — Router Service (DIP-compliant navigation abstraction)
// ---------------------------------------------------------------------------
// The ONLY place in the codebase that touches `window.location` and
// `window.history`.  All other modules depend on this abstraction so the
// app is decoupled from the browser's global navigation APIs.
//
// Exports (default): Router
// ---------------------------------------------------------------------------

/**
 * Encapsulates all browser navigation concerns behind a plain API.
 *
 * **Dependency Inversion Principle:**
 * High‑level modules (UI components, page entry points) depend on this
 * abstraction rather than directly on `window.location` / `window.history`.
 */
export default class Router {
  /** Create a new Router.  Takes no dependencies. */
  constructor() {
    // Nothing to inject — the Router is the bottom‑most layer.
  }

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------

  /**
   * Navigate to the given URL by setting `window.location.href`.
   *
   * This **replaces** the current page in the browsing context (full
   * navigation).  Use {@link replaceState} for in‑place history updates.
   *
   * @param {string} url - The destination URL (relative or absolute).
   */
  navigate(url) {
    window.location.href = url;
  }

  /**
   * Alias for {@link navigate}.  Provided for semantic clarity when the
   * intent is explicitly a redirect (e.g. after authentication).
   *
   * @param {string} url - The destination URL.
   */
  redirect(url) {
    this.navigate(url);
  }

  // -----------------------------------------------------------------------
  // Read‑only accessors
  // -----------------------------------------------------------------------

  /**
   * Return the current pathname (e.g. `"/login.html"`).
   *
   * @returns {string} `window.location.pathname`
   */
  getPathname() {
    return window.location.pathname;
  }

  /**
   * Return a `URLSearchParams` instance for the current query string.
   *
   * @returns {URLSearchParams} Parsed search parameters.
   */
  getSearchParams() {
    return new URLSearchParams(window.location.search);
  }

  // -----------------------------------------------------------------------
  // History manipulation
  // -----------------------------------------------------------------------

  /**
   * Replace the current history entry without triggering a navigation.
   *
   * Useful for cleaning up the URL after processing a query parameter
   * (e.g. removing `?registered=true` without reloading the page).
   *
   * @param {*} data - Arbitrary data associated with the history entry.
   * @param {string} title - The new page title (usually `document.title`).
   * @param {string} url - The new URL to display in the address bar.
   */
  replaceState(data, title, url) {
    window.history.replaceState(data, title, url);
  }

  // -----------------------------------------------------------------------
  // Reload
  // -----------------------------------------------------------------------

  /**
   * Reload the current page (equivalent to `window.location.reload()`).
   */
  reload() {
    window.location.reload();
  }
}
