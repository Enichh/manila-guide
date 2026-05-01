// ---------------------------------------------------------------------------
// user-menu.js — User Dropdown Menu Component
// ---------------------------------------------------------------------------
// Manages the authenticated user dropdown: toggle, close‑on‑outside‑click,
// and sign‑out.  Extracted from the legacy `auth-utils.js` God‑module.
//
// Exports (default): UserMenu
// ---------------------------------------------------------------------------

/**
 * Encapsulates all behaviour of the `.user-menu` dropdown.
 *
 * **Single Responsibility:** Handle open / close of the dropdown and the
 * sign‑out action.  Rendering of the menu HTML itself is owned by {@link NavBar}.
 *
 * All external dependencies arrive via the constructor (DI).
 */
export default class UserMenu {
  /**
   * @param {import('../services/session-store.js').default} sessionStore
   * @param {import('../core/event-bus.js')} eventBus - Pub/sub event bus
   *        (the module namespace — used for emit calls).
   * @param {import('../services/router.js').default} router
   * @param {import('../services/auth-api.js').default} authApi
   */
  constructor(sessionStore, eventBus, router, authApi) {
    /** @private */
    this._sessionStore = sessionStore;
    /** @private */
    this._eventBus = eventBus;
    /** @private */
    this._router = router;
    /** @private */
    this._authApi = authApi;

    // Bound handlers (stored so they can be removed in cleanup())
    /** @private */
    this._onDocumentClick = this._onDocumentClick.bind(this);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Attach global event listeners.  Safe to call multiple times — previous
   * listeners are removed before re‑attaching.
   */
  init() {
    // Remove any previously attached listener to prevent duplicates
    this.cleanup();

    // Global click listener for toggle / close / sign‑out (event delegation)
    document.addEventListener("click", this._onDocumentClick);
  }

  /**
   * Toggle the visibility of the user dropdown.
   */
  toggleMenu() {
    const dropdown = document.getElementById("userDropdown");
    if (dropdown) {
      dropdown.classList.toggle("show");
    }
  }

  /**
   * Close the user dropdown (no‑op if already closed).
   */
  closeMenu() {
    const dropdown = document.getElementById("userDropdown");
    if (dropdown) {
      dropdown.classList.remove("show");
    }
  }

  /**
   * Sign out the current user: destroy Supabase session, clear session,
   * emit event, redirect to login.
   */
  async handleSignOut() {
    await this._authApi.signOut();
    this._sessionStore.clearUser();
    this._eventBus.emit(this._eventBus.AUTH_SIGNED_OUT);
    this._router.navigate("login.html");
  }

  /**
   * Remove all event listeners registered by this component.
   */
  cleanup() {
    document.removeEventListener("click", this._onDocumentClick);
  }

  // -----------------------------------------------------------------------
  // Private — event handlers
  // -----------------------------------------------------------------------

  /**
   * Global click handler using event delegation.
   *
   * Handles three scenarios:
   *   1. Click on the user‑menu toggle button → toggle dropdown.
   *   2. Click on the sign‑out button → handle sign‑out.
   *   3. Click outside the `.user-menu` container → close dropdown.
   *
   * @param {MouseEvent} e
   * @private
   */
  _onDocumentClick(e) {
    const userMenu = document.querySelector(".user-menu");

    // Scenario 1 — toggle button
    const toggleBtn = e.target.closest(".user-menu-btn");
    if (toggleBtn) {
      e.preventDefault();
      this.toggleMenu();
      return;
    }

    // Scenario 2 — sign‑out button
    const logoutBtn = e.target.closest(".logout-btn");
    if (logoutBtn) {
      e.preventDefault();
      this.handleSignOut();
      return;
    }

    // Scenario 3 — click outside the menu closes it
    if (userMenu && !userMenu.contains(e.target)) {
      this.closeMenu();
    }
  }
}
