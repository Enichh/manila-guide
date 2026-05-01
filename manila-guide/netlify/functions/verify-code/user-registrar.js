/**
 * Creates users in Supabase Auth.
 *
 * SRP: One reason to change — how users are created in the auth system.
 * DIP: Depends on a Supabase admin client abstraction, injected via constructor.
 */
class UserRegistrar {
  /**
   * @param {object} supabaseClient - Supabase client with service_role (admin).
   */
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Creates a new user in Supabase Auth with email already confirmed.
   *
   * @param {string} email
   * @param {string} password
   * @param {string} name - Full name for user_metadata.
   * @returns {Promise<{ user: object|null, error?: string, alreadyExists?: boolean }>}
   */
  async createUser(email, password, name) {
    const { data: user, error } = await this.supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (error) {
      // Check if the error indicates the user already exists
      if (
        error.message &&
        error.message.includes("already been registered")
      ) {
        return { user: null, alreadyExists: true };
      }
      return { user: null, error: error.message };
    }

    return { user: user.user, alreadyExists: false };
  }
}

module.exports = { UserRegistrar };
