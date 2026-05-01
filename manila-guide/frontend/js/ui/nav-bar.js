// ---------------------------------------------------------------------------
// nav-bar.js — Navigation Bar Component
// ---------------------------------------------------------------------------
// Reads auth state from `SessionStore` and updates the `.nav-actions` section
// of the header accordingly (authenticated vs. unauthenticated states).
//
// Exports (default): NavBar
// ---------------------------------------------------------------------------

/**
 * Manages the navigation bar's auth‑dependent UI.
 *
 * **Single Responsibility:** Render the correct nav‑actions markup based on
 * current session state.  Reacts to `AUTH_CHANGED` and `NAV_UPDATE` events
 * from the {@link EventBus}.
 *
 * All external dependencies arrive via the constructor (DI).
 */
export default class NavBar {
  /**
   * @param {import('../services/session-store.js').default} sessionStore
   * @param {import('../core/event-bus.js')} eventBus - Pub/sub event bus
   *        (the module namespace object).
   */
  constructor(sessionStore, eventBus) {
    /** @private */
    this._sessionStore = sessionStore;
    /** @private */
    this._eventBus = eventBus;

    // Subscriptions (stored for cleanup)
    /** @private @type {Function[]} */
    this._unsubscribers = [];
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Subscribe to relevant events and perform the initial render.
   */
  init() {
    // Subscribe to AUTH_CHANGED and NAV_UPDATE
    this._unsubscribers.push(
      this._eventBus.on(this._eventBus.AUTH_CHANGED, () => this.update()),
    );
    this._unsubscribers.push(
      this._eventBus.on(this._eventBus.NAV_UPDATE, () => this.update()),
    );

    // Initial render
    this.update();
  }

  /**
   * Read the current session state and re‑render the `.nav-actions` element.
   */
  update() {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions) return;

    if (this._sessionStore.isAuthenticated()) {
      navActions.innerHTML = this._renderAuthenticated();
    } else {
      navActions.innerHTML = this._renderUnauthenticated();
    }
  }

  /**
   * Unsubscribe from all events.  Call when the component is torn down.
   */
  cleanup() {
    this._unsubscribers.forEach((unsub) => unsub());
    this._unsubscribers = [];
  }

  // -----------------------------------------------------------------------
  // Private — rendering
  // -----------------------------------------------------------------------

  /**
   * Render the authenticated nav‑actions: user menu with avatar, name, and
   * dropdown (My Trips / Admin Dashboard, My Reviews, Sign Out).
   *
   * @returns {string} HTML string.
   * @private
   */
  _renderAuthenticated() {
    const userName = this._escapeHtml(this._sessionStore.getDisplayName());
    const initial = userName.charAt(0).toUpperCase();
    const isAdmin = this._sessionStore.isAdmin();
    const userEmail = this._escapeHtml(
      this._sessionStore.getUser()?.email || '',
    );

    return `
      <div class="user-menu">
        <button class="user-menu-btn" type="button">
          <div class="user-avatar">${initial}</div>
          <span class="user-name">${userName}</span>
          <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="user-dropdown" id="userDropdown">
          <div class="dropdown-header">
            <div class="dropdown-user-info">
              <div class="dropdown-avatar">${initial}</div>
              <div>
                <div class="dropdown-name">${userName}</div>
                <div class="dropdown-email">${userEmail}</div>
                ${isAdmin ? '<div class="dropdown-role">Administrator</div>' : ''}
              </div>
            </div>
          </div>
          <div class="dropdown-divider"></div>
          <a href="${isAdmin ? 'admin.html' : '#itinerary'}" class="dropdown-item">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2C8.55228 2 9 2.44772 9 3V7H13C13.5523 7 14 7.44772 14 8C14 8.55228 13.5523 9 13 9H9V13C9 13.5523 8.55228 14 8 14C7.44772 14 7 13.5523 7 13V9H3C2.44772 9 2 8.55228 2 8C2 7.44772 2.44772 7 3 7H7V3C7 2.44772 7.44772 2 8 2Z" fill="currentColor"/>
            </svg>
            ${isAdmin ? 'Admin Dashboard' : 'My Trips'}
          </a>
          <a href="#reviews" class="dropdown-item">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L9.5 5.5L13 6L10.5 8.5L11 12L8 10L5 12L5.5 8.5L3 6L6.5 5.5L8 2Z" fill="currentColor"/>
            </svg>
            My Reviews
          </a>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item logout-btn" type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M13 8L10 5M13 8L10 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render the unauthenticated nav‑actions: Sign in / Get started buttons.
   *
   * @returns {string} HTML string.
   * @private
   */
  _renderUnauthenticated() {
    return `
      <a href="login.html" class="btn-ghost">Sign in</a>
      <a href="login.html" class="btn-primary">Get started</a>
    `;
  }

  // -----------------------------------------------------------------------
  // Private — utilities
  // -----------------------------------------------------------------------

  /**
   * Minimal HTML‑escape for user‑supplied strings to prevent XSS.
   *
   * @param {string} str
   * @returns {string}
   * @private
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
}
