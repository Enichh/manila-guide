// ---------------------------------------------------------------------------
// spot-cards.js — Dynamic Spot Card Renderer
// ---------------------------------------------------------------------------
// Fetches spots from Supabase via SpotApi and renders them as cards into the
// existing `.spots-grid` element, replacing the hardcoded HTML placeholders.
// Handles client‑side search and category filtering.
//
// **SOLID**
//   SRP — One job: render spot cards.
//   DIP — Depends on SpotApi and EventBus abstractions injected via constructor.
//
// Exports (default): SpotCards
// ---------------------------------------------------------------------------

/**
 * Renders spot data as dynamic cards in the `.spots-grid` container.
 *
 * All external dependencies arrive through the constructor (DI-compatible).
 */
export default class SpotCards {
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

    /** @private @type {string|null} — Current category filter ('All' = null). */
    this._activeCategory = null;

    // Bound handler references stored for cleanup
    /** @private @type {Function|null} */
    this._favClickHandler = null;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Fetch all active spots and perform the initial render.
   *
   * @returns {Promise<void>}
   */
  async init() {
    const grid = this._getGrid();
    if (!grid) return;

    const { spots, error } = await this._spotApi.getSpots({ status: 'active' });

    if (error) {
      grid.innerHTML = this._renderFallback(
        'Unable to load destinations. Please try again later.',
      );
      return;
    }

    this._allSpots = spots;
    this.render(spots);
  }

  /**
   * Render an array of spots into the `.spots-grid` element.
   *
   * Clears existing content, builds a card for each spot, then re-attaches
   * scroll-animation observers and favourite-button listeners.
   *
   * @param {object[]} spots
   */
  render(spots) {
    const grid = this._getGrid();
    if (!grid) return;

    // Clear existing content
    grid.innerHTML = '';

    if (!spots || spots.length === 0) {
      grid.innerHTML = this._renderFallback(
        'No spots found. Try adjusting your filters.',
      );
      return;
    }

    // Build card HTML for each spot
    grid.innerHTML = spots.map((spot) => this._createCardHTML(spot)).join('');

    // Re-attach interactivity
    this._attachFavouriteListeners();
    this._setupScrollAnimations();

    // Notify other components that spots have been rendered
    this._eventBus.emit('spots:rendered', { count: spots.length });
  }

  /**
   * Filter spots by category and re-render.
   *
   * @param {string|null} category — The category to filter by, or
   *        `'All'` / `null` to show all spots.
   */
  filterByCategory(category) {
    if (!category || category === 'All') {
      this._activeCategory = null;
      this.render(this._allSpots);
      return;
    }

    this._activeCategory = category.toLowerCase();

    const filtered = this._allSpots.filter(
      (spot) =>
        spot.category &&
        spot.category.toLowerCase() === this._activeCategory,
    );

    this.render(filtered);
  }

  /**
   * Filter spots by a free‑text search query and re-render.
   *
   * Matches against name, category, and description (case‑insensitive).
   *
   * @param {string} query — Search string.  Empty string renders all spots.
   */
  search(query) {
    if (!query || query.trim() === '') {
      this.render(this._allSpots);
      return;
    }

    const q = query.toLowerCase();

    const filtered = this._allSpots.filter(
      (spot) =>
        (spot.name && spot.name.toLowerCase().includes(q)) ||
        (spot.category && spot.category.toLowerCase().includes(q)) ||
        (spot.description && spot.description.toLowerCase().includes(q)),
    );

    this.render(filtered);
  }

  /**
   * Open the detail view for a specific spot.
   *
   * Emits the `spot:detailOpen` event with the full spot object and scrolls
   * to the `#detail` section.
   *
   * @param {string|number} spotId
   */
  showDetail(spotId) {
    const spot = this._allSpots.find(
      (s) => String(s.id) === String(spotId),
    );

    if (!spot) return;

    this._eventBus.emit('spot:detailOpen', { spot });

    const detailSection = document.getElementById('detail');
    if (detailSection) {
      detailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Remove all DOM listeners attached by this component.
   */
  cleanup() {
    const grid = this._getGrid();
    if (!grid) return;

    const buttons = grid.querySelectorAll('.fav-btn');
    if (this._favClickHandler) {
      buttons.forEach((btn) =>
        btn.removeEventListener('click', this._favClickHandler),
      );
      this._favClickHandler = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private — card HTML template
  // -----------------------------------------------------------------------

  /**
   * Build the full `<article>` card markup for a single spot.
   *
   * @param {object} spot
   * @returns {string} HTML string.
   * @private
   */
  _createCardHTML(spot) {
    const rating = spot.rating_avg ? spot.rating_avg.toFixed(1) : '\u2014';
    const reviewCount = spot.review_count || 0;
    const stars = this._renderStars(Math.round(spot.rating_avg || 0));
    const isFree =
      spot.entrance_fee &&
      spot.entrance_fee.toLowerCase().includes('free');

    return `
    <article class="spot-card" style="--card-hue: ${this._hueForCategory(spot.category)}" data-spot-id="${spot.id}">
      <div class="spot-card-img" style="background: ${this._gradientForCategory(spot.category)}">
        <div class="spot-img-overlay"></div>
        <div class="spot-card-badges">
          <span class="badge badge-cat">${this._escapeHtml(spot.category)}</span>
          ${isFree ? '<span class="badge badge-free">Free entry</span>' : ''}
        </div>
        <button class="fav-btn" data-spot-id="${spot.id}" aria-label="Save to favorites">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 12.25S1.75 9 1.75 5.25a3.25 3.25 0 0 1 5.25-2.56A3.25 3.25 0 0 1 12.25 5.25C12.25 9 7 12.25 7 12.25Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="spot-card-img-label">${this._escapeHtml(spot.name)}</div>
      </div>
      <div class="spot-card-body">
        <p class="spot-card-desc">${this._escapeHtml(this._truncate(spot.description || '', 150))}</p>
        <div class="spot-card-meta">
          <div class="meta-row">
            <span class="meta-icon">\u25F7</span>
            <span class="meta-text">${this._escapeHtml(spot.operating_hours || 'Hours vary')}</span>
          </div>
          <div class="meta-row">
            <span class="meta-icon">\u2299</span>
            <span class="meta-text">${this._escapeHtml(spot.address || 'Manila')}</span>
          </div>
        </div>
        <div class="spot-card-footer">
          <div class="spot-rating">
            <div class="stars">${stars}</div>
            <span class="rating-num">${rating}</span>
            <span class="rating-count">(${reviewCount})</span>
          </div>
          <div class="spot-fee ${isFree ? 'free' : ''}">${this._escapeHtml(spot.entrance_fee || 'Fee varies')}</div>
        </div>
        <a href="#detail" class="card-cta" data-spot-id="${spot.id}">View details \u2192</a>
      </div>
    </article>
    `;
  }

  // -----------------------------------------------------------------------
  // Private — helper methods
  // -----------------------------------------------------------------------

  /**
   * Return a CSS hue number for the given category string.
   *
   * @param {string} category
   * @returns {number}
   * @private
   */
  _hueForCategory(category) {
    if (!category) return 210;

    const c = category.toLowerCase();
    const map = {
      historical: 220,
      religious: 40,
      park: 160,
      museum: 280,
      restaurant: 30,
      shopping: 200,
      market: 350,
      entertainment: 300,
    };

    return map[c] ?? 210;
  }

  /**
   * Return a CSS `linear-gradient` string for the card image placeholder.
   *
   * Matches the feel of the hardcoded `.fort-bg`, `.rizal-bg`, etc. classes
   * that already exist in `user.css`.
   *
   * @param {string} category
   * @returns {string} CSS gradient value.
   * @private
   */
  _gradientForCategory(category) {
    if (!category) {
      return 'linear-gradient(160deg, #1e2d4d 0%, #0f1929 100%)';
    }

    const c = category.toLowerCase();
    const map = {
      historical: 'linear-gradient(160deg, #1e2d4d 0%, #0f1929 100%)',
      religious: 'linear-gradient(160deg, #4d2a0a 0%, #2b1507 100%)',
      park: 'linear-gradient(160deg, #1a4d2e 0%, #0d2b1a 100%)',
      museum: 'linear-gradient(160deg, #3d1a4d 0%, #1f0d2b 100%)',
      restaurant: 'linear-gradient(160deg, #4d2a0a 0%, #2b1507 100%)',
      shopping: 'linear-gradient(160deg, #0a2d4d 0%, #061929 100%)',
      market: 'linear-gradient(160deg, #4d0a2a 0%, #2b0714 100%)',
      entertainment: 'linear-gradient(160deg, #2a0a4d 0%, #16072b 100%)',
    };

    return map[c] ?? 'linear-gradient(160deg, #1e2d4d 0%, #0f1929 100%)';
  }

  /**
   * Render a star rating as filled / empty star characters.
   *
   * @param {number} count — Number of filled stars (0–5).
   * @returns {string} e.g. `"\u2605\u2605\u2605\u2605\u2606"` for 4 stars.
   * @private
   */
  _renderStars(count) {
    const filled = Math.max(0, Math.min(5, count));
    const empty = 5 - filled;
    return '\u2605'.repeat(filled) + '\u2606'.repeat(empty);
  }

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
  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /**
   * Truncate a string to `max` characters, appending an ellipsis if needed.
   *
   * @param {string} str
   * @param {number} max — Maximum character count before truncation.
   * @returns {string}
   * @private
   */
  _truncate(str, max) {
    if (!str || str.length <= max) return str || '';
    return str.slice(0, max).trimEnd() + '\u2026';
  }

  // -----------------------------------------------------------------------
  // Private — DOM helpers
  // -----------------------------------------------------------------------

  /**
   * Get the `.spots-grid` element.
   *
   * @returns {HTMLElement|null}
   * @private
   */
  _getGrid() {
    return document.querySelector('.spots-grid');
  }

  /**
   * Render a fallback / empty‑state message inside the grid.
   *
   * @param {string} message
   * @returns {string} HTML string.
   * @private
   */
  _renderFallback(message) {
    return `
      <div class="spots-fallback" style="grid-column: 1 / -1; text-align: center; padding: 48px 24px; color: var(--text-muted); font-size: 15px;">
        <p>${this._escapeHtml(message)}</p>
      </div>
    `;
  }

  // -----------------------------------------------------------------------
  // Private — re-attachable interactivity
  // -----------------------------------------------------------------------

  /**
   * Attach click listeners to every `.fav-btn` inside the grid.
   *
   * Handles the `saved` class toggle and, if authenticated, could later call
   * into {@link SpotApi.toggleSavedSpot}.  The handler reference is stored
   * so {@link cleanup} can remove it.
   *
   * @private
   */
  _attachFavouriteListeners() {
    const grid = this._getGrid();
    if (!grid) return;

    // Remove old handler if it exists (defensive)
    if (this._favClickHandler) {
      const oldButtons = grid.querySelectorAll('.fav-btn');
      oldButtons.forEach((btn) =>
        btn.removeEventListener('click', this._favClickHandler),
      );
    }

    this._favClickHandler = (e) => {
      const btn = e.currentTarget;
      btn.classList.toggle('saved');
    };

    const buttons = grid.querySelectorAll('.fav-btn');
    buttons.forEach((btn) =>
      btn.addEventListener('click', this._favClickHandler),
    );
  }

  /**
   * Set up an {@link IntersectionObserver} that adds `.visible` to spot
   * cards (and section headers that may have been cleared/re‑created) as
   * they scroll into the viewport.
   *
   * @private
   */
  _setupScrollAnimations() {
    const grid = this._getGrid();
    if (!grid) return;

    const cards = grid.querySelectorAll('.spot-card');
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.08 },
    );

    cards.forEach((el) => observer.observe(el));
  }
}
