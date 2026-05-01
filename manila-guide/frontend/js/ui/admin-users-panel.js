// ---------------------------------------------------------------------------
// admin-users-panel.js — Admin Users Panel Component
// ---------------------------------------------------------------------------
// Replaces the placeholder inside `#panel-users` with live user statistics
// and a table of recent registrations.  Data is fetched from
// {@link SpotApi.getUserStats}.
//
// **SOLID**
//   SRP — One job: display user activity statistics on the admin dashboard.
//   DIP — Depends on SpotApi and EventBus abstractions injected via constructor.
//
// Exports (default): AdminUsersPanel
// ---------------------------------------------------------------------------

/**
 * Populates the Users panel with live aggregate data and a recent
 * registrations table.
 *
 * All external dependencies arrive through the constructor (DI-compatible).
 */
export default class AdminUsersPanel {
  /**
   * @param {import('../services/spot-api.js').default} spotApi
   * @param {import('../core/event-bus.js')} eventBus — Pub/sub event bus
   *        (the module namespace object).
   */
  constructor(spotApi, eventBus) {
    /** @private */
    this._spotApi = spotApi;
    /** @private */
    this._eventBus = eventBus;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Fetch user stats from the API and render the panel.
   *
   * If the API call fails the panel shows a friendly error state rather than
   * a broken layout.
   *
   * @returns {Promise<void>}
   */
  async init() {
    await this._loadAndRender();
  }

  /**
   * No-op.  Kept for API consistency with other UI components.
   *
   * @returns {void}
   */
  cleanup() {}

  // -----------------------------------------------------------------------
  // Private — data loading & rendering
  // -----------------------------------------------------------------------

  /**
   * Fetch user stats from {@link SpotApi.getUserStats} and render the full
   * panel markup.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _loadAndRender() {
    const container = document.getElementById('panel-users');
    if (!container) return;

    const { stats, error } = await this._spotApi.getUserStats();

    if (error || !stats) {
      container.innerHTML = `
        <div class="admin-page-header">
          <div>
            <h1 class="admin-page-title">User Activity</h1>
            <p class="admin-page-sub">Could not load user data.</p>
          </div>
        </div>
      `;
      return;
    }

    // ── Recent registrations table rows ─────────────────────────────────
    const recentHTML =
      stats.recent.length > 0
        ? stats.recent
            .map(
              (u, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${this._escapeHtml(u.full_name || '\u2014')}</td>
            <td><span class="status active">${this._escapeHtml(u.role)}</span></td>
            <td>${this._formatDate(u.created_at)}</td>
          </tr>
        `,
            )
            .join('')
        : '<tr><td colspan="4" style="text-align:center;padding:2rem;">No users registered yet.</td></tr>';

    // ── Full panel markup ─────────────────────────────────────────────
    container.innerHTML = `
      <div class="admin-page-header">
        <div>
          <h1 class="admin-page-title">User Activity</h1>
          <p class="admin-page-sub">
            Monitor registered users and their roles.
          </p>
        </div>
      </div>
      <div class="admin-stats-row" style="margin-bottom:24px;">
        <div class="astat-card">
          <div class="astat-label">Total users</div>
          <div class="astat-value">${stats.total}</div>
          <div class="astat-delta up">${stats.admins} administrator${stats.admins === 1 ? '' : 's'}</div>
        </div>
      </div>
      <div class="admin-table-card">
        <div class="admin-table-header">
          <h3 class="admin-table-title">Recent Registrations</h3>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>${recentHTML}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // -----------------------------------------------------------------------
  // Private — utilities
  // -----------------------------------------------------------------------

  /**
   * Escape a string for safe embedding as HTML text content.
   *
   * Uses the DOM `textContent` approach rather than a regex so that every
   * HTML-special character is handled correctly.
   *
   * @param {string} str
   * @returns {string}
   * @private
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  /**
   * Format an ISO date string into a human-readable locale date.
   *
   * @param {string} dateStr — ISO 8601 timestamp (e.g. "2025-03-15T08:30:00Z").
   * @returns {string} Formatted date (e.g. "March 15, 2025") or the original
   *                   string if parsing fails.
   * @private
   */
  _formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr || '\u2014';
    }
  }
}
