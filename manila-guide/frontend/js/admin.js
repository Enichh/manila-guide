// Admin panel JavaScript for Manila Guide

// Tab switching
function switchAdminTab(panel, btn) {
  document
    .querySelectorAll(".admin-panel")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".admin-nav-tab")
    .forEach((t) => t.classList.remove("active"));
  document.getElementById("panel-" + panel).classList.add("active");
  btn.classList.add("active");
}

// Scroll animations
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add("visible");
    });
  },
  { threshold: 0.08 },
);
document
  .querySelectorAll(".astat-card, .admin-table-card")
  .forEach((el) => observer.observe(el));