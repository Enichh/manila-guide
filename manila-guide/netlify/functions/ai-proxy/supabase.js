// ---------------------------------------------------------------------------
// Supabase admin client (service_role — bypasses RLS)
// Used for direct database operations within the AI proxy.
// ---------------------------------------------------------------------------
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. " +
      "Itinerary tool functions that access the database will fail.",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

module.exports = supabase;
