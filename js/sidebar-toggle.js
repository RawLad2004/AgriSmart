/*==========================================================
                SIDEBAR TOGGLE (mobile/tablet)
    The dashboard sidebar is hidden off-canvas below 900px
    (see css/dashboard.css). This adds the hamburger button
    in the topbar, an overlay, and the open/close behavior
    so the sidebar can actually be reached on small screens.
==========================================================*/

document.addEventListener("DOMContentLoaded", () => {
  const shell = document.querySelector(".app-shell");
  const sidebar = document.querySelector(".sidebar");
  const topbar = document.querySelector(".topbar");

  if (!shell || !sidebar || !topbar) return;

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "sidebar-toggle-btn";
  toggleBtn.setAttribute("aria-label", "Open menu");
  toggleBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
  topbar.prepend(toggleBtn);

  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  shell.appendChild(overlay);

  function openSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("visible");
    toggleBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    toggleBtn.setAttribute("aria-label", "Close menu");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("visible");
    toggleBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    toggleBtn.setAttribute("aria-label", "Open menu");
  }

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
  });

  overlay.addEventListener("click", closeSidebar);

  sidebar.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closeSidebar);
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeSidebar();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeSidebar();
  });
});