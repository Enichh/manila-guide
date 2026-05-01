// ---------------------------------------------------------------------------
// admin.js — Entry Point for admin.html
// ---------------------------------------------------------------------------
// Composition root for the admin dashboard.  Resolves services from the DI
// container and wires them to admin UI components.
//
// Handles:
//   • Admin auth gate (redirect non‑admins to login)
//   • AdminDashboard — live stats cards from DB
//   • AdminSpotsTable — dynamic spots table with search, edit, delete
//   • AdminSpotForm — create / edit spot form
//   • AdminUsersPanel — user activity & recent registrations
//   • Admin tab switching (event delegation, no inline onclick)
//   • Scroll animations for stats cards
//   • Admin avatar / display‑name update
//
// Loaded as a module via:
//   <script type="module" src="js/pages/admin.js"></script>
// ---------------------------------------------------------------------------

import { bootstrap } from "../bootstrap.js";
import { SERVICES } from "../core/services.js";
import AdminDashboard from "../ui/admin-dashboard.js";
import AdminSpotsTable from "../ui/admin-spots-table.js";
import AdminSpotForm from "../ui/admin-spot-form.js";
import AdminUsersPanel from "../ui/admin-users-panel.js";
import UserMenu from "../ui/user-menu.js";
import ThemeToggle from "../ui/theme-toggle.js";

// ---------------------------------------------------------------------------
// Init — runs on DOMContentLoaded
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  // ── 1. Bootstrap the DI container ─────────────────────────────────────
  const container = await bootstrap();

  // ── 2. Resolve the services needed by this page ────────────────────────
  const sessionStore = container.resolve(SERVICES.SESSION_STORE);
  const eventBus = container.resolve(SERVICES.EVENT_BUS);
  const spotApi = container.resolve(SERVICES.SPOT_API);
  const router = container.resolve(SERVICES.ROUTER);

  // ── 3. Auth gate — redirect if not authenticated or not admin ─────────
  if (!sessionStore.isAuthenticated() || !sessionStore.isAdmin()) {
    router.navigate("login.html");
    return;
  }

  // ── 4. UserMenu — handles logout-btn clicks via event delegation ──────
  const authApi = container.resolve(SERVICES.AUTH_API);

  const userMenu = new UserMenu(sessionStore, eventBus, router, authApi);
  userMenu.init();

  // ── 5. ThemeToggle — dark/light mode toggle button ────────────────────
  const themeToggle = new ThemeToggle(eventBus);
  themeToggle.init();

  // ── 6. Admin avatar / display name ────────────────────────────────────
  updateAdminDisplay(sessionStore);

  // ── 7. Tab switching — event delegation replaces inline onclick ────────
  setupTabSwitching();

  // ── 8. Admin UI components ────────────────────────────────────────────

  // 8a. Dashboard stats cards
  const dashboard = new AdminDashboard(spotApi, eventBus);
  await dashboard.init();

  // 8b. Spots table
  const spotsTable = new AdminSpotsTable(spotApi, eventBus);
  await spotsTable.init();

  // 8c. Spot form (create / edit)
  const spotForm = new AdminSpotForm(spotApi, eventBus);
  spotForm.init();

  // 8d. Users panel
  const usersPanel = new AdminUsersPanel(spotApi, eventBus);
  await usersPanel.init();

  // ── 9. Cross‑component refreshes ──────────────────────────────────────

  // When a spot is saved or deleted, refresh the dashboard stats and table
  eventBus.on("admin:spotSaved", async () => {
    await dashboard.init();
    await spotsTable.init();
  });

  eventBus.on("admin:spotDeleted", async () => {
    await dashboard.init();
    await spotsTable.init();
  });

  // ── 10. Scroll animations ─────────────────────────────────────────────
  setupAdminScrollAnimations();

  // ── 11. Expose instances for debugging ─────────────────────────────────
  window.__app = {
    container,
    sessionStore,
    eventBus,
    spotApi,
    authApi,
    router,
    dashboard,
    spotsTable,
    spotForm,
    usersPanel,
    userMenu,
    themeToggle,
  };
});

// ---------------------------------------------------------------------------
// Tab switching — event delegation on .admin-nav-tabs
// ---------------------------------------------------------------------------

/**
 * Wire tab switching via event delegation, removing the need for inline
 * `onclick` handlers in the HTML.
 */
function setupTabSwitching() {
  const tabsContainer = document.querySelector(".admin-nav-tabs");
  if (!tabsContainer) return;

  tabsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".admin-nav-tab");
    if (!btn) return;

    const onclick = btn.getAttribute("onclick");
    if (!onclick) return;

    // Extract tab name from the old onclick attribute
    // Format: "switchAdminTab('tabName', this)"
    const match = onclick.match(/switchAdminTab\('(\w+)'/);
    if (!match) return;

    const tabName = match[1];
    switchAdminTab(tabName, btn);
  });
}

/**
 * Switch the visible admin panel.
 *
 * Deactivates all `admin-panel` elements and `admin-nav-tab` buttons, then
 * activates the target panel and button.
 *
 * @param {string} tabName - Panel suffix (e.g. `"dashboard"`, `"spots"`).
 * @param {HTMLElement} btn - The clicked tab button.
 */
function switchAdminTab(tabName, btn) {
  document
    .querySelectorAll(".admin-panel")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".admin-nav-tab")
    .forEach((t) => t.classList.remove("active"));

  const targetPanel = document.getElementById(`panel-${tabName}`);
  if (targetPanel) targetPanel.classList.add("active");
  if (btn) btn.classList.add("active");
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Set up an {@link IntersectionObserver} that adds `.visible` to admin stat
 * cards as they scroll into view.
 */
function setupAdminScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("visible");
      });
    },
    { threshold: 0.1 },
  );

  document
    .querySelectorAll(".astat-card")
    .forEach((card) => observer.observe(card));
}

/**
 * Update the admin avatar initial and display name in the header from the
 * session store.
 *
 * @param {import('../services/session-store.js').default} sessionStore
 */
function updateAdminDisplay(sessionStore) {
  const user = sessionStore.getUser();
  if (!user) return;

  const displayName = sessionStore.getDisplayName();
  const initial = displayName.charAt(0).toUpperCase();

  const avatarEl = document.querySelector(".admin-avatar");
  if (avatarEl) avatarEl.textContent = initial;

  const userInfoSpan = document.querySelector(".admin-user-info > span");
  if (userInfoSpan) userInfoSpan.textContent = displayName;
}
