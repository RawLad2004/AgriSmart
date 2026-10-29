/*==========================================================
                TABLE HORIZONTAL SCROLL
    Every dashboard page builds its .data-table by injecting
    HTML after an async data fetch (farms, crops, livestock,
    market, finances, etc.). Rather than edit every one of
    those files individually, this watches the page and wraps
    any table.data-table it finds in a .table-scroll container
    so it can be swiped left/right on narrow screens instead
    of squishing its columns.
==========================================================*/

(function () {

    function wrapDataTables() {
        document.querySelectorAll("table.data-table").forEach(function (table) {
            var parent = table.parentElement;
            if (parent && parent.classList.contains("table-scroll")) return;

            var wrapper = document.createElement("div");
            wrapper.className = "table-scroll";
            parent.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        wrapDataTables();

        // Tables are re-rendered after async Supabase calls
        // (add/delete rows, filters, etc.), so keep watching.
        var observer = new MutationObserver(wrapDataTables);
        observer.observe(document.body, { childList: true, subtree: true });
    });

})();