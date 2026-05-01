// ---------------------------------------------------------------------------
// admin-spot-form.js — Admin Spot Create / Edit Form Component
// ---------------------------------------------------------------------------
// Replaces the placeholder inside `#panel-spots` with a functional form for
// creating or editing a tourist spot.  Communicates with SpotApi for CRUD
// operations and the EventBus for cross-component notifications.
//
// **SOLID**
//   SRP — One job: manage the spot create/edit form lifecycle.
//   DIP — Depends on SpotApi and EventBus abstractions injected via constructor.
//
// Exports (default): AdminSpotForm
// ---------------------------------------------------------------------------

/**
 * Renders and manages the create/edit spot form in the admin panel.
 *
 * Listens for the `admin:editSpot` event to enter edit mode and emits
 * `admin:spotSaved` / `admin:spotDeleted` after successful mutations so
 * other components (dashboard stats, spots table) can refresh.
 *
 * All external dependencies arrive through the constructor (DI-compatible).
 */
export default class AdminSpotForm {
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

    /**
     * Tracks the currently-editing spot id.
     * `null`  = create mode (new spot).
     * `number` = edit mode (existing spot primary key).
     *
     * @private
     * @type {number|null}
     */
    this._editingId = null;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Wire up event listeners and render the initial placeholder view.
   *
   * @returns {void}
   */
  init() {
    // Listen for edit events emitted by AdminSpotsTable
    this._eventBus.on('admin:editSpot', (spot) => this.showEdit(spot));

    // Wire the "+ Add new spot" button in the spots panel header
    const addBtn = document.querySelector(
      '#panel-spots .admin-page-header .btn-primary',
    );
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showCreate());
    }

    // Also wire the "+ Add spot" button in the dashboard header
    const dashboardAddBtn = document.querySelector(
      '#panel-dashboard .admin-page-header .btn-primary',
    );
    if (dashboardAddBtn) {
      dashboardAddBtn.addEventListener('click', () => {
        this._switchToTab('spots');
        this.showCreate();
      });
    }

    // Render the initial placeholder (inherits from the static HTML)
    this._renderEmpty();
  }

  /**
   * Switch to create mode and render a blank form.
   *
   * @returns {void}
   */
  showCreate() {
    this._editingId = null;
    this._renderForm(
      {
        name: '',
        category: '',
        description: '',
        entrance_fee: '',
        operating_hours: '',
        address: '',
        best_time_visit: '',
        status: 'active',
      },
      'Add New Spot',
    );
  }

  /**
   * Switch to edit mode and render the form pre-filled with the given spot.
   *
   * @param {object} spot — A spot record from the API / table.
   * @returns {void}
   */
  showEdit(spot) {
    this._editingId = spot.id;
    this._renderForm(spot, 'Edit Spot');
  }

  /**
   * No-op.  Kept for API consistency with other UI components.
   *
   * @returns {void}
   */
  cleanup() {}

  // -----------------------------------------------------------------------
  // Private — rendering
  // -----------------------------------------------------------------------

  /**
   * Build and inject the spot form markup into `#panel-spots`.
   *
   * @param {object} spot  — Key/value pairs to pre-populate the form with.
   * @param {string} title — The heading text (e.g. "Add New Spot").
   * @private
   */
  _renderForm(spot, title) {
    const container = document.getElementById('panel-spots');
    if (!container) return;

    const categories = [
      'Historical Sites',
      'Religious Sites',
      'Parks',
      'Museums',
      'Tourist Attractions',
      'Shopping Malls',
      'Markets',
      'Restaurants',
      'Entertainment',
    ];

    container.innerHTML = `
      <div class="admin-page-header">
        <div>
          <h1 class="admin-page-title">${this._escapeHtml(title)}</h1>
          <p class="admin-page-sub">${
            this._editingId
              ? 'Update the details below.'
              : 'Fill in the details for the new tourist spot.'
          }</p>
        </div>
      </div>
      <div class="admin-form-card">
        <form id="spotForm" class="admin-form">
          <div class="form-row">
            <div class="form-group full-width">
              <label class="form-label">Spot Name *</label>
              <input
                type="text"
                class="form-input"
                name="name"
                value="${this._escapeAttr(spot.name)}"
                required
                placeholder="e.g. Fort Santiago"
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Category *</label>
              <select class="form-input" name="category" required>
                <option value="">Select category…</option>
                ${categories
                  .map(
                    (c) =>
                      `<option value="${this._escapeAttr(c)}"${
                        spot.category === c ? ' selected' : ''
                      }>${this._escapeHtml(c)}</option>`,
                  )
                  .join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-input" name="status">
                <option value="active"${
                  spot.status === 'active' ? ' selected' : ''
                }>Active (visible)</option>
                <option value="draft"${
                  spot.status === 'draft' ? ' selected' : ''
                }>Draft (hidden)</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Entrance Fee</label>
              <input
                type="text"
                class="form-input"
                name="entrance_fee"
                value="${this._escapeAttr(spot.entrance_fee)}"
                placeholder="e.g. \u20B175 \u2013 \u20B1150 or Free"
              />
            </div>
            <div class="form-group">
              <label class="form-label">Operating Hours</label>
              <input
                type="text"
                class="form-input"
                name="operating_hours"
                value="${this._escapeAttr(spot.operating_hours)}"
                placeholder="e.g. 8:00 AM \u2013 6:00 PM"
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group full-width">
              <label class="form-label">Address</label>
              <input
                type="text"
                class="form-input"
                name="address"
                value="${this._escapeAttr(spot.address)}"
                placeholder="e.g. Gen. Luna St., Intramuros, Manila"
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group full-width">
              <label class="form-label">Best Time to Visit</label>
              <input
                type="text"
                class="form-input"
                name="best_time_visit"
                value="${this._escapeAttr(spot.best_time_visit)}"
                placeholder="e.g. Morning (8\u201310 AM)"
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group full-width">
              <label class="form-label">Description</label>
              <textarea
                class="form-input form-textarea"
                name="description"
                rows="5"
                placeholder="Describe the spot, its history, and what visitors can expect\u2026"
              >${this._escapeHtml(spot.description || '')}</textarea>
            </div>
          </div>
          <div class="form-row form-actions">
            <button type="button" class="btn-ghost cancel-btn">Cancel</button>
            <button type="submit" class="btn-primary">
              ${this._editingId ? 'Update Spot' : 'Create Spot'}
            </button>
          </div>
          <div class="form-error" id="formError" style="display:none;"></div>
        </form>
      </div>
    `;

    this._wireFormEvents();
  }

  /**
   * Restore the placeholder view inside `#panel-spots`.
   *
   * Keeps the panel in its default state when no form is active.
   *
   * @private
   */
  _renderEmpty() {
    const container = document.getElementById('panel-spots');
    if (!container) return;

    // Only render the placeholder if the container is empty or currently
    // contains a form (i.e. we came back from create/edit mode).  If the
    // panel already shows the static placeholder we don't need to do anything.
    const existingForm = container.querySelector('#spotForm');
    if (!existingForm && container.querySelector('.placeholder-panel')) {
      return; // Already showing the placeholder — nothing to do
    }

    container.innerHTML = `
      <div class="admin-page-header">
        <div>
          <h1 class="admin-page-title">Manage Spots</h1>
          <p class="admin-page-sub">
            Add, edit, or remove tourist spots from the directory.
          </p>
        </div>
        <button class="btn-primary sm">+ Add new spot</button>
      </div>
      <div class="placeholder-panel">
        <div class="placeholder-icon">\uD83D\uDDFA\uFE0F</div>
        <h3>Spots Management</h3>
        <p>
          Click \u201C+ Add new spot\u201D to create one, or use the table below
          to edit existing spots.
        </p>
      </div>
    `;

    // Re-wire the add button after replacing the DOM
    const addBtn = container.querySelector('.btn-primary');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showCreate());
    }
  }

  // -----------------------------------------------------------------------
  // Private — form event wiring
  // -----------------------------------------------------------------------

  /**
   * Attach listeners to the cancel button and submit handler of the
   * currently rendered form.
   *
   * @private
   */
  _wireFormEvents() {
    const form = document.getElementById('spotForm');
    if (!form) return;

    // ── Cancel button ──────────────────────────────────────────────────
    form.querySelector('.cancel-btn')?.addEventListener('click', () => {
      this._renderEmpty();
    });

    // ── Submit handler ─────────────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      // Basic validation
      if (!data.name || !data.category) {
        this._showError('Name and category are required.');
        return;
      }

      let result;
      if (this._editingId) {
        result = await this._spotApi.updateSpot(this._editingId, data);
      } else {
        result = await this._spotApi.createSpot(data);
      }

      if (result.error) {
        this._showError(result.error.message);
        return;
      }

      // Notify other components
      this._eventBus.emit('admin:spotSaved', result.spot);
      this._eventBus.emit('admin:spotDeleted'); // triggers dashboard refresh

      // Show a success banner briefly, then return to the placeholder
      this._showSuccessAndReset();
    });
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
  // Private — feedback helpers
  // -----------------------------------------------------------------------

  /**
   * Display an error message inside the form's error banner.
   *
   * @param {string} msg — Human-readable error text.
   * @private
   */
  _showError(msg) {
    const el = document.getElementById('formError');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  /**
   * Replace the form with a success confirmation and reset to placeholder
   * after a short delay so the user can see the confirmation.
   *
   * @private
   */
  _showSuccessAndReset() {
    const container = document.getElementById('panel-spots');
    if (!container) return;

    container.innerHTML = `
      <div class="admin-page-header">
        <div>
          <h1 class="admin-page-title">
            \u2713 Spot ${this._editingId ? 'Updated' : 'Created'}
          </h1>
          <p class="admin-page-sub">The spot has been saved successfully.</p>
        </div>
        <button class="btn-primary sm">+ Add new spot</button>
      </div>
    `;

    // Re-wire the add button
    const addBtn = container.querySelector('.btn-primary');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showCreate());
    }

    this._editingId = null;
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
   * Escape a string for safe embedding inside an HTML attribute value.
   *
   * Covers the five characters that are meaningful inside a
   * double-quoted attribute value.
   *
   * @param {string} str
   * @returns {string}
   * @private
   */
  _escapeAttr(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
