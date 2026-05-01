// Shared Authentication Utilities for Manila Guide

// Session management class
class AuthSession {
  constructor() {
    this.currentUser = this.getCurrentUser();
  }

  getCurrentUser() {
    const userData = sessionStorage.getItem("currentUser");
    return userData ? JSON.parse(userData) : null;
  }

  setUser(user) {
    this.currentUser = user;
    sessionStorage.setItem("currentUser", JSON.stringify(user));
  }

  clearUser() {
    this.currentUser = null;
    sessionStorage.removeItem("currentUser");
  }

  isAuthenticated() {
    return this.currentUser !== null;
  }

  isAdmin() {
    return this.currentUser && this.currentUser.role === "admin";
  }

  getUserDisplayName() {
    return this.currentUser
      ? this.currentUser.name || this.currentUser.email.split("@")[0]
      : "Guest";
  }
}

// Global auth session instance
const authSession = new AuthSession();

// Navigation update utilities
function updateNavigationAuthState() {
  const navActions = document.querySelector(".nav-actions");
  if (!navActions) return;

  if (authSession.isAuthenticated()) {
    // Show authenticated state
    const userName = authSession.getUserDisplayName();
    const isAdmin = authSession.isAdmin();

    navActions.innerHTML = `
      <div class="user-menu">
        <button class="user-menu-btn" onclick="toggleUserMenu()">
          <div class="user-avatar">${userName.charAt(0).toUpperCase()}</div>
          <span class="user-name">${userName}</span>
          <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="user-dropdown" id="userDropdown">
          <div class="dropdown-header">
            <div class="dropdown-user-info">
              <div class="dropdown-avatar">${userName.charAt(0).toUpperCase()}</div>
              <div>
                <div class="dropdown-name">${userName}</div>
                <div class="dropdown-email">${authSession.currentUser.email}</div>
                ${isAdmin ? '<div class="dropdown-role">Administrator</div>' : ""}
              </div>
            </div>
          </div>
          <div class="dropdown-divider"></div>
          <a href="${isAdmin ? "admin.html" : "#itinerary"}" class="dropdown-item">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2C8.55228 2 9 2.44772 9 3V7H13C13.5523 7 14 7.44772 14 8C14 8.55228 13.5523 9 13 9H9V13C9 13.5523 8.55228 14 8 14C7.44772 14 7 13.5523 7 13V9H3C2.44772 9 2 8.55228 2 8C2 7.44772 2.44772 7 3 7H7V3C7 2.44772 7.44772 2 8 2Z" fill="currentColor"/>
            </svg>
            ${isAdmin ? "Admin Dashboard" : "My Trips"}
          </a>
          <a href="#reviews" class="dropdown-item">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L9.5 5.5L13 6L10.5 8.5L11 12L8 10L5 12L5.5 8.5L3 6L6.5 5.5L8 2Z" fill="currentColor"/>
            </svg>
            My Reviews
          </a>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item logout-btn" onclick="logout()">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M13 8L10 5M13 8L10 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>
    `;
  } else {
    // Show unauthenticated state
    navActions.innerHTML = `
      <a href="login.html" class="btn-ghost">Sign in</a>
      <a href="login.html" class="btn-primary">Get started</a>
    `;
  }
}

// User menu toggle
function toggleUserMenu() {
  const dropdown = document.getElementById("userDropdown");
  if (dropdown) {
    dropdown.classList.toggle("show");
  }
}

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  const userMenu = document.querySelector(".user-menu");
  const dropdown = document.getElementById("userDropdown");

  if (userMenu && dropdown && !userMenu.contains(e.target)) {
    dropdown.classList.remove("show");
  }
});

// Logout function
function logout() {
  authSession.clearUser();
  window.location.href = "login.html";
}

// Check authentication status and redirect if needed
function checkAuthStatus() {
  if (authSession.isAuthenticated()) {
    if (
      authSession.isAdmin() &&
      !window.location.pathname.includes("admin.html")
    ) {
      // Admin should be on admin page
      if (window.location.pathname.includes("login.html")) {
        window.location.href = "admin.html";
      }
    } else if (
      !authSession.isAdmin() &&
      window.location.pathname.includes("admin.html")
    ) {
      // Non-admin shouldn't access admin page
      window.location.href = "index.html";
    }
  } else if (window.location.pathname.includes("admin.html")) {
    // Unauthenticated users can't access admin page
    window.location.href = "login.html";
  }
}

// Initialize authentication on page load
document.addEventListener("DOMContentLoaded", () => {
  checkAuthStatus();
  updateNavigationAuthState();
});

// Export for use in other scripts
if (typeof module !== "undefined" && module.exports) {
  module.exports = { AuthSession, authSession, updateNavigationAuthState };
}
