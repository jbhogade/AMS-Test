/*==============================================================================
#-------------- Start Code for : SHARED APP HELPERS (app.js) ------------------
#
#  PURPOSE   : Small shared functions used by EVERY page:
#               1. Sidebar mobile open/close
#               2. Escaping text safely (prevents HTML injection)
#               3. Status -> badge class mapping
#               4. Currency / number formatting
#               5. Page identification (for navigation highlighting)
#
#  Every new page must load this file AFTER theme.js and BEFORE its own script.
#------------------------------------------------------------------------------*/

/* ---- 1) MOBILE SIDEBAR : open / close / overlay click ----------------------- */
function openSidebar() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("sidebar-overlay").classList.add("show");
}

function closeSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebar-overlay").classList.remove("show");
}

/* ---- 2) ESCAPE TEXT : safely display user data in the HTML ------------------ */
function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
}

/* ---- 3) STATUS TO BADGE : converts a status string to a badge CSS class ----- */
function badgeClassFor(status) {
    return STATUS_BADGE_CLASS[status] || "badge-grey";
}

/* ---- 4) NUMBER FORMATTING (Indian currency ₹ with lakh/crore counting) ----- */
function formatCurrency(amount) {
    const n = Number(amount);
    if (isNaN(n)) return "₹0";
    return "₹" + new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 2
    }).format(n);
}

/* Indian-style plain number counting (1,00,000 - lakh / 1,00,00,000 - crore).
   Used for any non-currency count that should group digits the Indian way. */
function formatIndianNumber(n) {
    const num = Number(n);
    if (isNaN(num)) return "0";
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(num);
}

/* ---- 5) NAVIGATION : highlight the sidebar link for the current page -------- */
function setActiveNav(pageId) {
    const links = document.querySelectorAll(".sidebar-link");
    links.forEach(link => {
        if (link.dataset.page === pageId) {
            link.classList.add("active");
        }
    });
}

/* ---- Initialise shared page behaviour (call on every page) ------------------ */
function initApp() {
    /* Sidebar toggle button (hamburger) */
    const toggle = document.getElementById("sidebar-toggle");
    if (toggle) toggle.addEventListener("click", openSidebar);

    /* Overlay click closes the sidebar */
    const overlay = document.getElementById("sidebar-overlay");
    if (overlay) overlay.addEventListener("click", closeSidebar);

    /* Set current year in the sidebar footer */
    const yearEl = document.getElementById("current-year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/*------------------------------------------------------------------------------
#-------------- End of the code : SHARED APP HELPERS ---------------------------
#------------------------------------------------------------------------------*/
