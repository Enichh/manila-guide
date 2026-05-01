// ---------------------------------------------------------------------------
// verify-form.js — Verification Code UI Component
// ---------------------------------------------------------------------------
// Renders the 6‑digit code input UI into a given container, auto‑submits on
// the 6th digit, and exposes methods for error / resend feedback.
//
// Exports (default): VerifyForm
// ---------------------------------------------------------------------------

/**
 * Self-contained verification‑code UI.
 *
 * **Single Responsibility:** Render the verification step and handle the
 * code‑input lifecycle.  All business logic (send‑verification, verify‑code)
 * is delegated to `AuthApi`.
 *
 * Designed for Dependency Injection — every external dependency arrives via
 * the constructor.
 */
export default class VerifyForm {
  /**
   * @param {import('../services/auth-api.js').default} authApi
   * @param {import('../core/event-bus.js')} eventBus - Pub/sub event bus
   *        (the module namespace — used for emit calls).
   */
  constructor(authApi, eventBus) {
    /** @private */
    this._authApi = authApi;
    /** @private */
    this._eventBus = eventBus;

    // State set during render()
    /** @private @type {HTMLElement|null} */
    this._container = null;
    /** @private @type {string|null} */
    this._panelId = null;

    // Bound handlers (stored for cleanup)
    /** @private */
    this._onInput = this._onInput.bind(this);
    /** @private */
    this._onKeyDown = this._onKeyDown.bind(this);
    /** @private */
    this._onClick = this._onClick.bind(this);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Render the verification code UI into `container`.
   *
   * After rendering, the user types digits.  Once 6 digits are entered the
   * form auto‑calls `authApi.verifyCode(email, code, action, extraData)`.
   *
   * @param {HTMLElement} container - The DOM element to replace with the
   *        verification UI.
   * @param {object} opts
   * @param {string} opts.email      - The email that received the code.
   * @param {string} opts.action     - `"register"` or `"login"`.
   * @param {object} [opts.extraData={}] - Additional payload for the
   *        verify‑code call (e.g. `password`, `name` on register).
   * @param {string} [opts.panelId]  - ID suffix used for error display
   *        (e.g. `"register"` → `register-error`).  Defaults to action.
   */
  render(container, { email, action, extraData = {}, panelId }) {
    // Store references for later use
    this._container = container;
    this._panelId = panelId || action;

    container.innerHTML = `
      <div class="verify-wrapper">
        <div class="auth-card-header">
          <div class="card-logo-emblem">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L12.5 7.5H18L13.5 11L15.5 17L10 13.5L4.5 17L6.5 11L2 7.5H7.5L10 2Z" fill="currentColor"/>
            </svg>
          </div>
          <span>Verify your email</span>
        </div>
        <h2 class="auth-heading">Enter verification code</h2>
        <p class="auth-sub">
          A 6‑digit code was sent to<br/><strong>${this._escapeHtml(email)}</strong>
        </p>
        <div class="error-msg" id="${this._panelId}-error"></div>
        <div class="form-group code-group">
          <input
            type="text"
            class="form-input code-input"
            id="${this._panelId}-verification-code"
            placeholder="000000"
            maxlength="6"
            inputmode="numeric"
            autocomplete="one-time-code"
            autofocus
          />
        </div>
        <button class="btn-ghost full-w resend-btn" type="button">
          Resend code
        </button>
        <p class="auth-footer">
          <a href="#" class="cancel-verify-link">← Back</a>
        </p>
      </div>
    `;

    // Attach event listeners using delegation on the container
    this._attachListeners();

    // Store metadata on the container so event handlers can reference them
    this._container._verifyData = { email, action, extraData };
  }

  /**
   * Show an error message within the rendered verification UI.
   *
   * @param {string} message - Human‑readable error text.
   */
  showError(message) {
    const errorEl = this._getErrorElement();
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add("show");
      errorEl.style.color = ""; // Reset to default error color
    }
    const input = this._getCodeInput();
    if (input) {
      input.disabled = false;
      input.value = "";
      input.focus();
    }
    // Re-enable resend button
    const resendBtn = this._getResendButton();
    if (resendBtn) resendBtn.disabled = false;
  }

  /**
   * Indicate that the code was successfully resent.
   */
  showResendSuccess() {
    const btn = this._getResendButton();
    if (!btn) return;

    btn.classList.add("success");
    btn.textContent = "Code sent!";
    btn.disabled = true;

    setTimeout(() => {
      btn.classList.remove("success");
      btn.textContent = "Resend code";
      btn.disabled = false;
    }, 3000);
  }

  /**
   * Indicate that resending the code failed.
   *
   * @param {string} message
   */
  showResendError(message) {
    const btn = this._getResendButton();
    if (btn) {
      btn.textContent = "Resend code";
      btn.disabled = false;
    }

    this.showError(message);
  }

  /**
   * Remove all DOM content and event listeners managed by this component.
   * After calling this the container is empty and the instance is inert.
   */
  cleanup() {
    this._removeListeners();

    if (this._container) {
      this._container.innerHTML = "";
      this._container = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private — event handling
  // -----------------------------------------------------------------------

  /**
   * Attach delegation‑based listeners to the container.
   * @private
   */
  _attachListeners() {
    if (!this._container) return;

    this._container.addEventListener("input", this._onInput);
    this._container.addEventListener("keydown", this._onKeyDown);
    this._container.addEventListener("click", this._onClick);
  }

  /**
   * Remove the listeners attached in `_attachListeners`.
   * @private
   */
  _removeListeners() {
    if (!this._container) return;

    this._container.removeEventListener("input", this._onInput);
    this._container.removeEventListener("keydown", this._onKeyDown);
    this._container.removeEventListener("click", this._onClick);
  }

  /**
   * Handle `input` on the code field — filter to digits only and auto‑submit
   * when 6 digits are present.
   *
   * @param {Event} e
   * @private
   */
  async _onInput(e) {
    const input = e.target;
    if (!input.classList.contains("code-input")) return;

    // Strip non‑digits
    const raw = input.value;
    const clean = raw.replace(/\D/g, "");
    if (clean !== raw) {
      input.value = clean;
    }

    // Auto‑submit on 6 digits with delay to prevent double-triggers
    if (clean.length === 6) {
      // Disable input to prevent re-submission
      input.disabled = true;

      // Show verifying state
      this._showVerifyingState();

      // Small delay so user sees the "verifying" state
      setTimeout(async () => {
        await this._verifyCode(clean);
      }, 300);
    }
  }

  /**
   * Handle `keydown` — support Backspace / Delete, block non‑digit printable
   * keys so only digits can be entered (numeric inputmode alone isn't
   * sufficient on desktop).
   *
   * @param {KeyboardEvent} e
   * @private
   */
  _onKeyDown(e) {
    const input = e.target;
    if (!input.classList.contains("code-input")) return;

    // Allow navigation / editing keys
    const allowedKeys = [
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "Tab",
      "Home",
      "End",
    ];
    if (allowedKeys.includes(e.key)) return;

    // Allow Ctrl / Cmd combos (copy / paste / select‑all)
    if (e.ctrlKey || e.metaKey) return;

    // Block non‑digit printable keys
    if (e.key.length === 1 && !/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  }

  /**
   * Handle `click` on the container — delegates to resend or cancel actions.
   *
   * @param {MouseEvent} e
   * @private
   */
  _onClick(e) {
    const target = e.target;

    // Resend button
    if (
      target.classList.contains("resend-btn") ||
      target.closest(".resend-btn")
    ) {
      e.preventDefault();
      this._handleResend();
      return;
    }

    // Cancel link
    if (
      target.classList.contains("cancel-verify-link") ||
      target.closest(".cancel-verify-link")
    ) {
      e.preventDefault();
      this._handleCancel();
      return;
    }
  }

  // -----------------------------------------------------------------------
  // Private — actions
  // -----------------------------------------------------------------------

  /**
   * Call `authApi.verifyCode` and handle the result.
   *
   * @param {string} code - The 6‑digit code.
   * @private
   */
  async _verifyCode(code) {
    const data = this._container?._verifyData;
    if (!data) return;

    try {
      const result = await this._authApi.verifyCode(
        data.email,
        code,
        data.action,
        data.extraData,
      );

      // Show success message before redirect
      this._showSuccessState();

      // Small delay so user sees the success message
      setTimeout(() => {
        this._eventBus.emit("verify:codeSuccess", {
          action: data.action,
          email: data.email,
          result,
        });
      }, 800);
    } catch (err) {
      this.showError(err.message);
      // Re-enable input on error so user can retry
      const input = this._getCodeInput();
      if (input) {
        input.disabled = false;
        input.value = "";
        input.focus();
      }
      this._hideMessage();
    }
  }

  /**
   * Show "Verifying..." state in the UI.
   * @private
   */
  _showVerifyingState() {
    const errorEl = this._getErrorElement();
    if (errorEl) {
      errorEl.textContent = "Code being verified…";
      errorEl.classList.add("show");
      errorEl.style.color = "var(--text-secondary)";
    }
    // Also disable the resend button
    const resendBtn = this._getResendButton();
    if (resendBtn) resendBtn.disabled = true;
  }

  /**
   * Show success state before redirect.
   * @private
   */
  _showSuccessState() {
    const errorEl = this._getErrorElement();
    if (errorEl) {
      errorEl.textContent = "Code verified! Redirecting…";
      errorEl.classList.add("show");
      errorEl.style.color = "var(--success)";
    }
  }

  /**
   * Hide the message display and re-enable the resend button.
   * @private
   */
  _hideMessage() {
    const errorEl = this._getErrorElement();
    if (errorEl) {
      errorEl.classList.remove("show");
      errorEl.style.color = "";
    }
    // Re-enable resend button
    const resendBtn = this._getResendButton();
    if (resendBtn) resendBtn.disabled = false;
  }

  /**
   * Resend the verification code.
   * @private
   */
  async _handleResend() {
    const data = this._container?._verifyData;
    if (!data) return;

    const btn = this._getResendButton();
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sending...";
    }

    try {
      await this._authApi.requestVerificationCode(data.email, data.action);
      this.showResendSuccess();
    } catch (err) {
      this.showResendError(err.message);
    }
  }

  /**
   * Cancel verification — emits an event so the orchestrator can reload or
   * reset the UI.
   * @private
   */
  _handleCancel() {
    this._eventBus.emit("verify:cancel");
  }

  // -----------------------------------------------------------------------
  // Private — DOM helpers
  // -----------------------------------------------------------------------

  /** @returns {HTMLInputElement|null} */
  _getCodeInput() {
    return this._container?.querySelector(".code-input") || null;
  }

  /** @returns {HTMLElement|null} */
  _getErrorElement() {
    const panelId = this._panelId || "signin";
    return this._container?.querySelector(`#${panelId}-error`) || null;
  }

  /** @returns {HTMLButtonElement|null} */
  _getResendButton() {
    return this._container?.querySelector(".resend-btn") || null;
  }

  /**
   * Minimal HTML‑escape for user‑supplied strings.
   *
   * @param {string} str
   * @returns {string}
   * @private
   */
  _escapeHtml(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
}
