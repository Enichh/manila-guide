// ---------------------------------------------------------------------------
// auth-form.js — Authentication Form Orchestrator
// ---------------------------------------------------------------------------
// UI orchestration for the login page: tab switching, field validation,
// sign‑in / register submission, and verification‑code flow delegation.
//
// Exports (default): AuthForm
// ---------------------------------------------------------------------------

import VerifyForm from "./verify-form.js";

/**
 * Orchestrates the auth UI on `login.html`.
 *
 * **Single Responsibility:** Wire up DOM events, validate form fields, and
 * coordinate the two‑step auth flow.  All I/O is delegated to {@link AuthApi}
 * and {@link ProfileApi}; session persistence goes through {@link SessionStore}.
 *
 * The verification‑code step is delegated to {@link VerifyForm} for further
 * separation of concerns.
 *
 * All external dependencies arrive via the constructor (DI).
 */
export default class AuthForm {
  /**
   * @param {import('../services/auth-api.js').default} authApi
   * @param {import('../services/session-store.js').default} sessionStore
   * @param {import('../core/event-bus.js')} eventBus - Pub/sub event bus
   *        (the module namespace object).
   * @param {import('../services/profile-api.js').default} profileApi
   * @param {import('../services/router.js').default} router
   * @param {import('../services/validators.js').default} authValidator
   */
  constructor(
    authApi,
    sessionStore,
    eventBus,
    profileApi,
    router,
    authValidator,
  ) {
    /** @private */
    this._authApi = authApi;
    /** @private */
    this._sessionStore = sessionStore;
    /** @private */
    this._eventBus = eventBus;
    /** @private */
    this._profileApi = profileApi;
    /** @private */
    this._router = router;
    /** @private */
    this._authValidator = authValidator;

    // Sub‑components
    /** @private @type {VerifyForm|null} */
    this._verifyForm = null;

    // State
    /** @private @type {'signin'|'register'|null} */
    this._currentAction = null;
    /** @private @type {{ name: string, email: string, password: string }|null} */
    this._signupData = null;
    /** @private @type {object|null} Supabase session returned after successful sign‑in */
    this._loginSession = null;

    // Bound handlers (stored for cleanup)
    /** @private */
    this._onTabClick = this._onTabClick.bind(this);
    /** @private */
    this._onRegisterClick = this._onRegisterClick.bind(this);
    /** @private */
    this._onSignInClick = this._onSignInClick.bind(this);
    /** @private */
    this._onKeyDown = this._onKeyDown.bind(this);
    /** @private */
    this._onVerifySuccess = this._onVerifySuccess.bind(this);
    /** @private */
    this._onVerifyCancel = this._onVerifyCancel.bind(this);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Attach all event listeners.  Must be called after the DOM is ready.
   *
   * Uses event delegation on:
   *   - `.auth-tabs` for tab switching
   *   - `#panel-register` for the register button
   *   - `#panel-signin` for the sign‑in button
   *   - `document` for Enter‑key submission
   */
  init() {
    this._attachListeners();

    // Check for a `?registered=true` query param and show success message
    this._handleRegisteredRedirect();

    // Listen for verification‑code success / cancel events from VerifyForm
    this._eventBus.on("verify:codeSuccess", this._onVerifySuccess);
    this._eventBus.on("verify:cancel", this._onVerifyCancel);
  }

  /**
   * Switch between the "signin" and "register" panels.
   *
   * @param {'signin'|'register'} tab
   */
  switchTab(tab) {
    const tabs = document.querySelectorAll(".auth-tab-btn");
    tabs.forEach((btn, i) => {
      btn.classList.toggle(
        "active",
        (i === 0 && tab === "signin") || (i === 1 && tab === "register"),
      );
    });

    const signinPanel = document.getElementById("panel-signin");
    const registerPanel = document.getElementById("panel-register");

    if (signinPanel) signinPanel.classList.toggle("active", tab === "signin");
    if (registerPanel)
      registerPanel.classList.toggle("active", tab === "register");

    this.hideError("signin");
    this.hideError("register");
  }

  /**
   * Show an error message inside a specific panel.
   *
   * @param {string} panelId - Either `"signin"` or `"register"`.
   * @param {string} message - Human‑readable error text.
   */
  showError(panelId, message) {
    const el = document.getElementById(`${panelId}-error`);
    if (el) {
      el.textContent = message;
      el.classList.add("show");
    }
  }

  /**
   * Hide the error message for a specific panel.
   *
   * @param {string} panelId - Either `"signin"` or `"register"`.
   */
  hideError(panelId) {
    const el = document.getElementById(`${panelId}-error`);
    if (el) el.classList.remove("show");
  }

  /**
   * Replace the given panel's content with the verification‑code input UI
   * (delegates to {@link VerifyForm}).
   *
   * @param {'signin'|'register'} panel - Which panel to replace.
   */
  showCodeInput(panel) {
    const panelEl = document.getElementById(`panel-${panel}`);
    if (!panelEl) return;

    const email =
      panel === "register"
        ? this._signupData.email
        : this._loginSession.user.email;

    const extraData =
      panel === "register"
        ? { password: this._signupData.password, name: this._signupData.name }
        : {};

    // Clean up any previous VerifyForm instance
    if (this._verifyForm) {
      this._verifyForm.cleanup();
    }

    // Create a new VerifyForm and render into the panel
    this._verifyForm = new VerifyForm(this._authApi, this._eventBus);
    this._verifyForm.render(panelEl, {
      email,
      action: panel === "register" ? "register" : "login",
      extraData,
      panelId: panel,
    });
  }

  /**
   * Called by the verification UI when a full 6‑digit code has been entered
   * and successfully verified by the backend.
   *
   * @param {object} payload
   * @param {string} payload.action  - `"register"` or `"login"`.
   * @param {string} payload.email
   * @param {object} payload.result  - The parsed JSON response from verify‑code.
   */
  async handleCodeInput({ action, email, result }) {
    // The actual verify‑code API call is already done by VerifyForm.
    // This handler deals with post‑verification routing.
    try {
      if (action === "register") {
        // Registration successful — redirect to login
        this._router.navigate("login.html?registered=true");
      } else {
        // Login flow — fetch profile to determine role
        const userId = this._loginSession?.user?.id;
        if (!userId) {
          throw new Error("Session lost. Please sign in again.");
        }

        const { profile, error } = await this._profileApi.getProfile(userId);

        if (error) {
          console.error("Failed to fetch profile:", error);
        }

        const userRole = profile?.role || "user";
        const userName =
          profile?.full_name ||
          this._loginSession.user.user_metadata?.full_name ||
          this._loginSession.user.email.split("@")[0];

        // Persist session
        this._sessionStore.setUser({
          email: this._loginSession.user.email,
          name: userName,
          role: userRole,
        });

        // Emit auth event
        this._eventBus.emit(this._eventBus.AUTH_SIGNED_IN, {
          email: this._loginSession.user.email,
          name: userName,
          role: userRole,
        });
        this._eventBus.emit(this._eventBus.AUTH_CHANGED, {
          email: this._loginSession.user.email,
          name: userName,
          role: userRole,
        });

        // Redirect based on role
        if (userRole === "admin") {
          this._router.navigate("admin.html");
        } else {
          this._router.navigate("index.html");
        }
      }
    } catch (err) {
      // If we have an active VerifyForm, show the error there
      if (this._verifyForm) {
        this._verifyForm.showError(err.message);
      } else {
        this.showError("signin", err.message);
      }
    }
  }

  /**
   * Resend the verification code for the given panel.
   *
   * @param {'signin'|'register'} panel
   */
  async resendCode(panel) {
    if (!this._verifyForm) return;

    const email =
      panel === "register"
        ? this._signupData?.email
        : this._loginSession?.user?.email;

    if (!email) return;

    try {
      await this._authApi.requestVerificationCode(
        email,
        panel === "register" ? "register" : "login",
      );
      this._verifyForm.showResendSuccess();
    } catch (err) {
      this._verifyForm.showResendError(err.message);
    }
  }

  /**
   * Cancel the verification flow and reload the page to reset all state.
   *
   * @param {'signin'|'register'} _panel - Unused; kept for API compatibility.
   */
  cancelVerification(_panel) {
    // Reset internal state
    this._currentAction = null;
    this._signupData = null;
    this._loginSession = null;

    // Reload the page to guarantee a clean slate
    this._router.reload();
  }

  /**
   * Remove all event listeners and clean up sub‑components.
   */
  cleanup() {
    this._removeListeners();
    this._eventBus.off("verify:codeSuccess", this._onVerifySuccess);
    this._eventBus.off("verify:cancel", this._onVerifyCancel);

    if (this._verifyForm) {
      this._verifyForm.cleanup();
      this._verifyForm = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private — event listener setup / teardown
  // -----------------------------------------------------------------------

  /**
   * Attach event listeners via delegation where sensible.
   * @private
   */
  _attachListeners() {
    // Tab switching — delegation on the tabs container
    const tabsContainer = document.querySelector(".auth-tabs");
    if (tabsContainer) {
      tabsContainer.addEventListener("click", this._onTabClick);
    }

    // Register button — delegation on the register panel
    const registerPanel = document.getElementById("panel-register");
    if (registerPanel) {
      registerPanel.addEventListener("click", this._onRegisterClick);
    }

    // Sign‑in button — delegation on the sign‑in panel
    const signinPanel = document.getElementById("panel-signin");
    if (signinPanel) {
      signinPanel.addEventListener("click", this._onSignInClick);
    }

    // Enter‑key submission
    document.addEventListener("keydown", this._onKeyDown);
  }

  /**
   * Remove the listeners attached in `_attachListeners`.
   * @private
   */
  _removeListeners() {
    const tabsContainer = document.querySelector(".auth-tabs");
    if (tabsContainer) {
      tabsContainer.removeEventListener("click", this._onTabClick);
    }

    const registerPanel = document.getElementById("panel-register");
    if (registerPanel) {
      registerPanel.removeEventListener("click", this._onRegisterClick);
    }

    const signinPanel = document.getElementById("panel-signin");
    if (signinPanel) {
      signinPanel.removeEventListener("click", this._onSignInClick);
    }

    document.removeEventListener("keydown", this._onKeyDown);
  }

  // -----------------------------------------------------------------------
  // Private — event handlers
  // -----------------------------------------------------------------------

  /**
   * Delegate click on `.auth-tabs` to the individual tab buttons.
   *
   * @param {MouseEvent} e
   * @private
   */
  _onTabClick(e) {
    const btn = e.target.closest(".auth-tab-btn");
    if (!btn) return;

    e.preventDefault();

    // Determine which tab based on button position / text
    const tabs = [...document.querySelectorAll(".auth-tab-btn")];
    const idx = tabs.indexOf(btn);
    const tab = idx === 0 ? "signin" : "register";

    this.switchTab(tab);
  }

  /**
   * Delegate click on the register panel to the submit button.
   *
   * @param {MouseEvent} e
   * @private
   */
  _onRegisterClick(e) {
    const btn = e.target.closest(".btn-primary");
    if (!btn) return; // Not the submit button — ignore

    // Guard against double‑clicks while verification UI is showing
    if (btn.disabled) return;

    e.preventDefault();
    this._handleRegister();
  }

  /**
   * Delegate click on the sign‑in panel to the submit button.
   *
   * @param {MouseEvent} e
   * @private
   */
  _onSignInClick(e) {
    const btn = e.target.closest(".btn-primary");
    if (!btn) return;

    if (btn.disabled) return;

    e.preventDefault();
    this._handleSignIn();
  }

  /**
   * Enter‑key handler — submits the currently active panel's form.
   *
   * @param {KeyboardEvent} e
   * @private
   */
  _onKeyDown(e) {
    if (e.key !== "Enter") return;

    const activePanel = document.querySelector(".auth-panel.active");
    if (!activePanel) return;

    // Only trigger on non‑code‑input panels (code input uses auto‑verify)
    const hasNameField = activePanel.querySelector(
      'input[type="text"]:not([inputmode])',
    );

    if (activePanel.id === "panel-signin") {
      e.preventDefault();
      this._handleSignIn();
    } else if (activePanel.id === "panel-register" && hasNameField) {
      e.preventDefault();
      this._handleRegister();
    }
  }

  // -----------------------------------------------------------------------
  // Private — form submission logic
  // -----------------------------------------------------------------------

  /**
   * Validate the register form and kick off the verification flow.
   * @private
   */
  async _handleRegister() {
    const panel = document.getElementById("panel-register");
    if (!panel) return;

    const nameEl = panel.querySelector('input[type="text"]');
    const emailEl = panel.querySelector('input[type="email"]');
    const passwordEl = panel.querySelector('input[type="password"]');

    if (!nameEl || !emailEl || !passwordEl) return;

    const name = nameEl.value.trim();
    const email = emailEl.value.trim().toLowerCase();
    const password = passwordEl.value;

    this.hideError("register");

    // Validation (delegated to AuthValidator)
    const result = this._authValidator.validateRegistration(
      name,
      email,
      password,
    );
    if (!result.valid) {
      this.showError("register", result.error);
      return;
    }

    // Disable form controls while waiting for the verification code
    this._setPanelDisabled(panel, true);

    try {
      await this._authApi.requestVerificationCode(email, "register");

      // Store data for the verification step
      this._signupData = { name, email, password };
      this._currentAction = "register";

      this.showCodeInput("register");
    } catch (err) {
      this.showError("register", err.message);
      this._setPanelDisabled(panel, false);
    }
  }

  /**
   * Validate the sign‑in form and kick off the two‑step login flow.
   * @private
   */
  async _handleSignIn() {
    const panel = document.getElementById("panel-signin");
    if (!panel) return;

    const emailEl = document.getElementById("signin-email");
    const passwordEl = document.getElementById("signin-password");

    if (!emailEl || !passwordEl) return;

    const email = emailEl.value.trim().toLowerCase();
    const password = passwordEl.value;

    this.hideError("signin");

    // Validation (delegated to AuthValidator)
    const result = this._authValidator.validateSignIn(email, password);
    if (!result.valid) {
      this.showError("signin", result.error);
      return;
    }

    this._setPanelDisabled(panel, true);

    try {
      // Step 1: password auth against Supabase
      const { session, error } = await this._authApi.signIn(email, password);

      if (error || !session) {
        throw new Error("Invalid email or password.");
      }

      // Step 2: request verification code
      await this._authApi.requestVerificationCode(email, "login");

      this._loginSession = session;
      this._currentAction = "login";

      this.showCodeInput("signin");
    } catch (err) {
      this.showError("signin", err.message);
      this._setPanelDisabled(panel, false);
    }
  }

  // -----------------------------------------------------------------------
  // Private — verification success / cancel handlers
  // -----------------------------------------------------------------------

  /**
   * Called when `verify:codeSuccess` is emitted by {@link VerifyForm}.
   *
   * @param {object} payload
   * @private
   */
  _onVerifySuccess(payload) {
    this.handleCodeInput(payload);
  }

  /**
   * Called when `verify:cancel` is emitted by {@link VerifyForm}.
   * @private
   */
  _onVerifyCancel() {
    this.cancelVerification();
  }

  // -----------------------------------------------------------------------
  // Private — helpers
  // -----------------------------------------------------------------------

  /**
   * Enable or disable all form controls inside a panel.
   *
   * @param {HTMLElement} panel
   * @param {boolean} disabled
   * @private
   */
  _setPanelDisabled(panel, disabled) {
    const controls = panel.querySelectorAll("input, button");
    controls.forEach((el) => (el.disabled = disabled));
  }

  /**
   * Handle the `?registered=true` query parameter on page load: switch to
   * sign‑in and show the success message.
   * @private
   */
  _handleRegisteredRedirect() {
    if (!this._router.getPathname().includes("login.html")) return;

    const params = this._router.getSearchParams();
    if (params.get("registered") === "true") {
      this.switchTab("signin");

      const successEl = document.getElementById("signin-success");
      if (successEl) successEl.classList.add("show");

      // Clean the URL without reloading
      this._router.replaceState({}, document.title, this._router.getPathname());
    }
  }
}
