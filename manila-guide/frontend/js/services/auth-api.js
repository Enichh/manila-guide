// ---------------------------------------------------------------------------
// auth-api.js — Authentication API Service (DIP / Anti-Corruption Layer)
// ---------------------------------------------------------------------------
// The UI layer never touches Supabase or Netlify Functions directly.  All
// auth-related I/O flows through this class, making it trivial to swap
// backends later.
//
// Exports (default):
//   AuthApi
// ---------------------------------------------------------------------------

/**
 * @typedef {object} AuthResult
 * @property {object|null} session - The Supabase session object on success.
 * @property {Error|null}  error   - An Error instance on failure.
 */

/**
 * Encapsulates every authentication I/O operation — Supabase password auth,
 * session retrieval, and the two-step verification calls to Netlify
 * Functions.
 *
 * **Dependency:** A Supabase client instance (injected via constructor).
 */
export default class AuthApi {
  /**
   * @param {object} supabaseClient - A pre-configured Supabase client
   *                                  (from `createSupabaseClient`).
   */
  constructor(supabaseClient) {
    /** @private */
    this._supabase = supabaseClient;
  }

  // -----------------------------------------------------------------------
  // Supabase password-auth methods
  // -----------------------------------------------------------------------

  /**
   * Sign in with email + password against Supabase Auth.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<AuthResult>}
   */
  async signIn(email, password) {
    const { data, error } = await this._supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { session: null, error: new Error(error.message) };
    }

    return { session: data.session, error: null };
  }

  /**
   * Sign out the current user (destroys the Supabase session).
   *
   * @returns {Promise<void>}
   */
  async signOut() {
    await this._supabase.auth.signOut();
  }

  /**
   * Retrieve the current session from Supabase (e.g. on page load to check
   * if the user is still signed in).
   *
   * @returns {Promise<AuthResult>}
   */
  async getSession() {
    const { data, error } = await this._supabase.auth.getSession();

    if (error) {
      return { session: null, error: new Error(error.message) };
    }

    return { session: data.session, error: null };
  }

  // -----------------------------------------------------------------------
  // Netlify Function verification methods
  // -----------------------------------------------------------------------

  /**
   * Request that a 6-digit verification code be sent to `email`.
   *
   * @param {string} email  - Recipient email address.
   * @param {string} action - One of `"register"` or `"login"`.
   * @returns {Promise<boolean>} Resolves `true` on success.
   * @throws {Error} When the Netlify Function returns a non-2xx status.
   */
  async requestVerificationCode(email, action) {
    const response = await fetch('/.netlify/functions/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, action }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        message || `send-verification failed (${response.status})`,
      );
    }

    return true;
  }

  /**
   * Verify a 6-digit code against the Netlify backend.
   *
   * @param {string} email     - The email that received the code.
   * @param {string} code      - The 6-digit verification code.
   * @param {string} action    - `"register"` or `"login"`.
   * @param {object} [extraData={}] - Additional payload (e.g. `password`,
   *                                  `name` for registration).
   * @returns {Promise<object>} The parsed JSON body from the function
   *                            (varies by action).
   * @throws {Error} When the Netlify Function returns a non-2xx status.
   */
  async verifyCode(email, code, action, extraData = {}) {
    const payload = { email, code, action, ...extraData };

    const response = await fetch('/.netlify/functions/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `verify-code failed (${response.status})`);
    }

    return response.json();
  }
}
