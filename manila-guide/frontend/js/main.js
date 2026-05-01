// Main page JavaScript for Manila Guide

// Mobile menu toggle
function toggleMobileMenu() {
  document.getElementById("mobileMenu").classList.toggle("open");
}

// Filter chips functionality
document.querySelectorAll(".chip").forEach((c) => {
  c.addEventListener("click", () => {
    document
      .querySelectorAll(".chip")
      .forEach((x) => x.classList.remove("active"));
    c.classList.add("active");
  });
});

// Detail tabs functionality
document.querySelectorAll(".dtab").forEach((t) => {
  t.addEventListener("click", () => {
    document
      .querySelectorAll(".dtab")
      .forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
  });
});

// Favorite buttons
document.querySelectorAll(".fav-btn").forEach((btn) => {
  btn.addEventListener("click", () => btn.classList.toggle("saved"));
});

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
  .querySelectorAll(
    ".spot-card, .section-header, .detail-main, .detail-sidebar, .itin-card, .itin-sidebar > *, .review-item",
  )
  .forEach((el) => observer.observe(el));