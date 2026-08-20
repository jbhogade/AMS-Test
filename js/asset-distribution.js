/*==============================================================================
#-------------- Start Code for : ASSET DISTRIBUTION PAGE (asset-distribution.js) -
#
#  PURPOSE   : Per-employee asset holdings breakdown - how many assets each
#              employee holds DIRECTLY (personally assigned) vs under their
#              TEAM (held by direct subordinates, or assigned with a
#              subordinate/team actual user recorded on the asset).
#
#  CLASSIFICATION (same rules as the Asset Issue Form):
#    - Direct  = amsOwnedEmployeeAssets()  : custodian has the asset with no
#                subordinate/team holder recorded.
#    - Team    = amsTeamEmployeeAssets()   : a direct subordinate holds it, OR
#                the asset records assignedToSubordinate / assignedSubText.
#------------------------------------------------------------------------------*/

/* ---- Page state ------------------------------------------------------------ */
const DIST_STATE = {
    rows: [],              /* [{ empId, name, dept, designation, directCount, teamCount, total, direct:[], team:[] }] */
    loaded: false,
};

/* =============================================================================
   1) DATA
   ===========================================================================*/
function distBuildRows() {
    const employees = amsGetEmployeesForPortal();
    return employees.map(emp => {
        const direct = amsOwnedEmployeeAssets(emp.empId) || [];
        const team = amsTeamEmployeeAssets(emp.empId) || [];
        return {
            empId: emp.empId,
            name: emp.name,
            dept: emp.dept || "",
            designation: emp.designation || "",
            directCount: direct.length,
            teamCount: team.length,
            total: direct.length + team.length,
            direct,
            team,
        };
    });
}

function distFilteredRows() {
    const search = (document.getElementById("distSearch").value || "").toLowerCase();
    const dept = document.getElementById("distDeptFilter").value;
    const onlyWithAssets = document.getElementById("distOnlyWithAssets").checked;
    return DIST_STATE.rows.filter(r => {
        if (dept && r.dept !== dept) return false;
        if (onlyWithAssets && r.total === 0) return false;
        if (search) {
            const hay = `${r.name} ${r.empId} ${r.dept} ${r.designation}`.toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });
}

/* =============================================================================
   2) RENDER : summary cards
   ===========================================================================*/
function distRenderSummary() {
    const totalDirect = DIST_STATE.rows.reduce((n, r) => n + r.directCount, 0);
    const totalTeam = DIST_STATE.rows.reduce((n, r) => n + r.teamCount, 0);
    const withAssets = DIST_STATE.rows.filter(r => r.total > 0).length;
    const html = `
        <div class="stat-card"><div class="stat-value">${totalDirect}</div><div class="stat-label">Direct (Personal) Assets</div></div>
        <div class="stat-card"><div class="stat-value">${totalTeam}</div><div class="stat-label">Team / Subordinate Assets</div></div>
        <div class="stat-card"><div class="stat-value">${totalDirect + totalTeam}</div><div class="stat-label">Total Distributed</div></div>
        <div class="stat-card"><div class="stat-value">${withAssets}</div><div class="stat-label">Employees Holding Assets</div></div>
    `;
    document.getElementById("distStockSummary").innerHTML = html;
}

/* =============================================================================
   3) RENDER : distribution table (sortable + filterable)
   ===========================================================================*/
function distRenderTable() {
    const rows = distFilteredRows();

    const getters = {
        empId: r => r.empId,
        name: r => r.name,
        dept: r => r.dept,
        designation: r => r.designation,
        direct: r => r.directCount,
        team: r => r.teamCount,
        total: r => r.total,
    };
    const sorted = amsSortRows("distTable", rows, getters);

    const body = sorted.length
        ? sorted.map(r => `<tr>
            <td class="mono-cell">${amsEsc(r.empId)}</td>
            <td>${amsEsc(r.name)}</td>
            <td>${amsEsc(r.dept)}</td>
            <td>${amsEsc(r.designation) || "-"}</td>
            <td class="mono-cell">${r.directCount}</td>
            <td class="mono-cell">${r.teamCount}</td>
            <td class="mono-cell"><strong>${r.total}</strong></td>
            <td class="actions-cell">
                <button class="btn btn-secondary" onclick="distOpenDetail('${amsEsc(r.empId)}')">View Assets</button>
            </td>
        </tr>`).join("")
        : `<tr><td colspan="8" style="color:var(--text-muted);text-align:center;">No employees match the current filters</td></tr>`;

    document.getElementById("distTable").innerHTML = `
        <thead><tr>
            ${amsSortableTh("distTable", "empId", "Emp ID")}
            ${amsSortableTh("distTable", "name", "Employee Name")}
            ${amsSortableTh("distTable", "dept", "Department")}
            ${amsSortableTh("distTable", "designation", "Designation")}
            ${amsSortableTh("distTable", "direct", "Direct")}
            ${amsSortableTh("distTable", "team", "Team")}
            ${amsSortableTh("distTable", "total", "Total")}
            <th></th>
        </tr></thead>
        <tbody>${body}</tbody>`;

    const shownTotal = sorted.reduce((n, r) => n + r.total, 0);
    document.getElementById("distTableFooter").innerHTML =
        `<span>${sorted.length} employee${sorted.length === 1 ? "" : "s"} &middot; ${shownTotal} asset(s) shown</span>`;
}

/* =============================================================================
   4) RENDER : per-employee detail modal
   ===========================================================================*/
function distOpenDetail(empId) {
    const r = DIST_STATE.rows.find(x => x.empId === empId);
    if (!r) return;
    document.getElementById("distDetailTitle").textContent = `${r.name} (${r.empId}) - Asset Detail`;

    const row = (a, kindCls, kindLabel) => `<tr>
        <td class="mono-cell">${amsEsc(amsComputeFullId(a))}</td>
        <td>${amsEsc(a.type)}</td>
        <td>${amsEsc(a.make)} ${amsEsc(a.model)}</td>
        <td>${amsEsc(a.serialNumber) || "-"}</td>
        <td>${amsEsc(a.status)}</td>
        <td><span class="badge ${kindCls}">${kindLabel}</span></td>
    </tr>`;

    const directRows = r.direct.length
        ? r.direct.map(a => row(a, "badge-green", "Direct")).join("")
        : `<tr><td colspan="6" style="color:var(--text-muted);text-align:center;">No directly held assets</td></tr>`;

    const teamRows = r.team.length
        ? r.team.map(a => row(a, "badge-transfer", "Team")).join("")
        : `<tr><td colspan="6" style="color:var(--text-muted);text-align:center;">No team / subordinate assets</td></tr>`;

    document.getElementById("distDetailBody").innerHTML = `
        <p class="form-hint" style="margin-bottom:10px;">
            Direct = personally held by the employee. Team = held by the employee's subordinates, or assigned
            to the employee with a subordinate/team member recorded as the actual user.
            Direct: <strong>${r.directCount}</strong> &middot; Team: <strong>${r.teamCount}</strong> &middot; Total: <strong>${r.total}</strong>
        </p>
        <div class="card" style="margin-bottom:14px;">
            <div class="card-title">Direct (Personal Use) - ${r.directCount}</div>
            <div class="table-wrap"><table class="table">
                <thead><tr><th>Asset ID (Full)</th><th>Type</th><th>Make / Model</th><th>Serial</th><th>Status</th><th>Kind</th></tr></thead>
                <tbody>${directRows}</tbody>
            </table></div>
        </div>
        <div class="card">
            <div class="card-title">Team / Subordinate Use - ${r.teamCount}</div>
            <div class="table-wrap"><table class="table">
                <thead><tr><th>Asset ID (Full)</th><th>Type</th><th>Make / Model</th><th>Serial</th><th>Status</th><th>Kind</th></tr></thead>
                <tbody>${teamRows}</tbody>
            </table></div>
        </div>`;
    amsOpenModal("modalDistDetail");
}

/* =============================================================================
   5) EXPORT
   ===========================================================================*/
function distExportCsv() {
    const headers = ["Emp ID", "Employee Name", "Department", "Designation", "Direct Assets", "Team Assets", "Total Assets"];
    const rows = distFilteredRows().map(r => [r.empId, r.name, r.dept, r.designation, r.directCount, r.teamCount, r.total]);
    const csv = [headers.map(amsCsvCell).join(",")].concat(rows.map(r => r.map(amsCsvCell).join(","))).join("\r\n");
    amsDownloadFile(csv, "Asset_Distribution.csv", "text/csv;charset=utf-8;");
}

function distExportXlsx() {
    const headers = ["Emp ID", "Employee Name", "Department", "Designation", "Direct Assets", "Team Assets", "Total Assets"];
    const rows = distFilteredRows().map(r => [r.empId, r.name, r.dept, r.designation, r.directCount, r.teamCount, r.total]);
    amsExportXlsx("Asset_Distribution", headers, rows);
}

function amsCsvCell(v) {
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* =============================================================================
   6) PAGE INIT
   ===========================================================================*/
function initAssetDistribution() {
    amsDbEnsureLoaded().then(() => {
        DIST_STATE.rows = distBuildRows();
        DIST_STATE.loaded = true;

        const depts = [];
        DIST_STATE.rows.forEach(r => { if (r.dept && !depts.includes(r.dept)) depts.push(r.dept); });
        depts.sort((a, b) => a.localeCompare(b));
        document.getElementById("distDeptFilter").innerHTML = `<option value="">All Departments</option>` + depts.map(d => `<option value="${amsEsc(d)}">${amsEsc(d)}</option>`).join("");

        amsSortRegisterRenderer("distTable", distRenderTable);

        document.getElementById("distSearch").addEventListener("input", distRenderTable);
        document.getElementById("distDeptFilter").addEventListener("change", distRenderTable);
        document.getElementById("distOnlyWithAssets").addEventListener("change", distRenderTable);
        document.getElementById("btnDistCsv").addEventListener("click", distExportCsv);
        document.getElementById("btnDistXlsx").addEventListener("click", distExportXlsx);

        distRenderSummary();
        distRenderTable();
    });
}
