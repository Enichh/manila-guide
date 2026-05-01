// ---------------------------------------------------------------------------
// admin-spots-table.js — Admin Spots Table Component
// ---------------------------------------------------------------------------
// Fetches all spots (regardless of status) from SpotApi and renders them
// into the dashboard's table (`.table-wrap tbody`).  Provides client‑side
// search filtering, edit navigation, and delete with confirmation.
//
// **SOLID**
//   SRP — One job: render and manage the spots table on the admin dashboard.
//   DIP — Depends on SpotApi and EventBus abstractions injected via constructor.
//
// Exports (default): AdminSpotsTable
// ---------------------------------------------------------------------------

/**
 * Renders and manages the admin spots table with search, edit, and delete.
 *
 * All external dependencies arrive through the constructor (DI-compatible).
 */
export default class AdminSpotsTable {
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

    /** @private @type {object[]} — Full cached set for client‑side filtering. */
    this._allSpots = [];

    // Stored for cleanup
    /** @private @type {HTMLInputElement|null} */
    this._searchInput = null;
    /** @private @type {Function|null} */
    this._searchHandler = null;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Fetch spots, render the table, and wire up the search input.
   *
   * @returns {Promise<void>}
   */
  async init() {
    await this._fetchAndRender();
    this._wireSearch();
  }

  /**
   * Remove all DOM listeners attached by this component.
   */
  cleanup() {
    if (this._searchInput && this._searchHandler) {
      this._searchInput.removeEventListener('input', this._searchHandler);
      this._searchHandler = null;
      this._searchInput = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private — data fetching & rendering
  // -----------------------------------------------------------------------

  /**
   * Fetch all spots from the API and render the table.
   *
   * Fetches without a status filter so that both active and draft spots
   * appear in the admin table.  If the API call fails the table is left
   * untouched so existing hardcoded rows remain visible.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _fetchAndRender() {
    const { spots, error } = await this._spotApi.getSpots();

    if (error) return;

    this._allSpots = spots;
    this._renderTable(spots);
  }

  /**
   * Build and inject the `<tbody>` markup for the given array of spots.
   *
   * Handles the empty state with a centred message spanning all columns.
   *
   * @param {object[]} spots
   * @private
   */
  _renderTable(spots) {
    const tbody = document.querySelector('#panel-dashboard .table-wrap tbody');
    if (!tbody) return;

    if (spots.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:2rem;">No spots found.</td></tr>';
      return;
    }

    tbody.innerHTML = spots
      .map(
        (spot) => `
      <tr>
        <td class="td-name">${this._escape(spot.name)}</td>
        <td class="td-cat">${this._escape(spot.category)}</td>
        <td>${this._escape(spot.entrance_fee || '\u2014')}</td>
        <td>${this._escape(spot.operating_hours || '\u2014')}</td>
        <td><span class="status ${spot.status}">${this._escape(spot.status)}</span></td>
        <td class="td-actions">
          <button class="tbl-btn edit-btn" data-id="${spot.id}">Edit</button>
          <button class="tbl-btn danger delete-btn" data-id="${spot.id}">Delete</button>
        </td>
      </tr>
    `,
      )
      .join('');

    this._wireRowButtons();
  }

  // -----------------------------------------------------------------------
  // Private — row interactivity (edit & delete)
  // -----------------------------------------------------------------------

  /**
   * Attach click listeners to every `.edit-btn` and `.delete-btn` in the
   * table body.
   *
   * Edit buttons switch to the "spots" panel and emit the `admin:editSpot`
   * event with the full spot object so that a form component can populate
   * its fields.
   *
   * Delete buttons ask for confirmation before calling
   * {@link SpotApi.deleteSpot}.  On success the table and dashboard stats
   * are refreshed.
   *
   * @private
   */
  _wireRowButtons() {
    // ── Edit buttons ──────────────────────────────────────────────────
    document.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        const spot = this._allSpots.find((s) => s.id === id);
        if (spot) {
          this._switchToTab('spots');
          this._eventBus.emit('admin:editSpot', spot);
        }
      });
    });

    // ── Delete buttons ────────────────────────────────────────────────
    document.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id, 10);
        const spot = this._allSpots.find((s) => s.id === id);

        if (!confirm(`Delete "${spot?.name}"? This cannot be undone.`))
          return;

        const { error } = await this._spotApi.deleteSpot(id);
        if (error) {
          alert('Failed to delete: ' + error.message);
          return;
        }

        // Refresh the table so the deleted row disappears
        await this._fetchAndRender();

        // Let the dashboard know it should refresh its stats
        this._eventBus.emit('admin:spotDeleted');
      });
    });
  }

  // -----------------------------------------------------------------------
  // Private — search filtering
  // -----------------------------------------------------------------------

  /**
   * Wire the admin search bar so that typing filters the table rows on the
   * client side (matching against spot name and category).
   *
   * @private
   */
  _wireSearch() {
    this._searchInput = document.querySelector('.admin-search-bar input');
    if (!this._searchInput) return;

    this._searchHandler = () => {
      const q = this._searchInput.value.trim().toLowerCase();

      if (!q) {
        this._renderTable(this._allSpots);
        return;
      }

      const filtered = this._allSpots.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q),
      );

      this._renderTable(filtered);
    };

    this._searchInput.addEventListener('input', this._searchHandler);
  }

  // -----------------------------------------------------------------------
  // Private — navigation
  // -----------------------------------------------------------------------

  /**
   * Switch to a named admin tab by delegating to the global
   * `switchAdminTab` function (exposed by `pages/admin.js`).
   *
   * @param {string} tabName — The tab identifier (e.g. `"spots"`).
   * @private
   */
  _switchToTab(tabName) {
    if (typeof window.switchAdminTab === 'function') {
      const btn = document.querySelector(
        `.admin-nav-tab[onclick*="${tabName}"]`,
      );
      window.switchAdminTab(tabName, btn);
    }
  }

  // -----------------------------------------------------------------------
  // Private — utilities
  // -----------------------------------------------------------------------

  /**
   * Minimal HTML‑escape to prevent XSS when inserting user‑generated text.
   *
   * Uses the DOM `textContent` approach rather than a regex so that every
   * HTML‑special character is handled correctly.
   *
   * @param {string} str
   * @returns {string}
   * @private
   */
  _escape(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }
}
