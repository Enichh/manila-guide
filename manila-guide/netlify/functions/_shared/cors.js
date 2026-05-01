const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Handles CORS preflight requests.
 * @param {object} event - Netlify function event.
 * @returns {object|null} - Response object for OPTIONS, or null if not OPTIONS.
 */
function handleCors(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  return null;
}

/**
 * Wraps a response body with CORS headers.
 * @param {number} statusCode - HTTP status code.
 * @param {string} body - Response body string.
 * @returns {object} - { statusCode, headers, body }
 */
function wrapResponse(statusCode, body) {
  return { statusCode, headers: corsHeaders, body };
}

module.exports = { corsHeaders, handleCors, wrapResponse };
