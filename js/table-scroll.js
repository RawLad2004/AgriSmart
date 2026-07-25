/*==========================================================
                TABLE SCROLL
    Wraps every .data-table in a horizontally scrollable
    container so wide tables don't break the layout on small
    screens. Tables are usually rendered dynamically (after a
    Supabase fetch), so we watch the DOM and wrap any new
    table as soon as it appears instead of only running once
    on page load.
==========================================================*/

function wrapDataTablesForScroll(root) {
  (root || document).querySelectorAll("table.data-table").forEach(table => {
    if (table.parentElement && table.parentElement.classList.contains("table-scroll-wrap")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "table-scroll-wrap";
    wrapper.style.overflowX = "auto";
    wrapper.style.width = "100%";
    wrapper.style.webkitOverflowScrolling = "touch";

    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wrapDataTablesForScroll();

  const observer = new MutationObserver(() => wrapDataTablesForScroll());
  observer.observe(document.body, { childList: true, subtree: true });
});
