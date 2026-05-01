// scripts/generate-env.js – used by Netlify build
const fs = require("fs");
const path = require("path");

const envConfig = `window.__ENV = {
  SUPABASE_URL: '${process.env.SUPABASE_URL}',
  SUPABASE_ANON_KEY: '${process.env.SUPABASE_ANON_KEY}',
  SUPABASE_PUBLISHABLE_KEY: '${process.env.SUPABASE_PUBLISHABLE_KEY}',
  GOOGLE_MAPS_KEY: '${process.env.GOOGLE_MAPS_KEY}',
  MISTRAL_API_KEYS: '${process.env.MISTRAL_API_KEYS || ""}'
};`;

const frontendConfig = `
window.CONFIG = {
  APP_NAME: 'Manila Guide',
  APP_TAGLINE: 'Tourist Information System',
  ENABLE_REGISTRATION: true,
  ENABLE_ADMIN_ACCESS: true,
  REQUIRE_EMAIL_VERIFICATION: true,
  MIN_PASSWORD_LENGTH: 6,
  SESSION_TIMEOUT_MINUTES: 120,
  IS_DEVELOPMENT: false,
  DEBUG_MODE: false
};`;

const distDir = path.join(__dirname, "..", "frontend", "js");
fs.writeFileSync(
  path.join(distDir, "env-config.js"),
  envConfig + frontendConfig,
);
