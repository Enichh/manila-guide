/**
 * Manages verification code records in the email_verifications table.
 *
 * SRP: One reason to change — how verification codes are stored/queried.
 * DIP: Depends on a Supabase client abstraction, injected via constructor.
 */
class CodeStore {
  /**
   * @param {object} supabaseClient - Supabase client (admin, service_role).
   */
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Fetches the most recent verification record for an email.
   *
   * @param {string} email
   * @returns {Promise<{ data: object|null, error?: string }>}
   */
  async getLatestCode(email) {
    const { data: records, error } = await this.supabase
      .from("email_verifications")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      return { data: null, error: error.message };
    }

    if (!records || records.length === 0) {
      return { data: null, error: null };
    }

    return { data: records[0], error: null };
  }

  /**
   * Increments the attempt count for a verification record.
   *
   * @param {string} id - The record ID.
   * @param {number} currentAttempts - Current attempts count.
   * @returns {Promise<{ data: null, error?: string }>}
   */
  async incrementAttempts(id, currentAttempts) {
    const { error } = await this.supabase
      .from("email_verifications")
      .update({ attempts: currentAttempts + 1 })
      .eq("id", id);

    return { data: null, error: error ? error.message : null };
  }

  /**
   * Deletes a verification record by ID.
   *
   * @param {string} id - The record ID.
   * @returns {Promise<{ data: null, error?: string }>}
   */
  async deleteCode(id) {
    const { error } = await this.supabase
      .from("email_verifications")
      .delete()
      .eq("id", id);

    return { data: null, error: error ? error.message : null };
  }
}

module.exports = { CodeStore };
