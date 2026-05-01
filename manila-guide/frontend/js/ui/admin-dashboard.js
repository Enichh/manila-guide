// ---------------------------------------------------------------------------
// admin-dashboard.js — Admin Stats Cards Component
// ---------------------------------------------------------------------------
// Fetches aggregate spot statistics from SpotApi and populates the four
// admin stat cards (`.astat-card`) with live data — replacing the hardcoded
// placeholder values in admin.html.
//
// **SOLID**
//   SRP — One job: update the four stat cards on the admin dashboard.
//   DIP — Depends on SpotApi and EventBus abstractions injected via constructor.
//
// Exports (default): AdminDashboard
// ---------------------------------------------------------------------------

/**
 * Populates the admin dashboard stat cards with live aggregate data.
 *
 * All external dependencies arrive through the constructor (DI-compatible).
 */
export default class AdminDashboard {
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
   * Fetch aggregate stats and populate all four stat cards.
   *
   * If the API call fails, the cards are left with their existing hardcoded
   * placeholder values so the UI never appears broken.
   *
   * @returns {Promise<void>}
   */
  async init() {
    const { stats, error } = await this._spotApi.getSpotStats();
    if (error || !stats) return;

    this._updateCard(0, {
      label: 'Total spots',
      value: stats.total,
      delta: `${stats.active} active · ${stats.draft} draft`,
      deltaClass: 'up',
    });

    this._updateCard(1, {
      label: 'Active spots',
      value: stats.active,
      delta: 'published',
      deltaClass: 'up',
    });

    this._updateCard(2, {
      label: 'Categories',
      value: stats.categories,
      delta: 'types of spots',
      deltaClass: 'up',
    });

    this._updateCard(3, {
      label: 'Draft spots',
      value: stats.draft,
      delta: 'needs review',
      deltaClass: 'down',
    });
  }

  /**
   * No-op.  Kept for API consistency with other UI components.
   */
  cleanup() {}

  // -----------------------------------------------------------------------
  // Private — helpers
  // -----------------------------------------------------------------------

  /**
   * Update the label, value, and delta text of a single stat card.
   *
   * The delta element's CSS class is also updated to reflect the semantic
   * colour (`.up` = green / `.down` = red) defined in `admin.css`.
   *
   * @param {number} index          — Zero-based index of the `.astat-card`.
   * @param {object} data
   * @param {string} data.label      — Text for the `.astat-label` element.
   * @param {number|string} data.value — Text for the `.astat-value` element.
   * @param {string} data.delta      — Text for the `.astat-delta` element.
   * @param {'up'|'down'} [data.deltaClass='up'] — CSS class for the delta.
   * @private
   */
  _updateCard(index, { label, value, delta, deltaClass = 'up' }) {
    const cards = document.querySelectorAll('.astat-card');
    const card = cards[index];
    if (!card) return;

    const labelEl = card.querySelector('.astat-label');
    const valueEl = card.querySelector('.astat-value');
    const deltaEl = card.querySelector('.astat-delta');

    if (labelEl) labelEl.textContent = label;
    if (valueEl) valueEl.textContent = value;
    if (deltaEl) {
      deltaEl.textContent = delta;
      // Replace existing up/down class so the colour is correct
      deltaEl.classList.remove('up', 'down');
      deltaEl.classList.add(deltaClass);
    }
  }
}
