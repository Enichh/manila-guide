// ---------------------------------------------------------------------------
// spot-detail.js — Dynamic Spot Detail Renderer
// ---------------------------------------------------------------------------
// Replaces the hardcoded #detail section with dynamically rendered content
// when a spot card is clicked.  Handles tab switching (Overview / Directions /
// Gallery / Activities) via internal event delegation.
//
// **SOLID**
//   SRP — One job: render the spot detail panel.
//   DIP — Depends on SpotApi and EventBus abstractions injected via constructor.
//
// Exports (default): SpotDetail
// ---------------------------------------------------------------------------

/**
 * Renders spot detail data into the `#detail` section.
 *
 * Listens for the `spot:detailOpen` event (emitted by {@link SpotCards}) and
 * populates the detail layout with live data from a spot object.
 *
 * All external dependencies arrive through the constructor (DI-compatible).
 */
export default class SpotDetail {
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

    /** @private @type {object|null} — Currently displayed spot. */
    this._currentSpot = null;

    /** @private @type {string} — Active tab key. */
    this._activeTab = "overview";

    /** @private @type {Function|null} */
    this._tabClickHandler = null;

    /** @private @type {Function|null} */
    this._onSpotOpen = null;

    /** @private @type {Function[]} */
    this._unsubscribers = [];
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Subscribe to events and render the initial empty state.
   */
  init() {
    // Bind and store handler references for cleanup
    this._onSpotOpen = this._handleSpotOpen.bind(this);

    // Subscribe to spot:detailOpen
    this._unsubscribers.push(
      this._eventBus.on("spot:detailOpen", this._onSpotOpen),
    );

    // Render initial placeholder
    this._renderEmpty();
  }

  /**
   * Remove all event listeners and subscriptions.
   */
  cleanup() {
    this._unsubscribers.forEach((unsub) => unsub());
    this._unsubscribers = [];
    this._detachTabListeners();
    this._onSpotOpen = null;
    this._currentSpot = null;
  }

  // -----------------------------------------------------------------------
  // Private — event handlers
  // -----------------------------------------------------------------------

  /**
   * Handle the `spot:detailOpen` event: render the detail section with the
   * given spot's data and scroll to it.
   *
   * @param {{ spot: object }} payload
   * @private
   */
  _handleSpotOpen({ spot }) {
    if (!spot) return;

    this._currentSpot = spot;
    this._activeTab = "overview";
    this._render(spot, "overview");
  }

  /**
   * Handle a tab click via event delegation.
   *
   * @param {MouseEvent} e
   * @private
   */
  _onTabClick(e) {
    const tab = e.target.closest(".dtab");
    if (!tab) return;

    const tabName = tab.dataset.tab;
    if (!tabName || tabName === this._activeTab) return;

    this._activeTab = tabName;

    // Update active class on tabs
    const allTabs = document.querySelectorAll(".detail-tabs-bar .dtab");
    allTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    // Re-render tab content
    if (this._currentSpot) {
      this._renderTabContent(tabName, this._currentSpot);
    }
  }

  // -----------------------------------------------------------------------
  // Private — rendering
  // -----------------------------------------------------------------------

  /**
   * Render the full detail section for a spot, including the tab bar and
   * tab content, then attach listeners.
   *
   * @param {object} spot
   * @param {string} activeTab
   * @private
   */
  _render(spot, activeTab) {
    const section = document.getElementById("detail");
    if (!section) return;

    const container = section.querySelector(".container");
    if (!container) return;

    container.innerHTML = this._renderHTML(spot, activeTab);

    // Attach tab click listeners
    this._attachTabListeners();

    // Wire sidebar interactivity (buttons, nearby spots)
    this._updateSidebar(spot);

    // Notify other components
    this._eventBus.emit("detail:rendered", { spot });
  }

  /**
   * Render only the tab content area (when switching tabs without re-rendering
   * the entire section).
   *
   * @param {string} tabName
   * @param {object} spot
   * @private
   */
  _renderTabContent(tabName, spot) {
    const body = document.querySelector(".detail-body");
    if (!body) return;

    body.innerHTML = this._renderTabBodyHTML(tabName, spot);
  }

  /**
   * Build the complete detail section HTML for a spot.
   *
   * @param {object} spot
   * @param {string} activeTab
   * @returns {string} HTML string.
   * @private
   */
  _renderHTML(spot, activeTab) {
    const name = this._escapeHtml(spot.name || "Unknown Spot");
    const category = this._escapeHtml(spot.category || "");
    const address = this._escapeHtml(spot.address || spot.location || "Manila");
    const rating = spot.rating_avg ? spot.rating_avg.toFixed(1) : "\u2014";
    const reviewCount = spot.review_count || 0;
    const stars = this._renderStars(Math.round(spot.rating_avg || 0));
    const fee = this._escapeHtml(spot.entrance_fee || "Fee varies");
    const hours = this._escapeHtml(spot.operating_hours || "Hours vary");
    const description = this._escapeHtml(
      spot.description || "No description available.",
    );
    const imageGradient = this._gradientForCategory(spot.category);

    return `
      <div class="section-eyebrow">Spot Detail Page</div>
      <div class="detail-layout">
        <div class="detail-main">
          <div class="detail-hero" style="background: ${imageGradient}">
            <div class="detail-hero-overlay"></div>
            <div class="detail-hero-content">
              <div class="detail-tabs-bar">
                <button class="dtab ${activeTab === "overview" ? "active" : ""}" data-tab="overview">Overview</button>
                <button class="dtab ${activeTab === "directions" ? "active" : ""}" data-tab="directions">Directions</button>
                <button class="dtab ${activeTab === "gallery" ? "active" : ""}" data-tab="gallery">Gallery</button>
                <button class="dtab ${activeTab === "activities" ? "active" : ""}" data-tab="activities">Activities</button>
              </div>
              <div class="detail-title-block">
                <div class="badge badge-cat">${category}</div>
                <h2 class="detail-name">${name}</h2>
                <div class="detail-stars">
                  ${stars} <span>${rating} \u00B7 ${reviewCount} reviews</span>
                </div>
              </div>
            </div>
          </div>
          <div class="detail-body">
            ${this._renderTabBodyHTML(activeTab, spot)}
          </div>
        </div>
        <div class="detail-sidebar">
          ${this._renderSidebarHTML(spot)}
        </div>
      </div>
    `;
  }

  /**
   * Build the tab-specific body content.
   *
   * @param {string} tabName
   * @param {object} spot
   * @returns {string} HTML string.
   * @private
   */
  _renderTabBodyHTML(tabName, spot) {
    switch (tabName) {
      case "overview":
        return this._renderOverviewTab(spot);
      case "directions":
        return this._renderDirectionsTab(spot);
      case "gallery":
        return this._renderGalleryTab(spot);
      case "activities":
        return this._renderActivitiesTab(spot);
      default:
        return this._renderOverviewTab(spot);
    }
  }

  /**
   * Render the Overview tab: info grid + description.
   *
   * @param {object} spot
   * @returns {string}
   * @private
   */
  _renderOverviewTab(spot) {
    const fee = this._escapeHtml(spot.entrance_fee || "Fee varies");
    const hours = this._escapeHtml(spot.operating_hours || "Hours vary");
    const address = this._escapeHtml(spot.address || spot.location || "Manila");
    const bestWay = this._escapeHtml(
      spot.best_way || spot.transport || "Various options",
    );
    const description = this._escapeHtml(
      spot.description || "No description available.",
    );

    return `
      <div class="detail-info-grid">
        <div class="info-block">
          <div class="info-block-icon">\u20B1</div>
          <div>
            <div class="info-block-label">Entrance fee</div>
            <div class="info-block-value">${fee}</div>
          </div>
        </div>
        <div class="info-block">
          <div class="info-block-icon">\u25F7</div>
          <div>
            <div class="info-block-label">Operating hours</div>
            <div class="info-block-value">${hours}</div>
          </div>
        </div>
        <div class="info-block">
          <div class="info-block-icon">\u2299</div>
          <div>
            <div class="info-block-label">Address</div>
            <div class="info-block-value">${address}</div>
          </div>
        </div>
        <div class="info-block">
          <div class="info-block-icon">\u2192</div>
          <div>
            <div class="info-block-label">Best way to get there</div>
            <div class="info-block-value">${bestWay}</div>
          </div>
        </div>
      </div>
      <div class="detail-desc-block">
        <h3 class="detail-sub-heading">About this landmark</h3>
        <p class="detail-desc-text">${description}</p>
      </div>
    `;
  }

  /**
   * Render the Directions tab.
   *
   * @param {object} spot
   * @returns {string}
   * @private
   */
  _renderDirectionsTab(spot) {
    const address = this._escapeHtml(spot.address || spot.location || "Manila");
    const transport = this._escapeHtml(spot.transport || spot.best_way || "");
    const directions = this._escapeHtml(spot.directions || "");

    return `
      <div class="detail-info-grid">
        <div class="info-block">
          <div class="info-block-icon">\u2299</div>
          <div>
            <div class="info-block-label">Address</div>
            <div class="info-block-value">${address}</div>
          </div>
        </div>
        <div class="info-block">
          <div class="info-block-icon">\u2192</div>
          <div>
            <div class="info-block-label">Best way to get there</div>
            <div class="info-block-value">${transport || "Various options"}</div>
          </div>
        </div>
      </div>
      ${
        directions
          ? `
      <div class="detail-desc-block">
        <h3 class="detail-sub-heading">Getting there</h3>
        <p class="detail-desc-text">${directions}</p>
      </div>
      `
          : `
      <div class="detail-desc-block">
        <h3 class="detail-sub-heading">Getting there</h3>
        <p class="detail-desc-text">Navigate to ${address}. Multiple public transport options available including LRT, jeepneys, and taxis.</p>
      </div>
      `
      }
    `;
  }

  /**
   * Render the Gallery tab.
   *
   * @param {object} spot
   * @returns {string}
   * @private
   */
  _renderGalleryTab(spot) {
    const name = this._escapeHtml(spot.name || "this spot");
    const gradient = this._gradientForCategory(spot.category);

    // If the spot has image URLs, render them; otherwise show placeholders
    const images =
      spot.images && Array.isArray(spot.images) && spot.images.length > 0
        ? spot.images
        : null;

    if (images) {
      const imageCards = images
        .map(
          (url) => `
        <div class="gallery-card">
          <img src="${this._escapeHtml(url)}" alt="${name}" loading="lazy" />
        </div>
      `,
        )
        .join("");

      return `
      <div class="detail-desc-block">
        <h3 class="detail-sub-heading">Photo gallery</h3>
      </div>
      <div class="gallery-grid">
        ${imageCards}
      </div>
      `;
    }

    // Placeholder gallery cards
    const placeholders = [1, 2, 3, 4]
      .map(
        (i) => `
      <div class="gallery-card gallery-placeholder" style="background: ${gradient}">
        <span>${name} \u2014 Photo ${i}</span>
      </div>
    `,
      )
      .join("");

    return `
      <div class="detail-desc-block">
        <h3 class="detail-sub-heading">Photo gallery</h3>
      </div>
      <div class="gallery-grid">
        ${placeholders}
      </div>
    `;
  }

  /**
   * Render the Activities tab.
   *
   * @param {object} spot
   * @returns {string}
   * @private
   */
  _renderActivitiesTab(spot) {
    const activities =
      spot.activities &&
      Array.isArray(spot.activities) &&
      spot.activities.length > 0
        ? spot.activities
        : spot.tags && Array.isArray(spot.tags) && spot.tags.length > 0
          ? spot.tags
          : null;

    if (activities) {
      const tags = activities
        .map((a) => `<span class="activity-tag">${this._escapeHtml(a)}</span>`)
        .join("\n");

      return `
      <div class="detail-activities">
        <h3 class="detail-sub-heading">Available activities</h3>
        <div class="activities-wrap">
          ${tags}
        </div>
      </div>
      `;
    }

    // Fallback activities based on category
    const fallbackActivities = this._fallbackActivities(spot.category);

    return `
      <div class="detail-activities">
        <h3 class="detail-sub-heading">Available activities</h3>
        <div class="activities-wrap">
          ${fallbackActivities.map((a) => `<span class="activity-tag">${this._escapeHtml(a)}</span>`).join("\n")}
        </div>
      </div>
    `;
  }

  /**
   * Render the sidebar: Plan your visit + Nearby attractions cards.
   *
   * @param {object} spot
   * @returns {string}
   * @private
   */
  _renderSidebarHTML(spot) {
    const hours = (spot.operating_hours || "").toLowerCase();
    const isOpen = hours.includes("24") || hours.includes("daily");
    const openStatus = isOpen
      ? "Yes \u00B7 Open daily"
      : hours || "Check hours";

    const bestTime = this._escapeHtml(
      spot.best_time_visit || "Morning (8\u201310 AM)",
    );
    const duration = this._durationForCategory(spot.category);

    const isAuth = this._sessionStore.isAuthenticated();
    const itinDisabled = isAuth ? "" : "disabled";
    const itinText = isAuth
      ? "Add to itinerary"
      : "Sign in to add to itinerary";
    const favDisabled = isAuth ? "" : "disabled";
    const favText = isAuth ? "Save to favorites" : "Sign in to save";

    return `
      <div class="sidebar-card">
        <h4 class="sidebar-card-title">Plan your visit</h4>
        <div class="sidebar-info-list">
          <div class="sidebar-info-item">
            <span class="si-label">Open today</span>
            <span class="si-val open">${openStatus}</span>
          </div>
          <div class="sidebar-info-item">
            <span class="si-label">Best time to visit</span>
            <span class="si-val">${bestTime}</span>
          </div>
          <div class="sidebar-info-item">
            <span class="si-label">Duration</span>
            <span class="si-val">${duration}</span>
          </div>
          <div class="sidebar-info-item">
            <span class="si-label">Accessibility</span>
            <span class="si-val">Information not available</span>
          </div>
        </div>
        <button class="btn-primary full-w itin-add-btn" ${itinDisabled}>${itinText}</button>
        <div class="add-to-itin-form" style="display:none;">
          <input type="date" class="itin-date-input" />
          <input type="time" class="itin-time-input" />
          <button class="btn-primary sm itin-confirm-btn">Add to trip</button>
          <span class="itin-success-msg" style="display:none; color: var(--success); font-size: 13px;"></span>
        </div>
        <button class="btn-ghost full-w mt-8 fav-btn" ${favDisabled}>${favText}</button>
      </div>
      <div class="sidebar-card nearby-card">
        <h4 class="sidebar-card-title">Nearby attractions</h4>
        <div class="nearby-list">
          <p class="nearby-loading" style="color: var(--text-muted); font-size: 14px;">Loading nearby spots\u2026</p>
        </div>
      </div>
    `;
  }

  /**
   * Wire sidebar interactivity after render: button handlers, nearby
   * attractions fetch, and auth-dependent state.
   *
   * @param {object} spot — The currently displayed spot.
   * @returns {Promise<void>}
   * @private
   */
  async _updateSidebar(spot) {
    const user = this._sessionStore.getUser();
    const isAuth = !!user;

    // ── "Add to itinerary" button ────────────────────────────────────
    const itinBtn = document.querySelector(".itin-add-btn");
    const itinForm = document.querySelector(".add-to-itin-form");
    const dateInput = document.querySelector(".itin-date-input");
    const timeInput = document.querySelector(".itin-time-input");
    const confirmBtn = document.querySelector(".itin-confirm-btn");
    const successMsg = document.querySelector(".itin-success-msg");

    if (itinBtn && itinForm && confirmBtn) {
      if (isAuth) {
        // Show the inline form on button click
        itinBtn.addEventListener("click", () => {
          itinBtn.style.display = "none";
          itinForm.style.display = "flex";
          if (successMsg) successMsg.style.display = "none";
        });

        // Confirm: emit event with date / time
        confirmBtn.addEventListener("click", () => {
          const date = dateInput ? dateInput.value : "";
          const time = timeInput ? timeInput.value : null;
          if (!date) {
            // Briefly highlight the date input if empty
            if (dateInput) {
              dateInput.style.borderColor = "var(--danger)";
              setTimeout(() => {
                dateInput.style.borderColor = "";
              }, 1500);
            }
            return;
          }
          this._eventBus.emit("itinerary:addRequest", {
            spotId: spot.id,
            spotName: spot.name,
            date,
            time,
          });
        });
      }
    }

    // ── "Save to favorites" button ───────────────────────────────────
    const favBtn = document.querySelector(".fav-btn");
    if (favBtn && isAuth) {
      favBtn.addEventListener("click", async () => {
        const { saved, error } = await this._spotApi.toggleSavedSpot(
          user.id,
          spot.id,
        );
        if (error) {
          favBtn.textContent = "Error \u2013 try again";
          return;
        }
        favBtn.textContent = saved ? "Saved \u2713" : "Save to favorites";
      });
    }

    // ── Listen for itinerary:itemAdded → show success ────────────────
    const onItemAdded = (data) => {
      if (data && data.spotName === spot.name) {
        // Hide form, show success
        if (itinForm) itinForm.style.display = "none";
        if (itinBtn) itinBtn.style.display = "";
        if (successMsg) {
          successMsg.textContent = `Added to itinerary for ${data.date || ""}!`;
          successMsg.style.display = "inline";
        }
      }
    };
    this._unsubscribers.push(
      this._eventBus.on("itinerary:itemAdded", onItemAdded),
    );

    // ── Nearby attractions ───────────────────────────────────────────
    await this._loadNearbySpots(spot);
  }

  /**
   * Fetch and render up to 3 nearby spots from the same category.
   *
   * @param {object} spot
   * @returns {Promise<void>}
   * @private
   */
  async _loadNearbySpots(spot) {
    const nearbyList = document.querySelector(".nearby-list");
    if (!nearbyList) return;

    const category = spot.category;
    if (!category) {
      nearbyList.innerHTML =
        '<p style="color: var(--text-muted); font-size: 14px;">No nearby suggestions available.</p>';
      return;
    }

    const { spots, error } = await this._spotApi.getSpots({
      category,
      status: "active",
    });

    if (error || !spots || spots.length === 0) {
      nearbyList.innerHTML =
        '<p style="color: var(--text-muted); font-size: 14px;">No nearby spots found.</p>';
      return;
    }

    // Exclude current spot, take first 3
    const nearby = spots.filter((s) => s.id !== spot.id).slice(0, 3);

    if (nearby.length === 0) {
      nearbyList.innerHTML =
        '<p style="color: var(--text-muted); font-size: 14px;">No other spots in this category yet.</p>';
      return;
    }

    nearbyList.innerHTML = nearby
      .map(
        (s) =>
          `<div class="nearby-item" style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); cursor:pointer;" data-spot-id="${s.id}">
            <div style="width:32px; height:32px; border-radius:8px; flex-shrink:0; background:${this._gradientForCategory(s.category)}"></div>
            <span style="font-size:14px; color:var(--text);">${this._escapeHtml(s.name)}</span>
          </div>`,
      )
      .join("");

    // Click handler: emit spot:detailOpen for clicked nearby spot
    nearbyList.addEventListener("click", (e) => {
      const item = e.target.closest(".nearby-item");
      if (!item) return;
      const spotId = item.dataset.spotId;
      if (!spotId) return;
      // Find the spot in the fetched results
      const clicked = spots.find((s) => String(s.id) === String(spotId));
      if (clicked) {
        this._eventBus.emit("spot:detailOpen", { spot: clicked });
      }
    });
  }

  /**
   * Return a human-readable duration estimate based on the spot category.
   *
   * @param {string} category
   * @returns {string}
   * @private
   */
  _durationForCategory(category) {
    if (!category) return "1\u20132 hours";

    const c = category.toLowerCase();
    const map = {
      museum: "1\u20132 hours",
      park: "1\u20133 hours",
      historical: "1.5\u20133 hours",
      restaurant: "1 hour",
      shopping: "2\u20133 hours",
      market: "1\u20132 hours",
      religious: "1\u20132 hours",
      entertainment: "1.5\u20133 hours",
    };

    return map[c] ?? "1\u20132 hours";
  }

  /**
   * Render the empty / placeholder state (no spot selected yet).
   *
   * @private
   */
  _renderEmpty() {
    const section = document.getElementById("detail");
    if (!section) return;

    const container = section.querySelector(".container");
    if (!container) return;

    container.innerHTML = `
      <div class="section-eyebrow">Spot Detail Page</div>
      <div class="detail-layout" style="display: flex; align-items: center; justify-content: center; min-height: 300px;">
        <div style="text-align: center; color: var(--text-muted);">
          <p style="font-size: 16px; margin-bottom: 8px;">Select a destination card above to view details.</p>
          <p style="font-size: 14px;">Click &ldquo;View details&rdquo; on any spot card.</p>
        </div>
      </div>
    `;
  }

  // -----------------------------------------------------------------------
  // Private — tab listeners
  // -----------------------------------------------------------------------

  /**
   * Attach the tab click handler via event delegation on the tabs bar.
   *
   * @private
   */
  _attachTabListeners() {
    this._detachTabListeners();

    this._tabClickHandler = this._onTabClick.bind(this);
    const tabsBar = document.querySelector(".detail-tabs-bar");
    if (tabsBar) {
      tabsBar.addEventListener("click", this._tabClickHandler);
    }
  }

  /**
   * Remove the tab click handler.
   *
   * @private
   */
  _detachTabListeners() {
    if (this._tabClickHandler) {
      const tabsBar = document.querySelector(".detail-tabs-bar");
      if (tabsBar) {
        tabsBar.removeEventListener("click", this._tabClickHandler);
      }
      this._tabClickHandler = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private — helpers
  // -----------------------------------------------------------------------

  /**
   * Return a CSS gradient for the detail hero based on category.
   *
   * @param {string} category
   * @returns {string}
   * @private
   */
  _gradientForCategory(category) {
    if (!category) {
      return "linear-gradient(160deg, #1e2d4d 0%, #0f1929 100%)";
    }

    const c = category.toLowerCase();
    const map = {
      historical: "linear-gradient(160deg, #1e2d4d 0%, #0f1929 100%)",
      religious: "linear-gradient(160deg, #4d2a0a 0%, #2b1507 100%)",
      park: "linear-gradient(160deg, #1a4d2e 0%, #0d2b1a 100%)",
      museum: "linear-gradient(160deg, #3d1a4d 0%, #1f0d2b 100%)",
      restaurant: "linear-gradient(160deg, #4d2a0a 0%, #2b1507 100%)",
      shopping: "linear-gradient(160deg, #0a2d4d 0%, #061929 100%)",
      market: "linear-gradient(160deg, #4d0a2a 0%, #2b0714 100%)",
      entertainment: "linear-gradient(160deg, #2a0a4d 0%, #16072b 100%)",
    };

    return map[c] ?? "linear-gradient(160deg, #1e2d4d 0%, #0f1929 100%)";
  }

  /**
   * Render a star rating string.
   *
   * @param {number} count
   * @returns {string}
   * @private
   */
  _renderStars(count) {
    const filled = Math.max(0, Math.min(5, count));
    const empty = 5 - filled;
    return "\u2605".repeat(filled) + "\u2606".repeat(empty);
  }

  /**
   * Suggest fallback activities based on spot category.
   *
   * @param {string} category
   * @returns {string[]}
   * @private
   */
  _fallbackActivities(category) {
    if (!category) return ["Sightseeing", "Photography"];

    const c = category.toLowerCase();
    const map = {
      historical: [
        "Guided tours",
        "Museum visit",
        "Photography",
        "Historical walks",
        "Cultural events",
      ],
      religious: [
        "Prayer",
        "Guided tours",
        "Photography",
        "Meditation",
        "Cultural events",
      ],
      park: ["Walking", "Picnic", "Photography", "Jogging", "Bird watching"],
      museum: [
        "Guided tours",
        "Exhibition viewing",
        "Photography",
        "Workshops",
        "Research",
      ],
      restaurant: [
        "Dining",
        "Food tasting",
        "Private events",
        "Cooking classes",
      ],
      shopping: ["Shopping", "Window browsing", "Food court", "Entertainment"],
      market: [
        "Bargain hunting",
        "Food tasting",
        "Photography",
        "Local crafts",
      ],
      entertainment: ["Live shows", "Gaming", "Dining", "Social events"],
    };

    return map[c] ?? ["Sightseeing", "Photography", "Guided tours"];
  }

  /**
   * Minimal HTML-escape to prevent XSS.
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
