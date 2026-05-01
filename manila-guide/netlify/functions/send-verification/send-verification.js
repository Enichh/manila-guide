const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");

const { handleCors, wrapResponse } = require("../_shared/cors.js");
const { generateEmailTemplate } = require("./email-template.js");
const { RateLimiter } = require("./rate-limiter.js");
const { EmailSender } = require("./email-sender.js");
const { UserLookup } = require("./user-lookup.js");
const { generateCode } = require("./code-generator.js");

// --- Composition root: wire dependencies ---

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const rateLimiter = new RateLimiter(supabase);
const emailSender = new EmailSender(transporter, process.env.GMAIL_EMAIL);
const userLookup = new UserLookup(supabase);

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

  const { email, action } = body;

  if (!email || !action) {
    return wrapResponse(400, "Email and action are required.");
  }

  if (action !== "register" && action !== "login") {
    return wrapResponse(400, "Invalid action.");
  }

  // For registration: check if email already exists in Supabase Auth
  if (action === "register") {
    const alreadyExists = await userLookup.emailExists(email);
    if (alreadyExists) {
      return wrapResponse(
        409,
        "A user with this email already exists. Please sign in instead.",
      );
    }
  }

  // Rate limiting: one code per 60 seconds per email
  const { allowed } = await rateLimiter.checkRateLimit(email);
  if (!allowed) {
    return wrapResponse(
      429,
      "Please wait at least 60 seconds before requesting a new code.",
    );
  }

  // Generate random 6-digit code
  const code = generateCode();

  // Store code in DB (expires in 10 minutes via default)
  const { error: dbError } = await supabase
    .from("email_verifications")
    .insert([{ email, code }]);

  if (dbError) {
    return wrapResponse(500, dbError.message);
  }

  // Send email
  const html = generateEmailTemplate(code, action);
  const { success, error: emailError } = await emailSender.send(
    email,
    "Your Verification Code – Manila Guide",
    html,
  );

  if (!success) {
    return wrapResponse(500, emailError);
  }

  return wrapResponse(200, "Code sent");
};
