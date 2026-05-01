/**
 * Looks up users in Supabase Auth.
 *
 * SRP: One reason to change — how users are queried from the auth system.
 * DIP: Depends on a Supabase admin client abstraction, injected via constructor.
 */
class UserLookup {
  /**
   * @param {object} supabaseClient - Supabase client with service_role (admin).
   */
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Checks whether an email is already registered in Supabase Auth.
   *
   * @param {string} email - The email address to check.
   * @returns {Promise<boolean>} True if the email is already registered.
   */
  async emailExists(email) {
    const { data: existingUsers, error } =
      await this.supabase.auth.admin.listUsers();

    if (error || !existingUsers) {
      // If we can't check, err on the safe side and say it doesn't exist.
      return false;
    }

    return existingUsers.users.some((u) => u.email === email);
  }
}

module.exports = { UserLookup };
