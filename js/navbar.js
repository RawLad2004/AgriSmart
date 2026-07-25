/*==========================================================
                    NAVBAR / HAMBURGER MENU
    Toggles the mobile dropdown (.mobile-menu) that holds the
    nav links + nav buttons when the hamburger button is
    tapped, and keeps everything in sync: icon swap, aria
    state, closing on link click / outside click / Escape /
    resize back to desktop.
==========================================================*/

document.addEventListener("DOMContentLoaded", function () {

    var toggle = document.getElementById("menu-toggle");
    var menu = document.getElementById("mobile-menu");

    if (!toggle || !menu) return;

    var MOBILE_BREAKPOINT = 900;

    function openMenu() {
        menu.classList.add("active");
        toggle.classList.add("active");
        toggle.setAttribute("aria-expanded", "true");
    }

    function closeMenu() {
        menu.classList.remove("active");
        toggle.classList.remove("active");
        toggle.setAttribute("aria-expanded", "false");
    }

    function isOpen() {
        return menu.classList.contains("active");
    }

    toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        isOpen() ? closeMenu() : openMenu();
    });

    // Close the menu after picking a link, so it doesn't stay
    // open on top of the page you just navigated to.
    menu.addEventListener("click", function (e) {
        if (e.target.closest("a")) {
            closeMenu();
        }
    });

    // Click outside the menu/hamburger closes it.
    document.addEventListener("click", function (e) {
        if (!isOpen()) return;
        if (menu.contains(e.target) || toggle.contains(e.target)) return;
        closeMenu();
    });

    // Escape key closes it.
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && isOpen()) closeMenu();
    });

    // Resizing back up to desktop width should reset the menu
    // so it doesn't stay stuck open once it's hidden by CSS.
    window.addEventListener("resize", function () {
        if (window.innerWidth > MOBILE_BREAKPOINT && isOpen()) {
            closeMenu();
        }
    });

});
