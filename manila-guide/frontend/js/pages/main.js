// ---------------------------------------------------------------------------
// main.js — Entry Point for index.html
// ---------------------------------------------------------------------------
// Composition root for the public‑facing landing / explore page.  Resolves
// services from the DI container and wires them to dynamic UI components.
//
// Handles:
//   • NavBar & UserMenu initialisation
//   • Dynamic spot cards (replaces hardcoded HTML)
//   • Dynamic spot detail (replaces hardcoded detail section)
//   • Itinerary planner (dynamic trip timeline + sidebar)
//   • Reviews section (dynamic reviews + write-review form)
//   • Search bar with debounced live search
//   • Category filter chips wired to SpotCards
//   • Mobile menu toggle
//   • IntersectionObserver scroll animations
//   • Chat widget (AI assistant)
//   • Sign‑out → NavBar re‑render
//
// Loaded as a module via:
//   <script type="module" src="js/pages/main.js"></script>
// ---------------------------------------------------------------------------

import { bootstrap } from "../bootstrap.js";
import { SERVICES } from "../core/services.js";
import NavBar from "../ui/nav-bar.js";
import UserMenu from "../ui/user-menu.js";
import ThemeToggle from "../ui/theme-toggle.js";
import ChatWidget from "../ui/chat-widget.js";
import SpotCards from "../ui/spot-cards.js";
import SpotDetail from "../ui/spot-detail.js";
import ItineraryPlanner from "../ui/itinerary-planner.js";
import ReviewsSection from "../ui/reviews-section.js";
import { AUTH_SIGNED_OUT } from "../core/event-bus.js";

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

  // ── 3. NavBar, UserMenu & ThemeToggle ─────────────────────────────────
  const navBar = new NavBar(sessionStore, eventBus);
  navBar.init();

  const authApi = container.resolve(SERVICES.AUTH_API);

  const userMenu = new UserMenu(sessionStore, eventBus, router, authApi);
  userMenu.init();

  const themeToggle = new ThemeToggle(eventBus);
  themeToggle.init();

  // ── 4. Dynamic spot cards (replaces hardcoded HTML) ────────────────────
  const spotCards = new SpotCards(spotApi, eventBus);
  await spotCards.init();

  // ── 5. Dynamic spot detail (replaces hardcoded detail section) ─────────
  const spotDetail = new SpotDetail(spotApi, sessionStore, eventBus);
  spotDetail.init();

  // ── 5b. Itinerary planner ─────────────────────────────────────────────
  const itineraryPlanner = new ItineraryPlanner(
    spotApi,
    sessionStore,
    eventBus,
  );
  itineraryPlanner.init();

  // ── 5c. Reviews section ───────────────────────────────────────────────
  const reviewsSection = new ReviewsSection(spotApi, sessionStore, eventBus);
  reviewsSection.init();

  // ── 6. Chat widget — AI assistant ─────────────────────────────────────
  const chatApi = container.resolve(SERVICES.CHAT_API);
  const chatWidget = new ChatWidget(chatApi, eventBus, sessionStore);
  chatWidget.init();

  // ── 7. Wire cross‑component events ────────────────────────────────────

  // 7. itinerary:addRequest → DB insert + re‑render planner + feedback
  eventBus.on(
    "itinerary:addRequest",
    async ({ spotId, spotName, date, time }) => {
      const user = sessionStore.getUser();
      if (!user) return;

      const { item, error } = await spotApi.addToItinerary(
        user.id,
        spotId,
        date,
        time,
      );

      if (error) {
        console.error("[main] Failed to add to itinerary:", error.message);
        return;
      }

      // Re-render itinerary planner with fresh data
      await itineraryPlanner.render();

      // Emit success for SpotDetail sidebar feedback
      eventBus.emit("itinerary:itemAdded", { spotName, date, item });
    },
  );

  // ── 8. Public‑page interactivity ──────────────────────────────────────

  // 8a. Search bar
  setupSearch(spotCards);

  // 8b. Filter chips
  setupFilterChips(spotCards);

  // 8c. Mobile menu toggle
  setupMobileMenu();

  // 8d. Scroll animations
  setupScrollAnimations(eventBus);

  // 8e. Re‑render nav on sign‑out
  eventBus.on(AUTH_SIGNED_OUT, () => navBar.update());

  // ── 9. Expose instances for debugging ─────────────────────────────────
  window.__app = {
    container,
    sessionStore,
    eventBus,
    spotApi,
    spotCards,
    spotDetail,
    itineraryPlanner,
    reviewsSection,
    navBar,
    userMenu,
    themeToggle,
    chatApi,
    chatWidget,
  };
});

// ---------------------------------------------------------------------------
// Private helpers — interactivity wiring
// ---------------------------------------------------------------------------

// ── Search ────────────────────────────────────────────────────────────────

/**
 * Wire the search input and button to {@link SpotCards.search}.
 *
 * Supports two interaction modes:
 *  - **Live search:** Debounced by 300 ms as the user types.
 *  - **Explicit search:** Immediate on button click or Enter key.
 *
 * @param {import('../ui/spot-cards.js').default} spotCards
 */
function setupSearch(spotCards) {
  const input = document.querySelector(".search-input");
  const btn = document.querySelector(".search-btn");

  if (!input || !btn) return;

  /** @type {number|undefined} */
  let debounceTimer;

  /**
   * Execute the search immediately (clears any pending debounce).
   */
  const executeSearch = () => {
    clearTimeout(debounceTimer);
    spotCards.search(input.value.trim());
  };

  // Live search on input (debounced 300 ms)
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      spotCards.search(input.value.trim());
    }, 300);
  });

  // Explicit search on Enter key
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      executeSearch();
    }
  });

  // Explicit search on button click
  btn.addEventListener("click", executeSearch);
}

// ── Filter chips ──────────────────────────────────────────────────────────

/**
 * Wire filter-chip clicks to {@link SpotCards.filterByCategory}.
 *
 * Clicking a `.chip` removes `.active` from all siblings, applies it to
 * the clicked chip, and calls `spotCards.filterByCategory(chip.textContent)`.
 *
 * @param {import('../ui/spot-cards.js').default} spotCards
 */
function setupFilterChips(spotCards) {
  const chips = document.querySelectorAll(".chip");
  if (chips.length === 0) return;

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      // Toggle active class: the clicked chip is active, others are not
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");

      // Delegate filtering to SpotCards
      spotCards.filterByCategory(chip.textContent.trim());
    });
  });
}

// ── Mobile menu ───────────────────────────────────────────────────────────

/**
 * Wire the hamburger button to toggle the mobile menu.
 *
 * Looks for a `.hamburger` button and a `#mobileMenu` element, then toggles
 * the `.open` class on click.
 */
function setupMobileMenu() {
  const hamburger = document.querySelector(".hamburger");
  const mobileMenu = document.getElementById("mobileMenu");

  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener("click", () => {
    mobileMenu.classList.toggle("open");
  });
}

// ── Scroll animations ─────────────────────────────────────────────────────

/**
 * Set up an {@link IntersectionObserver} that adds `.visible` to elements
 * as they scroll into the viewport, triggering CSS entrance animations.
 *
 * Observes structural page elements on init AND dynamically rendered spot
 * cards by listening for the `spots:rendered` event.
 *
 * @param {import('../core/event-bus.js')} eventBus
 */
function setupScrollAnimations(eventBus) {
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

  /**
   * Observe all currently existing animatable elements.
   */
  const observeExisting = () => {
    const targets = document.querySelectorAll(
      [
        ".spot-card",
        ".section-header",
        ".detail-main",
        ".detail-sidebar",
        ".itin-card",
        ".itin-sidebar > *",
        ".review-item",
      ].join(", "),
    );

    targets.forEach((el) => observer.observe(el));
  };

  // Initial observation pass
  observeExisting();

  // Re-observe when spot cards are dynamically rendered
  const unsub = eventBus.on("spots:rendered", () => {
    // Small delay to let the DOM settle after innerHTML replacement
    requestAnimationFrame(() => {
      observeExisting();
    });
  });

  // Store the unsubscriber on the observer so it can be cleaned up if needed
  observer._unsub = unsub;
}
