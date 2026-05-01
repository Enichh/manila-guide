// ---------------------------------------------------------------------------
// auth.js — Entry Point for login.html
// ---------------------------------------------------------------------------
// Wires up the authentication page using composition‑root DI.  Every service
// the page needs comes from the container — no global lookups, no legacy
// inline `onclick` handlers.
//
// Loaded as a module via:
//   <script type="module" src="js/pages/auth.js"></script>
// ---------------------------------------------------------------------------

import { bootstrap } from "../bootstrap.js";
import { SERVICES } from "../core/services.js";
import AuthForm from "../ui/auth-form.js";
import NavBar from "../ui/nav-bar.js";
import UserMenu from "../ui/user-menu.js";
import ThemeToggle from "../ui/theme-toggle.js";

// ---------------------------------------------------------------------------
// Init — runs on DOMContentLoaded
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  // ── 1. Bootstrap the DI container ─────────────────────────────────────
  const container = await bootstrap();

  // ── 2. Resolve the services needed by this page ────────────────────────
  const authApi = container.resolve(SERVICES.AUTH_API);
  const sessionStore = container.resolve(SERVICES.SESSION_STORE);
  const eventBus = container.resolve(SERVICES.EVENT_BUS);
  const profileApi = container.resolve(SERVICES.PROFILE_API);
  const router = container.resolve(SERVICES.ROUTER);
  const authValidator = container.resolve(SERVICES.AUTH_VALIDATOR);

  // ── 3. Instantiate and initialise UI components ───────────────────────
  const authForm = new AuthForm(
    authApi,
    sessionStore,
    eventBus,
    profileApi,
    router,
    authValidator,
  );
  authForm.init();

  const navBar = new NavBar(sessionStore, eventBus);
  navBar.init();

  const userMenu = new UserMenu(sessionStore, eventBus, router, authApi);
  userMenu.init();

  const themeToggle = new ThemeToggle(eventBus);
  themeToggle.init();

  // ── 4. Expose instances for debugging ─────────────────────────────────
  window.__app = {
    container,
    authApi,
    sessionStore,
    eventBus,
    profileApi,
    authForm,
    navBar,
    userMenu,
    themeToggle,
  };
});
