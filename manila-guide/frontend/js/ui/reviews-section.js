// ---------------------------------------------------------------------------
// reviews-section.js — Dynamic Reviews with Write Review Form
// ---------------------------------------------------------------------------
// Handles displaying reviews for a spot in the #reviews section, including
// fetching data from SpotApi, rendering a summary card with rating bar chart,
// and providing an inline "Write a Review" form.
//
// SOLID: Single Responsibility — only reviews display + submission.
//        Dependency Inversion — injects SpotApi, SessionStore, EventBus.
//
// Exports (default):
//   ReviewsSection
// ---------------------------------------------------------------------------

/**
 * Manages the reviews section: fetches reviews for a spot, renders them,
 * updates the summary card, and provides a write-review form.
 *
 * **Dependencies (injected via constructor):**
 * - `spotApi`      — instance of SpotApi for fetching / posting reviews
 * - `sessionStore` — instance of SessionStore for auth state
 * - `eventBus`     — pub/sub event bus (module namespace)
 */
export default class ReviewsSection {
  /**
   * @param {import('../services/spot-api.js').default} spotApi
   * @param {import('../services/session-store.js').default} sessionStore
   * @param {import('../core/event-bus.js')} eventBus
   */
  constructor(spotApi, sessionStore, eventBus) {
    /** @private */
    this._spotApi = spotApi;
    /** @private */
    this._sessionStore = sessionStore;
    /** @private */
    this._eventBus = eventBus;

    /** @private @type {string|null} — Currently active spot ID. */
    this._currentSpotId = null;

    /** @private @type {object|null} — Currently active spot object. */
    this._currentSpot = null;

    /** @private @type {object[]} — Cached reviews for the current spot. */
    this._currentReviews = [];

    /** @private @type {number} — Selected star rating in the form. */
    this._selectedRating = 0;

    /** @private @type {Function[]} — Cleanup functions for event subscriptions. */
    this._unsubscribers = [];

    /** @private @type {boolean} — Whether styles have been injected. */
    this._stylesInjected = false;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Initialise: render placeholder, subscribe to events.
   */
  init() {
    this._injectStyles();
    this.render(null);

    // Listen for spot detail open
    this._unsubscribers.push(
      this._eventBus.on('spot:detailOpen', (payload) => {
        if (payload && payload.spot) {
          this._currentSpot = payload.spot;
          this._currentSpotId = payload.spot.id;
          this.render(payload.spot.id);
        }
      }),
    );

    // Toggle write-review button state on auth changes
    this._unsubscribers.push(
      this._eventBus.on('auth:signedIn', () => {
        this._toggleWriteButton(true);
      }),
    );
    this._unsubscribers.push(
      this._eventBus.on('auth:signedOut', () => {
        this._toggleWriteButton(false);
      }),
    );
  }

  /**
   * Render the reviews section for a given spot (or show a placeholder).
   *
   * @param {string|null} spotId
   */
  async render(spotId = null) {
    const listCol = document.querySelector('.reviews-list-col');
    if (!listCol) return;

    if (!spotId) {
      this._currentSpotId = null;
      this._currentReviews = [];
      listCol.innerHTML = this._buildPlaceholderHTML();
      this._resetSummaryCard();
      return;
    }

    // Fetch reviews
    const { reviews, error } = await this._spotApi.getReviews(spotId);

    if (error) {
      listCol.innerHTML = this._buildErrorHTML(error.message);
      return;
    }

    this._currentReviews = reviews || [];
    listCol.innerHTML = this._buildReviewListHTML(this._currentReviews);
    this._updateSummaryCard(this._currentReviews);

    // Set initial write button state based on auth
    this._toggleWriteButton(this._sessionStore.isAuthenticated());
  }

  /**
   * Show the inline "Write a Review" form inside the summary card.
   */
  showReviewForm() {
    const card = document.querySelector('.review-summary-card');
    if (!card) return;

    // Find and replace the write button area
    const writeBtn = card.querySelector('.btn-primary.full-w');
    if (!writeBtn) return;

    // Reset state
    this._selectedRating = 0;

    // Replace the button with the form
    const formHTML = `
      <div class="review-form" id="reviewForm">
        <h4 class="review-form-title">Share Your Experience</h4>
        <div class="review-form-stars" id="reviewStars">
          <button class="star-btn empty" data-rating="1">☆</button>
          <button class="star-btn empty" data-rating="2">☆</button>
          <button class="star-btn empty" data-rating="3">☆</button>
          <button class="star-btn empty" data-rating="4">☆</button>
          <button class="star-btn empty" data-rating="5">☆</button>
        </div>
        <textarea
          class="review-form-textarea"
          id="reviewComment"
          placeholder="Tell others about your experience..."
          rows="3"
        ></textarea>
        <div class="review-form-actions">
          <button class="btn-ghost sm" id="reviewCancel">Cancel</button>
          <button class="btn-primary sm" id="reviewSubmit">Submit Review</button>
        </div>
        <div class="error-msg" id="reviewError"></div>
      </div>
    `;

    writeBtn.insertAdjacentHTML('beforebegin', formHTML);
    writeBtn.style.display = 'none';

    // Wire event listeners
    this._wireFormEvents(card);
  }

  /**
   * Remove all event subscriptions.
   */
  cleanup() {
    this._unsubscribers.forEach((unsub) => unsub());
    this._unsubscribers = [];
    this._currentSpotId = null;
    this._currentSpot = null;
    this._currentReviews = [];
    this._selectedRating = 0;
  }

  // -----------------------------------------------------------------------
  // Private — HTML builders
  // -----------------------------------------------------------------------

  /**
   * Build the placeholder message shown when no spot is selected.
   *
   * @returns {string}
   * @private
   */
  _buildPlaceholderHTML() {
    return `
      <div class="review-item" style="text-align:center; padding: 48px 24px;">
        <p style="color: var(--text-muted); font-size: 15px;">
          Select a spot to see its reviews
        </p>
      </div>
    `;
  }

  /**
   * Build an error message HTML.
   *
   * @param {string} message
   * @returns {string}
   * @private
   */
  _buildErrorHTML(message) {
    return `
      <div class="review-item" style="text-align:center; padding: 48px 24px;">
        <p style="color: var(--danger); font-size: 14px;">
          Failed to load reviews: ${this._escapeHtml(message)}
        </p>
      </div>
    `;
  }

  /**
   * Build HTML for a list of reviews.
   *
   * @param {object[]} reviews
   * @returns {string}
   * @private
   */
  _buildReviewListHTML(reviews) {
    if (!reviews || reviews.length === 0) {
      return `
        <div class="review-item" style="text-align:center; padding: 48px 24px;">
          <p style="color: var(--text-muted); font-size: 15px;">
            No reviews yet. Be the first to share your experience!
          </p>
        </div>
      `;
    }

    return reviews
      .map((review) => {
        const initials = this._getInitials(
          review.user_name || review.profiles?.name || 'Anonymous',
        );
        const { bg, color } = this._randomAvatarColor();
        const spotName =
          review.spot_name ||
          (this._currentSpot ? this._currentSpot.name : '');

        return `
          <div class="review-item">
            <div class="review-header">
              <div class="review-avatar" style="background: ${bg}; color: ${color}">
                ${this._escapeHtml(initials)}
              </div>
              <div class="review-user-info">
                <div class="review-user-name">
                  ${this._escapeHtml(review.user_name || review.profiles?.name || 'Anonymous')}
                </div>
                <div class="review-user-meta">
                  ${this._escapeHtml(this._formatReviewDate(review.created_at))}
                </div>
              </div>
              <div class="review-spot-tag">
                ${this._escapeHtml(spotName)}
              </div>
            </div>
            <div class="review-stars">
              ${this._renderStars(review.rating)}
            </div>
            <p class="review-text">
              ${this._escapeHtml(review.comment)}
            </p>
          </div>
        `;
      })
      .join('');
  }

  // -----------------------------------------------------------------------
  // Private — Summary card
  // -----------------------------------------------------------------------

  /**
   * Update the summary card based on review data.
   *
   * @param {object[]} reviews
   * @private
   */
  _updateSummaryCard(reviews) {
    const card = document.querySelector('.review-summary-card');
    if (!card) return;

    // Guard against modifying the card while the form is showing
    if (card.querySelector('#reviewForm')) return;

    const count = reviews.length;

    if (count === 0) {
      // Reset to zero state
      const rscoreEl = card.querySelector('.rscore');
      const starsEl = card.querySelector('.rscore-stars');
      const labelEl = card.querySelector('.rscore-label');

      if (rscoreEl) rscoreEl.textContent = '\u2014';
      if (starsEl) starsEl.textContent = '\u2606\u2606\u2606\u2606\u2606';
      if (labelEl) labelEl.textContent = 'No reviews yet';

      // Reset bars to 0%
      for (let i = 1; i <= 5; i++) {
        const numEl = card.querySelector(`.rbar-row:nth-child(${6 - i})`);
        if (!numEl) continue;
        const fillEl = numEl.querySelector('.rbar-fill');
        const pctEl = numEl.querySelector('.rbar-pct');
        if (fillEl) fillEl.style.width = '0%';
        if (pctEl) pctEl.textContent = '0%';
      }
      return;
    }

    // Calculate average rating
    const total = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    const avg = total / count;

    // Count per star rating
    const buckets = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      const rounded = Math.round(r.rating || 0);
      if (rounded >= 1 && rounded <= 5) {
        buckets[rounded]++;
      }
    });

    // Update score
    const rscoreEl = card.querySelector('.rscore');
    if (rscoreEl) {
      rscoreEl.textContent = avg.toFixed(1);
    }

    // Update stars
    const starsEl = card.querySelector('.rscore-stars');
    if (starsEl) {
      starsEl.textContent = this._renderStars(Math.round(avg));
    }

    // Update label
    const labelEl = card.querySelector('.rscore-label');
    if (labelEl) {
      labelEl.textContent = `Based on ${count} review${count !== 1 ? 's' : ''}`;
    }

    // Update bar chart (the HTML has rows ordered 5→1 top to bottom)
    for (let star = 1; star <= 5; star++) {
      // The nth-child: star 5 is first child (1), star 1 is last (5)
      // So: nth-child for star N = 6 - N
      const rowEl = card.querySelector(
        `.rbar-row:nth-child(${6 - star})`,
      );
      if (!rowEl) continue;

      const fillEl = rowEl.querySelector('.rbar-fill');
      const pctEl = rowEl.querySelector('.rbar-pct');
      const pct = count > 0 ? Math.round((buckets[star] / count) * 100) : 0;

      if (fillEl) fillEl.style.width = `${pct}%`;
      if (pctEl) pctEl.textContent = `${pct}%`;
    }
  }

  /**
   * Reset the summary card to its default placeholder state.
   *
   * @private
   */
  _resetSummaryCard() {
    const card = document.querySelector('.review-summary-card');
    if (!card) return;

    if (card.querySelector('#reviewForm')) return;

    const rscoreEl = card.querySelector('.rscore');
    const starsEl = card.querySelector('.rscore-stars');
    const labelEl = card.querySelector('.rscore-label');

    if (rscoreEl) rscoreEl.textContent = '\u2014';
    if (starsEl) starsEl.textContent = '\u2606\u2606\u2606\u2606\u2606';
    if (labelEl) labelEl.textContent = 'Select a spot to see reviews';

    for (let i = 1; i <= 5; i++) {
      const rowEl = card.querySelector(`.rbar-row:nth-child(${6 - i})`);
      if (!rowEl) continue;
      const fillEl = rowEl.querySelector('.rbar-fill');
      const pctEl = rowEl.querySelector('.rbar-pct');
      if (fillEl) fillEl.style.width = '0%';
      if (pctEl) pctEl.textContent = '0%';
    }
  }

  // -----------------------------------------------------------------------
  // Private — Write button state
  // -----------------------------------------------------------------------

  /**
   * Toggle the "Write a review" button state.
   * When not authenticated: disable with "Sign in to write a review".
   * When authenticated: enable with "Write a review".
   *
   * @param {boolean} authenticated
   * @private
   */
  _toggleWriteButton(authenticated) {
    const card = document.querySelector('.review-summary-card');
    if (!card) return;

    // Don't interfere if the form is currently displayed
    if (card.querySelector('#reviewForm')) return;

    const btn = card.querySelector('.btn-primary.full-w');
    if (!btn) return;

    btn.style.display = '';

    if (!authenticated) {
      btn.textContent = 'Sign in to write a review';
      btn.disabled = true;
      btn.style.opacity = '0.55';
      btn.style.cursor = 'not-allowed';
      btn.title = 'You must be signed in to write a review';
      // Remove existing click handler by cloning
      const clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
    } else {
      btn.textContent = 'Write a review';
      btn.disabled = false;
      btn.style.opacity = '';
      btn.style.cursor = '';
      btn.title = '';
      // Ensure the click handler is wired (replace to remove old ones)
      const clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
      clone.addEventListener('click', () => this.showReviewForm());
    }
  }

  // -----------------------------------------------------------------------
  // Private — Review form wiring
  // -----------------------------------------------------------------------

  /**
   * Wire star button clicks, cancel, and submit for the review form.
   *
   * @param {HTMLElement} card — The `.review-summary-card` element.
   * @private
   */
  _wireFormEvents(card) {
    const starsContainer = card.querySelector('#reviewStars');
    const commentEl = card.querySelector('#reviewComment');
    const cancelBtn = card.querySelector('#reviewCancel');
    const submitBtn = card.querySelector('#reviewSubmit');
    const errorEl = card.querySelector('#reviewError');

    // ── Star buttons ──────────────────────────────────────────────
    if (starsContainer) {
      const starBtns = starsContainer.querySelectorAll('.star-btn');

      const highlightStars = (rating) => {
        starBtns.forEach((btn) => {
          const btnRating = parseInt(btn.getAttribute('data-rating'), 10);
          if (btnRating <= rating) {
            btn.textContent = '\u2605'; // ★
            btn.classList.remove('empty');
          } else {
            btn.textContent = '\u2606'; // ☆
            btn.classList.add('empty');
          }
        });
      };

      starBtns.forEach((btn) => {
        // Click: set rating
        btn.addEventListener('click', () => {
          this._selectedRating = parseInt(
            btn.getAttribute('data-rating'),
            10,
          );
          highlightStars(this._selectedRating);
          // Clear error
          if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
          }
        });

        // Hover: preview
        btn.addEventListener('mouseenter', () => {
          const previewRating = parseInt(
            btn.getAttribute('data-rating'),
            10,
          );
          highlightStars(previewRating);
        });
      });

      // Mouse leave: revert to selected rating
      starsContainer.addEventListener('mouseleave', () => {
        highlightStars(this._selectedRating);
      });
    }

    // ── Cancel ────────────────────────────────────────────────────
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this._hideReviewForm(card);
      });
    }

    // ── Submit ────────────────────────────────────────────────────
    if (submitBtn && commentEl) {
      submitBtn.addEventListener('click', async () => {
        // Validate
        if (this._selectedRating === 0) {
          if (errorEl) {
            errorEl.textContent = 'Please select a star rating.';
            errorEl.style.display = 'block';
          }
          return;
        }

        const comment = commentEl.value.trim();
        if (!comment) {
          if (errorEl) {
            errorEl.textContent = 'Please write a comment.';
            errorEl.style.display = 'block';
          }
          return;
        }

        if (!this._currentSpotId) {
          if (errorEl) {
            errorEl.textContent = 'No spot selected.';
            errorEl.style.display = 'block';
          }
          return;
        }

        const user = this._sessionStore.getUser();
        if (!user || !user.id) {
          if (errorEl) {
            errorEl.textContent =
              'You must be signed in to submit a review.';
            errorEl.style.display = 'block';
          }
          return;
        }

        // Disable submit button to prevent double-submit
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        const { review, error } = await this._spotApi.addReview(
          this._currentSpotId,
          user.id,
          this._selectedRating,
          comment,
        );

        if (error) {
          if (errorEl) {
            errorEl.textContent =
              error.message || 'Failed to submit review. Please try again.';
            errorEl.style.display = 'block';
          }
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Review';
          return;
        }

        // Success: hide form, refresh reviews
        this._hideReviewForm(card);
        await this.render(this._currentSpotId);
      });
    }
  }

  /**
   * Remove the review form and restore the "Write a review" button.
   *
   * @param {HTMLElement} card — The `.review-summary-card` element.
   * @private
   */
  _hideReviewForm(card) {
    const form = card.querySelector('#reviewForm');
    if (form) {
      form.remove();
    }

    // Restore the write button
    const writeBtn = card.querySelector('.btn-primary.full-w');
    if (writeBtn) {
      writeBtn.style.display = '';
      // Re-wire the click handler
      const clone = writeBtn.cloneNode(true);
      writeBtn.parentNode.replaceChild(clone, writeBtn);

      if (this._sessionStore.isAuthenticated()) {
        clone.addEventListener('click', () => this.showReviewForm());
      } else {
        clone.textContent = 'Sign in to write a review';
        clone.disabled = true;
        clone.style.opacity = '0.55';
        clone.style.cursor = 'not-allowed';
        clone.title = 'You must be signed in to write a review';
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private — Formatting helpers
  // -----------------------------------------------------------------------

  /**
   * Convert an ISO date string to a friendly format like "April 2025".
   *
   * @param {string} dateStr
   * @returns {string}
   * @private
   */
  _formatReviewDate(dateStr) {
    if (!dateStr) return '';

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;

      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];

      return `${months[date.getMonth()]} ${date.getFullYear()}`;
    } catch {
      return dateStr;
    }
  }

  /**
   * Render star characters: ★ filled, ☆ empty.
   *
   * @param {number} count — Number of filled stars (0-5).
   * @returns {string}
   * @private
   */
  _renderStars(count) {
    const filled = Math.max(0, Math.min(5, count));
    const empty = 5 - filled;
    return '\u2605'.repeat(filled) + '\u2606'.repeat(empty);
  }

  /**
   * Extract initials from a name string.
   *
   * @param {string} name
   * @returns {string} — 1-2 uppercase characters.
   * @private
   */
  _getInitials(name) {
    if (!name || name === 'Anonymous') return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return '?';
    const first = parts[0].charAt(0).toUpperCase();
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : '';
    return first + last;
  }

  /**
   * Return a random pastel background + dark text colour pair for avatars.
   *
   * @returns {{ bg: string, color: string }}
   * @private
   */
  _randomAvatarColor() {
    const pairs = [
      { bg: '#e8edf7', color: '#2e3f6b' },
      { bg: '#e8f5ef', color: '#1a5c3a' },
      { bg: '#f7ede8', color: '#6b2e1a' },
      { bg: '#f5e8f0', color: '#5c1a4a' },
      { bg: '#e8f4f5', color: '#1a4a5c' },
      { bg: '#f5f2e8', color: '#5c4a1a' },
      { bg: '#eae8f5', color: '#2e1a5c' },
      { bg: '#f0e8f2', color: '#4a1a5c' },
    ];

    return pairs[Math.floor(Math.random() * pairs.length)];
  }

  /**
   * Minimal HTML-escape to prevent XSS.
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

  // -----------------------------------------------------------------------
  // Private — Style injection
  // -----------------------------------------------------------------------

  /**
   * Inject minimal CSS for the review form (only if not already injected).
   *
   * @private
   */
  _injectStyles() {
    if (this._stylesInjected) return;

    // Check if already injected by another instance
    if (document.getElementById('reviews-section-styles')) {
      this._stylesInjected = true;
      return;
    }

    const style = document.createElement('style');
    style.id = 'reviews-section-styles';
    style.textContent = `
      .review-form {
        margin-top: 16px;
      }
      .review-form-title {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 12px;
      }
      .review-form-stars {
        display: flex;
        gap: 4px;
        margin-bottom: 12px;
      }
      .star-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--gold);
        padding: 0;
        transition: transform 0.15s;
      }
      .star-btn:hover {
        transform: scale(1.2);
      }
      .star-btn.empty {
        color: var(--border-mid);
      }
      .review-form-textarea {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 10px;
        font-family: inherit;
        font-size: 13px;
        resize: vertical;
      }
      .review-form-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
        justify-content: flex-end;
      }
    `;

    document.head.appendChild(style);
    this._stylesInjected = true;
  }
}
