// Authentication JavaScript for Manila Guide
// Full two-step flow: password → verification code → session

// ── Global state ──────────────────────────────────────────
let currentAction = null; // 'register' or 'login'
let signupData = null; // { name, email, password } for registration
let loginSession = null; // Supabase session after password check

// ── UI Helpers ──────────────────────────────────────────
function showError(panelId, msg) {
  const el = document.getElementById(panelId + "-error");
  if (el) {
    el.textContent = msg;
    el.classList.add("show");
  }
}

function hideError(panelId) {
  const el = document.getElementById(panelId + "-error");
  if (el) el.classList.remove("show");
}

// ── Tab Switching ───────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll(".auth-tab-btn").forEach((t, i) => {
    t.classList.toggle(
      "active",
      (i === 0 && tab === "signin") || (i === 1 && tab === "register"),
    );
  });
  document
    .getElementById("panel-signin")
    .classList.toggle("active", tab === "signin");
  document
    .getElementById("panel-register")
    .classList.toggle("active", tab === "register");
  hideError("signin");
  hideError("register");
}

// ── Step 1: Send Verification Code ────────────────────────
async function requestVerificationCode(action, email) {
  const res = await fetch("/.netlify/functions/send-verification", {
    method: "POST",
    body: JSON.stringify({ email, action }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg);
  }
  return true;
}

// ── Step 2: Verify Code (auto‑verify trigger) ────────────
async function verifyCodeInput(code) {
  if (code.length !== 6) return; // wait for full 6 digits

  const panel = currentAction === "register" ? "register" : "signin";
  const email =
    currentAction === "register" ? signupData.email : loginSession.user.email;

  try {
    const payload = {
      email,
      code,
      action: currentAction,
    };
    if (currentAction === "register") {
      payload.password = signupData.password;
      payload.name = signupData.name;
    }

    const res = await fetch("/.netlify/functions/verify-code", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg);
    }

    // ── Success ──
    if (currentAction === "register") {
      // After registration, automatically sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: signupData.email,
        password: signupData.password,
      });
      if (error) throw error;

      // Store user info in session (for auth-utils.js)
      authSession.setUser({
        email: signupData.email,
        name: signupData.name,
        role: "user",
      });
    } else {
      // Login: user was already signed in via password
      // Fetch role from profiles table to determine if admin
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", loginSession.user.id)
        .single();

      if (profileError) {
        console.error("Failed to fetch profile:", profileError);
      }

      const userRole = profile?.role || "user";
      const userName =
        profile?.full_name ||
        loginSession.user.user_metadata?.full_name ||
        loginSession.user.email.split("@")[0];

      authSession.setUser({
        email: loginSession.user.email,
        name: userName,
        role: userRole,
      });

      // Redirect based on role
      if (userRole === "admin") {
        window.location.href = "admin.html";
        return;
      }
    }

    window.location.href = "index.html";
  } catch (err) {
    showError(panel, err.message);
    // Clear code input and re-enable it
    const codeInput = document.getElementById(panel + "-verification-code");
    if (codeInput) {
      codeInput.value = "";
      codeInput.focus();
    }
  }
}

// ── Registration Flow ────────────────────────────────────
async function handleRegister() {
  const nameEl = document.querySelector('#panel-register input[type="text"]');
  const emailEl = document.querySelector('#panel-register input[type="email"]');
  const passwordEl = document.querySelector(
    '#panel-register input[type="password"]',
  );
  const name = nameEl.value.trim();
  const email = emailEl.value.trim().toLowerCase();
  const password = passwordEl.value;

  hideError("register");

  if (!name || !email || !password) {
    showError("register", "All fields are required.");
    return;
  }
  if (password.length < 6) {
    showError("register", "Password must be at least 6 characters.");
    return;
  }

  // Disable form, show verification UI
  const panel = document.getElementById("panel-register");
  const inputs = panel.querySelectorAll("input, button");
  inputs.forEach((el) => (el.disabled = true));

  try {
    await requestVerificationCode("register", email);
    // Store data for later verification
    signupData = { name, email, password };
    currentAction = "register";
    showCodeInput("register");
  } catch (err) {
    showError("register", err.message);
    inputs.forEach((el) => (el.disabled = false));
  }
}

// ── Login Flow ───────────────────────────────────────────
async function handleSignIn() {
  const email = document
    .getElementById("signin-email")
    .value.trim()
    .toLowerCase();
  const password = document.getElementById("signin-password").value;

  hideError("signin");

  if (!email || !password) {
    showError("signin", "Please enter email and password.");
    return;
  }

  // Disable form
  const signinPanel = document.getElementById("panel-signin");
  const inputs = signinPanel.querySelectorAll("input, button");
  inputs.forEach((el) => (el.disabled = true));

  try {
    // First, sign in with password against Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      // If the error says "Email not confirmed", that's okay — we'll still do verification
      // But if it's a wrong password, it will say "Invalid login credentials"
      throw new Error("Invalid email or password.");
    }

    // Password correct – now send verification code
    loginSession = data;
    await requestVerificationCode("login", email);
    currentAction = "login";
    showCodeInput("signin");
  } catch (err) {
    showError("signin", err.message);
    inputs.forEach((el) => (el.disabled = false));
  }
}

// ── UI: Show Code Input ──────────────────────────────────
function showCodeInput(panel) {
  const panelEl = document.getElementById("panel-" + panel);
  const email =
    panel === "register" ? signupData.email : loginSession.user.email;

  panelEl.innerHTML = `
    <div class="auth-card-header">
      <div class="card-logo-emblem">
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L12.5 7.5H18L13.5 11L15.5 17L10 13.5L4.5 17L6.5 11L2 7.5H7.5L10 2Z" fill="currentColor"/>
        </svg>
      </div>
      <span>Verify your email</span>
    </div>
    <h2 class="auth-heading">Enter verification code</h2>
    <p class="auth-sub">A 6‑digit code was sent to <strong>${email}</strong></p>
    <div class="error-msg" id="${panel}-error"></div>
    <div class="form-group">
      <input
        type="text"
        class="form-input code-input"
        id="${panel}-verification-code"
        placeholder="000000"
        maxlength="6"
        inputmode="numeric"
        autocomplete="one-time-code"
        oninput="const clean=this.value.replace(/\\D/g,'');if(clean!==this.value)this.value=clean;if(clean.length===6)verifyCodeInput(clean)"
        autofocus
      />
    </div>
    <button class="btn-ghost full-w resend-btn" onclick="resendCode('${panel}')">
      Resend code
    </button>
    <p class="auth-footer">
      <a href="#" onclick="cancelVerification('${panel}'); return false;">← Back</a>
    </p>
  `;
}

// ── Resend Code ──────────────────────────────────────────
async function resendCode(panel) {
  const email =
    panel === "register" ? signupData.email : loginSession.user.email;
  try {
    await requestVerificationCode(panel, email);
    // Brief visual feedback
    const btn = document.querySelector(".resend-btn");
    if (btn) {
      btn.textContent = "Code resent!";
      setTimeout(() => {
        btn.textContent = "Resend code";
      }, 2000);
    }
  } catch (err) {
    showError(panel, err.message);
  }
}

// ── Cancel Verification (go back) ───────────────────────
function cancelVerification(panel) {
  if (panel === "register") {
    signupData = null;
  } else {
    loginSession = null;
  }
  currentAction = null;
  // Reload the page to reset all state
  window.location.reload();
}

// ── Logout ──────────────────────────────────────────────
function logout() {
  supabase.auth.signOut().then(() => {
    authSession.clearUser();
    window.location.href = "login.html";
  });
}

// ── Check authentication on page load ───────────────────
function checkAuthStatus() {
  if (authSession.isAuthenticated()) {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (authSession.isAdmin()) {
          window.location.href = "admin.html";
        } else {
          window.location.href = "index.html";
        }
      } else {
        // SessionStorage says logged in but Supabase doesn't — clear
        authSession.clearUser();
      }
    });
  }
}

// ── Enter key handler ───────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const activePanel = document.querySelector(".auth-panel.active");
    // Only trigger on non-code-input panels (code input uses auto-verify)
    const hasNameField = activePanel?.querySelector(
      'input[type="text"]:not([inputmode])',
    );
    if (activePanel && hasNameField) {
      if (activePanel.id === "panel-signin") {
        handleSignIn();
      } else if (activePanel.id === "panel-register") {
        handleRegister();
      }
    }
  }
});

// ── Init on login page ──────────────────────────────────
if (window.location.pathname.includes("login.html")) {
  checkAuthStatus();
}
