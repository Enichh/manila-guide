// frontend/scripts/serve.js – simple static server with env injection
const http = require("http");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: "../../.env" }); // assume .env is in project root

const PORT = 3000;

const server = http.createServer((req, res) => {
  if (req.url === "/js/env-config.js") {
    // Generate config from env vars
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
  IS_DEVELOPMENT: true,
  DEBUG_MODE: true
};`;

    res.writeHead(200, { "Content-Type": "application/javascript" });
    return res.end(envConfig + frontendConfig);
  }

  // Serve static files
  const filePath = path.join(__dirname, "..", req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const mime =
      { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[
        ext
      ] || "text/plain";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
});

server.listen(PORT, () =>
  console.log(
    `Dev server running at http://localhost:${PORT}/pages/index.html`,
  ),
);
