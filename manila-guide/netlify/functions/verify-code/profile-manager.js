/**
 * Manages user profile records in the profiles table.
 *
 * SRP: One reason to change — how profiles are stored/upserted.
 * DIP: Depends on a Supabase client abstraction, injected via constructor.
 */
class ProfileManager {
  /**
   * @param {object} supabaseClient - Supabase client (admin, service_role).
   */
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Upserts a profile record for a user.
   *
   * @param {string} userId - The user's Supabase Auth UUID.
   * @param {string} fullName - The user's full name.
   * @param {string} role - The user's role (default "user").
   * @returns {Promise<{ profile: object|null, error?: string }>}
   */
  async upsertProfile(userId, fullName, role) {
    const { data: profile, error } = await this.supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          full_name: fullName,
          role: role,
        },
        { onConflict: "id" },
      );

    return { profile, error: error ? error.message : null };
  }
}

module.exports = { ProfileManager };
