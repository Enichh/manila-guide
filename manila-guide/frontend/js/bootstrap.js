// ---------------------------------------------------------------------------
// bootstrap.js — Composition Root / DI Wiring
// ---------------------------------------------------------------------------
// Central place where every service, factory, and shared instance is
// registered with the DI container.  Page entry points call `bootstrap()` to
// obtain a fully wired container, then resolve only the dependencies they need.
//
// This keeps the HTML pages completely decoupled from instantiation details
// and makes it trivial to swap implementations (e.g. a mock Supabase client
// for tests) without touching UI code.
//
// Exports (named):
//   bootstrap() → Container
// ---------------------------------------------------------------------------

import {
  register,
  registerInstance,
  resolve,
  createScope,
} from "./core/container.js";
import { SERVICES } from "./core/services.js";
import * as EventBus from "./core/event-bus.js";
import { createSupabaseClient } from "./services/supabase-client.js";
import SessionStore from "./services/session-store.js";
import AuthApi from "./services/auth-api.js";
import ProfileApi from "./services/profile-api.js";
import SpotApi from "./services/spot-api.js";
import Router from "./services/router.js";
import AuthValidator from "./services/validators.js";
import ChatApi from "./services/chat-api.js";

// Re‑export the container's `resolve` so callers can opt into tree‑shakable
// access without importing container.js themselves.
export { resolve } from "./core/container.js";

/**
 * Bootstrap the application's dependency-injection container.
 *
 * Registers every shared service, factory, and configuration value that the
 * various page entry points may need.  Each HTML page should call this
 * **once** on or after `DOMContentLoaded`, then resolve what it needs.
 *
 * @returns {object} The container namespace with `resolve`, `register`,
 *                   `registerInstance`, and `createScope` methods.
 *
 * @example
 * import { bootstrap } from './bootstrap.js';
 *
 * document.addEventListener('DOMContentLoaded', async () => {
 *   const container = await bootstrap();
 *   const sessionStore = container.resolve('sessionStore');
 *   // …
 * });
 */
export async function bootstrap(config = {}) {
  // -------------------------------------------------------------------
  // 1. Configuration values (injected config overrides window.__ENV)
  // -------------------------------------------------------------------
  const supabaseUrl = config.supabaseUrl ?? window.__ENV?.SUPABASE_URL ?? "";
  const supabaseAnonKey =
    config.supabaseAnonKey ?? window.__ENV?.SUPABASE_ANON_KEY ?? "";

  registerInstance(SERVICES.SUPABASE_URL, supabaseUrl);
  registerInstance(SERVICES.SUPABASE_ANON_KEY, supabaseAnonKey);

  // -------------------------------------------------------------------
  // 2. Core infrastructure
  // -------------------------------------------------------------------

  // EventBus — exported as a module namespace; register the whole namespace
  // so other services receive it via DI without a hard import.
  registerInstance(SERVICES.EVENT_BUS, EventBus);

  // Supabase client — factory wrapper so we can inject URL / key from config
  register(
    SERVICES.SUPABASE_CLIENT,
    (url, anonKey) => createSupabaseClient(url, anonKey),
    [SERVICES.SUPABASE_URL, SERVICES.SUPABASE_ANON_KEY],
  );

  // SessionStore — pure in‑memory / sessionStorage abstraction, no deps
  register(SERVICES.SESSION_STORE, () => new SessionStore(), []);

  // -------------------------------------------------------------------
  // 3. API services (each depends on the Supabase client)
  // -------------------------------------------------------------------
  register(SERVICES.AUTH_API, (client) => new AuthApi(client), [
    SERVICES.SUPABASE_CLIENT,
  ]);
  register(SERVICES.PROFILE_API, (client) => new ProfileApi(client), [
    SERVICES.SUPABASE_CLIENT,
  ]);
  register(SERVICES.SPOT_API, (client) => new SpotApi(client), [
    SERVICES.SUPABASE_CLIENT,
  ]);

  // -------------------------------------------------------------------
  // 3b. Router — navigation abstraction (no dependencies)
  // -------------------------------------------------------------------
  register(SERVICES.ROUTER, () => new Router(), []);

  // -------------------------------------------------------------------
  // 3c. AuthValidator — pure validation logic (no dependencies)
  // -------------------------------------------------------------------
  register(SERVICES.AUTH_VALIDATOR, () => new AuthValidator(), []);

  // -------------------------------------------------------------------
  // 3d. ChatApi — AI chat adapter (no dependencies)
  // -------------------------------------------------------------------
  register(SERVICES.CHAT_API, () => new ChatApi(), []);

  // -------------------------------------------------------------------
  // 4. Return the container so page entry points can resolve at will
  // -------------------------------------------------------------------
  return { resolve, register, registerInstance, createScope };
}
