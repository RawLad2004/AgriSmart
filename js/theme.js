/*==========================================================
                THEME TOGGLE
    Applied as early as possible to avoid a flash of the
    wrong theme. Preference is remembered in localStorage.
==========================================================*/

(function () {
  const saved = localStorage.getItem("agrismart-theme");
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("agrismart-theme", "light");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("agrismart-theme", "dark");
    }
  });
});