/**
 * Generates a random 6-digit verification code.
 *
 * This is a PURE function — no dependencies, no side effects.
 *
 * @returns {string} A 6-digit numeric string (e.g. "482917").
 */
function generateCode() {
  return Math.floor(100_000 + Math.random() * 900_000).toString();
}

module.exports = { generateCode };
