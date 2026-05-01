// ---------------------------------------------------------------------------
// validators.js — Pure Validation Logic (no I/O, no dependencies)
// ---------------------------------------------------------------------------
// Extracted from AuthForm to give it a single reason to change (validation
// rules).  All functions are pure: given the same inputs they always return
// the same output.
//
// Exports:
//   default: AuthValidator
//   named:    isValidEmail
// ---------------------------------------------------------------------------

/**
 * Check whether a string looks like a valid email address.
 *
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  return typeof email === "string" && email.includes("@");
}

/**
 * Pure validation logic for authentication forms.
 *
 * **Single Responsibility:** Validate registration and sign‑in payloads.
 * No DOM access, no API calls, no side effects.
 */
export default class AuthValidator {
  // Constructor takes NO dependencies — this is pure logic.
  constructor() {
    // no-op
  }

  /**
   * Validate a registration payload.
   *
   * @param {string} name
   * @param {string} email
   * @param {string} password
   * @returns {{ valid: boolean, error?: string }}
   */
  validateRegistration(name, email, password) {
    if (!name || !email || !password) {
      return { valid: false, error: "All fields are required." };
    }
    if (!isValidEmail(email)) {
      return { valid: false, error: "Please enter a valid email address." };
    }
    if (password.length < 6) {
      return { valid: false, error: "Password must be at least 6 characters." };
    }
    return { valid: true };
  }

  /**
   * Validate a sign‑in payload.
   *
   * @param {string} email
   * @param {string} password
   * @returns {{ valid: boolean, error?: string }}
   */
  validateSignIn(email, password) {
    if (!email || !password) {
      return { valid: false, error: "Please enter email and password." };
    }
    return { valid: true };
  }
}
