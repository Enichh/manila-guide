const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");

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

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method not allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: "Invalid JSON" };
  }

  const { email, action } = body;

  if (!email || !action) {
    return { statusCode: 400, headers, body: "Email and action are required." };
  }

  if (action !== "register" && action !== "login") {
    return { statusCode: 400, headers, body: "Invalid action." };
  }

  // For registration: check if email already exists in Supabase Auth
  if (action === "register") {
    const { data: existingUsers, error: lookupErr } =
      await supabase.auth.admin.listUsers();

    if (!lookupErr && existingUsers) {
      const alreadyExists = existingUsers.users.some((u) => u.email === email);
      if (alreadyExists) {
        return {
          statusCode: 409,
          headers,
          body: "A user with this email already exists. Please sign in instead.",
        };
      }
    }
  }

  // Rate limiting: one code per 60 seconds per email
  const { data: recent } = await supabase
    .from("email_verifications")
    .select("created_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1);

  if (recent && recent.length > 0) {
    const lastSent = new Date(recent[0].created_at).getTime();
    if (Date.now() - lastSent < 60_000) {
      return {
        statusCode: 429,
        headers,
        body: "Please wait at least 60 seconds before requesting a new code.",
      };
    }
  }

  // Generate random 6‑digit code
  const code = Math.floor(100_000 + Math.random() * 900_000).toString();

  // Store code in DB (expires in 10 minutes via default)
  const { error: dbError } = await supabase
    .from("email_verifications")
    .insert([{ email, code }]);

  if (dbError) {
    return { statusCode: 500, headers, body: dbError.message };
  }

  // Send email with styled template
  const emailTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code - Manila Guide</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Jost:wght@300;400;500&display=swap');

    body {
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #faf8f5 0%, #f5f0e8 100%);
      font-family: 'Jost', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #2d2a26;
    }

    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(45, 42, 38, 0.08);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #c9a227 0%, #b8941d 100%);
      padding: 40px 30px;
      text-align: center;
    }

    .logo {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: #ffffff;
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 24px;
      font-weight: 500;
      letter-spacing: 0.5px;
    }

    .logo-icon {
      width: 32px;
      height: 32px;
    }

    .content {
      padding: 48px 40px;
      text-align: center;
    }

    h1 {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 32px;
      font-weight: 500;
      color: #2d2a26;
      margin: 0 0 16px;
      letter-spacing: -0.5px;
    }

    .subtitle {
      font-size: 16px;
      color: #6b6560;
      margin-bottom: 40px;
      line-height: 1.6;
    }

    .code-container {
      background: linear-gradient(135deg, #faf8f5 0%, #f5f0e8 100%);
      border: 2px dashed #c9a227;
      border-radius: 12px;
      padding: 32px 24px;
      margin: 32px 0;
    }

    .code-label {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #8b8078;
      margin-bottom: 16px;
    }

    .code {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 48px;
      font-weight: 500;
      letter-spacing: 8px;
      color: #c9a227;
      text-shadow: 0 2px 4px rgba(201, 162, 39, 0.15);
    }

    .expiry {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #fff5f0;
      color: #c45c3e;
      font-size: 14px;
      padding: 12px 20px;
      border-radius: 20px;
      margin-top: 24px;
    }

    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #e8e4df, transparent);
      margin: 40px 0;
    }

    .security-note {
      font-size: 13px;
      color: #8b8078;
      line-height: 1.6;
    }

    .footer {
      background: #faf8f5;
      padding: 24px 40px;
      text-align: center;
      font-size: 13px;
      color: #9b9088;
    }

    .footer a {
      color: #c9a227;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <svg class="logo-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 2L12.5 7.5H18L13.5 11L15.5 17L10 13.5L4.5 17L6.5 11L2 7.5H7.5L10 2Z" fill="currentColor"/>
        </svg>
        <span>Manila Guide</span>
      </div>
    </div>

    <div class="content">
      <h1>Verify Your Email</h1>
      <p class="subtitle">Thank you for joining Manila Guide.<br>Use the verification code below to complete your ${action === "register" ? "registration" : "sign in"}.</p>

      <div class="code-container">
        <div class="code-label">Your Verification Code</div>
        <div class="code">${code}</div>
      </div>

      <div class="expiry">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5 3.5a.5.5 0 0 0 1 0V5.707l2.146 2.147a.5.5 0 0 0 .708-.708l-3-3a.5.5 0 0 0-.708 0l-3 3a.5.5 0 1 0 .708.708L7.5 5.707V11.5z"/>
        </svg>
        <span>Expires in 10 minutes</span>
      </div>

      <div class="divider"></div>

      <p class="security-note">
        If you didn't request this code, you can safely ignore this email.<br>
        Someone may have entered your email address by mistake.
      </p>
    </div>

    <div class="footer">
      <p>© 2026 Manila Guide. All rights reserved.</p>
      <p>Tourist Information System for the Pearl of the Orient</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"Manila Guide" <${process.env.GMAIL_EMAIL}>`,
      to: email,
      subject: "Your Verification Code – Manila Guide",
      html: emailTemplate,
    });
    return { statusCode: 200, headers, body: "Code sent" };
  } catch (emailError) {
    return { statusCode: 500, headers, body: emailError.message };
  }
};
