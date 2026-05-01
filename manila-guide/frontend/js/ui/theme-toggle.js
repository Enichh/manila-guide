export default class ThemeToggle {
  constructor(eventBus) {
    this._eventBus = eventBus;
    this._STORAGE_KEY = "manila-guide-theme";
    this._onClick = this._onClick.bind(this);
  }

  init() {
    // Restore saved theme
    const saved = localStorage.getItem(this._STORAGE_KEY) || "light";
    this._applyTheme(saved);

    // Render toggle button into every .nav-actions container and admin-nav-actions
    this._renderToggle();

    // Listen for nav updates to re-render toggle
    this._unsub = this._eventBus.on("nav:update", () => {
      // Small delay so NavBar finishes rendering first
      requestAnimationFrame(() => this._renderToggle());
    });
  }

  _renderToggle() {
    // Public page nav
    const publicNav = document.querySelector(".nav-inner .nav-actions");
    if (publicNav && !publicNav.querySelector(".theme-toggle-btn")) {
      const btn = this._createButton();
      // Insert before the last element (or append)
      publicNav.appendChild(btn);
    }

    // Public page mobile menu
    const mobileMenu = document.getElementById("mobileMenu");
    if (mobileMenu && !mobileMenu.querySelector(".theme-toggle-mob")) {
      const mobBtn = document.createElement("a");
      mobBtn.href = "#";
      mobBtn.className = "mob-link theme-toggle-mob";
      mobBtn.textContent =
        this._getTheme() === "dark" ? "Light mode" : "Dark mode";
      mobBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.toggle();
      });
      mobileMenu.appendChild(mobBtn);
    }

    // Admin page
    const adminActions = document.querySelector(".admin-nav-actions");
    if (adminActions && !adminActions.querySelector(".theme-toggle-btn")) {
      const btn = this._createButton();
      adminActions.insertBefore(btn, adminActions.firstChild);
    }
  }

  _createButton() {
    const isDark = this._getTheme() === "dark";
    const btn = document.createElement("button");
    btn.className = "theme-toggle-btn";
    btn.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode",
    );
    btn.innerHTML = isDark ? this._sunIcon() : this._moonIcon();
    btn.addEventListener("click", this._onClick);
    return btn;
  }

  _sunIcon() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  }

  _moonIcon() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }

  toggle() {
    const current = this._getTheme();
    const next = current === "dark" ? "light" : "dark";
    this._applyTheme(next);
    this._updateButtons();
  }

  _onClick(e) {
    e.preventDefault();
    this.toggle();
  }

  _getTheme() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }

  _applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(this._STORAGE_KEY, theme);
  }

  _updateButtons() {
    const isDark = this._getTheme() === "dark";
    document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
      btn.innerHTML = isDark ? this._sunIcon() : this._moonIcon();
      btn.setAttribute(
        "aria-label",
        isDark ? "Switch to light mode" : "Switch to dark mode",
      );
    });
    const mobBtn = document.querySelector(".theme-toggle-mob");
    if (mobBtn) mobBtn.textContent = isDark ? "Light mode" : "Dark mode";
  }

  cleanup() {
    if (this._unsub) this._unsub();
    document
      .querySelectorAll(".theme-toggle-btn, .theme-toggle-mob")
      .forEach((el) => el.remove());
  }
}
