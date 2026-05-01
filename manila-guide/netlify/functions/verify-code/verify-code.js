const { createClient } = require("@supabase/supabase-js");

const { handleCors, wrapResponse } = require("../_shared/cors.js");
const { CodeStore } = require("./code-store.js");
const { UserRegistrar } = require("./user-registrar.js");
const { ProfileManager } = require("./profile-manager.js");

// --- Composition root: wire dependencies ---

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const codeStore = new CodeStore(supabaseAdmin);
const userRegistrar = new UserRegistrar(supabaseAdmin);
const profileManager = new ProfileManager(supabaseAdmin);

// --- Handler ---

exports.handler = async (event) => {
  // CORS preflight
  const corsResponse = handleCors(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== "POST") {
    return wrapResponse(405, "Method not allowed");
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return wrapResponse(400, "Invalid JSON");
  }

  const { email, code, password, name, action } = body;

  if (!email || !code || !action) {
    return wrapResponse(400, "Email, code, and action are required.");
  }

  // Retrieve verification record
  const { data: record, error: lookupError } =
    await codeStore.getLatestCode(email);

  if (lookupError) {
    console.error("Database lookup error:", lookupError);
    return wrapResponse(500, "Database error. Please try again.");
  }

  if (!record) {
    console.log("No verification code found for email:", email);
    return wrapResponse(
      400,
      "No verification code found. Please request a new code.",
    );
  }

  // Debug logging
  console.log(
    "Retrieved code:",
    record.code,
    "Submitted code:",
    code,
    "Email:",
    email,
  );

  // Check expiration
  if (new Date(record.expires_at) < new Date()) {
    console.log("Verification code expired for email:", email);
    await codeStore.deleteCode(record.id);
    return wrapResponse(
      400,
      "Verification code expired. Please request a new code.",
    );
  }

  // Validate code first
  if (record.code !== code) {
    console.log(
      "Code mismatch - Expected:",
      record.code,
      "Got:",
      code,
      "Email:",
      email,
      "Attempts:",
      record.attempts,
    );

    // Increment attempts only on failed validation
    await codeStore.incrementAttempts(record.id, record.attempts);

    // Check if this failure reaches the limit
    if (record.attempts + 1 >= 5) {
      console.log("Too many attempts for email:", email);
      await codeStore.deleteCode(record.id);
      return wrapResponse(400, "Too many attempts. Please request a new code.");
    }

    return wrapResponse(
      400,
      "Invalid verification code. Please check your email and try again.",
    );
  }

  // Code is correct — clean up record
  await codeStore.deleteCode(record.id);

  // --- Action-specific logic ---
  if (action === "register") {
    if (!password || !name) {
      return wrapResponse(
        400,
        "Name and password are required for registration.",
      );
    }

    // Create user in Supabase Auth (confirmed immediately)
    const {
      user,
      error: createError,
      alreadyExists,
    } = await userRegistrar.createUser(email, password, name);

    if (alreadyExists) {
      return wrapResponse(200, "User already registered. Please sign in.");
    }

    if (createError) {
      return wrapResponse(500, createError);
    }

    // Upsert profile (the trigger may have already created one; upsert to be safe)
    const { error: profileError } = await profileManager.upsertProfile(
      user.id,
      name,
      "user",
    );

    if (profileError) {
      return wrapResponse(500, profileError);
    }

    return wrapResponse(200, "User registered and verified.");
  }

  if (action === "login") {
    // User already authenticated via password on the frontend.
    // This function is called only to confirm the 2FA code.
    return wrapResponse(200, "Code verified. Proceed.");
  }

  return wrapResponse(400, "Invalid action.");
};
