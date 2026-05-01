// ---------------------------------------------------------------------------
// supabase-client.js — Supabase Client Factory
// ---------------------------------------------------------------------------
// Creates a Supabase client singleton backed by the browser CDN build
// (window.supabase).  During the transition from the legacy global pattern
// this module also stores the client on `window.__supabaseClient`.
//
// Exports (named):
//   createSupabaseClient(supabaseUrl, supabaseAnonKey) → SupabaseClient
// ---------------------------------------------------------------------------

/**
 * Create (or retrieve the cached singleton of) a Supabase client.
 *
 * Designed to be registered with the DI container so higher-level services
 * receive the client via constructor injection instead of reaching for a
 * global directly.
 *
 * @param {string} supabaseUrl     - Supabase project URL (e.g. window.__ENV.SUPABASE_URL).
 * @param {string} supabaseAnonKey - Supabase anonymous / publishable key.
 * @returns {object} A Supabase client instance.
 * @throws {Error} If `window.supabase` is not available (Supabase CDN script
 *                 was not loaded before this module ran).
 */
export function createSupabaseClient(supabaseUrl, supabaseAnonKey) {
  // ---- Guard: CDN must be loaded ------------------------------------------
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error(
      '[SupabaseClient] window.supabase is not available. ' +
        'Make sure the Supabase CDN script is loaded before this module.',
    );
  }

  // ---- Return cached singleton if already created -------------------------
  if (window.__supabaseClient) {
    return window.__supabaseClient;
  }

  // ---- Instantiate --------------------------------------------------------
  const client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

  // ---- Expose on window for backward compatibility during transition ------
  window.__supabaseClient = client;

  return client;
}
