// ---------------------------------------------------------------------------
// services.js — DI Service Name Constants
// ---------------------------------------------------------------------------
// Central registry of all DI service names used across the application.
// Use these constants instead of raw string literals so that typos are
// caught at import time and renaming is a single‑file change.
//
// Exports (named):
//   SERVICES — object mapping constant names to DI registration keys
// ---------------------------------------------------------------------------

export const SERVICES = {
  SUPABASE_URL: "supabaseUrl",
  SUPABASE_ANON_KEY: "supabaseAnonKey",
  SUPABASE_CLIENT: "supabaseClient",
  EVENT_BUS: "eventBus",
  SESSION_STORE: "sessionStore",
  AUTH_API: "authApi",
  PROFILE_API: "profileApi",
  SPOT_API: "spotApi",
  ROUTER: "router",
  AUTH_VALIDATOR: "authValidator",
  CHAT_API: "chatApi",
};
