/*==============================================================================
#-------------- Start Code for : DUMMY DATA (dummy-data.js) -------------------
#
#  PURPOSE   : Provides sample / test data for the whole portal because we
#              are NOT connected to SQL Server yet.
#
#  HOW TO USE IN FUTURE (SQL SERVER MIGRATION) :
#    - Every data source below is a plain JavaScript array / object.
#    - When you connect SQL Server, replace each section with an AJAX / fetch
#      call that reads the same shape of data from your backend API.
#    - KEEP the property names identical so the pages that consume this data
#      do NOT need to change.
#
#  FILE MAP :
#    1. SHARED HELPERS  - date formatting, toast, CSV helpers (from v3-3)
#    2. NOTIFICATIONS   - toast + bell + activity log (from v3-3)
#    3. IDENTITY        - "Viewing As" role simulator (from v3-3)
#    4. ACCESSORIES     - accessory master (from v3-3)
#    5. LOOKUP MASTERS  - categories, makes, types, sites, departments
#    6. ASSETS          - full lifecycle model with Smart Asset IDs (from v3-3)
#    7. CONSUMABLES     - stock with restock/used log (from v3-3)
#    8. SPARE PARTS     - stock with restock/used log (from v3-3)
#    9. EMPLOYEE MASTER - employees, departments & assignment helpers
#   10. ROLES & USERS   - roles, user accounts, page registry, role access
#   11. COMPANY         - single company record for print letterheads
#   12. EXIT RECORDS    - snapshot of employee exits
#   13. ACTIVITY LOG    - recent events for the dashboard timeline
#   14. STATUS COLORS   - maps status text to a CSS badge class
#   15. SUMMARY HELPERS - simple count/total functions used by pages
#------------------------------------------------------------------------------*/

/* =============================================================================
   1) SHARED HELPERS  (used by every page)
   ===========================================================================*/

/* =============================================================================
   DATABASE / API LAYER  (AMS-TEST)
   -----------------------------------------------------------------------------
   The AMS-Test portal is backed by the SQL Server database "AMS-TEST" reached
   through the ASP.NET Core API (server\AMS.API). Business data is stored as
   JSON documents in the dbo.ams_collections table; this layer loads every
   collection into the global arrays below at startup and PUTs a collection
   back to the API whenever the in-memory data changes. SQL Server is the
   single source of truth - the arrays are just a live cache of the documents.

   AUTH : the portal is gated by login.html. A successful login returns a JWT
   stored under "ams_session" in localStorage; every API call sends it as a
   Bearer token. layout.js redirects to login.html when the session is missing
   or expired.
   ===========================================================================*/

const AMS_API_BASE = "";
const AMS_SESSION_KEY = "ams_session";

/* ---- session --------------------------------------------------------------- */
function amsGetSession() {
    try { return JSON.parse(localStorage.getItem(AMS_SESSION_KEY) || "null"); }
    catch (e) { return null; }
}
function amsSetSession(s) {
    try { localStorage.setItem(AMS_SESSION_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
}
function amsClearSession() {
    try { localStorage.removeItem(AMS_SESSION_KEY); } catch (e) { /* storage unavailable */ }
}

/* Merge a partial update (e.g. new profile fields) into the stored session. */
function amsUpdateSession(partial) {
    const sess = amsGetSession() || {};
    Object.assign(sess, partial);
    amsSetSession(sess);
    return sess;
}

/* Log the current user out and return to the login page. */
function amsLogout() {
    try { localStorage.removeItem(AMS_VIEWING_AS_STORAGE_KEY); } catch (e) { /* storage unavailable */ }
    amsClearSession();
    amsLoginRedirect();
}
function amsLoginRedirect() {
    const isPages = /\/pages\//.test(window.location.pathname);
    window.location.replace((isPages ? "../" : "") + "login.html");
}

/* ---- core API client ------------------------------------------------------- */
async function amsApiFetch(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers || {});
    const sess = amsGetSession();
    if (sess && sess.token) opts.headers["Authorization"] = "Bearer " + sess.token;
    if (opts.body !== undefined && typeof opts.body !== "string") {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(opts.body);
    }
    let res;
    try {
        res = await fetch(AMS_API_BASE + path, opts);
    } catch (e) {
        throw new Error("Cannot reach the AMS-Test API. Start server\\AMS.API (dotnet run) and refresh.");
    }
    if (res.status === 401) {
        amsClearSession();
        amsLoginRedirect();
        throw new Error("Session expired. Redirecting to login.");
    }
    if (!res.ok) {
        let msg = "API error " + res.status;
        try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) { /* non-JSON error */ }
        throw new Error(msg);
    }
    const text = await res.text();
    try { return text ? JSON.parse(text) : null; } catch (e) { return text; }
}
function amsApiGet(path)   { return amsApiFetch(path, { method: "GET" }); }
function amsApiPut(path, body)   { return amsApiFetch(path, { method: "PUT", body }); }
function amsApiDelete(path) { return amsApiFetch(path, { method: "DELETE" }); }

/* ---- runtime copies of the DB documents (loaded from the API at startup) ---- */
let AMS_ROLE_ACCESS_DEFAULTS = {};
let AMS_REPORT_HEADER_PREFS  = {};

/* ---- collection registry: DB key -> the in-memory global that holds it ------ */
const AMS_COLLECTIONS = {
    assets:          () => DUMMY_ASSETS,
    employees:       () => DUMMY_EMPLOYEES,
    assetTypes:      () => AMS_DUMMY_ASSET_TYPES,
    assetMakes:      () => AMS_DUMMY_ASSET_MAKES,
    assetCategories: () => AMS_DUMMY_ASSET_CATEGORIES,
    sites:           () => AMS_DUMMY_SITES,
    departments:     () => AMS_DUMMY_DEPARTMENTS,
    designations:    () => AMS_DESIGNATION_OPTIONS,
    vendors:         () => AMS_DUMMY_VENDORS,
    consumables:     () => AMS_DUMMY_CONSUMABLES,
    consumableLog:   () => AMS_DUMMY_CONSUMABLE_LOG,
    spareParts:      () => AMS_DUMMY_SPARE_PARTS,
    sparePartLog:    () => AMS_DUMMY_SPAREPART_LOG,
    accessories:     () => AMS_DUMMY_ACCESSORIES,
    simCards:        () => AMS_DUMMY_SIM_CARDS,
    users:           () => AMS_DUMMY_USERS,
    exitRecords:     () => AMS_DUMMY_EXIT_RECORDS,
};

/* ---- document (object) collections: stored as a single JSON object ---------- */
const AMS_DOC_COLLECTIONS = {
    company:     () => AMS_DUMMY_COMPANY_DETAILS,
    roleAccess:  () => AMS_ROLE_ACCESS_DEFAULTS,
    reportPrefs: () => AMS_REPORT_HEADER_PREFS,
};

let AMS_DB_LOADING = null;   /* idempotent load promise */
let AMS_DB_READY   = false;

async function amsDbLoadAll() {
    if (AMS_DB_READY) return;
    if (AMS_DB_LOADING) return AMS_DB_LOADING;
    AMS_DB_LOADING = (async () => {
        await Promise.all(Object.keys(AMS_COLLECTIONS).map(async key => {
            let items = [];
            try { items = await amsApiGet("/api/collection/" + key); }
            catch (e) { console.warn("[amsDb] load " + key + " failed: " + e.message); }
            const arr = AMS_COLLECTIONS[key]();
            arr.length = 0;
            if (Array.isArray(items)) arr.push.apply(arr, items);
        }));
        await Promise.all(Object.keys(AMS_DOC_COLLECTIONS).map(async key => {
            let doc = null;
            try { doc = await amsApiGet("/api/collection/" + key); }
            catch (e) { console.warn("[amsDb] load " + key + " failed: " + e.message); }
            const target = AMS_DOC_COLLECTIONS[key]();
            if (doc && typeof doc === "object") Object.assign(target, doc);
        }));
        const accMax = AMS_DUMMY_ACCESSORIES.reduce((m, a) =>
            Math.max(m, parseInt(String(a.accCode || "0").replace(/\D/g, ""), 10) || 0), 0);
        if (accMax >= AMS_ACC_SEQ) AMS_ACC_SEQ = accMax + 1;
        const venMax = AMS_DUMMY_VENDORS.reduce((m, v) =>
            Math.max(m, parseInt(String(v.vendorId || "0").replace(/\D/g, ""), 10) || 0), 0);
        if (venMax >= AMS_VENDOR_SEQ) AMS_VENDOR_SEQ = venMax + 1;
        AMS_DB_READY = true;
    })();
    return AMS_DB_LOADING;
}
function amsDbEnsureLoaded() { return amsDbLoadAll(); }
function amsDbIsReady() { return AMS_DB_READY; }

/* Persist an array collection back to SQL Server (wholesale replace). */
async function amsDbSave(key) {
    const getter = AMS_COLLECTIONS[key];
    if (!getter) return;
    try { await amsApiPut("/api/collection/" + key, getter()); }
    catch (e) { amsToast("Save failed: " + e.message, "danger"); throw e; }
}

/* Persist a document collection (object) back to SQL Server. */
async function amsDbSaveDoc(key) {
    const getter = AMS_DOC_COLLECTIONS[key];
    if (!getter) return;
    try { await amsApiPut("/api/collection/" + key, getter()); }
    catch (e) { amsToast("Save failed: " + e.message, "danger"); throw e; }
}

/* Persist whichever collection owns the given array reference (used by the
   master-table engine and other generic mutators that don't know the key). */
function amsDbKeyForArray(arr) {
    if (!arr) return null;
    for (const key of Object.keys(AMS_COLLECTIONS)) {
        if (AMS_COLLECTIONS[key]() === arr) return key;
    }
    return null;
}
async function amsDbSaveArray(arr) {
    const key = amsDbKeyForArray(arr);
    if (key) await amsDbSave(key);
}

/* Convenience: fire-and-forget save (keeps the UI responsive; errors still
   surface through amsDbSave's toast). */
function amsDbSaveAsync(key) {
    if (!amsDbIsReady()) return;
    amsDbSave(key).catch(() => {});
}
function amsDbSaveDocAsync(key) {
    if (!amsDbIsReady()) return;
    amsDbSaveDoc(key).catch(() => {});
}

/* Converts stored ISO date (yyyy-mm-dd) to dd-mm-yyyy for display in the UI */
function amsFormatDate(iso) {
    if (!iso) return "";
    const parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    const [y, m, d] = parts;
    return `${d}-${m}-${y}`;
}

/* Reverse of amsFormatDate: dd-mm-yyyy (e.g. from CSV import) back to ISO */
function amsParseDMY(dmy) {
    if (!dmy) return "";
    const parts = String(dmy).trim().split("-");
    if (parts.length !== 3) return dmy;
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/* Toast notification - types: info | success | warning | danger */
function amsToast(message, type) {
    type = type || "info";
    /* Settings > Notifications can turn popups off (history still records) */
    if (!amsGetToastEnabled()) return;
    let container = document.getElementById("amsToastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "amsToastContainer";
        container.className = "ams-toast-container";
        document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `ams-toast ams-toast-${type}`;
    toast.textContent = message;
    toast.addEventListener("click", () => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 250);
    });
    container.appendChild(toast);
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
    raf(() => toast.classList.add("show"));
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 250);
    }, 3500);
}

/* Escapes a value for safe CSV output */
function amsCsvRow(arr) {
    return arr.map(v => {
        v = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(",");
}

/* Parses CSV text into an array of arrays (handles quoted fields) */
function amsParseCsv(text) {
    const rows = []; let row = [], field = "", inQuotes = false;
    text = text.replace(/\r\n/g, "\n");
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
            else field += c;
        } else {
            if (c === '"') inQuotes = true;
            else if (c === ",") { row.push(field); field = ""; }
            else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
            else field += c;
        }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.length > 1 || (r[0] !== undefined && r[0] !== ""));
}

/* Triggers a browser download for text content (CSV / TXT export) */
function amsDownloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* Shows the shared "Import report" modal after a bulk CSV import.
   results: [ { row, record, result, reason } ] where result is one of
   "added" | "updated" | "skipped" | "error". Rows skipped because of a missing
   Department / Designation carry `missingDept` / `missingDesig` tags so a
   Supreme Root user can add those lookups right from the report. The modal is
   built on the fly (no page markup needed) using only theme-variable styles. */
function amsShowImportReport(results) {
    document.getElementById("amsImportReportOverlay")?.remove();

    const count = r => results.filter(x => x.result === r).length;
    const added = count("added"), updated = count("updated");
    const skipped = count("skipped"), errors = count("error");
    const total = results.length;

    const chip = (label, value, cls) => `
        <span class="badge ${cls}" style="font-size:12px; padding:6px 10px; display:inline-flex; align-items:center; gap:6px;">
            ${label}: <strong>${value}</strong>
        </span>`;

    const rowsHtml = results.length
        ? results.map(r => `
            <tr>
                <td class="mono">${amsEsc(r.row)}</td>
                <td>${amsEsc(r.record || "-")}</td>
                <td>
                    ${r.result === "added" ? `<span class="badge badge-green">Added</span>`
                        : r.result === "updated" ? `<span class="badge badge-blue">Updated</span>`
                        : r.result === "skipped" ? `<span class="badge badge-amber">Skipped</span>`
                        : `<span class="badge badge-red">Error</span>`}
                </td>
                <td>${amsEsc(r.reason || "")}</td>
            </tr>`).join("")
        : `<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">No rows were read from the file.</td></tr>`;

    /* ---- Missing lookups quick-add (Supreme Root only) ---- */
    const isSupreme = typeof amsGetViewingAsRole === "function" && amsGetViewingAsRole() === "Supreme Root";
    const missingDepts = [...new Set(results.filter(r => r.missingDept).map(r => r.missingDept).filter(Boolean))];
    const missingDesigs = [...new Set(results.filter(r => r.missingDesig).map(r => r.missingDesig).filter(Boolean))];
    let lookupsHtml = "";
    if (isSupreme && (missingDepts.length || missingDesigs.length)) {
        const deptChips = missingDepts.map(d => `
            <span class="badge badge-amber lookup-chip" style="padding:5px 10px; display:inline-flex; align-items:center; gap:8px;"
                  data-missing-dept="${amsEsc(d)}">
                Department: <strong>${amsEsc(d)}</strong>
                <button class="btn btn-primary" style="padding:3px 10px; font-size:12px;" data-add-dept="${amsEsc(d)}">Add</button>
            </span>`).join("");
        const desigChips = missingDesigs.map(d => `
            <span class="badge badge-amber lookup-chip" style="padding:5px 10px; display:inline-flex; align-items:center; gap:8px;"
                  data-missing-desig="${amsEsc(d)}">
                Designation: <strong>${amsEsc(d)}</strong>
                <button class="btn btn-primary" style="padding:3px 10px; font-size:12px;" data-add-desig="${amsEsc(d)}">Add</button>
            </span>`).join("");
        lookupsHtml = `
            <div style="border:1px solid var(--border); border-radius:8px; padding:10px 12px; margin-bottom:12px; background:var(--bg-elevated);">
                <div style="font-weight:700; margin-bottom:6px;">Missing lookups from this file (Supreme Root)</div>
                <div style="color:var(--text-secondary); font-size:12px; margin-bottom:8px;">
                    The import file uses ${missingDepts.length + missingDesigs.length} lookup(s) not in the masters yet.
                    Add them here, then re-import the file to add the skipped rows.
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;" id="amsMissingLookups">
                    ${deptChips}${desigChips}
                </div>
            </div>`;
    }

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay open";
    overlay.id = "amsImportReportOverlay";
    overlay.style.display = "flex";
    overlay.innerHTML = `
        <div class="modal" style="width:720px; max-width:92vw;">
            <div class="modal-header">
                <h3>Import Report</h3>
                <button class="modal-close" data-ams-close-import-report>&times;</button>
            </div>
            <div class="modal-body">
                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
                    ${chip("Total rows", total, "badge-grey")}
                    ${chip("Added", added, "badge-green")}
                    ${chip("Updated", updated, "badge-blue")}
                    ${chip("Skipped", skipped, "badge-amber")}
                    ${chip("Errors", errors, "badge-red")}
                </div>
                ${lookupsHtml}
                <div style="max-height: 300px; overflow:auto; border:1px solid var(--border); border-radius:8px;">
                    <table class="table" style="margin:0;">
                        <thead>
                            <tr><th style="width:56px;">Row</th><th>Record</th><th style="width:110px;">Result</th><th>Reason</th></tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="ams-download-import-report">Download Report</button>
                <button class="btn btn-primary" data-ams-close-import-report>Done</button>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    /* ---- Wire: close + download report ---- */
    overlay.addEventListener("click", (ev) => {
        if (ev.target === overlay || ev.target.closest("[data-ams-close-import-report]")) {
            overlay.remove();
        }
    });
    const dlBtn = document.getElementById("ams-download-import-report");
    if (dlBtn) dlBtn.addEventListener("click", () => {
        const lines = [["Row", "Record", "Result", "Reason"],
            ...results.map(r => [r.row, r.record, r.result, r.reason])];
        amsDownloadFile(lines.map(amsCsvRow).join("\r\n"), "Import_Report.csv", "text/csv");
    });

    /* ---- Wire: quick-add missing Department / Designation ---- */
    overlay.addEventListener("click", (ev) => {
        const addDeptBtn = ev.target.closest("[data-add-dept]");
        if (addDeptBtn) { amsQuickAddDeptFromReport(addDeptBtn.getAttribute("data-add-dept"), addDeptBtn); return; }
        const addDesigBtn = ev.target.closest("[data-add-desig]");
        if (addDesigBtn) { amsQuickAddDesigFromReport(addDesigBtn.getAttribute("data-add-desig"), addDesigBtn); return; }
        const saveDept = ev.target.closest("[data-save-dept]");
        if (saveDept) {
            const wrap = saveDept.closest("[data-dept-editor]");
            const short = wrap.querySelector("[data-dept-short]").value.trim().toUpperCase();
            const name = saveDept.getAttribute("data-save-dept");
            if (!short) { amsToast("Shortform is required for the department.", "warning"); return; }
            if (amsDeptKnown(name)) { amsToast("Department already exists.", "warning"); return; }
            amsEnsureDepartment(name, short); /* adds to BOTH masters + persists */
            amsToast(`Department "${name}" added to the Department Master.`, "success");
            const chip = wrap.closest(".lookup-chip");
            if (chip) chip.outerHTML = `<span class="badge badge-green" style="padding:5px 10px;">Department: <strong>${amsEsc(name)}</strong> - added</span>`;
        }
    });
}

/* Inline editor for adding a missing Department straight from the Import Report */
function amsQuickAddDeptFromReport(name, btn) {
    if (amsDeptKnown(name)) {
        btn.outerHTML = `<span class="badge badge-green">Added</span>`;
        return;
    }
    const suggestion = (name.replace(/[^a-zA-Z]/g, "").slice(0, 3) || "NEW").toUpperCase();
    btn.closest(".lookup-chip").outerHTML = `
        <span class="badge badge-amber lookup-chip" style="padding:5px 10px; display:inline-flex; align-items:center; gap:8px;" data-dept-editor="${amsEsc(name)}">
            Department: <strong>${amsEsc(name)}</strong>
            <input type="text" value="${amsEsc(suggestion)}" maxlength="4" style="width:60px; padding:3px 6px; font-size:12px;" data-dept-short title="Shortform used inside AMS Employee IDs (max 4 letters)">
            <button class="btn btn-primary" style="padding:3px 10px; font-size:12px;" data-save-dept="${amsEsc(name)}">Save</button>
        </span>`;
}

/* Adds a missing Designation straight from the Import Report (no extra data needed) */
function amsQuickAddDesigFromReport(name, btn) {
    if (amsDesigKnown(name)) {
        btn.outerHTML = `<span class="badge badge-green">Added</span>`;
        return;
    }
    amsEnsureDesignation(name); /* adds to BOTH masters + persists */
    amsToast(`Designation "${name}" added to the Designation Master.`, "success");
    btn.closest(".lookup-chip").outerHTML = `<span class="badge badge-green" style="padding:5px 10px;">Designation: <strong>${amsEsc(name)}</strong> - added</span>`;
}

/* Escapes text for safe HTML insertion */
function amsEsc(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
}

/* =============================================================================
   2) NOTIFICATIONS  (toast + persistent bell + append-only activity log)
   ===========================================================================*/

const AMS_NOTIF_STORAGE_KEY = "ams_notifications";
const AMS_NOTIF_MAX = 50;

function amsGetNotifications() {
    try { return JSON.parse(localStorage.getItem(AMS_NOTIF_STORAGE_KEY)) || []; }
    catch (e) { return []; }
}
function amsSaveNotifications(list) {
    try { localStorage.setItem(AMS_NOTIF_STORAGE_KEY, JSON.stringify(list.slice(0, AMS_NOTIF_MAX))); } catch (e) { /* storage full */ }
}

/* Separate from the bell on purpose - the bell's "Clear All" must never erase
   the permanent audit trail Log Report reads from. Append-only from amsNotify(). */
const AMS_LOG_STORAGE_KEY = "ams_activity_log";
const AMS_LOG_MAX = 1000;

function amsGetActivityLog() {
    try { return JSON.parse(localStorage.getItem(AMS_LOG_STORAGE_KEY)) || []; }
    catch (e) { return []; }
}
function amsSaveActivityLog(list) {
    try { localStorage.setItem(AMS_LOG_STORAGE_KEY, JSON.stringify(list.slice(0, AMS_LOG_MAX))); } catch (e) { /* storage full */ }
}

function amsTimeAgo(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

/* Call this from ANY page to notify: amsNotify("message", "success") */
function amsNotify(message, type) {
    type = type || "info";
    const entry = {
        message, type, time: new Date().toISOString(),
        actorRole: (typeof amsGetViewingAsRole === "function") ? amsGetViewingAsRole() : "Standard User",
        page: document.title.replace(/^.* - /, "") || location.pathname,
    };
    const list = amsGetNotifications();
    list.unshift(entry);
    amsSaveNotifications(list);
    const log = amsGetActivityLog();
    log.unshift(entry);
    amsSaveActivityLog(log);
    amsToast(message, type);
    amsRenderBell();
}

function amsRenderBell() {
    const list = amsGetNotifications();
    const badge = document.getElementById("notifBellBadge");
    if (badge) {
        if (list.length) { badge.textContent = list.length > 9 ? "9+" : list.length; badge.style.display = "flex"; }
        else badge.style.display = "none";
    }
    const panel = document.getElementById("notifBellList");
    if (!panel) return;
    panel.innerHTML = list.length
        ? list.map(n => `
            <div class="notif-item">
              <span class="notif-dot notif-${n.type}"></span>
              <div>
                <div class="notif-msg">${amsEsc(n.message)}</div>
                <div class="notif-time">${amsTimeAgo(n.time)}</div>
              </div>
            </div>`).join("")
        : `<div class="notif-empty">No notifications yet</div>`;
}

function amsInitBell() {
    const trigger = document.getElementById("notifBellTrigger");
    const panel = document.getElementById("notifBellPanel");
    if (!trigger || !panel) return;
    amsRenderBell();
    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        panel.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
        if (!e.target.closest("#notifBellPanel") && !e.target.closest("#notifBellTrigger")) panel.classList.remove("open");
    });
    const clearBtn = document.getElementById("notifClearAll");
    if (clearBtn) clearBtn.addEventListener("click", () => { amsSaveNotifications([]); amsRenderBell(); });
    window.addEventListener("storage", (e) => { if (e.key === AMS_NOTIF_STORAGE_KEY) amsRenderBell(); });
}

/* =============================================================================
   3) IDENTITY  ("Viewing As" role simulator - localStorage-backed so the role
      stays consistent across pages, like theme choice)
   ===========================================================================*/

const AMS_VIEWING_AS_STORAGE_KEY = "ams_viewing_as_role";

/* The "Viewing As" role simulator was removed in favour of the logged-in
   account. amsGetViewingAsRole() now resolves to the real session role so
   existing page code (role guards, hints) keeps working unchanged. */
function amsGetViewingAsRole() {
    try {
        const session = amsGetSession();
        if (session && session.role) return session.role;
        return "Standard User";
    }
    catch (e) { return "Standard User"; }
}
function amsSetViewingAsRole(role) {
    /* Compatibility stub - role is always the real session role now. */
    if (role) { try { localStorage.removeItem(AMS_VIEWING_AS_STORAGE_KEY); } catch (e) { /* ignore */ } }
}

/* =============================================================================
   4) ACCESSORIES  (common / supportive accessories, linked to an Asset Type)
   ===========================================================================*/

let AMS_ACC_SEQ = 24;
const AMS_DUMMY_ACCESSORIES = [];


/* Options for the Assign/Reassign/Replace checklist - active accessories for an Asset Type */
function amsGetAccessoryOptions(assetType) {
    return AMS_DUMMY_ACCESSORIES.filter(a => a.assetType === assetType && a.active).map(a => a.name);
}

/* Quick-add from the checklist "+" - adds straight to the shared master list */
function amsQuickAddAccessory(name, assetType) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    if (AMS_DUMMY_ACCESSORIES.some(a => a.assetType === assetType && a.name.toLowerCase() === trimmed.toLowerCase())) {
        return null;
    }
    AMS_ACC_SEQ += 1;
    AMS_DUMMY_ACCESSORIES.push({ accCode: `ACC-${String(AMS_ACC_SEQ).padStart(6, "0")}`, name: trimmed, assetType, active: true });
    amsDbSaveAsync("accessories");
    return trimmed;
}

/* Quick-add department from "Assign to Department +" */
function amsQuickAddDepartment(name, shortform) {
    const trimmedName = (name || "").trim();
    const trimmedShort = (shortform || "").trim().toUpperCase();
    if (!trimmedName || !trimmedShort) return null;
    if (AMS_DUMMY_DEPARTMENTS.some(d => d.name.toLowerCase() === trimmedName.toLowerCase())) return null;
    AMS_DUMMY_DEPARTMENTS.push({ name: trimmedName, shortform: trimmedShort, active: true });
    amsDbSaveAsync("departments");
    return trimmedName;
}

/* Quick-add designation (used by the "+" button next to the Designation field) */
function amsQuickAddDesignation(name) {
    const trimmedName = (name || "").trim();
    if (!trimmedName) return null;
    if (AMS_DESIGNATION_OPTIONS.some(d => d.name.toLowerCase() === trimmedName.toLowerCase())) return null;
    AMS_DESIGNATION_OPTIONS.push({ name: trimmedName, active: true });
    amsDbSaveAsync("designations");
    return trimmedName;
}

/* =============================================================================
   5) LOOKUP MASTERS  (fed to the generic master-table engine)
   ===========================================================================*/
const AMS_DUMMY_ASSET_CATEGORIES = [];
const AMS_DUMMY_ASSET_MAKES = [];


/* shortform matches the prefix used in Smart Asset IDs (e.g. LT00007HOIT -> LT = Laptop) */
const AMS_DUMMY_ASSET_TYPES = [];


/* shortform matches the site-code segment in Smart Asset IDs (e.g. LT00007HOIT -> HO = Mumbai HO) */
const AMS_DUMMY_SITES = [];


/* shortform is used inside the auto-generated AMS Employee ID: EMP-<shortform>-000001 */
const AMS_DUMMY_DEPARTMENTS = [];
const AMS_DESIGNATION_OPTIONS = [];


/* =============================================================================
   5a-2) UNIFIED DEPARTMENT / DESIGNATION LOOKUP HELPERS
   -----------------------------------------------------------------------------
   Departments & designations live in TWO parallel sources:
     - DEPARTMENTS / DESIGNATIONS  : hardcoded seeds used by the Employee form
                                     dropdowns, AMS Employee ID shortforms and
                                     the bulk-import reference check
     - AMS_DUMMY_DEPARTMENTS / AMS_DESIGNATION_OPTIONS : DB-backed arrays used
                                     by the Department/Designation Masters and
                                     the asset/report dropdowns
   These helpers keep BOTH in sync and persist to SQL Server, so a department
   or designation created ANYWHERE (Employee form, bulk import, Import Report
   quick-add) shows up in the Masters and survives navigation.
   ===========================================================================*/

/* Is this department known in EITHER master source? */
function amsDeptKnown(name) {
    const n = (name || "").trim().toLowerCase();
    if (!n) return false;
    if (DEPARTMENTS.some(d => d.name.toLowerCase() === n)) return true;
    return AMS_DUMMY_DEPARTMENTS.some(d => d.name.toLowerCase() === n);
}

/* Is this designation known in EITHER master source? (blank is always ok) */
function amsDesigKnown(name) {
    const n = (name || "").trim().toLowerCase();
    if (!n) return true;
    if (DESIGNATIONS.some(d => d.toLowerCase() === n)) return true;
    return AMS_DESIGNATION_OPTIONS.some(d => (d.name || "").toLowerCase() === n);
}

/* Ensures a department exists in BOTH masters (+ persists to SQL). Returns the
   shortform in use (derived from the masters, or the caller's value, or a best
   guess from the name). No-op if the department is already present. */
function amsEnsureDepartment(name, shortform) {
    const trimmedName = (name || "").trim();
    if (!trimmedName) return "";
    const trimmedShort = (shortform || "").trim().toUpperCase();
    const dbRec = AMS_DUMMY_DEPARTMENTS.find(d => d.name.toLowerCase() === trimmedName.toLowerCase());
    const seedRec = DEPARTMENTS.find(d => d.name.toLowerCase() === trimmedName.toLowerCase());
    const short = trimmedShort
        || (dbRec && dbRec.shortform)
        || (seedRec && seedRec.short)
        || (trimmedName.replace(/[^a-zA-Z]/g, "").slice(0, 3) || "NEW").toUpperCase();
    if (!seedRec) DEPARTMENTS.push({ name: trimmedName, short });
    if (!dbRec) {
        AMS_DUMMY_DEPARTMENTS.push({ name: trimmedName, shortform: short, active: true });
        amsDbSaveAsync("departments");
    }
    return short;
}

/* Ensures a designation exists in BOTH masters (+ persists to SQL). Returns
   true if it was newly added to the DB-backed master. */
function amsEnsureDesignation(name) {
    const trimmedName = (name || "").trim();
    if (!trimmedName) return false;
    if (!DESIGNATIONS.some(d => d.toLowerCase() === trimmedName.toLowerCase())) {
        DESIGNATIONS.push(trimmedName);
    }
    if (AMS_DESIGNATION_OPTIONS.some(d => (d.name || "").toLowerCase() === trimmedName.toLowerCase())) return false;
    AMS_DESIGNATION_OPTIONS.push({ name: trimmedName, active: true });
    amsDbSaveAsync("designations");
    return true;
}


/* =============================================================================
   5b) ASSET ID HELPERS  (Smart Asset ID model - shared by Asset Master, Employee
   Master and Reports. Lookup shortforms come from the masters above.)
   ===========================================================================*/

/* shortform segment for an Asset Type (e.g. "Laptop" -> "LT") */
function amsTypeShort(typeName) { return (AMS_DUMMY_ASSET_TYPES.find(t => t.name === typeName) || {}).shortform || ""; }

/* shortform segment for a Site (e.g. "Mumbai HO" -> "HO") */
function amsSiteShort(siteName) { return (AMS_DUMMY_SITES.find(s => s.name === siteName) || {}).shortform || ""; }

/* shortform segment for a Department (e.g. "IT" -> "IT") */
function amsDeptShort(deptName) { return (AMS_DUMMY_DEPARTMENTS.find(d => d.name === deptName) || {}).shortform || ""; }

/* Base Display ID - the permanent type+sequence part (e.g. "LT00007") that does
   NOT change when the asset is assigned/transferred. Works even for records that
   have no explicit displayId field (older dummy entries). */
function amsBaseDisplayId(asset) {
    if (asset.displayId) return asset.displayId;
    const m = String(asset.id || "").match(/^[A-Za-z]+\d+/);
    return m ? m[0] : asset.id;
}

/* Employee view-model used by pages that work with asset assignments. Asset
   records link to employees via their AMS ID (empId mirror below), so the Smart
   Asset ID suffix resolves to the assignee's department. */
function amsGetEmployeeByAmsId(amsId) {
    const e = findEmployee(amsId);
    if (!e) return null;
    return {
        amsId: e.amsId,
        empId: e.amsId,            /* view: mirrors the AMS ID that assets store in assignedTo */
        empIdCompany: e.empId,     /* the company-issued ID, kept for reference */
        name: getEmployeeFullName(e),
        dept: e.department,
        designation: e.designation,
        contact: e.contact,
        email: e.email,
        status: e.status,
        reportsTo: e.managerAmsId,
    };
}

/* All employees in the view-model shape (includes exited/inactive, as the
   Asset Master must still resolve history rows that reference them) */
function amsGetEmployeesForPortal() {
    return DUMMY_EMPLOYEES.map(e => amsGetEmployeeByAmsId(e.amsId));
}

/* FULL Smart Asset ID = Base Display ID + CurrentSite + Assignee's Dept, only
   once the asset is Assigned. Unassigned assets stay on their base/short form. */
function amsComputeFullId(asset) {
    const base = amsBaseDisplayId(asset);
    if (!asset.assignedTo) return base; /* unassigned - base/short form only */
    const emp = amsGetEmployeeByAmsId(asset.assignedTo);
    const siteShort = amsSiteShort(asset.currentSite || asset.site);
    /* Assign to Department (optional) overrides the employee's own department for
       this suffix - e.g. a shared printer physically sitting in Sales, even if the
       Direct Employee responsible for it is from IT, should show as belonging to
       Sales, not IT. */
    const deptShort = amsDeptShort(asset.assignedDepartment || (emp ? emp.dept : ""));
    return `${base}${siteShort}${deptShort}`;
}

/* Asset ID to display on a printed form. Uses the COMPUTED full ID so an
   assigned asset always prints with its department suffix (base + site + dept),
   even if the stored id is an older base+site form. For snapshot records (exit
   reports) that have no live assignment, falls back to the stored id. */
function amsPrintAssetId(oa) {
    if (!oa) return "";
    const stored = oa.id || oa.assetId || "";
    if (oa.assignedTo || (typeof oa.id === "string" && oa.id && (oa.displayId || oa.currentSite || oa.site))) {
        const full = amsComputeFullId(oa);
        if (full) return full;
    }
    return stored;
}

/* =============================================================================
   6) ASSETS  (full lifecycle model with Smart Asset IDs - from v3-3)
   ===========================================================================*/

/* Status options. "Transfer" = in-transit between sites. "Not Working" = needs repair.
   "Retired / Scrapped" = permanently out of service. */
const AMS_ASSET_STATUS_OPTIONS = [
    "In Store", "Assigned", "In Repair", "Transfer", "Not Working", "Retired / Scrapped", "Replaced",
];
const DUMMY_ASSETS = [];


/* =============================================================================
   7) CONSUMABLES  (per-site stock with Restock/Used movement log)
   ===========================================================================*/

const AMS_CONSUMABLE_CATEGORIES = ["Printer Supplies", "Cables", "Peripherals", "Stationery", "IT Accessories"];
const AMS_CONSUMABLE_UNITS = ["Nos", "Box", "Pack", "Ream", "Meter"];
const AMS_DUMMY_CONSUMABLES = [];
const AMS_DUMMY_CONSUMABLE_LOG = [];


/* =============================================================================
   8) SPARE PARTS  (per-site stock with Restock/Used movement log)
   ===========================================================================*/

const AMS_SPAREPART_CATEGORIES = ["Internal Component", "Toner / Ink", "Mechanical Part"];
const AMS_DUMMY_SPARE_PARTS = [];
const AMS_DUMMY_SPAREPART_LOG = [];


/* =============================================================================
   8a) SIM CARD MASTER  (mobile SIM cards issued to employees)
   ----------------------------------------------------------------------------
   A SIM card and a mobile phone are issued together to some users. The phone
   itself is tracked as a normal Asset; this collection stores the separate SIM
   record (SIM serial / ICCID, the mobile number on it, operator, plan, issue
   status and assignment). Rendered by pages/sim-cards.html + js/sim-cards.js
   in the same style as the Asset Master.
   ===========================================================================*/

const AMS_SIM_STATUS_OPTIONS = ["In Store", "Issued", "Blocked", "Retired"];
const AMS_SIM_OPERATOR_OPTIONS = ["Jio", "Airtel", "Vodafone Idea", "BSNL", "MTNL"];
const AMS_DUMMY_SIM_CARDS = [];

/* Next auto-generated SIM display ID (SIM-000001, SIM-000002, ...) */
function amsNextSimId() {
    const maxSeq = AMS_DUMMY_SIM_CARDS.reduce((m, s) => {
        const n = parseInt(String(s.simId || "0").replace(/\D/g, ""), 10);
        return isNaN(n) ? m : Math.max(m, n);
    }, 0);
    return "SIM-" + String(maxSeq + 1).padStart(6, "0");
}


/* =============================================================================
   8b) VENDOR MASTER  (suppliers behind Assets / Consumables / Spare Parts)
   ---------------------------------------------------------------------------
   A config-only master driven by the generic engine (js/master-table.js).
   The vendor names seeded here are the ones already referenced across the
   portal data (assets, consumables, spare parts) so every existing record
   links back to a vendor. amsGetActiveVendorNames() feeds the vendor
   datalists on the Asset / Consumable / Spare Parts forms.
   ===========================================================================*/

let AMS_VENDOR_SEQ = 12;

const AMS_VENDOR_CATEGORIES = ["Assets", "Consumables", "Spare Parts", "Services", "All"];
const AMS_DUMMY_VENDORS = [];


/* Live vendor names for the Asset / Consumable / Spare Parts vendor fields */
function amsGetActiveVendorNames() {
    return AMS_DUMMY_VENDORS.filter(v => v.active).map(v => v.name);
}

/* Refills every <select class="ams-vendor-select"> (the "pick a Vendor" fields
   on the Asset / Consumable / Spare Parts forms) with the active vendor list.
   Keeps the currently-selected value, and if it is no longer in the master it
   is preserved as an extra option so old records still show their vendor. */
function amsPopulateVendorSelects() {
    const names = amsGetActiveVendorNames();
    document.querySelectorAll("select.ams-vendor-select").forEach(sel => {
        const current = sel.value;
        sel.innerHTML = `<option value="">(None - optional)</option>` +
            names.map(n => `<option value="${amsEsc(n)}">${amsEsc(n)}</option>`).join("");
        if (current && !names.some(n => n === current)) {
            const opt = document.createElement("option");
            opt.value = current; opt.textContent = current;
            sel.appendChild(opt);
        }
        if (current) sel.value = current;
    });
}

/* Sets a vendor select to a given vendor name, adding it as an option first if
   it is not in the current master list (so old records never show blank). */
function amsSetVendorSelectValue(selId, value) {
    const sel = document.getElementById(selId);
    if (!sel) return;
    if (value && !Array.from(sel.options).some(o => o.value === value)) {
        const opt = document.createElement("option");
        opt.value = value; opt.textContent = value;
        sel.appendChild(opt);
    }
    sel.value = value || "";
}

/* ---- Vendor quick-add (+) : one shared popover, dropped next to whichever
   vendor select's "+" was clicked. Used by the Asset / Consumable / Spare
   Parts forms. ---- */
let amsVendorQaTarget = null;

function amsCloseVendorQa() {
    document.querySelectorAll("#amsQaPopoverVendor.open").forEach(p => p.classList.remove("open"));
}

function amsWireVendorQuickAdds() {
    /* Build the shared popover once */
    let popover = document.getElementById("amsQaPopoverVendor");
    if (!popover) {
        popover = document.createElement("div");
        popover.className = "quickadd-popover";
        popover.id = "amsQaPopoverVendor";
        popover.innerHTML = `
            <label class="qa-label">New Vendor Name *</label>
            <input type="text" id="amsQaVendorName" class="input" placeholder="e.g. Tech Solutions India">
            <label class="qa-label">Contact Person</label>
            <input type="text" id="amsQaVendorContact" class="input" placeholder="Optional">
            <label class="qa-label">Phone</label>
            <input type="text" id="amsQaVendorPhone" class="input" placeholder="Optional">
            <label class="qa-label">Email</label>
            <input type="text" id="amsQaVendorEmail" class="input" placeholder="Optional">
            <label class="qa-label">City</label>
            <input type="text" id="amsQaVendorCity" class="input" placeholder="Optional">
            <div class="qa-actions" style="display:flex; gap:8px; justify-content:flex-end; margin-top:10px;">
                <button type="button" class="btn btn-secondary" data-ams-qa-vendor-cancel>Cancel</button>
                <button type="button" class="btn btn-primary" id="amsQaVendorSave">Add</button>
            </div>`;
        document.body.appendChild(popover);
    }

    document.querySelectorAll("[data-quickadd-vendor]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            amsVendorQaTarget = btn.getAttribute("data-quickadd-vendor");
            const host = btn.closest(".select-with-add") || btn.parentElement;
            host.appendChild(popover);
            const wasOpen = popover.classList.contains("open");
            amsCloseVendorQa();
            if (!wasOpen) popover.classList.add("open");
        });
    });

    document.querySelectorAll("[data-ams-qa-vendor-cancel]").forEach(btn => btn.addEventListener("click", amsCloseVendorQa));
    document.addEventListener("click", (e) => {
        if (!e.target.closest("#amsQaPopoverVendor") && !e.target.closest("[data-quickadd-vendor]")) amsCloseVendorQa();
    });

    const saveBtn = document.getElementById("amsQaVendorSave");
    if (saveBtn) saveBtn.addEventListener("click", () => {
        const name = document.getElementById("amsQaVendorName").value.trim();
        if (!name) { alert("Enter a Vendor name."); return; }
        if (AMS_DUMMY_VENDORS.some(v => v.name.toLowerCase() === name.toLowerCase())) { alert("This Vendor already exists."); return; }
        AMS_DUMMY_VENDORS.push({
            vendorId: "VEN-" + String(++AMS_VENDOR_SEQ).padStart(6, "0"),
            name,
            contactPerson: document.getElementById("amsQaVendorContact").value.trim(),
            phone: document.getElementById("amsQaVendorPhone").value.trim(),
            email: document.getElementById("amsQaVendorEmail").value.trim(),
            city: document.getElementById("amsQaVendorCity").value.trim(),
            category: "All", gstin: "", remarks: "", active: true,
        });
        amsPopulateVendorSelects();
        if (amsVendorQaTarget && document.getElementById(amsVendorQaTarget)) {
            document.getElementById(amsVendorQaTarget).value = name;
        }
        ["amsQaVendorName", "amsQaVendorContact", "amsQaVendorPhone", "amsQaVendorEmail", "amsQaVendorCity"]
            .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
        amsCloseVendorQa();
        amsNotify(`Vendor "${name}" added.`, "success");
    });
}

/* =============================================================================
   9) EMPLOYEE MASTER  (people, departments, hierarchy & assignments)
   ===========================================================================*/

/* ---- Departments and their short-forms (used inside the AMS Employee ID) --- */
const DEPARTMENTS = [
    { name: "Production", short: "PRD" },
    { name: "IT",         short: "IT"  },
    { name: "Facilities", short: "FAC" },
    { name: "Admin",      short: "ADM" },
    { name: "Logistics",  short: "LOG" },
    { name: "Finance",    short: "FIN" },
    { name: "HR",         short: "HR"  }
];

/* ---- Suggested designations (shown in the Add/Edit form as suggestions) ---- */
const DESIGNATIONS = [
    "Managing Director", "General Manager", "Department Manager",
    "Supervisor", "Engineer", "Technician", "Support Engineer",
    "Accountant", "HR Executive", "Machine Operator", "Security Guard"
];

/* ---- Credential levels (demo of the "Super Root User" visibility rule) ----- */
const CREDENTIAL_LEVELS = [
    { name: "Standard User",  amsVisible: false },
    { name: "Administrator",  amsVisible: false },
    { name: "Super Root",     amsVisible: true  }
];

/* ---- Facilities checked / disabled during employee exit or handover --------- */
const FACILITIES_CHECKLIST = [
    { key: "email",  label: "Email Login",            revokedOnExit: true },
    { key: "erp",    label: "ERP Login",              revokedOnExit: true },
    { key: "vpn",    label: "VPN Access",             revokedOnExit: true },
    { key: "card",   label: "Building Access Card",   revokedOnExit: true },
    { key: "phone",  label: "Phone / Extension",      revokedOnExit: true },
    { key: "share",  label: "Shared Drive / Mail Group", revokedOnExit: true }
];

/* ---- Employee records -------------------------------------------------------
 *  amsId      : AUTO-GENERATED (EMP-<DeptShort>-000001) - hidden from normal users
 *  empId      : the ID given by the company (e.g. 00609, D00001). Default EMP-000001.
 *  managerAmsId : reports-to relationship (used to compute subordinate assets)
 * ---------------------------------------------------------------------------*/
const DUMMY_EMPLOYEES = [];


/* ---- Employee helper functions ---------------------------------------------- */

/* Returns the short-form for a department name (falls back to GEN) */
function getDeptShort(departmentName) {
    const dept = DEPARTMENTS.find(d => d.name === departmentName);
    return dept ? dept.short : "GEN";
}

/* Auto-generates the next AMS ID for a department, e.g. EMP-IT-000004.
   Uses the highest existing sequence number for that department so IDs stay
   unique even when records have been removed (leaving gaps). */
function generateAmsId(departmentName) {
    const short = getDeptShort(departmentName);
    const prefix = "EMP-" + short + "-";
    let maxSeq = 0;
    DUMMY_EMPLOYEES.forEach(e => {
        if (e.amsId && e.amsId.indexOf(prefix) === 0) {
            const seq = parseInt(e.amsId.slice(prefix.length), 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
    });
    return prefix + String(maxSeq + 1).padStart(6, "0");
}

/* Combines first + middle + last into a display name */
function getEmployeeFullName(emp) {
    return [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(" ");
}

/* Returns the initials of an employee (for the avatar) */
function getEmployeeInitials(emp) {
    return (emp.firstName[0] || "") + (emp.lastName[0] || "");
}

/* All employees, optionally filtered by status */
function getEmployees(statusFilter) {
    if (!statusFilter || statusFilter === "All") return DUMMY_EMPLOYEES;
    return DUMMY_EMPLOYEES.filter(e => e.status === statusFilter);
}

/* Finds one employee by AMS ID */
function findEmployee(amsId) {
    return DUMMY_EMPLOYEES.find(e => e.amsId === amsId);
}

/* Finds one employee by AMS ID OR company ID */
function findEmployeeAny(identifier) {
    return DUMMY_EMPLOYEES.find(e => e.amsId === identifier || e.empId === identifier);
}

/* Adds a new employee and returns the record with its generated AMS ID.
   Also registers the employee's department/designation in BOTH lookup masters
   (and persists) so they show up in the Department / Designation Masters even
   when the employee was bulk-imported with a lookup that only existed in one
   master source. */
function addEmployee(data) {
    amsEnsureDepartment(data.department, data.deptShort || "");
    amsEnsureDesignation(data.designation);
    const emp = {
        amsId: generateAmsId(data.department),
        empId: data.empId || "EMP-000001",
        firstName: data.firstName,
        middleName: data.middleName || "",
        lastName: data.lastName,
        department: data.department,
        designation: data.designation,
        contact: data.contact || "",
        email: data.email || "",
        managerAmsId: data.managerAmsId || null,
        status: "Active",
        exitDate: null
    };
    DUMMY_EMPLOYEES.push(emp);
    amsDbSaveAsync("employees");
    return emp;
}

/* Updates the editable fields of an existing employee */
function updateEmployee(amsId, data) {
    const emp = findEmployee(amsId);
    if (!emp) return null;
    emp.empId = data.empId || "EMP-000001";
    emp.firstName = data.firstName;
    emp.middleName = data.middleName || "";
    emp.lastName = data.lastName;
    emp.department = data.department;
    emp.designation = data.designation;
    emp.contact = data.contact || "";
    emp.email = data.email || "";
    emp.managerAmsId = data.managerAmsId || null;
    amsDbSaveAsync("employees");
    return emp;
}

/* Marks an employee as exited: releases their assets back to the store. The
   assets held + facilities disabled at the moment of exit are snapshotted into
   AMS_DUMMY_EXIT_RECORDS so the printed Handover Form stays accurate even after
   the assets have been released back to the store / the org chart has changed.

   exitReason         : selected Reason of Exit (Resignation, Retirement, etc.)
   teamInchargeAmsId  : optional - the new Incharge/HOD who takes over the
                        exiting employee's direct subordinates. Their managerAmsId
                        is re-pointed to this person so the team's asset records
                        continue under the new incharge, and the transfer is
                        snapshotted for the printed Handover Form. */
function exitEmployee(amsId, exitDate, remarks, facilitiesDisabled, exitReason, teamInchargeAmsId) {
    const emp = findEmployee(amsId);
    if (!emp) return null;
    emp.status = "Inactive";
    emp.exitDate = exitDate || new Date().toISOString().slice(0, 10);
    emp.exitRemarks = remarks || "";
    emp.exitReason = exitReason || "";

    /* Snapshot the direct assets held at exit (before releasing them) */
    const directAssetsHeld = DUMMY_ASSETS
        .filter(a => a.assignedTo === amsId)
        .map(a => ({
            assetId: a.id, type: a.type, makeModel: a.makeModel,
            site: a.currentSite || a.site, assignedDepartment: a.assignedDepartment,
            remarks: a.remarks, usageNote: a.usageNote,
        }));

    /* Facilities disabled at exit (defaults to the facilities revoked on exit) */
    const disabled = (facilitiesDisabled && facilitiesDisabled.length)
        ? facilitiesDisabled.map(String)
        : FACILITIES_CHECKLIST.filter(f => f.revokedOnExit).map(f => f.label);

    /* ---- Subordinate / team transfer to the new Incharge / HOD ----
       Direct subordinates (still active) get their reporting line re-pointed to
       the chosen incharge so their asset records continue under them. */
    const subordinates = getSubordinates(amsId);
    const incharge = teamInchargeAmsId && teamInchargeAmsId !== amsId ? findEmployee(teamInchargeAmsId) : null;

    let teamTransferredTo = null;
    const subordinateAssetsTransferred = [];
    if (incharge) {
        subordinates.forEach(sub => { sub.managerAmsId = incharge.amsId; });
        teamTransferredTo = {
            amsId: incharge.amsId,
            empId: incharge.empId,
            name: getEmployeeFullName(incharge),
            department: incharge.department,
            designation: incharge.designation,
        };
        subordinates.forEach(sub => {
            getEmployeeAssets(sub.amsId).forEach(a => {
                subordinateAssetsTransferred.push({
                    subAmsId: sub.amsId, subName: getEmployeeFullName(sub), subEmpId: sub.empId,
                    assetId: a.id, type: a.type, makeModel: a.makeModel,
                    site: a.currentSite || a.site, status: a.status,
                });
            });
        });
    }

    AMS_DUMMY_EXIT_RECORDS.push({
        exitId: amsGenerateExitId(),
        amsId,
        empId: emp.empId,
        empName: getEmployeeFullName(emp),
        empDept: emp.department,
        empDesignation: emp.designation,
        exitDate: emp.exitDate,
        exitReason: emp.exitReason,
        exitRemarks: emp.exitRemarks,
        facilitiesDisabled: disabled,
        directAssetsHeld,
        teamTransferredTo,
        subordinateAssetsTransferred,
    });

    DUMMY_ASSETS.forEach(a => {
        if (a.assignedTo === amsId) a.assignedTo = null;
    });
    amsDbSaveAsync("employees");
    amsDbSaveAsync("assets");
    amsDbSaveAsync("exitRecords");
    return emp;
}

/* Returns the permanent exit record (snapshot) for an employee, if one exists */
function getExitRecord(amsId) {
    return AMS_DUMMY_EXIT_RECORDS.find(r => r.amsId === amsId);
}

/* Direct subordinates of an employee (via managerAmsId) */
function getSubordinates(amsId) {
    return DUMMY_EMPLOYEES.filter(e => e.managerAmsId === amsId && e.status === "Active");
}

/* Assets directly assigned to an employee */
function getEmployeeAssets(amsId) {
    return DUMMY_ASSETS.filter(a => a.assignedTo === amsId);
}

/* Assets owned by an employee's subordinates (the whole team) */
function getSubordinateAssets(amsId) {
    const subIds = getSubordinates(amsId).map(s => s.amsId);
    return DUMMY_ASSETS.filter(a => subIds.includes(a.assignedTo));
}

/* Assets not assigned to anyone yet */
function getUnassignedAssets() {
    return DUMMY_ASSETS.filter(a => !a.assignedTo);
}

/* Assigns an asset to an employee */
function assignAsset(assetId, amsId) {
    const asset = DUMMY_ASSETS.find(a => a.id === assetId);
    if (asset) asset.assignedTo = amsId;
    amsDbSaveAsync("assets");
}

/* Reassigns an asset from its current owner to another employee */
function reassignAsset(assetId, toAmsId) {
    assignAsset(assetId, toAmsId);
}

/* =============================================================================
   ASSET HOLDER HELPERS  (shared by Asset Master + print forms)
   An asset is always assigned to a Direct Employee (the custodian) and MAY
   additionally record the ACTUAL USER:
     - as a record from the User master (assignedToSubordinate) - a FORMAL
       sub-record of the same assignment. The asset is still directly issued to
       the employee, so the printed Asset Issue Form lists it under
       "Assets Issued".
     - as FREE TEXT typed into the Assign modal for a party NOT present in the
       User master (assignedSubText). Those assets are NOT directly issued to
       the employee - the real holder is an outsider - so the print routes them
       to the "Assets Currently Assigned to Subordinates (For Reference)"
       section instead of "Assets Issued".
   ===========================================================================*/

/* True when the asset is NOT personally held by the custodian: its real user
   was typed as free text (assignedSubText, not in the User master). Only these
   assets are moved out of "Assets Issued" into the "For Reference" section of
   the printed Asset Issue Form. */
function amsAssetIsDeptOrSub(a) {
    return !!(a && a.assignedSubText);
}

/* Human-readable label for the actual holder (subordinate/free-text user) of
   an asset. */
function amsAssetHolderLabel(a) {
    if (!a) return "";
    if (a.assignedToSubordinate) {
        const emp = amsGetEmployeeByAmsId(a.assignedToSubordinate);
        return emp ? `${emp.name} (${emp.empId})` : a.assignedToSubordinate;
    }
    if (a.assignedSubText) return a.assignedSubText;
    return "";
}

/* Splits an employee's currently-held assets into (a) assets issued directly to
   them - including those whose actual user is a User MASTER record - and (b)
   assets whose real user was NOT the employee personally: free text holders
   (assignedSubText). Only the latter feed the "For Reference" section of the
   printed Asset Issue Form; the former stay in "Assets Issued". */
function amsSplitDirectVsSubordinateAssets(assets) {
    const direct = [];
    const subordinate = [];
    (assets || []).forEach(a => {
        if (amsAssetIsDeptOrSub(a)) subordinate.push(a);
        else direct.push(a);
    });
    return { direct, subordinate };
}

/* Builds the "Accessories / Items Included" section of a printed form from the
   accessories recorded on the assets (checked at assignment time). Renders each
   asset's accessories as pre-checked blocks labelled with the asset ID, falling
   back to the standard blank checklist when nothing was recorded. */
function amsBuildPrintAccessoriesHtml(assets) {
    const rows = [];
    (assets || []).forEach(oa => {
        const acc = (oa && Array.isArray(oa.accessories) && oa.accessories.length) ? oa.accessories : [];
        if (!acc.length) return;
        const label = amsPrintAssetId(oa).toUpperCase();
        acc.forEach(name => {
            rows.push(`<label class="pf-check-block"><input type="checkbox" checked> ${amsEsc(name)}${label ? ` <span class="pf-acc-asset">(${amsEsc(label)})</span>` : ""}</label>`);
        });
    });
    if (!rows.length) {
        return `
        <div class="pf-section-bar">Accessories / Items Included</div>
        <div class="pf-checklist-grid">
            <label class="pf-check-block"><input type="checkbox" disabled> Power Adaptor / Charger</label>
            <label class="pf-check-block"><input type="checkbox" disabled> Carrying Bag / Case</label>
            <label class="pf-check-block"><input type="checkbox" disabled> Mouse / Keyboard (if applicable)</label>
            <label class="pf-check-block"><input type="checkbox" disabled> Original Box / Documentation</label>
            <label class="pf-check-block" style="grid-column:1 / -1;">Other: ________________________________</label>
        </div>`;
    }
    return `
        <div class="pf-section-bar">Accessories / Items Included</div>
        <div class="pf-checklist-grid">
            ${rows.join("")}
            <label class="pf-check-block" style="grid-column:1 / -1;">Other: ________________________________</label>
        </div>`;
}

/* =============================================================================
   10) ROLES & USERS  (roles, user accounts, page registry, role access defaults)
   ===========================================================================*/

const AMS_USER_ROLES = ["Standard User", "Viewer (Read-Only)", "Admin", "Super Root", "Supreme Root"];

const AMS_PAGE_REGISTRY = [
    { key: "dashboard",     label: "Dashboard" },
    { key: "employee",      label: "Employee Master" },
    { key: "asset",         label: "Asset Master" },
    { key: "reports",       label: "Report Master (page access)" },
    { key: "assetType",     label: "Asset Type Master" },
    { key: "assetMake",     label: "Asset Make Master" },
    { key: "assetCategory", label: "Asset Category Master" },
    { key: "site",          label: "Site Master" },
    { key: "consumable",    label: "Consumable Master" },
    { key: "spareParts",    label: "Spare Parts Master" },
    { key: "department",    label: "Department Master" },
    { key: "designation",   label: "Designation Master" },
    { key: "systemAdmin",   label: "System Administrator Master (hub)" },
    { key: "accessory",     label: "Accessory Master" },
    { key: "company",       label: "Company Master" },
    { key: "userMaster",    label: "User Master" },
    { key: "accessRights",  label: "Access Rights Control Master (Supreme Root only)" },
    { key: "roleAccess",    label: "Role Access Master (Supreme Root only)" },
    { key: "log",           label: "Log Report (Super Root and Supreme Root only)" },
    { key: "report.assetLifecycle",     label: "Report: Asset Lifecycle" },
    { key: "report.assetIssue",         label: "Report: Asset Issue Form" },
    { key: "report.assetHandover",      label: "Report: Asset Handover Form" },
    { key: "report.consumableRestock",  label: "Report: Consumable Restock" },
    { key: "report.consumableUsed",     label: "Report: Consumable Used" },
    { key: "report.sparePartsRestock",  label: "Report: Spare Parts Restock" },
    { key: "report.sparePartsUsed",     label: "Report: Spare Parts Used" },
];
const AMS_DUMMY_USERS = [];


/* Role Access defaults - what a role can see when a user has no per-user override.
   Supreme-Root-exclusive pages (accessRights, roleAccess, log) are enforced in code too. */
const AMS_ROLE_ACCESS_STORAGE_KEY = "ams_role_access_defaults";

function amsDefaultRoleAccessMap() {
    const map = {};
    AMS_USER_ROLES.forEach(role => { map[role] = {}; });
    AMS_PAGE_REGISTRY.forEach(p => {
        const key = p.key;
        AMS_USER_ROLES.forEach(role => {
            let allowed = true;
            if (role === "Standard User") allowed = !["systemAdmin", "accessRights", "roleAccess", "userMaster", "company", "accessory", "log"].includes(key);
            if (key === "accessRights" || key === "roleAccess") allowed = role === "Supreme Root";
            if (key === "log") allowed = role === "Super Root" || role === "Supreme Root";
            map[role][key] = allowed;
        });
    });
    return map;
}

function amsGetRoleAccessDefaults() {
    if (AMS_ROLE_ACCESS_DEFAULTS && Object.keys(AMS_ROLE_ACCESS_DEFAULTS).length) return AMS_ROLE_ACCESS_DEFAULTS;
    try {
        const raw = localStorage.getItem(AMS_ROLE_ACCESS_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupt storage - fall back to defaults */ }
    return amsDefaultRoleAccessMap();
}
function amsSaveRoleAccessDefaults(map) {
    Object.assign(AMS_ROLE_ACCESS_DEFAULTS, map);
    try { localStorage.setItem(AMS_ROLE_ACCESS_STORAGE_KEY, JSON.stringify(map)); } catch (e) { /* storage full */ }
    amsDbSaveDocAsync("roleAccess");
}

/* =============================================================================
   11) COMPANY  (single record used to fill print-form letterheads)
   ===========================================================================*/

const AMS_DUMMY_COMPANY_DETAILS = {};

/* localStorage-backed (like theme/notifications) so a saved name/logo shows on
   print letterheads generated from other pages/tabs. */
const AMS_COMPANY_STORAGE_KEY = "ams_company_details";

function amsGetCompanyDetails() {
    try {
        const raw = localStorage.getItem(AMS_COMPANY_STORAGE_KEY);
        if (raw) return Object.assign({}, AMS_DUMMY_COMPANY_DETAILS, JSON.parse(raw));
    } catch (e) { /* corrupt/unavailable storage - fall back to defaults */ }
    return AMS_DUMMY_COMPANY_DETAILS;
}

function amsSaveCompanyDetails(details) {
    try { localStorage.setItem(AMS_COMPANY_STORAGE_KEY, JSON.stringify(details)); } catch (e) { /* storage full */ }
    Object.assign(AMS_DUMMY_COMPANY_DETAILS, details);
    amsDbSaveDocAsync("company");
}

/* =============================================================================
   11.5) PORTAL PREFERENCES  (Settings page - localStorage-backed so the choices
         apply on every page, like theme/company/notifications)
   ===========================================================================*/

const AMS_PORTAL_NAME_STORAGE_KEY = "ams_portal_name";
const AMS_FONT_SIZE_STORAGE_KEY   = "ams_font_size";
const AMS_PAGE_SIZE_STORAGE_KEY   = "ams_page_size";
const AMS_TOAST_STORAGE_KEY       = "ams_toast_enabled";

const AMS_FONT_SIZE_OPTIONS = ["sm", "md", "lg"];   /* sm=14, md=16 (default), lg=18 */

function amsGetPortalName() {
    try { return localStorage.getItem(AMS_PORTAL_NAME_STORAGE_KEY) || "Asset Manager"; }
    catch (e) { return "Asset Manager"; }
}
function amsSavePortalName(name) {
    try { localStorage.setItem(AMS_PORTAL_NAME_STORAGE_KEY, name); } catch (e) { /* storage full */ }
}

function amsGetFontSize() {
    try {
        const v = localStorage.getItem(AMS_FONT_SIZE_STORAGE_KEY);
        return AMS_FONT_SIZE_OPTIONS.indexOf(v) > -1 ? v : "md";
    } catch (e) { return "md"; }
}
function amsSaveFontSize(size) {
    try { localStorage.setItem(AMS_FONT_SIZE_STORAGE_KEY, size); } catch (e) { /* storage full */ }
}

function amsGetDefaultPageSize() {
    try {
        const n = parseInt(localStorage.getItem(AMS_PAGE_SIZE_STORAGE_KEY), 10);
        return [10, 20, 50, 100].indexOf(n) > -1 ? n : 20;
    } catch (e) { return 20; }
}
function amsSaveDefaultPageSize(n) {
    try { localStorage.setItem(AMS_PAGE_SIZE_STORAGE_KEY, String(n)); } catch (e) { /* storage full */ }
}

function amsGetToastEnabled() {
    try { return localStorage.getItem(AMS_TOAST_STORAGE_KEY) !== "false"; }
    catch (e) { return true; }
}
function amsSaveToastEnabled(enabled) {
    try { localStorage.setItem(AMS_TOAST_STORAGE_KEY, enabled ? "true" : "false"); } catch (e) { /* storage full */ }
}

/* Applies the saved non-theme preferences on every page (called from layout.js
   initLayout). Font size uses an attribute + CSS in main.css. */
function amsApplyPortalPrefs() {
    if (document.documentElement) document.documentElement.setAttribute("data-font-size", amsGetFontSize());
}

/* =============================================================================
   11.6) REPORT HEADER APPEARANCE  (Reports page - what the company letterhead
         shows when printing any report/form, e.g. rectangular banner image,
         logo, company name, slogan, address). localStorage-backed so the choice
         applies to every print across the portal.
   ===========================================================================*/

const AMS_REPORT_HEADER_STORAGE_KEY = "ams_report_header_prefs";

const AMS_REPORT_HEADER_DEFAULTS = {
    style: "classic",      /* "classic" (logo + name block) | "banner" (rectangular image on top) */
    showLogo: true,
    showName: true,
    showSlogan: true,
    showAddress: true,
};

function amsGetReportHeaderPrefs() {
    const merged = Object.assign({}, AMS_REPORT_HEADER_DEFAULTS, AMS_REPORT_HEADER_PREFS);
    try {
        const raw = localStorage.getItem(AMS_REPORT_HEADER_STORAGE_KEY);
        if (raw) return Object.assign(merged, JSON.parse(raw));
    } catch (e) { /* corrupt/unavailable storage - fall back to defaults */ }
    return merged;
}

function amsSaveReportHeaderPrefs(prefs) {
    Object.assign(AMS_REPORT_HEADER_PREFS, prefs);
    try { localStorage.setItem(AMS_REPORT_HEADER_STORAGE_KEY, JSON.stringify(prefs)); } catch (e) { /* storage full */ }
    amsDbSaveDocAsync("reportPrefs");
}

/* Wipes every localStorage-backed demo preference + data (Settings > Data).
   The in-memory seed arrays are untouched, so a page reload brings the demo
   data back exactly as shipped. */
function amsResetDemoData() {
    ["ams-theme", "ams_notifications", "ams_activity_log", "ams_viewing_as_role",
     "ams_role_access_defaults", "ams_company_details",
     AMS_PORTAL_NAME_STORAGE_KEY, AMS_FONT_SIZE_STORAGE_KEY,
     AMS_PAGE_SIZE_STORAGE_KEY, AMS_TOAST_STORAGE_KEY,
     AMS_REPORT_HEADER_STORAGE_KEY].forEach(key => {
        try { localStorage.removeItem(key); } catch (e) { /* storage unavailable */ }
    });

    /* Runtime doc globals hold whatever was loaded from the DB this page-session;
       reset them too so "restore demo defaults" takes effect immediately without
       a reload. */
    Object.keys(AMS_REPORT_HEADER_PREFS).forEach(k => delete AMS_REPORT_HEADER_PREFS[k]);
    Object.keys(AMS_ROLE_ACCESS_DEFAULTS).forEach(k => delete AMS_ROLE_ACCESS_DEFAULTS[k]);
    Object.keys(AMS_DUMMY_COMPANY_DETAILS).forEach(k => delete AMS_DUMMY_COMPANY_DETAILS[k]);
}

/* =============================================================================
   12) EXIT RECORDS  (snapshot of employee exits, for printable Handover Forms)
   ===========================================================================*/

/* PLANNED DB TABLE: "ExitRecords". Until then an in-memory array (fresh clone
   per page load, same as every other array here). */
const AMS_DUMMY_EXIT_RECORDS = [];


function amsGenerateExitId() {
    const n = AMS_DUMMY_EXIT_RECORDS.length + 1;
    return `EXIT-${String(n).padStart(6, "0")}`;
}

const AMS_EXIT_FACILITIES_CHECKLIST = [
    "Email Login",
    "ERP Login",
    "Access Card / Biometric",
    "VPN Access",
];

/* =============================================================================
   13) STATUS COLORS  (maps a status string to a badge CSS class)
   ===========================================================================*/

const STATUS_BADGE_CLASS = {
    "Operational":       "badge-green",
    "Under Maintenance": "badge-amber",
    "Out of Service":    "badge-red",
    "In Stock":          "badge-green",
    "Out of Stock":      "badge-red",
    "Low Stock":         "badge-amber",
    "Active":            "badge-green",
    "Inactive":          "badge-red",
    "Assigned":          "badge-green",
    "In Store":          "badge-blue",
    "In Repair":         "badge-amber",
    "Transfer":          "badge-blue",
    "Not Working":       "badge-red",
    "Retired / Scrapped": "badge-red",
    "Replaced":          "badge-grey",
    "Exited":            "badge-red"
};

/* =============================================================================
   14) SUMMARY HELPERS  (small functions every page can reuse)
   ===========================================================================*/

function getAssetSummary() {
    const total = DUMMY_ASSETS.length;
    const operational = DUMMY_ASSETS.filter(a => a.status === "Assigned" || a.status === "In Store").length;
    const maintenance = DUMMY_ASSETS.filter(a => a.status === "In Repair" || a.status === "Not Working").length;
    const outOfService = DUMMY_ASSETS.filter(a => a.status === "Retired / Scrapped").length;
    const totalValue = DUMMY_ASSETS.reduce((sum, a) => sum + (a.purchaseCost || 0), 0);
    return { total, operational, maintenance, outOfService, totalValue };
}

/* Items whose stock is at or below their reorder level need attention */
function getLowStockItems() {
    const lowConsumables = AMS_DUMMY_CONSUMABLES
        .filter(c => c.qty <= c.reorderLevel)
        .map(c => ({ id: c.consumableId, name: c.name, stock: c.qty, type: "Consumable" }));

    const lowSpareParts = AMS_DUMMY_SPARE_PARTS
        .filter(p => p.qty <= p.reorderLevel)
        .map(p => ({ id: p.partId, name: p.name, stock: p.qty, type: "Spare Part" }));

    return [...lowConsumables, ...lowSpareParts];
}

function getConsumableSummary() {
    const total = AMS_DUMMY_CONSUMABLES.length;
    const totalUnits = AMS_DUMMY_CONSUMABLES.reduce((sum, c) => sum + c.qty, 0);
    const lowStock = AMS_DUMMY_CONSUMABLES.filter(c => c.qty <= c.reorderLevel).length;
    return { total, totalUnits, lowStock };
}

function getSparePartSummary() {
    const total = AMS_DUMMY_SPARE_PARTS.length;
    const totalUnits = AMS_DUMMY_SPARE_PARTS.reduce((sum, p) => sum + p.qty, 0);
    const lowStock = AMS_DUMMY_SPARE_PARTS.filter(p => p.qty <= p.reorderLevel).length;
    return { total, totalUnits, lowStock };
}

/* Chart data: assets grouped by category, for the dashboard bar chart */
function getAssetsByCategory() {
    const groups = {};
    DUMMY_ASSETS.forEach(a => {
        groups[a.category] = (groups[a.category] || 0) + 1;
    });
    return Object.entries(groups)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
}

/* Chart data: assets grouped by TYPE, for the dashboard bar chart. The dummy
   set is mostly IT hardware, so this breakdown (Laptop/Desktop/Printer/
   Monitor) gives a meaningful multi-bar chart. */
function getAssetsByType() {
    const groups = {};
    DUMMY_ASSETS.forEach(a => {
        groups[a.type] = (groups[a.type] || 0) + 1;
    });
    return Object.entries(groups)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
}

/* Chart data: donut ring showing asset status distribution */
function getAssetsByStatus() {
    const groups = {};
    DUMMY_ASSETS.forEach(a => {
        groups[a.status] = (groups[a.status] || 0) + 1;
    });
    return groups;
}

/* Employee counts by status - used if a page needs a head-count summary */
function getEmployeeSummary() {
    const active = DUMMY_EMPLOYEES.filter(e => e.status === "Active").length;
    const inactive = DUMMY_EMPLOYEES.length - active;
    const assignedAssets = DUMMY_ASSETS.filter(a => a.assignedTo).length;
    return { total: DUMMY_EMPLOYEES.length, active, inactive, assignedAssets };
}

/*------------------------------------------------------------------------------
#-------------- End of the code : DUMMY DATA ---------------------------------
#------------------------------------------------------------------------------*/
