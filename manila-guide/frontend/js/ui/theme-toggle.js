export default class ThemeToggle {
  constructor(eventBus) {
    this._eventBus = eventBus;
    this._STORAGE_KEY = 'manila-guide-theme';
    this._onClick = this._onClick.bind(this);
  }

  init() {
    // Restore saved theme
    const saved = localStorage.getItem(this._STORAGE_KEY) || 'light';
    this._applyTheme(saved);

    // Render toggle button into every .nav-actions container and admin-nav-actions
    this._renderToggle();

    // Listen for nav updates to re-render toggle
    this._unsub = this._eventBus.on('nav:update', () => {
      // Small delay so NavBar finishes rendering first
      requestAnimationFrame(() => this._renderToggle());
    });
  }

  _renderToggle() {
    // Public page nav
    const publicNav = document.querySelector('.nav-inner .nav-actions');
    if (publicNav && !publicNav.querySelector('.theme-toggle-btn')) {
      const btn = this._createButton();
      // Insert before the last element (or append)
      publicNav.appendChild(btn);
    }

    // Public page mobile menu
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu && !mobileMenu.querySelector('.theme-toggle-mob')) {
      const mobBtn = document.createElement('a');
      mobBtn.href = '#';
      mobBtn.className = 'mob-link theme-toggle-mob';
      mobBtn.textContent = this._getTheme() === 'dark' ? '☀️ Light mode' : '🌙 Dark mode';
      mobBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggle();
      });
      mobileMenu.appendChild(mobBtn);
    }

    // Admin page
    const adminActions = document.querySelector('.admin-nav-actions');
    if (adminActions && !adminActions.querySelector('.theme-toggle-btn')) {
      const btn = this._createButton();
      adminActions.insertBefore(btn, adminActions.firstChild);
    }
  }

  _createButton() {
    const isDark = this._getTheme() === 'dark';
    const btn = document.createElement('button');
    btn.className = 'theme-toggle-btn';
    btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.innerHTML = isDark ? '☀️' : '🌙';
    btn.addEventListener('click', this._onClick);
    return btn;
  }

  toggle() {
    const current = this._getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    this._applyTheme(next);
    this._updateButtons();
  }

  _onClick(e) {
    e.preventDefault();
    this.toggle();
  }

  _getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this._STORAGE_KEY, theme);
  }

  _updateButtons() {
    const isDark = this._getTheme() === 'dark';
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.innerHTML = isDark ? '☀️' : '🌙';
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    });
    const mobBtn = document.querySelector('.theme-toggle-mob');
    if (mobBtn) mobBtn.textContent = isDark ? '☀️ Light mode' : '🌙 Dark mode';
  }

  cleanup() {
    if (this._unsub) this._unsub();
    document.querySelectorAll('.theme-toggle-btn, .theme-toggle-mob').forEach(el => el.remove());
  }
}
