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
    /** @private @type {Function|null} */
    this._cardCTAClickHandler = null;
    /** @private @type {Function|null} */
    this._tripBtnClickHandler = null;
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

    const { spots, error } = await this._spotApi.getSpots({ status: "active" });

    if (error) {
      grid.innerHTML = this._renderFallback(
        "Unable to load destinations. Please try again later.",
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
    grid.innerHTML = "";

    if (!spots || spots.length === 0) {
      grid.innerHTML = this._renderFallback(
        "No spots found. Try adjusting your filters.",
      );
      return;
    }

    // Build card HTML for each spot
    grid.innerHTML = spots.map((spot) => this._createCardHTML(spot)).join("");

    // Re-attach interactivity
    this._attachFavouriteListeners();
    this._attachCardCTAListeners();
    this._attachTripButtonListeners();
    this._setupScrollAnimations();

    // Notify other components that spots have been rendered
    this._eventBus.emit("spots:rendered", { count: spots.length });
  }

  /**
   * Filter spots by category and re-render.
   *
   * @param {string|null} category — The category to filter by, or
   *        `'All'` / `null` to show all spots.
   */
  filterByCategory(category) {
    if (!category || category === "All") {
      this._activeCategory = null;
      this.render(this._allSpots);
      return;
    }

    this._activeCategory = category.toLowerCase();

    const filtered = this._allSpots.filter(
      (spot) =>
        spot.category && spot.category.toLowerCase() === this._activeCategory,
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
    if (!query || query.trim() === "") {
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
    const spot = this._allSpots.find((s) => String(s.id) === String(spotId));

    if (!spot) return;

    this._eventBus.emit("spot:detailOpen", { spot });

    const detailSection = document.getElementById("detail");
    if (detailSection) {
      detailSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /**
   * Remove all DOM listeners attached by this component.
   */
  cleanup() {
    const grid = this._getGrid();
    if (!grid) return;

    const favButtons = grid.querySelectorAll(".fav-btn");
    if (this._favClickHandler) {
      favButtons.forEach((btn) =>
        btn.removeEventListener("click", this._favClickHandler),
      );
      this._favClickHandler = null;
    }

    const ctaLinks = grid.querySelectorAll(".card-cta");
    if (this._cardCTAClickHandler) {
      ctaLinks.forEach((link) =>
        link.removeEventListener("click", this._cardCTAClickHandler),
      );
      this._cardCTAClickHandler = null;
    }

    const tripBtns = grid.querySelectorAll(".card-trip-btn");
    if (this._tripBtnClickHandler) {
      tripBtns.forEach((btn) =>
        btn.removeEventListener("click", this._tripBtnClickHandler),
      );
      this._tripBtnClickHandler = null;
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
    const rating = spot.rating_avg ? spot.rating_avg.toFixed(1) : "\u2014";
    const reviewCount = spot.review_count || 0;
    const stars = this._renderStars(Math.round(spot.rating_avg || 0));
    const isFree =
      spot.entrance_fee && spot.entrance_fee.toLowerCase().includes("free");

    return `
    <article class="spot-card" style="--card-hue: ${this._hueForCategory(spot.category)}" data-spot-id="${spot.id}">
      <div class="spot-card-img" style="background: ${this._gradientForCategory(spot.category)}">
        <div class="spot-img-overlay"></div>
        <div class="spot-card-badges">
          <span class="badge badge-cat">${this._escapeHtml(this._formatCategory(spot.category))}</span>
          ${isFree ? '<span class="badge badge-free">Free entry</span>' : ""}
        </div>
        <button class="fav-btn" data-spot-id="${spot.id}" aria-label="Save to favorites">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 12.25S1.75 9 1.75 5.25a3.25 3.25 0 0 1 5.25-2.56A3.25 3.25 0 0 1 12.25 5.25C12.25 9 7 12.25 7 12.25Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="spot-card-img-label">${this._escapeHtml(spot.name)}</div>
      </div>
      <div class="spot-card-body">
        <p class="spot-card-desc">${this._escapeHtml(this._truncate(spot.description || "", 150))}</p>
        <div class="spot-card-meta">
          <div class="meta-row">
            <span class="meta-icon">\u25F7</span>
            <span class="meta-text">${this._escapeHtml(spot.operating_hours || "Hours vary")}</span>
          </div>
          <div class="meta-row">
            <span class="meta-icon">\u2299</span>
            <span class="meta-text">${this._escapeHtml(spot.address || "Manila")}</span>
          </div>
        </div>
        <div class="spot-card-footer">
          <div class="spot-rating">
            <div class="stars">${stars}</div>
            <span class="rating-num">${rating}</span>
            <span class="rating-count">(${reviewCount})</span>
          </div>
          <div class="spot-fee ${isFree ? "free" : ""}">${this._escapeHtml(this._simplifyFee(spot.entrance_fee))}</div>
        </div>
        <div class="spot-card-actions">
          <a href="#detail" class="card-cta" data-spot-id="${spot.id}">View details \u2192</a>
          <button class="card-trip-btn" data-spot-id="${spot.id}" data-spot-name="${this._escapeHtml(spot.name)}" title="Add to itinerary">+ Trip</button>
        </div>
      </div>
    </article>
    `;
  }

  // -----------------------------------------------------------------------
  // Private — helper methods
  // -----------------------------------------------------------------------

  /**
   * Format a snake_case category string to human-readable Title Case.
   * Converts e.g. "shopping_mall" → "Shopping Mall",
   * "religious_site" → "Religious Site".
   *
   * @param {string} category
   * @returns {string}
   * @private
   */
  _formatCategory(category) {
    if (!category) return "";
    return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Simplify an entrance fee string for compact card display.
   * Extracts the main price, leaving full detail for the detail view.
   *
   * @param {string} feeStr
   * @returns {string}
   * @private
   */
  _simplifyFee(feeStr) {
    if (!feeStr) return "Fee varies";
    const lower = feeStr.toLowerCase();
    if (lower.includes("free")) return "Free";

    // Try to extract the first price mentioned
    const cleaned = feeStr
      .replace(/PHP\s*/gi, "\u20B1")
      .replace(/Php\s*/gi, "\u20B1")
      .replace(/php\s*/gi, "\u20B1");

    // If it has a range like "\u20B175 – \u20B1150", return that
    const rangeMatch = cleaned.match(
      /\u20B1[\d,.]+\s*(\u2013|\u2014|-|to)\s*\u20B1[\d,.]+/i,
    );
    if (rangeMatch) return rangeMatch[0];

    // If it has a single price "\u20B175" or "\u20B175 (regular)", extract just the price
    const singleMatch = cleaned.match(/\u20B1[\d,.]+/);
    if (singleMatch) return singleMatch[0];

    // If it's a short string (under 30 chars), show as-is
    if (cleaned.length <= 30) return cleaned;

    // Otherwise truncate
    return cleaned.substring(0, 28) + "\u2026";
  }

  /**
   * Return a CSS hue number for the given category string.
   * Uses substring matching to handle DB values like "Historical Sites",
   * "Religious Sites", "Tourist Attraction", etc.
   *
   * @param {string} category
   * @returns {number}
   * @private
   */
  _hueForCategory(category) {
    if (!category) return 210;
    const c = category.toLowerCase();
    if (c.includes("historical")) return 220;
    if (c.includes("religious") || c.includes("church")) return 40;
    if (c.includes("park") || c.includes("garden")) return 160;
    if (c.includes("museum")) return 280;
    if (c.includes("restaurant") || c.includes("food") || c.includes("dining"))
      return 30;
    if (c.includes("shopping") || c.includes("mall") || c.includes("market"))
      return 200;
    if (c.includes("entertainment") || c.includes("nightlife")) return 300;
    if (c.includes("attraction") || c.includes("tourist")) return 180;
    return 210;
  }

  /**
   * Return a CSS `linear-gradient` string for the card image placeholder.
   * Uses substring matching to handle DB values like "Historical Sites",
   * "Religious Sites", etc.
   *
   * @param {string} category
   * @returns {string} CSS gradient value.
   * @private
   */
  _gradientForCategory(category) {
    if (!category) {
      return "linear-gradient(160deg, #1e2d4d 0%, #0f1929 100%)";
    }

    const c = category.toLowerCase();
    if (c.includes("historical"))
      return "linear-gradient(160deg, #1e2d4d 0%, #0f1929 100%)";
    if (c.includes("religious") || c.includes("church"))
      return "linear-gradient(160deg, #4d2a0a 0%, #2b1507 100%)";
    if (c.includes("park") || c.includes("garden"))
      return "linear-gradient(160deg, #1a4d2e 0%, #0d2b1a 100%)";
    if (c.includes("museum"))
      return "linear-gradient(160deg, #3d1a4d 0%, #1f0d2b 100%)";
    if (c.includes("restaurant") || c.includes("food") || c.includes("dining"))
      return "linear-gradient(160deg, #4d2a0a 0%, #2b1507 100%)";
    if (c.includes("shopping") || c.includes("mall") || c.includes("market"))
      return "linear-gradient(160deg, #0a2d4d 0%, #061929 100%)";
    if (c.includes("entertainment") || c.includes("nightlife"))
      return "linear-gradient(160deg, #2a0a4d 0%, #16072b 100%)";
    if (c.includes("attraction") || c.includes("tourist"))
      return "linear-gradient(160deg, #1e2d4d 0%, #0f1929 100%)";
    return "linear-gradient(160deg, #1e2d4d 0%, #0f1929 100%)";
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
    return "\u2605".repeat(filled) + "\u2606".repeat(empty);
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
    if (!str) return "";
    const div = document.createElement("div");
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
    if (!str || str.length <= max) return str || "";
    return str.slice(0, max).trimEnd() + "\u2026";
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
    return document.querySelector(".spots-grid");
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
   * @private
   */
  _attachFavouriteListeners() {
    const grid = this._getGrid();
    if (!grid) return;

    if (this._favClickHandler) {
      const oldButtons = grid.querySelectorAll(".fav-btn");
      oldButtons.forEach((btn) =>
        btn.removeEventListener("click", this._favClickHandler),
      );
    }

    this._favClickHandler = (e) => {
      const btn = e.currentTarget;
      btn.classList.toggle("saved");
    };

    const buttons = grid.querySelectorAll(".fav-btn");
    buttons.forEach((btn) =>
      btn.addEventListener("click", this._favClickHandler),
    );
  }

  /**
   * Attach click listeners to every `.card-cta` "View details" link.
   * Prevents default anchor behaviour and calls {@link showDetail} with
   * the spot ID from the `data-spot-id` attribute.
   *
   * @private
   */
  _attachCardCTAListeners() {
    const grid = this._getGrid();
    if (!grid) return;

    if (this._cardCTAClickHandler) {
      const oldLinks = grid.querySelectorAll(".card-cta");
      oldLinks.forEach((link) =>
        link.removeEventListener("click", this._cardCTAClickHandler),
      );
    }

    this._cardCTAClickHandler = (e) => {
      e.preventDefault();
      const spotId = e.currentTarget.dataset.spotId;
      if (spotId) {
        this.showDetail(spotId);
      }
    };

    const links = grid.querySelectorAll(".card-cta");
    links.forEach((link) =>
      link.addEventListener("click", this._cardCTAClickHandler),
    );
  }

  /**
   * Attach click listeners to every `.card-trip-btn` "+ Trip" button.
   *
   * When clicked, emits `itinerary:quickAdd` with the spot ID and name
   * so the page orchestrator can either open a date/time picker or
   * scroll to the detail sidebar.
   *
   * @private
   */
  _attachTripButtonListeners() {
    const grid = this._getGrid();
    if (!grid) return;

    if (this._tripBtnClickHandler) {
      const oldBtns = grid.querySelectorAll(".card-trip-btn");
      oldBtns.forEach((btn) =>
        btn.removeEventListener("click", this._tripBtnClickHandler),
      );
    }

    this._tripBtnClickHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const btn = e.currentTarget;
      const spotId = btn.dataset.spotId;
      const spotName = btn.dataset.spotName;

      if (spotId) {
        // Emit event so the page orchestrator can handle the rest
        // (open detail sidebar, show date/time form, etc.)
        this._eventBus.emit("itinerary:quickAdd", { spotId, spotName });
        // Also open the detail for this spot
        this.showDetail(spotId);
      }
    };

    const buttons = grid.querySelectorAll(".card-trip-btn");
    buttons.forEach((btn) =>
      btn.addEventListener("click", this._tripBtnClickHandler),
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

    const cards = grid.querySelectorAll(".spot-card");
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.08 },
    );

    cards.forEach((el) => observer.observe(el));
  }
}
