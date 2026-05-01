/**
 * Handles rate limiting for verification code requests.
 * Ensures only one code per 60 seconds per email address.
 *
 * SRP: One reason to change — the rate limit rule.
 * DIP: Depends on a Supabase client abstraction, injected via constructor.
 */
class RateLimiter {
  /**
   * @param {object} supabaseClient - Supabase client (admin, service_role).
   */
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Checks whether an email is allowed to receive a new verification code.
   *
   * @param {string} email - The email address to check.
   * @returns {Promise<{ allowed: boolean, retryAfterSeconds: number }>}
   */
  async checkRateLimit(email) {
    const { data: recent } = await this.supabase
      .from("email_verifications")
      .select("created_at")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1);

    if (recent && recent.length > 0) {
      const lastSent = new Date(recent[0].created_at).getTime();
      const elapsed = Date.now() - lastSent;
      const cooldown = 60_000; // 60 seconds

      if (elapsed < cooldown) {
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil((cooldown - elapsed) / 1000),
        };
      }
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }
}

module.exports = { RateLimiter };
