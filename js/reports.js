/*==============================================================================
#-------------- Start Code for : REPORTS PAGE LOGIC (reports.js) ----------------
#
#  PURPOSE   : Powers every tab on Report Master - ported from v3-3
#              (reports-master-v1-0.js) and adapted to the v4-0 data model.
#
#  DATA SOURCE: reads DUMMY_ASSETS[].history[], DUMMY_EMPLOYEES,
#               AMS_DUMMY_CONSUMABLE_LOG, and AMS_DUMMY_SPAREPART_LOG - the
#               same seed data every page starts from. Since there's no shared
#               backend/storage yet, edits made during a session on another
#               page live only in that page's own memory and are lost on
#               navigation - so this report reflects the SEED data, not live
#               changes from a separate page session. This resolves naturally
#               once SQL Server integration replaces the dummy data layer.
#
#  v4-0 ADAPTATIONS :
#    - Assets now live in DUMMY_ASSETS (not AMS_DUMMY_ASSETS); the display ID
#      is the asset's own `id` field, and employees are joined via amsId.
#    - History action strings written by js/assets.js include "Assigned - New",
#      "Reassigned", "Returned", "Transferred to ...", "Replaced by ...",
#      "Retired / Scrapped", "Not Working", "Added to Inventory (...)"; the
#      classifier below maps them all to report event types.
#    - Asset Issue / Handover rows deep-link straight into the shared print
#      engine (js/print-forms.js amsGenerateReport) instead of navigating to
#      another page.
#    - Print goes through js/print-docs.js (company letterhead), badges use the
#      v4-0 badge-* classes, colors are var(--...) only.
#------------------------------------------------------------------------------*/

/*-------------- Start Code for TAB SWITCHING ----------------------------------*/
function amsWireReportTabs() {
    document.querySelectorAll(".report-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".report-tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".report-panel").forEach(p => p.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById(`panel-${tab.getAttribute("data-report")}`).classList.add("active");
        });
    });
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for POPULATE SHARED DROPDOWNS (Sites, Departments, Types) -----*/
function amsPopulateSiteFilters() {
    const opts = `<option value="">All</option>` + AMS_DUMMY_SITES.map(s => `<option value="${amsEsc(s.name)}">${amsEsc(s.name)}</option>`).join("");
    ["alSite", "crSite", "cuSite", "srSite", "suSite", "issueSite", "handoverSite"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = opts;
    });
}

function amsPopulateIssueHandoverExtraFilters() {
    const deptOpts = `<option value="">All</option>` + AMS_DUMMY_DEPARTMENTS.map(d => `<option value="${amsEsc(d.name)}">${amsEsc(d.name)}</option>`).join("");
    const typeOpts = `<option value="">All</option>` + AMS_DUMMY_ASSET_TYPES.filter(t => t.active).map(t => `<option value="${amsEsc(t.name)}">${amsEsc(t.name)}</option>`).join("");
    ["issueDept", "handoverDept"].forEach(id => { document.getElementById(id).innerHTML = deptOpts; });
    ["issueAssetType", "handoverAssetType"].forEach(id => { document.getElementById(id).innerHTML = typeOpts; });
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for EVENT TYPE CLASSIFICATION (matches the action
   strings written by js/assets.js into asset history) ---------------------------*/
function amsClassifyEvent(action) {
    const a = String(action || "");
    if (a.startsWith("Transferred")) return "Transfer";
    if (a === "Reassigned") return "Reassign";
    if (a === "Assign" || a === "Assigned - New") return "Assign";
    if (a === "Return" || a === "Returned") return "Return";
    if (a.startsWith("Replaced by") || a.startsWith("Added to Inventory (Replacement")) return "Replace";
    if (a === "Retired / Scrapped") return "Retire";
    if (a === "Not Working") return "Fault";
    return "Other";
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for ASSET LIFECYCLE REPORT --------------------------*/
function amsFlattenAssetHistory() {
    return DUMMY_ASSETS.flatMap(a =>
        (a.history || []).map(h => ({
            ...h,
            assetDisplayId: a.id || a.amsAssetId || "",
            assetType: a.type,
            assetSite: a.currentSite || a.site,
        })));
}

function amsRenderAssetLifecycleReport() {
    const eventType = document.getElementById("alEventType").value;
    const site = document.getElementById("alSite").value;
    const fromDate = document.getElementById("alFromDate").value;
    const toDate = document.getElementById("alToDate").value;

    let entries = amsFlattenAssetHistory();
    if (eventType) entries = entries.filter(e => amsClassifyEvent(e.action) === eventType);
    if (site) entries = entries.filter(e => e.assetSite === site);
    if (fromDate) entries = entries.filter(e => e.date >= fromDate);
    if (toDate) entries = entries.filter(e => e.date <= toDate);
    entries = [...entries].sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const rows = entries.length ? entries.map(e => `<tr>
        <td class="mono">${amsFormatDate(e.date)}</td>
        <td><span class="badge badge-grey">${amsEsc(amsClassifyEvent(e.action))}</span></td>
        <td>${amsEsc(e.action)}</td>
        <td class="mono">${amsEsc(e.assetDisplayId)}</td>
        <td>${amsEsc(e.assetType)}</td>
        <td>${amsEsc(e.empName) || "-"}</td>
        <td>${amsEsc(e.empDept) || "-"}</td>
        <td>${amsEsc(e.statusLabel)}</td>
    </tr>`).join("") : `<tr><td colspan="8" style="color:var(--text-secondary)">No events match these filters</td></tr>`;

    document.getElementById("alTable").innerHTML = `
        <thead><tr><th>Date</th><th>Type</th><th>Action</th><th>Asset ID</th><th>Asset Type</th><th>Employee</th><th>Department</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>`;
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for ASSET ISSUE / HANDOVER RECORD TABLES (click-to-print) -----*/
function amsRenderIssueHandoverTable(tableId, reportType, searchId, siteId, fromId, toId, deptId, typeId) {
    const wantExited = reportType === "exit";
    const searchTerm = searchId ? (document.getElementById(searchId).value || "").toLowerCase() : "";
    const site = siteId ? document.getElementById(siteId).value : "";
    const fromDate = fromId ? document.getElementById(fromId).value : "";
    const toDate = toId ? document.getElementById(toId).value : "";
    const dept = deptId ? document.getElementById(deptId).value : "";
    const assetType = typeId ? document.getElementById(typeId).value : "";

    /* One row per currently-assigned asset (Assigned or In Repair still counts as
       "currently held"). Issue Form -> only Active employees; Handover Form ->
       only Exited employees (that's the whole point of a handover). */
    const rows = DUMMY_ASSETS
        .filter(a => a.assignedTo && (a.status === "Assigned" || a.status === "In Repair"))
        .map(a => {
            const emp = amsGetEmployeeByAmsId(a.assignedTo);
            if (!emp) return "";
            const isExited = emp.status === "Exited";
            if (wantExited !== isExited) return "";
            if (searchTerm && ![emp.name, emp.empIdCompany, emp.dept, a.id].some(v => String(v).toLowerCase().includes(searchTerm))) return "";
            const assetSite = a.currentSite || a.site;
            if (site && assetSite !== site) return "";
            if (dept && emp.dept !== dept) return "";
            if (assetType && a.type !== assetType) return "";
            /* "Last activity date" = this asset's most recent history entry - for
               Issue Form that's typically the last Assign/Reassign; for Handover
               it's whatever happened last (Assign, Transfer, etc.). */
            const lastDate = (a.history && a.history.length) ? a.history[a.history.length - 1].date : "";
            if (fromDate && (!lastDate || lastDate < fromDate)) return "";
            if (toDate && (!lastDate || lastDate > toDate)) return "";
            const statusBadge = isExited ? `<span class="badge badge-red">Exited</span>` : `<span class="badge badge-green">Active</span>`;
            const rowStyle = isExited ? ' style="background:color-mix(in srgb, var(--danger) 10%, transparent);"' : "";
            return `<tr${rowStyle}>
                <td class="mono">${amsEsc(emp.empIdCompany)}</td>
                <td><a href="#" class="clickable-id" data-report-emp="${amsEsc(emp.amsId)}" data-report-type="${reportType}">${amsEsc(emp.name)}</a></td>
                <td>${statusBadge}</td>
                <td>${amsEsc(emp.dept)}</td>
                <td class="mono"><a href="#" class="clickable-id" data-report-emp="${amsEsc(emp.amsId)}" data-report-type="${reportType}">${amsEsc(a.id)}</a></td>
                <td>${amsEsc(a.type)}</td>
                <td>${amsEsc(assetSite)}</td>
            </tr>`;
        }).join("");

    document.getElementById(tableId).innerHTML = `
        <thead><tr><th>Emp Code</th><th>Employee Name</th><th>Status</th><th>Department</th><th>Asset ID</th><th>Asset Type</th><th>Site</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="7" style="color:var(--text-secondary)">No ${wantExited ? "exited" : "active"} employees with currently held assets match these filters</td></tr>`}</tbody>`;
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for CONSUMABLE / SPARE PARTS REPORTS (all items) -----*/
function amsRenderStockLogReport(logArray, type, siteId, fromId, toId, tableId) {
    const site = document.getElementById(siteId).value;
    const fromDate = document.getElementById(fromId).value;
    const toDate = document.getElementById(toId).value;

    let entries = logArray.filter(l => l.type === type);
    if (site) entries = entries.filter(l => l.site === site);
    if (fromDate) entries = entries.filter(l => l.date >= fromDate);
    if (toDate) entries = entries.filter(l => l.date <= toDate);
    entries = [...entries].sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const showAsset = type === "Used" && entries.some(l => "assetIdSnapshot" in l);
    const rows = entries.length ? entries.map(l => `<tr>
        <td class="mono">${amsFormatDate(l.date)}</td>
        <td>${amsEsc(l.name)}</td>
        <td>${amsEsc(l.site)}</td>
        <td class="mono">${l.qty}</td>
        <td>${amsEsc(l.by) || "-"}</td>
        ${showAsset ? `<td class="mono">${amsEsc(l.assetIdSnapshot) || "-"}</td>` : ""}
        <td>${amsEsc(l.remarks) || "-"}</td>
    </tr>`).join("") : `<tr><td colspan="${showAsset ? 7 : 6}" style="color:var(--text-secondary)">No records match these filters</td></tr>`;

    document.getElementById(tableId).innerHTML = `
        <thead><tr><th>Date</th><th>Item</th><th>Site</th><th>Qty</th><th>${type === "Restocked" ? "Vendor" : "Used By"}</th>${showAsset ? "<th>Used For Asset</th>" : ""}<th>Remarks</th></tr></thead>
        <tbody>${rows}</tbody>`;
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for GENERIC EXPORT: CSV + EXCEL (any report table) ---*/
function amsTableToRows(tableEl) {
    return [...tableEl.querySelectorAll("tr")].map(tr =>
        [...tr.children].map(cell => cell.textContent.trim()));
}

function amsExportTableToCsv(filename, tableEl) {
    const rows = amsTableToRows(tableEl);
    amsDownloadFile(rows.map(amsCsvRow).join("\r\n"), `${filename}.csv`, "text/csv");
}

/* Excel export via the "HTML table as .xls" trick - Excel opens this natively,
   no external library needed (keeps the whole app dependency-free). */
function amsExportTableToExcel(filename, tableEl) {
    const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
        <x:Name>Report</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
        <body><table border="1">${tableEl.innerHTML}</table></body>
        </html>`;
    amsDownloadFile(html, `${filename}.xls`, "application/vnd.ms-excel");
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for GENERIC PRINT (company letterhead via print-docs.js) -----*/
function amsPrintReport(title, tableEl) {
    const today = amsFormatDate(new Date().toISOString().slice(0, 10));
    const headerHtml = amsBuildPrintHeader(title, `
        <div class="pf-form-title">${amsEsc(title).toUpperCase()}</div>
        <div><strong>Generated:</strong> ${today}</div>`, "Asset Management System · Report Master");
    const content = `
        ${headerHtml}
        <table class="pf-asset-table">${tableEl.innerHTML}</table>
        <div class="pf-footer"><span>AMS v4 - Generated electronically from Report Master</span></div>`;
    amsPrintDocument(content, title);
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for REPORT APPEARANCE (header editor) --------------*/
/* Renders a live on-screen preview of the chosen print letterhead, so users can
   see what will show on reports before printing. Mirrors amsBuildPrintHeader()
   from js/print-docs.js (which the actual print window uses). */
function amsRenderReportHeaderPreview() {
    const box = document.getElementById("reportHeaderPreview");
    if (!box) return;
    const c = amsGetCompanyDetails();
    const p = amsGetReportHeaderPrefs();

    const nameHtml = p.showName ? `<div class="rp-name">${amsEsc(c.companyName || "Your Company Name Pvt. Ltd.")}</div>` : "";
    const sloganHtml = (p.showSlogan && c.slogan) ? `<div class="rp-slogan">${amsEsc(c.slogan)}</div>` : "";
    const subHtml = p.showAddress ? `<div class="rp-sub">${amsEsc(c.address || "Asset Management System")}</div>` : "";
    const texts = nameHtml + sloganHtml + subHtml;

    let inner;
    if (p.style === "banner" && c.bannerDataUrl) {
        inner = `<div class="rp-banner"><img src="${c.bannerDataUrl}" alt="Banner preview"></div>` +
            (texts ? `<div class="rp-caption">${texts}</div>` : "");
    } else if (p.style === "banner") {
        inner = `<span class="rp-empty">Banner style selected - upload a rectangular banner in Company Master to see it here. Showing classic header meanwhile.</span>`;
    } else {
        inner = `<div class="rp-block">
            ${p.showLogo && c.logoDataUrl ? `<img class="rp-logo" src="${c.logoDataUrl}" alt="Logo preview">` : ""}
            <div>${texts || `<span class="rp-empty">All company text is hidden for printing.</span>`}</div>
        </div>`;
    }
    box.innerHTML = inner;
}

function amsLoadReportAppearance() {
    const prefs = amsGetReportHeaderPrefs();
    const radio = document.querySelector(`input[name="rpStyle"][value="${amsEsc(prefs.style)}"]`);
    if (radio) radio.checked = true;
    const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!val;
    };
    setCheck("rpShowLogo", prefs.showLogo);
    setCheck("rpShowName", prefs.showName);
    setCheck("rpShowSlogan", prefs.showSlogan);
    setCheck("rpShowAddress", prefs.showAddress);
    amsRenderReportHeaderPreview();
}

function amsWireReportAppearance() {
    const toggle = document.getElementById("btnReportAppearance");
    const panel = document.getElementById("reportAppearancePanel");
    if (toggle && panel) {
        toggle.addEventListener("click", () => {
            const open = panel.classList.toggle("open");
            toggle.textContent = open ? "Hide Report Appearance" : "Report Appearance";
        });
    }

    document.querySelectorAll('input[name="rpStyle"]').forEach(r => {
        r.addEventListener("change", () => {
            const prefs = amsGetReportHeaderPrefs();
            prefs.style = r.value;
            amsSaveReportHeaderPrefs(prefs);
            amsRenderReportHeaderPreview();
            amsNotify("Report header style updated", "success");
        });
    });

    const prefsCheckboxes = [
        ["rpShowLogo", "showLogo"],
        ["rpShowName", "showName"],
        ["rpShowSlogan", "showSlogan"],
        ["rpShowAddress", "showAddress"],
    ];
    prefsCheckboxes.forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", () => {
            const prefs = amsGetReportHeaderPrefs();
            prefs[key] = el.checked;
            amsSaveReportHeaderPrefs(prefs);
            amsRenderReportHeaderPreview();
            amsNotify("Report header appearance updated", "success");
        });
    });
    amsLoadReportAppearance();
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for WIRE UP ALL EXPORT / PRINT / FILTER BUTTONS ------*/
function amsWireReportButtons() {
    /* Asset Lifecycle */
    document.getElementById("btnAlFilter").addEventListener("click", amsRenderAssetLifecycleReport);
    document.getElementById("btnAlPrint").addEventListener("click", () => amsPrintReport("Asset Lifecycle Report", document.getElementById("alTable")));
    document.getElementById("btnAlCsv").addEventListener("click", () => amsExportTableToCsv("Asset_Lifecycle_Report", document.getElementById("alTable")));
    document.getElementById("btnAlXls").addEventListener("click", () => amsExportTableToExcel("Asset_Lifecycle_Report", document.getElementById("alTable")));

    /* Asset Issue / Handover */
    document.getElementById("issueSearch").addEventListener("input", () => amsRenderIssueHandoverTable("issueTable", "assign", "issueSearch", "issueSite", "issueFromDate", "issueToDate", "issueDept", "issueAssetType"));
    document.getElementById("handoverSearch").addEventListener("input", () => amsRenderIssueHandoverTable("handoverTable", "exit", "handoverSearch", "handoverSite", "handoverFromDate", "handoverToDate", "handoverDept", "handoverAssetType"));
    document.getElementById("btnIssueFilter").addEventListener("click", () => amsRenderIssueHandoverTable("issueTable", "assign", "issueSearch", "issueSite", "issueFromDate", "issueToDate", "issueDept", "issueAssetType"));
    document.getElementById("btnHandoverFilter").addEventListener("click", () => amsRenderIssueHandoverTable("handoverTable", "exit", "handoverSearch", "handoverSite", "handoverFromDate", "handoverToDate", "handoverDept", "handoverAssetType"));
    document.getElementById("btnIssuePrint").addEventListener("click", () => amsPrintReport("Asset Issue Form - All", document.getElementById("issueTable")));
    document.getElementById("btnHandoverPrint").addEventListener("click", () => amsPrintReport("Asset Handover Form - All", document.getElementById("handoverTable")));
    document.getElementById("btnIssueCsv").addEventListener("click", () => amsExportTableToCsv("Asset_Issue_Form_Records", document.getElementById("issueTable")));
    document.getElementById("btnIssueXls").addEventListener("click", () => amsExportTableToExcel("Asset_Issue_Form_Records", document.getElementById("issueTable")));
    document.getElementById("btnHandoverCsv").addEventListener("click", () => amsExportTableToCsv("Asset_Handover_Form_Records", document.getElementById("handoverTable")));
    document.getElementById("btnHandoverXls").addEventListener("click", () => amsExportTableToExcel("Asset_Handover_Form_Records", document.getElementById("handoverTable")));

    /* Consumable / Spare Parts stock log reports */
    document.getElementById("btnCrFilter").addEventListener("click", () => amsRenderStockLogReport(AMS_DUMMY_CONSUMABLE_LOG, "Restocked", "crSite", "crFromDate", "crToDate", "crTable"));
    document.getElementById("btnCuFilter").addEventListener("click", () => amsRenderStockLogReport(AMS_DUMMY_CONSUMABLE_LOG, "Used", "cuSite", "cuFromDate", "cuToDate", "cuTable"));
    document.getElementById("btnSrFilter").addEventListener("click", () => amsRenderStockLogReport(AMS_DUMMY_SPAREPART_LOG, "Restocked", "srSite", "srFromDate", "srToDate", "srTable"));
    document.getElementById("btnSuFilter").addEventListener("click", () => amsRenderStockLogReport(AMS_DUMMY_SPAREPART_LOG, "Used", "suSite", "suFromDate", "suToDate", "suTable"));

    document.getElementById("btnCrPrint").addEventListener("click", () => amsPrintReport("Consumable Restock Report", document.getElementById("crTable")));
    document.getElementById("btnCuPrint").addEventListener("click", () => amsPrintReport("Consumable Used Report", document.getElementById("cuTable")));
    document.getElementById("btnSrPrint").addEventListener("click", () => amsPrintReport("Spare Parts Restock Report", document.getElementById("srTable")));
    document.getElementById("btnSuPrint").addEventListener("click", () => amsPrintReport("Spare Parts Used Report", document.getElementById("suTable")));

    document.getElementById("btnCrCsv").addEventListener("click", () => amsExportTableToCsv("Consumable_Restock_Report", document.getElementById("crTable")));
    document.getElementById("btnCrXls").addEventListener("click", () => amsExportTableToExcel("Consumable_Restock_Report", document.getElementById("crTable")));
    document.getElementById("btnCuCsv").addEventListener("click", () => amsExportTableToCsv("Consumable_Used_Report", document.getElementById("cuTable")));
    document.getElementById("btnCuXls").addEventListener("click", () => amsExportTableToExcel("Consumable_Used_Report", document.getElementById("cuTable")));

    document.getElementById("btnSrCsv").addEventListener("click", () => amsExportTableToCsv("Spare_Parts_Restock_Report", document.getElementById("srTable")));
    document.getElementById("btnSrXls").addEventListener("click", () => amsExportTableToExcel("Spare_Parts_Restock_Report", document.getElementById("srTable")));
    document.getElementById("btnSuCsv").addEventListener("click", () => amsExportTableToCsv("Spare_Parts_Used_Report", document.getElementById("suTable")));
    document.getElementById("btnSuXls").addEventListener("click", () => amsExportTableToExcel("Spare_Parts_Used_Report", document.getElementById("suTable")));

    /* Click-to-print deep-links on Issue / Handover rows */
    document.addEventListener("click", (e) => {
        const link = e.target.closest("[data-report-emp]");
        if (!link) return;
        e.preventDefault();
        if (typeof amsGenerateReport === "function") {
            amsGenerateReport(link.getAttribute("data-report-emp"), link.getAttribute("data-report-type"));
        }
    });
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for PAGE INIT ---------------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
    if (typeof initLayout === "function") initLayout("reports");
    amsWireReportTabs();
    amsWireReportAppearance();
    amsWireReportButtons();
    (typeof amsDbEnsureLoaded === "function" ? amsDbEnsureLoaded() : Promise.resolve()).then(() => {
        amsPopulateSiteFilters();
        amsPopulateIssueHandoverExtraFilters();
        amsRenderAssetLifecycleReport();
        amsRenderIssueHandoverTable("issueTable", "assign", "issueSearch", "issueSite", "issueFromDate", "issueToDate", "issueDept", "issueAssetType");
        amsRenderIssueHandoverTable("handoverTable", "exit", "handoverSearch", "handoverSite", "handoverFromDate", "handoverToDate", "handoverDept", "handoverAssetType");
        amsRenderStockLogReport(AMS_DUMMY_CONSUMABLE_LOG, "Restocked", "crSite", "crFromDate", "crToDate", "crTable");
        amsRenderStockLogReport(AMS_DUMMY_CONSUMABLE_LOG, "Used", "cuSite", "cuFromDate", "cuToDate", "cuTable");
        amsRenderStockLogReport(AMS_DUMMY_SPAREPART_LOG, "Restocked", "srSite", "srFromDate", "srToDate", "srTable");
        amsRenderStockLogReport(AMS_DUMMY_SPAREPART_LOG, "Used", "suSite", "suFromDate", "suToDate", "suTable");
    });
});
/*-------------- End of the code ------------------------------------------------*/
/*==============================================================================
#-------------- End of the code : REPORTS PAGE LOGIC ----------------------------
#------------------------------------------------------------------------------*/
