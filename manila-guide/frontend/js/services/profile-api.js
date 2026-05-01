// ---------------------------------------------------------------------------
// profile-api.js — Profile Data Access Service
// ---------------------------------------------------------------------------
// Every read or write to the `profiles` table flows through this class so
// the UI layer never touches Supabase query builders directly.
//
// Exports (default):
//   ProfileApi
// ---------------------------------------------------------------------------

/**
 * Thin data-access layer for the `profiles` table in Supabase.
 *
 * **Dependency:** A Supabase client instance (injected via constructor).
 */
export default class ProfileApi {
  /**
   * @param {object} supabaseClient - A pre-configured Supabase client.
   */
  constructor(supabaseClient) {
    /** @private */
    this._supabase = supabaseClient;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Fetch a single profile by its user id.
   *
   * @param {string} userId - The UUID of the user (matches `auth.users.id`).
   * @returns {Promise<{ profile: object|null, error: Error|null }>}
   */
  async getProfile(userId) {
    const { data, error } = await this._supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return { profile: null, error: new Error(error.message) };
    }

    return { profile: data, error: null };
  }

  /**
   * Insert or update a profile row (upsert).
   *
   * @param {string} userId - The UUID of the user.
   * @param {object} data   - Key/value pairs to store (e.g. `full_name`,
   *                          `role`, `avatar_url`).
   * @returns {Promise<{ profile: object|null, error: Error|null }>}
   */
  async upsertProfile(userId, data) {
    const { data: result, error } = await this._supabase
      .from('profiles')
      .upsert({ id: userId, ...data })
      .select()
      .single();

    if (error) {
      return { profile: null, error: new Error(error.message) };
    }

    return { profile: result, error: null };
  }
}
