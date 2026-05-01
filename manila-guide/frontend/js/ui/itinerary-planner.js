// ---------------------------------------------------------------------------
// itinerary-planner.js — Dynamic Trip Planner Component
// ---------------------------------------------------------------------------
// Renders the user's itinerary from the database into the #itinerary section,
// grouping stops by day in a visual timeline.  Also updates the sidebar with
// trip stats and the user's saved spots.
//
// **SOLID**
//   SRP — One job: render itinerary from DB into the existing HTML shell.
//   DIP — Depends on SpotApi, SessionStore, and EventBus abstractions
//         injected via constructor.
//
// Exports (default): ItineraryPlanner
// ---------------------------------------------------------------------------

/**
 * Renders dynamic itinerary data into the existing `.itin-layout` section.
 *
 * All external dependencies arrive through the constructor (DI-compatible).
 */
export default class ItineraryPlanner {
  /**
   * @param {import('../services/spot-api.js').default} spotApi
   * @param {import('../services/session-store.js').default} sessionStore
   * @param {import('../core/event-bus.js')} eventBus — Pub/sub event bus
   *        (the module namespace object).
   */
  constructor(spotApi, sessionStore, eventBus) {
    /** @private */
    this._spotApi = spotApi;
    /** @private */
    this._sessionStore = sessionStore;
    /** @private */
    this._eventBus = eventBus;

    // Bound unsubscribe functions stored for cleanup
    /** @private @type {Function|null} */
    this._unsubSignedIn = null;
    /** @private @type {Function|null} */
    this._unsubSignedOut = null;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Initial render and event subscriptions.
   *
   * Safe to call multiple times — previous subscriptions are torn down first.
   *
   * @returns {Promise<void>}
   */
  async init() {
    // Remove any previously attached listeners
    this.cleanup();

    // Initial render
    await this.render();

    // Re-render on auth state changes
    this._unsubSignedIn = this._eventBus.on(this._eventBus.AUTH_SIGNED_IN, () =>
      this.render(),
    );
    this._unsubSignedOut = this._eventBus.on(
      this._eventBus.AUTH_SIGNED_OUT,
      () => this.render(),
    );
  }

  /**
   * Fetch data and re-render the entire itinerary section.
   *
   * @returns {Promise<void>}
   */
  async render() {
    const main = this._getItinMain();
    if (!main) return;

    const user = this._sessionStore.getUser();

    // --- Signed-out state ---
    if (!user) {
      main.innerHTML = this._buildSignedOutHTML();
      this._clearSidebar();
      return;
    }

    // --- Fetch data ---
    const { itineraries } = await this._spotApi.getItineraries(user.id);
    const { savedSpots } = await this._spotApi.getSavedSpots(user.id);

    // --- Empty state ---
    if (!itineraries || itineraries.length === 0) {
      main.innerHTML = this._buildEmptyHTML();
      this._updateSidebar([], savedSpots || []);
      return;
    }

    // --- Populated state ---
    main.innerHTML = this._buildItineraryHTML(itineraries);
    this._updateSidebar(itineraries, savedSpots || []);
  }

  /**
   * Remove all event subscriptions registered by this component.
   */
  cleanup() {
    if (this._unsubSignedIn) {
      this._unsubSignedIn();
      this._unsubSignedIn = null;
    }
    if (this._unsubSignedOut) {
      this._unsubSignedOut();
      this._unsubSignedOut = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private — HTML builders
  // -----------------------------------------------------------------------

  /**
   * Build the full itinerary card HTML for a populated trip.
   *
   * Groups items by `day_date`, renders a header with date-range info,
   * then iterates over each day to build its timeline.
   *
   * @param {object[]} itineraries
   * @returns {string} HTML string.
   * @private
   */
  _buildItineraryHTML(itineraries) {
    // Group by day_date
    const groups = new Map();
    for (const item of itineraries) {
      const key = item.day_date;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    }

    const dayEntries = [...groups.entries()];
    const dayKeys = [...groups.keys()];
    const firstDate = dayKeys[0];
    const lastDate = dayKeys[dayKeys.length - 1];
    const dayCount = dayKeys.length;
    const totalStops = itineraries.length;

    // Build the card header subtitle
    const dateRange = this._formatDateRange(firstDate, lastDate);
    const subText = `${dateRange} \u00B7 ${dayCount} ${dayCount === 1 ? "day" : "days"}`;

    let html = "";
    html += '<div class="itin-card">';
    html += '<div class="itin-card-header">';
    html += "<div>";
    html += '<h3 class="itin-card-title">My Manila Trip</h3>';
    html += `<span class="itin-card-sub">${this._escapeHtml(subText)}</span>`;
    html += "</div>";
    html += '<button class="btn-ghost sm">+ Add stop</button>';
    html += "</div>";

    // Render each day
    let dayIndex = 0;
    for (const [dateStr, stops] of dayEntries) {
      dayIndex++;
      html += this._buildDayHTML(dayIndex, dateStr, stops);
    }

    html += "</div>"; // .itin-card
    return html;
  }

  /**
   * Build a single `.itin-day` block with timeline stops.
   *
   * @param {number} dayNum — 1-based day number.
   * @param {string} dateStr — ISO date string (day_date).
   * @param {object[]} stops — Itinerary items for this day.
   * @returns {string} HTML string.
   * @private
   */
  _buildDayHTML(dayNum, dateStr, stops) {
    const dateLabel = this._formatDateNicely(dateStr);

    let html = "";
    html += '<div class="itin-day">';
    html += '<div class="itin-day-header">';
    html += `<div class="itin-day-num">Day ${dayNum}</div>`;
    html += `<div class="itin-day-date">${this._escapeHtml(dateLabel)}</div>`;
    html += "</div>";
    html += '<div class="itin-timeline">';

    for (let i = 0; i < stops.length; i++) {
      const item = stops[i];
      const spot = item.spots || {};
      const isLast = i === stops.length - 1;

      html += '<div class="timeline-stop">';
      html += `<div class="tl-time">${this._formatTimeNicely(item.time_slot) || "\u2014"}</div>`;
      html += '<div class="tl-dot-wrap">';
      html += '<div class="tl-dot active"></div>';
      if (!isLast) {
        html += '<div class="tl-line"></div>';
      }
      html += "</div>";
      html += '<div class="tl-stop-card">';
      html += `<div class="tl-stop-name">${this._escapeHtml(spot.name || "Unknown Spot")}</div>`;
      html += `<div class="tl-stop-meta">${this._escapeHtml(spot.category || "")} \u00B7 ${this._escapeHtml(spot.entrance_fee || "Free")}</div>`;
      html += `<div class="tl-stop-dur">${this._escapeHtml(item.estimated_duration || "\u2014")}</div>`;
      html += "</div>";
      html += "</div>"; // .timeline-stop
    }

    html += "</div>"; // .itin-timeline
    html += "</div>"; // .itin-day
    return html;
  }

  /**
   * Build the empty-state HTML shown when the user has no itinerary items.
   *
   * @returns {string} HTML string.
   * @private
   */
  _buildEmptyHTML() {
    return `
      <div class="itin-card">
        <div class="itin-card-header">
          <div>
            <h3 class="itin-card-title">My Manila Trip</h3>
            <span class="itin-card-sub">No stops yet</span>
          </div>
        </div>
        <div class="itin-empty" style="padding: 48px 24px; text-align: center;">
          <p style="font-size: 18px; margin-bottom: 12px; color: var(--text-primary);">
            Your adventure awaits! \uD83C\uDF34
          </p>
          <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 20px;">
            Search for spots and add them to your itinerary to get started.
          </p>
          <a href="#explore" class="btn-primary" style="display: inline-block; text-decoration: none;">
            Browse destinations
          </a>
        </div>
      </div>`;
  }

  /**
   * Build the signed-out placeholder shown when no user is authenticated.
   *
   * @returns {string} HTML string.
   * @private
   */
  _buildSignedOutHTML() {
    return `
      <div class="itin-card" style="text-align: center; padding: 64px 24px;">
        <p style="font-size: 18px; margin-bottom: 8px; color: var(--text-primary);">
          Sign in to plan your trip!
        </p>
        <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 20px;">
          Create an account or sign in to save spots and build your Manila itinerary.
        </p>
        <a href="login.html" class="btn-primary" style="display: inline-block; text-decoration: none;">
          Sign in
        </a>
      </div>`;
  }

  // -----------------------------------------------------------------------
  // Private — sidebar helpers
  // -----------------------------------------------------------------------

  /**
   * Update the sidebar with real trip stats and saved spots.
   *
   * @param {object[]} itineraries
   * @param {object[]} savedSpots
   * @private
   */
  _updateSidebar(itineraries, savedSpots) {
    this._updateSummaryCard(itineraries);
    this._updateSavedSpotsCard(savedSpots);
  }

  /**
   * Populate the `.itin-summary-card` with real stats computed from
   * the itinerary data.
   *
   * @param {object[]} itineraries
   * @private
   */
  _updateSummaryCard(itineraries) {
    const card = document.querySelector(".itin-summary-card");
    if (!card) return;

    const totalStops = itineraries.length;

    // Unique days
    const uniqueDays = new Set(itineraries.map((i) => i.day_date));
    const dayCount = uniqueDays.size;

    // Estimated total fees — sum the first numeric value from each entrance_fee
    let totalFees = 0;
    let freeCount = 0;
    for (const item of itineraries) {
      const spot = item.spots || {};
      const feeStr = spot.entrance_fee || "";
      if (/free/i.test(feeStr)) {
        freeCount++;
      } else {
        totalFees += this._parseFeeNumeric(feeStr);
      }
    }

    const feeDisplay =
      totalFees > 0
        ? `\u20B1 ${totalFees}+`
        : totalFees === 0 && freeCount > 0
          ? "\u20B1 0"
          : "\u2014";

    const freeDisplay =
      totalStops > 0 ? `${freeCount} of ${totalStops}` : "\u2014";

    card.innerHTML = `
      <h4 class="itin-sum-title">Trip summary</h4>
      <div class="itin-sum-rows">
        <div class="itin-sum-row">
          <span>Total stops</span>
          <span class="itin-sum-val">${totalStops || "\u2014"}</span>
        </div>
        <div class="itin-sum-row">
          <span>Days</span>
          <span class="itin-sum-val">${dayCount || "\u2014"} ${dayCount === 1 ? "day" : "days"}</span>
        </div>
        <div class="itin-sum-row">
          <span>Est. total fees</span>
          <span class="itin-sum-val">${feeDisplay}</span>
        </div>
        <div class="itin-sum-row">
          <span>Free attractions</span>
          <span class="itin-sum-val">${freeDisplay}</span>
        </div>
      </div>
      <button class="btn-primary full-w">Save itinerary</button>
    `;
  }

  /**
   * Populate the `.saved-spots-card` with the user's saved spots.
   *
   * Shows up to 5 spots then a "+X more" label.
   *
   * @param {object[]} savedSpots
   * @private
   */
  _updateSavedSpotsCard(savedSpots) {
    const card = document.querySelector(".saved-spots-card");
    if (!card) return;

    const maxVisible = 5;
    const visible = savedSpots.slice(0, maxVisible);
    const remaining = savedSpots.length - maxVisible;

    let itemsHtml = "";
    for (const s of visible) {
      const spot = s.spots || {};
      const name = spot.name || "Unknown Spot";
      itemsHtml += `
        <div class="saved-item">
          <div class="saved-dot"></div>
          <span>${this._escapeHtml(name)}</span>
        </div>`;
    }

    if (remaining > 0) {
      itemsHtml += `
        <div class="saved-item" style="opacity: 0.65;">
          <div class="saved-dot"></div>
          <span>+${remaining} more</span>
        </div>`;
    }

    if (savedSpots.length === 0) {
      itemsHtml = `
        <p style="font-size: 13px; color: var(--text-muted); padding: 8px 0;">
          No saved spots yet. Start exploring!
        </p>`;
    }

    card.innerHTML = `
      <h4 class="saved-title">Saved spots</h4>
      <div class="saved-list">${itemsHtml}</div>
      <a href="#explore" class="btn-ghost full-w sm" style="display: inline-block; text-align: center; text-decoration: none;">
        Browse more spots
      </a>
    `;
  }

  /**
   * Clear the sidebar cards to a neutral state (used on sign-out).
   *
   * @private
   */
  _clearSidebar() {
    // Summary card — show dashes
    const summaryCard = document.querySelector(".itin-summary-card");
    if (summaryCard) {
      summaryCard.innerHTML = `
        <h4 class="itin-sum-title">Trip summary</h4>
        <div class="itin-sum-rows">
          <div class="itin-sum-row">
            <span>Total stops</span>
            <span class="itin-sum-val">&mdash;</span>
          </div>
          <div class="itin-sum-row">
            <span>Days</span>
            <span class="itin-sum-val">&mdash;</span>
          </div>
          <div class="itin-sum-row">
            <span>Est. total fees</span>
            <span class="itin-sum-val">&mdash;</span>
          </div>
          <div class="itin-sum-row">
            <span>Free attractions</span>
            <span class="itin-sum-val">&mdash;</span>
          </div>
        </div>
        <button class="btn-primary full-w" disabled>Save itinerary</button>
      `;
    }

    // Saved spots card — show sign-in prompt
    const savedCard = document.querySelector(".saved-spots-card");
    if (savedCard) {
      savedCard.innerHTML = `
        <h4 class="saved-title">Saved spots</h4>
        <div class="saved-list">
          <p style="font-size: 13px; color: var(--text-muted); padding: 8px 0;">
            Sign in to see your saved spots.
          </p>
        </div>
        <a href="login.html" class="btn-ghost full-w sm" style="display: inline-block; text-align: center; text-decoration: none;">
          Sign in
        </a>
      `;
    }
  }

  // -----------------------------------------------------------------------
  // Private — formatting helpers
  // -----------------------------------------------------------------------

  /**
   * Format an ISO date string into a human-readable label.
   *
   * Examples:
   *   "2025-05-14" → "Wednesday, May 14"
   *   "2025-05-15" → "Thursday, May 15"
   *
   * @param {string} dateStr — ISO date string (YYYY-MM-DD).
   * @returns {string} Formatted date string, or the original if unparseable.
   * @private
   */
  _formatDateNicely(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr + "T00:00:00");
      if (isNaN(d.getTime())) return dateStr;

      const options = {
        weekday: "long",
        month: "long",
        day: "numeric",
      };
      return d.toLocaleDateString("en-US", options);
    } catch {
      return dateStr;
    }
  }

  /**
   * Format a date range for the card subtitle.
   *
   * Examples:
   *   Same day: "May 14"
   *   Same month: "May 14 – 15"
   *   Different months: "May 14 – Jun 2"
   *
   * @param {string} first — ISO date string.
   * @param {string} last — ISO date string.
   * @returns {string} Formatted range string.
   * @private
   */
  _formatDateRange(first, last) {
    if (!first) return "";
    if (!last || first === last) {
      return this._formatDateShort(first);
    }

    const d1 = new Date(first + "T00:00:00");
    const d2 = new Date(last + "T00:00:00");

    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      return `${first} \u2013 ${last}`;
    }

    const sameMonth =
      d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

    if (sameMonth) {
      const month = d1.toLocaleDateString("en-US", { month: "long" });
      return `${month} ${d1.getDate()} \u2013 ${d2.getDate()}`;
    }

    return `${this._formatDateShort(first)} \u2013 ${this._formatDateShort(last)}`;
  }

  /**
   * Format a single ISO date to "Month Day" (e.g. "May 14").
   *
   * @param {string} dateStr
   * @returns {string}
   * @private
   */
  _formatDateShort(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr + "T00:00:00");
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  /**
   * Format a time-slot string into a readable label.
   *
   * Handles several common formats:
   *   "09:00:00" → "9:00 AM"
   *   "09:00"   → "9:00 AM"
   *   "13:30"   → "1:30 PM"
   *   "Morning" → "Morning" (pass-through)
   *   null/undefined → ""
   *
   * @param {string|null|undefined} timeStr
   * @returns {string} Formatted time, or empty string if falsy.
   * @private
   */
  _formatTimeNicely(timeStr) {
    if (!timeStr) return "";

    // If it already looks like a label, pass through
    if (/[a-z]/i.test(timeStr) && !/\d/.test(timeStr)) {
      return timeStr;
    }

    // Try to parse HH:MM or HH:MM:SS
    const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return timeStr;

    const hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

    return `${displayHours}:${minutes} ${period}`;
  }

  /**
   * Extract a numeric fee from an entrance_fee string.
   *
   * Parsing rules:
   *   "₱75 – ₱150"    → 75  (takes the first number after ₱)
   *   "₱75"           → 75
   *   "Free"          → 0
   *   "Free entry"    → 0
   *   null/undefined  → 0
   *
   * @param {string|null|undefined} feeStr
   * @returns {number} Extracted numeric value, or 0.
   * @private
   */
  _parseFeeNumeric(feeStr) {
    if (!feeStr) return 0;
    if (/free/i.test(feeStr)) return 0;

    const match = feeStr.match(/₱\s*(\d[\d,]*)/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ""), 10);
    }

    // Fallback: try to find any number
    const numMatch = feeStr.match(/(\d[\d,]*)/);
    if (numMatch) {
      return parseInt(numMatch[1].replace(/,/g, ""), 10);
    }

    return 0;
  }

  // -----------------------------------------------------------------------
  // Private — DOM helpers
  // -----------------------------------------------------------------------

  /**
   * Get the `.itin-main` element (the left column of the itinerary section).
   *
   * @returns {HTMLElement|null}
   * @private
   */
  _getItinMain() {
    return document.querySelector(".itin-main");
  }

  /**
   * Minimal HTML‑escape to prevent XSS when inserting text content.
   *
   * Uses the DOM `textContent` approach so every HTML‑special character
   * is handled correctly.
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
}
