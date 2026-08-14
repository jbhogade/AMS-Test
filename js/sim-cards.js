/*==============================================================================
#-------------- Start Code for : SIM CARD MASTER PAGE LOGIC (sim-cards.js) ------
#
#  PURPOSE   : All logic for the SIM Card Master page - table render, SIM ID
#              generation, Add/Edit, Assign/Reassign/Return, Block, Retire, and
#              the lifecycle history shown inside the View modal. Plus bulk
#              Import / Export / Template. The SIM card record is SEPARATE from
#              the mobile phone Asset record: a user can be issued a phone
#              (tracked as an Asset) AND a SIM card (tracked here).
#
#  DATA      : Reads/writes the shared AMS_DUMMY_SIM_CARDS collection
#              (DB-backed via the simCards collection key).
#------------------------------------------------------------------------------*/

/* =============================================================================
   1) IN-MEMORY STATE
   ===========================================================================*/
const SIM_STATE = {
    sims: AMS_DUMMY_SIM_CARDS, /* live reference - the DB-backed collection cache */
    editingId: null,           /* simId currently being edited/acted on (Add modal = null) */
    assignMode: null,          /* "assign" | "reassign" - which action opened modalSimAssign */
};

const SIM_STATUS_BADGE = {
    "In Store": "badge-blue", "Issued": "badge-green", "Blocked": "badge-red", "Retired": "badge-grey",
};

function simEmployeesRef() {
    return (typeof amsGetEmployeesForPortal === "function") ? amsGetEmployeesForPortal() : [];
}

/* =============================================================================
   2) RENDER: SIM CARD TABLE
   ===========================================================================*/
function renderSimTable() {
    const searchTerm = (document.getElementById("simSearchBox").value || "").toLowerCase();
    const statusFilterVal = document.getElementById("simStatusFilter").value;

    const filtered = SIM_STATE.sims.filter(s => {
        if (statusFilterVal && s.status !== statusFilterVal) return false;
        if (!searchTerm) return true;
        return [s.simId, s.mobileNumber, s.operator, s.plan, s.iccid].some(v => String(v || "").toLowerCase().includes(searchTerm));
    });

    const rows = filtered.map(s => {
        const emp = s.assignedTo ? amsGetEmployeeByAmsId(s.assignedTo) : null;
        return `<tr>
            <td class="mono-cell"><a href="#" class="clickable-id" data-sim-view-key="${amsEsc(s.simId)}">${amsEsc(s.simId)}</a></td>
            <td class="mono-cell">${amsEsc(s.mobileNumber) || "-"}</td>
            <td>${amsEsc(s.operator) || "-"}</td>
            <td>${amsEsc(s.plan) || "-"}</td>
            <td><span class="badge ${SIM_STATUS_BADGE[s.status] || "badge-grey"}">${amsEsc(s.status)}</span></td>
            <td>${emp ? amsEsc(emp.name) : "-"}</td>
            <td class="actions-cell">
                <button class="actions-trigger" data-sim-actions-for="${amsEsc(s.simId)}" title="Actions">Actions &#9662;</button>
                <div class="actions-menu" id="sim-menu-${amsEsc(s.simId)}">
                    <button data-sim-action="view" data-key="${amsEsc(s.simId)}">View</button>
                    <button data-sim-action="edit" data-key="${amsEsc(s.simId)}">Edit</button>
                    <div class="menu-divider"></div>
                    <button data-sim-action="assign" data-key="${amsEsc(s.simId)}" ${(s.assignedTo || s.status === "Retired") ? "disabled" : ""}>Assign</button>
                    <button data-sim-action="reassign" data-key="${amsEsc(s.simId)}" ${(!s.assignedTo || s.status === "Retired") ? "disabled" : ""}>Reassign</button>
                    <button data-sim-action="return" data-key="${amsEsc(s.simId)}" ${(!s.assignedTo || s.status === "Retired") ? "disabled" : ""}>Return</button>
                    <div class="menu-divider"></div>
                    <button data-sim-action="block" data-key="${amsEsc(s.simId)}" ${(s.status === "Blocked" || s.status === "Retired") ? "disabled" : ""}>Block</button>
                    <button class="danger-item" data-sim-action="retire" data-key="${amsEsc(s.simId)}" ${s.status === "Retired" ? "disabled" : ""}>Retire</button>
                </div>
            </td>
        </tr>`;
    });

    document.getElementById("simTable").innerHTML = `
        <thead><tr>
            <th>SIM ID</th><th>Mobile Number</th><th>Operator</th><th>Plan</th>
            <th>Status</th><th>Assigned To</th><th></th>
        </tr></thead>
        <tbody>${rows.join("") || `<tr><td colspan="7" class="empty-note" style="text-align:center;padding:28px;">No SIM cards found</td></tr>`}</tbody>`;

    const footer = document.getElementById("simTableFooter");
    if (footer) {
        const totalMatches = filtered.length;
        footer.innerHTML = totalMatches
            ? `<span>${totalMatches} SIM card${totalMatches === 1 ? "" : "s"}</span>`
            : "";
    }

    renderSimStockSummary();
}

/* =============================================================================
   3) STOCK SUMMARY (Total / In Store / Issued / Blocked+Retired)
   ===========================================================================*/
function renderSimStockSummary() {
    const sims = SIM_STATE.sims;
    const total = sims.length;
    const inStore = sims.filter(s => s.status === "In Store").length;
    const issued = sims.filter(s => s.status === "Issued").length;
    const outOfService = sims.filter(s => s.status === "Blocked" || s.status === "Retired").length;

    const tiles = [
        { label: "Total SIM Cards", value: total, cls: "" },
        { label: "In Store", value: inStore, cls: "accent-success" },
        { label: "Issued", value: issued, cls: "accent-warning" },
        { label: "Blocked / Retired", value: outOfService, cls: outOfService > 0 ? "accent-danger" : "" },
    ];
    document.getElementById("simStockSummary").innerHTML = tiles.map(t => `
        <div class="stat-card ${t.cls}">
            <div class="stat-value">${t.value}</div>
            <div class="stat-label">${t.label}</div>
        </div>`).join("");
}

/* =============================================================================
   4) ACTIONS DROPDOWN OPEN/CLOSE + ROW ACTION DELEGATION
   ===========================================================================*/
function amsSimCloseAllMenus() {
    document.querySelectorAll(".actions-menu.open").forEach(m => m.classList.remove("open"));
    amsSimSyncWrapOverflow();
}

function amsSimSyncWrapOverflow() {
    const anyOpen = document.querySelector(".actions-menu.open");
    const wrap = document.getElementById("simTableWrap");
    if (wrap) wrap.classList.toggle("mt-menu-open", !!(anyOpen && wrap.contains(anyOpen)));
}

function amsSimWireRowActions() {
    document.addEventListener("click", (e) => {
        const trigger = e.target.closest("[data-sim-actions-for]");
        if (trigger) {
            const key = trigger.getAttribute("data-sim-actions-for");
            const menu = document.getElementById(`sim-menu-${key}`);
            const wasOpen = menu.classList.contains("open");
            amsSimCloseAllMenus();
            if (!wasOpen) {
                menu.classList.add("open");
                amsSimSyncWrapOverflow();
            }
            return;
        }
        if (!e.target.closest(".actions-menu")) amsSimCloseAllMenus();
    });

    document.addEventListener("click", (e) => {
        const viewLink = e.target.closest("[data-sim-view-key]");
        if (viewLink) { e.preventDefault(); amsSimOpenViewModal(viewLink.getAttribute("data-sim-view-key")); return; }

        const btn = e.target.closest("[data-sim-action]");
        if (!btn) return;
        const action = btn.getAttribute("data-sim-action");
        const key = btn.getAttribute("data-key");
        amsSimCloseAllMenus();

        if (action === "view") amsSimOpenViewModal(key);
        else if (action === "edit") amsSimOpenEditModal(key);
        else if (action === "assign") amsSimOpenAssignModal(key, "assign");
        else if (action === "reassign") amsSimOpenAssignModal(key, "reassign");
        else if (action === "return") amsSimReturn(key);
        else if (action === "block") amsSimBlock(key);
        else if (action === "retire") amsSimRetire(key);
    });
}

/* =============================================================================
   5) MODAL OPEN / CLOSE HELPERS
   ===========================================================================*/
function amsSimOpenModal(id) { document.getElementById(id).classList.add("open"); }
function amsSimCloseModal(id) { document.getElementById(id).classList.remove("open"); }

/* =============================================================================
   6) ADD / EDIT FORM
   ===========================================================================*/
function amsPopulateSimFormSelects() {
    document.getElementById("fSimStatus").innerHTML = AMS_SIM_STATUS_OPTIONS.map(s => `<option value="${amsEsc(s)}">${amsEsc(s)}</option>`).join("");
    document.getElementById("simOperatorList").innerHTML = AMS_SIM_OPERATOR_OPTIONS.map(o => `<option value="${amsEsc(o)}"></option>`).join("");
}

function amsSimUpdateIdPreview() {
    document.getElementById("simIdPreview").textContent = SIM_STATE.editingId || amsNextSimId();
}

function amsSimOpenAddModal() {
    SIM_STATE.editingId = null;
    document.getElementById("simFormModalTitle").textContent = "Add SIM Card";
    document.getElementById("simForm").reset();
    amsPopulateSimFormSelects();
    document.getElementById("fSimStatus").value = "In Store";
    amsSimUpdateIdPreview();
    amsSimOpenModal("modalSimForm");
}

function amsSimOpenEditModal(key) {
    const s = SIM_STATE.sims.find(x => x.simId === key);
    if (!s) return;
    SIM_STATE.editingId = key;
    document.getElementById("simFormModalTitle").textContent = "Edit SIM Card";
    amsPopulateSimFormSelects();

    document.getElementById("fSimIccid").value = s.iccid || "";
    document.getElementById("fSimMobile").value = s.mobileNumber || "";
    document.getElementById("fSimOperator").value = s.operator || "";
    document.getElementById("fSimPlan").value = s.plan || "";
    document.getElementById("fSimStatus").value = s.status;
    document.getElementById("fSimActivationDate").value = s.activationDate || "";
    amsSetVendorSelectValue("fSimVendor", s.vendor || "");
    document.getElementById("fSimCost").value = s.cost || "";
    document.getElementById("fSimRemarks").value = s.remarks || "";
    amsSimUpdateIdPreview();
    amsSimOpenModal("modalSimForm");
}

function amsSimSubmitForm(e) {
    e.preventDefault();
    const mobile = document.getElementById("fSimMobile").value.trim();
    if (!mobile) { alert("Mobile Number is required."); return; }

    const values = {
        iccid: document.getElementById("fSimIccid").value.trim(),
        mobileNumber: mobile,
        operator: document.getElementById("fSimOperator").value.trim(),
        plan: document.getElementById("fSimPlan").value.trim(),
        activationDate: document.getElementById("fSimActivationDate").value,
        vendor: document.getElementById("fSimVendor").value.trim(),
        cost: document.getElementById("fSimCost").value.trim(),
        remarks: document.getElementById("fSimRemarks").value.trim(),
    };
    const statusVal = document.getElementById("fSimStatus").value;

    if (SIM_STATE.editingId) {
        const s = SIM_STATE.sims.find(x => x.simId === SIM_STATE.editingId);
        if (!s) return;
        Object.assign(s, values);
        s.status = statusVal;
        if (statusVal === "Retired") { s.assignedTo = null; s.assignedDate = ""; }
        amsNotify(`SIM card updated: ${s.simId}`, "info");
    } else {
        const simId = amsNextSimId();
        const sim = {
            simId,
            ...values,
            status: statusVal,
            assignedTo: null, assignedDate: "",
            history: [{ date: new Date().toISOString().slice(0, 10), action: "Added to Inventory", empId: "", empName: "", empDept: "", remarks: "", statusLabel: statusVal }],
        };
        SIM_STATE.sims.push(sim);
        amsNotify(`SIM card added: ${simId} (${sim.mobileNumber})`, "success");
    }

    amsSimCloseModal("modalSimForm");
    amsDbSaveAsync("simCards");
    renderSimTable();
}

/* =============================================================================
   7) VIEW MODAL (details + lifecycle history)
   ===========================================================================*/
function simHistoryEventType(action) {
    if (action.startsWith("Reassigned")) return { label: "Reassign", cls: "badge-amber" };
    if (action.startsWith("Assigned")) return { label: "Assign", cls: "badge-green" };
    if (action === "Returned") return { label: "Return", cls: "badge-grey" };
    if (action === "Blocked") return { label: "Block", cls: "badge-red" };
    if (action === "Retired") return { label: "Retire", cls: "badge-red" };
    if (action === "Added to Inventory") return { label: "Added", cls: "badge-green" };
    return { label: "Other", cls: "badge-grey" };
}

function amsSimOpenViewModal(key) {
    const s = SIM_STATE.sims.find(x => x.simId === key);
    if (!s) return;
    const emp = s.assignedTo ? amsGetEmployeeByAmsId(s.assignedTo) : null;

    const historyRows = (s.history && s.history.length)
        ? s.history.map(h => {
            const evt = simHistoryEventType(h.action);
            return `<tr>
                <td class="mono-cell">${amsFormatDate(h.date) || "-"}</td>
                <td><span class="badge ${evt.cls}">${evt.label}</span></td>
                <td>${amsEsc(h.action)}</td>
                <td>${amsEsc(h.empName) || "-"}</td>
                <td>${amsEsc(h.empDept) || "-"}</td>
                <td>${amsEsc(h.statusLabel) || "-"}</td>
                <td>${amsEsc(h.remarks) || "-"}</td>
            </tr>`;
        }).join("")
        : `<tr><td colspan="7" class="empty-note" style="text-align:center;">No lifecycle events recorded yet</td></tr>`;

    document.getElementById("simViewModalBody").innerHTML = `
        <div class="detail-row"><span class="detail-label">SIM ID</span><span class="detail-value mono-cell">${amsEsc(s.simId)}</span></div>
        <div class="detail-row"><span class="detail-label">SIM Serial / ICCID</span><span class="detail-value mono-cell">${amsEsc(s.iccid) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Mobile Number</span><span class="detail-value mono-cell">${amsEsc(s.mobileNumber) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Operator</span><span class="detail-value">${amsEsc(s.operator) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Plan</span><span class="detail-value">${amsEsc(s.plan) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">${amsEsc(s.status)}</span></div>
        <div class="detail-row"><span class="detail-label">Activation Date</span><span class="detail-value">${amsFormatDate(s.activationDate) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Assigned To</span><span class="detail-value">${emp ? amsEsc(emp.name) + " (" + amsEsc(emp.empId) + ")" : "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Assignment Date</span><span class="detail-value">${amsFormatDate(s.assignedDate) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Vendor</span><span class="detail-value">${amsEsc(s.vendor) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Cost</span><span class="detail-value">${s.cost ? formatCurrency(s.cost) : "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Remarks</span><span class="detail-value">${amsEsc(s.remarks) || "-"}</span></div>

        <div class="card" style="margin-top:14px;">
            <div class="card-title">Lifecycle History</div>
            <div class="table-wrap"><table class="table">
                <thead><tr><th>Date</th><th>Type</th><th>Action</th><th>Emp Name</th><th>Department</th><th>Status</th><th>Remarks</th></tr></thead>
                <tbody>${historyRows}</tbody>
            </table></div>
        </div>`;
    amsSimOpenModal("modalSimView");
}

/* =============================================================================
   8) ASSIGN / REASSIGN
   ===========================================================================*/
function amsSimPopulateEmpDropdown() {
    const activeEmps = simEmployeesRef().filter(e => e.status === "Active");
    document.getElementById("simAssignEmp").innerHTML =
        `<option value="">(Select employee)</option>` +
        activeEmps.map(e => `<option value="${amsEsc(e.empId)}">${amsEsc(e.name)} (${amsEsc(e.dept)})</option>`).join("");
}

function amsSimOpenAssignModal(key, mode) {
    const s = SIM_STATE.sims.find(x => x.simId === key);
    if (!s) return;
    SIM_STATE.editingId = key;
    SIM_STATE.assignMode = mode;
    document.getElementById("simAssignModalTitle").textContent = mode === "reassign" ? "Reassign SIM Card" : "Assign SIM Card";
    amsSimPopulateEmpDropdown();
    document.getElementById("simAssignEmp").value = s.assignedTo || "";
    document.getElementById("simAssignDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("simAssignRemarks").value = "";
    amsSimOpenModal("modalSimAssign");
}

function amsSimConfirmAssign() {
    const s = SIM_STATE.sims.find(x => x.simId === SIM_STATE.editingId);
    if (!s) return;
    const empId = document.getElementById("simAssignEmp").value;
    const assignDate = document.getElementById("simAssignDate").value || new Date().toISOString().slice(0, 10);
    const remarks = document.getElementById("simAssignRemarks").value.trim();
    if (!empId) { alert("Select an employee to assign this SIM card to."); return; }

    const emp = amsGetEmployeeByAmsId(empId);
    s.assignedTo = empId;
    s.assignedDate = assignDate;
    s.status = "Issued";
    if (!Array.isArray(s.history)) s.history = [];
    s.history.push({
        date: assignDate,
        action: SIM_STATE.assignMode === "reassign" ? "Reassigned" : "Assigned",
        empId: emp ? emp.empId : "", empName: emp ? emp.name : "", empDept: emp ? emp.dept : "",
        remarks, statusLabel: "Issued",
    });
    amsNotify(`SIM card ${s.simId} ${SIM_STATE.assignMode === "reassign" ? "reassigned" : "assigned"} to ${emp ? emp.name : empId}`, "success");

    amsSimCloseModal("modalSimAssign");
    amsDbSaveAsync("simCards");
    renderSimTable();
}

/* =============================================================================
   9) RETURN / BLOCK / RETIRE
   ===========================================================================*/
function amsSimReturn(key) {
    const s = SIM_STATE.sims.find(x => x.simId === key);
    if (!s) return;
    const prevEmp = s.assignedTo ? amsGetEmployeeByAmsId(s.assignedTo) : null;
    if (!confirm(`Mark "${s.simId}" as Returned (In Store)?`)) return;

    if (!Array.isArray(s.history)) s.history = [];
    s.history.push({
        date: new Date().toISOString().slice(0, 10), action: "Returned",
        empId: prevEmp ? prevEmp.empId : "", empName: prevEmp ? prevEmp.name : "", empDept: prevEmp ? prevEmp.dept : "",
        remarks: "", statusLabel: "In Store",
    });
    s.assignedTo = null; s.assignedDate = ""; s.status = "In Store";
    amsNotify(`SIM card returned: ${s.simId}${prevEmp ? ` (from ${prevEmp.name})` : ""}`, "info");
    amsDbSaveAsync("simCards");
    renderSimTable();
}

function amsSimBlock(key) {
    const s = SIM_STATE.sims.find(x => x.simId === key);
    if (!s) return;
    if (!confirm(`Block "${s.simId}"? The SIM stays on record but is unusable until unblocked.`)) return;

    if (!Array.isArray(s.history)) s.history = [];
    s.history.push({
        date: new Date().toISOString().slice(0, 10), action: "Blocked",
        empId: "", empName: "", empDept: "",
        remarks: "", statusLabel: "Blocked",
    });
    s.status = "Blocked";
    amsNotify(`SIM card blocked: ${s.simId}`, "warning");
    amsDbSaveAsync("simCards");
    renderSimTable();
}

function amsSimRetire(key) {
    const s = SIM_STATE.sims.find(x => x.simId === key);
    if (!s) return;
    if (!confirm(`Retire "${s.simId}"? This normally ends its lifecycle.`)) return;

    if (!Array.isArray(s.history)) s.history = [];
    s.history.push({
        date: new Date().toISOString().slice(0, 10), action: "Retired",
        empId: "", empName: "", empDept: "",
        remarks: "", statusLabel: "Retired",
    });
    s.assignedTo = null; s.assignedDate = ""; s.status = "Retired";
    amsNotify(`SIM card retired: ${s.simId}`, "info");
    amsDbSaveAsync("simCards");
    renderSimTable();
}

/* =============================================================================
   10) CSV : TEMPLATE / EXPORT / IMPORT
   ===========================================================================*/
const SIM_CSV_HEADERS = ["simId", "iccid", "mobileNumber*", "operator", "plan", "status", "activationDate", "vendor", "cost", "remarks"];

function amsDownloadSimTemplate() {
    const instructionRow = ["# Fields marked with * are required: mobileNumber. simId blank = auto-generated. status = In Store, Issued, Blocked or Retired (default In Store). activationDate format dd-mm-yyyy."];
    const sample = ["", "8991XXXXX", "9876543210", "Jio", "Postpaid", "In Store", "13-07-2026", "", "", "Example row - delete before importing"];
    const rows = [instructionRow, SIM_CSV_HEADERS, sample];
    amsDownloadFile(rows.map(amsCsvRow).join("\r\n"), "SIM_Cards_import_template.csv", "text/csv");
}

function amsExportSims() {
    const rows = [SIM_CSV_HEADERS];
    SIM_STATE.sims.forEach(s => {
        rows.push([
            s.simId, s.iccid || "", s.mobileNumber || "", s.operator || "", s.plan || "",
            s.status, amsFormatDate(s.activationDate), s.vendor || "", s.cost || "", s.remarks || "",
        ]);
    });
    amsDownloadFile(rows.map(amsCsvRow).join("\r\n"), "SIM_Cards_export.csv", "text/csv");
}

function amsSimShowImportSummary(results) {
    const banner = document.getElementById("simImportBanner");
    if (banner) {
        banner.style.display = "block";
        const added = results.filter(r => r.result === "added").length;
        const updated = results.filter(r => r.result === "updated").length;
        const skipped = results.filter(r => r.result === "skipped").length;
        const errors = results.filter(r => r.result === "error").length;
        banner.textContent =
            `Import complete: ${added} added, ${updated} updated, ${skipped} skipped, ${errors} error(s). Skipped/error reasons are listed in the report.`;
    }
    amsShowImportReport(results);
}

function amsImportSimsFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        let rows = amsParseCsv(String(e.target.result));
        rows = rows.filter(r => !(r[0] || "").trim().startsWith("#")); /* drop instruction/comment lines */
        if (!rows.length) { alert("File is empty or unreadable."); return; }
        const headers = rows[0].map(h => h.trim().replace(/\*$/, "")); /* strip the required-marker * */
        const results = [];

        for (let i = 1; i < rows.length; i++) {
            const raw = rows[i];
            if (!raw.length || raw.every(c => !c)) continue;
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = raw[idx] !== undefined ? raw[idx].trim() : ""; });
            const line = i + 1;
            const record = obj.simId || obj.mobileNumber || "(unnamed)";

            if (!obj.mobileNumber) {
                results.push({ row: line, record, result: "error", reason: "Missing required field: mobileNumber" });
                continue;
            }

            const status = AMS_SIM_STATUS_OPTIONS.includes(obj.status) ? obj.status : "In Store";

            const existing = obj.simId ? SIM_STATE.sims.find(s => s.simId === obj.simId) : null;
            if (existing) {
                Object.assign(existing, {
                    iccid: obj.iccid, mobileNumber: obj.mobileNumber, operator: obj.operator, plan: obj.plan,
                    activationDate: obj.activationDate ? amsParseDMY(obj.activationDate) : existing.activationDate,
                    vendor: obj.vendor, cost: obj.cost, remarks: obj.remarks,
                });
                if (status === "Retired") { existing.assignedTo = null; existing.assignedDate = ""; }
                existing.status = status;
                results.push({ row: line, record, result: "updated", reason: "Existing SIM card updated" });
            } else {
                const simId = obj.simId || amsNextSimId();
                const sim = {
                    simId,
                    iccid: obj.iccid || "",
                    mobileNumber: obj.mobileNumber,
                    operator: obj.operator || "",
                    plan: obj.plan || "",
                    status,
                    activationDate: obj.activationDate ? amsParseDMY(obj.activationDate) : "",
                    vendor: obj.vendor || "",
                    cost: obj.cost || "",
                    remarks: obj.remarks || "",
                    assignedTo: null, assignedDate: "",
                    history: [{ date: new Date().toISOString().slice(0, 10), action: "Added to Inventory (Import)", empId: "", empName: "", empDept: "", remarks: "", statusLabel: status }],
                };
                SIM_STATE.sims.push(sim);
                results.push({ row: line, record, result: "added", reason: "New SIM card added" });
            }
        }

        renderSimTable();
        amsSimShowImportSummary(results);
        const fileInput = document.getElementById("simImportFileInput");
        if (fileInput) fileInput.value = "";
    };
    reader.readAsText(file);
}

/* =============================================================================
   11) PAGE INIT
   ===========================================================================*/
async function initSimCards() {
    if (typeof amsDbEnsureLoaded === "function") await amsDbEnsureLoaded();
    amsPopulateSimFormSelects();
    renderSimTable();

    /* Toolbar */
    document.getElementById("simSearchBox").addEventListener("input", renderSimTable);
    document.getElementById("simStatusFilter").addEventListener("change", renderSimTable);
    document.getElementById("btnAddSim").addEventListener("click", amsSimOpenAddModal);
    document.getElementById("btnSimExport").addEventListener("click", amsExportSims);
    document.getElementById("btnSimTemplate").addEventListener("click", amsDownloadSimTemplate);
    document.getElementById("btnSimImport").addEventListener("click", () => document.getElementById("simImportFileInput").click());
    document.getElementById("simImportFileInput").addEventListener("change", (e) => {
        if (e.target.files[0]) amsImportSimsFile(e.target.files[0]);
    });

    /* Row actions + dropdowns */
    amsSimWireRowActions();

    /* Add/Edit form */
    document.getElementById("simForm").addEventListener("submit", amsSimSubmitForm);

    /* Assign/Reassign */
    document.getElementById("btnSimConfirmAssign").addEventListener("click", amsSimConfirmAssign);

    /* Close buttons inside modals + clicking the dark overlay */
    document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => amsSimCloseModal(btn.getAttribute("data-close"))));
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) amsSimCloseModal(overlay.id);
        });
    });
}

/*------------------------------------------------------------------------------
#-------------- End of the code : SIM CARD MASTER PAGE LOGIC -------------------
#------------------------------------------------------------------------------*/
