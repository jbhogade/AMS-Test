/*==============================================================================
#-------------- Start Code for : EMPLOYEE MASTER PAGE LOGIC (employees.js) ------
#
#  PURPOSE   : Drives the Employee Master page - table, filters, and all
#              employee actions (View, Edit, Assign, Reassign, Exit, and the
#              Asset Issue / Handover forms).
#
#  DATA      : Reads + writes the in-memory dummy data in dummy-data.js.
#              When SQL Server arrives, replace the data calls in this file
#              with API calls that return the same shapes.
#
#  ACTIONS (from the row menu) :
#     1. View           - full employee profile (AMS ID only for Super Root)
#     2. Edit           - update employee fields
#     3. Assign Asset   - give an unassigned asset to this employee
#     4. Reassign Asset - move one of his assets to another employee
#     5. Exit           - off-boarding with facility check-off + asset return
#     6. Assign Report  - prints / opens the professional Asset Issue Form
#     7. Exit Report    - prints / opens the Asset Handover / Return Form
#------------------------------------------------------------------------------*/

/* =============================================================================
   1) STATE
   ===========================================================================*/
let currentCredentialLevel = "Standard User";   /* controls AMS ID visibility  */
let editingAmsId = null;                        /* set while editing employee   */
let currentEmployeeAmsId = null;                /* the employee being acted on  */
let currentModal = null;                        /* id of the currently open modal */

/* =============================================================================
   2) MODAL HELPERS (open / close / wire-up)
   ===========================================================================*/
function showModal(id) {
    currentModal = id;
    document.getElementById(id).classList.add("open");
}

function hideModal(id) {
    document.getElementById(id).classList.remove("open");
    if (currentModal === id) currentModal = null;
}

/* Hide the currently open modal */
function hideCurrentModal() {
    if (currentModal) hideModal(currentModal);
}

/* =============================================================================
   3) TABLE RENDERING
   ===========================================================================*/
/* Reads the toolbar filters and returns the matching employees */
function getFilteredEmployees() {
    const search = (document.getElementById("emp-search").value || "").toLowerCase();
    const dept = document.getElementById("emp-dept-filter").value;
    const status = document.getElementById("emp-status-filter").value;

    return DUMMY_EMPLOYEES.filter(emp => {
        const fullName = getEmployeeFullName(emp).toLowerCase();
        const matchesSearch = !search ||
            fullName.includes(search) ||
            emp.empId.toLowerCase().includes(search) ||
            emp.designation.toLowerCase().includes(search) ||
            emp.amsId.toLowerCase().includes(search);
        const matchesDept = dept === "All" || emp.department === dept;
        const matchesStatus = status === "All" || emp.status === status;
        return matchesSearch && matchesDept && matchesStatus;
    });
}

/* Renders the employee table body */
function renderEmployeeTable() {
    const tbody = document.getElementById("employee-table-body");
    const thead = document.getElementById("employee-table-head");
    const amsVisible = isAmsVisible();
    const employees = getFilteredEmployees();

    /* Sortable header (shared js/sortable.js engine) */
    const getters = {
        amsId: emp => emp.amsId,
        name: emp => getEmployeeFullName(emp),
        dept: emp => emp.department,
        designation: emp => emp.designation,
        contact: emp => emp.contact || "",
        email: emp => emp.email || "",
        owned: emp => amsOwnedEmployeeAssets(emp.amsId).length,
        team: emp => amsTeamEmployeeAssets(emp.amsId).length,
        status: emp => emp.status,
    };
    const sorted = amsSortRows("employeeTable", employees, getters);
    if (thead) {
        thead.innerHTML = `<tr>
            ${amsSortableTh("employeeTable", "amsId", "AMS ID", "ams-col")}
            ${amsSortableTh("employeeTable", "name", "Employee")}
            ${amsSortableTh("employeeTable", "dept", "Department")}
            ${amsSortableTh("employeeTable", "designation", "Designation")}
            ${amsSortableTh("employeeTable", "contact", "Contact")}
            ${amsSortableTh("employeeTable", "email", "Email")}
            ${amsSortableTh("employeeTable", "owned", "Owned")}
            ${amsSortableTh("employeeTable", "team", "Team")}
            ${amsSortableTh("employeeTable", "status", "Status")}
            <th>Actions</th>
        </tr>`;
    }

    /* Show / hide the AMS Employee ID column based on credential level */
    document.getElementById("ams-col").style.display = amsVisible ? "" : "none";
    document.getElementById("ams-hint").style.display = amsVisible ? "none" : "";

    if (sorted.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-note" style="text-align:center;padding:28px;">
                    No employees found. Adjust the search / filters, or add a new employee.
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = sorted.map(emp => {
        const owned = amsOwnedEmployeeAssets(emp.amsId).length;
        const team = amsTeamEmployeeAssets(emp.amsId).length;
        const badge = badgeClassFor(emp.status);
        const amsCell = amsVisible
            ? `<td class="muted" title="Hidden from regular users">${escapeHtml(emp.amsId)}</td>`
            : "";

        return `
            <tr>
                ${amsCell}
                <td>
                    <div class="flex items-center gap-8">
                        <div class="emp-avatar">${escapeHtml(getEmployeeInitials(emp))}</div>
                        <div class="emp-cell-name">
                            <strong>${escapeHtml(getEmployeeFullName(emp))}</strong>
                            <span>${escapeHtml(emp.empId)}</span>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(emp.department)}</td>
                <td>${escapeHtml(emp.designation)}</td>
                <td class="muted">${escapeHtml(emp.contact || "-")}</td>
                <td class="muted">${escapeHtml(emp.email || "-")}</td>
                <td><span class="asset-count owned">${owned}</span></td>
                <td><span class="asset-count team">${team}</span></td>
                <td><span class="badge ${badge}"><span class="badge-dot"></span>${escapeHtml(emp.status)}</span></td>
                <td>${buildActionsMenu(emp)}</td>
            </tr>
        `;
    }).join("");
}

/* Builds the "Actions" dropdown for one employee row */
function buildActionsMenu(emp) {
    const active = emp.status === "Active";
    const exited = emp.status === "Inactive" && !!getExitRecord(emp.amsId);
    const holdsAssets = getEmployeeAssets(emp.amsId).length > 0 || getSubordinateAssets(emp.amsId).length > 0;
    return `
        <div class="row-actions">
            <button class="actions-btn" onclick="toggleRowActions(this)">Actions &#9662;</button>
            <div class="actions-menu">
                <a onclick="viewEmployee('${emp.amsId}')">&#128065; View</a>
                <a onclick="openEditModal('${emp.amsId}')">&#9998; Edit</a>
                ${active ? `<div class="menu-sep"></div>
                <a class="${holdsAssets ? "" : "menu-disabled"}" onclick="${holdsAssets ? `openIssueForm('${emp.amsId}')` : `alert('No Assign Report can be generated - this employee is not holding any assets.')`}">&#128203; Assign Report (Asset Issue Form)</a>
                <div class="menu-sep"></div>
                <a class="danger" onclick="openExitModal('${emp.amsId}')">&#10006; Exit</a>`
                : exited ? `<div class="menu-sep"></div>
                <a onclick="openHandoverForm('${emp.amsId}')">&#128202; Exit Report (Handover Form)</a>` : ""}
            </div>
        </div>
    `;
}

/* Row-menu helpers - prefer the shared viewport-anchored helpers from
   js/layout.js, but fall back to the classic open/close so the menus still
   work even if an older (cached) layout.js is loaded. */
function amsOpenRowMenu(trigger, menu) {
    if (typeof amsDropdownOpen === "function") { amsDropdownOpen(trigger, menu); return; }
    document.querySelectorAll(".actions-menu.open").forEach(m => m.classList.remove("open"));
    menu.classList.add("open");
    /* Viewport-anchored fallback (mirrors amsDropdownOpen): even with a stale
       cached layout.js the menu opens right under its trigger instead of
       floating absolute inside (and being clipped by) the table's scroll
       container. */
    const r = trigger.getBoundingClientRect();
    const mw = menu.offsetWidth || 200;
    const mh = menu.offsetHeight || 320;
    menu.style.position = "fixed";
    menu.style.right = "auto";
    menu.style.top = "auto";
    menu.style.zIndex = "500";
    let left = r.right - mw;
    if (left < 8) left = Math.max(8, r.left);
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
    let top = r.bottom + 6;
    if (top + mh > window.innerHeight - 8) { top = r.top - mh - 6; if (top < 8) top = 8; }
    menu.style.left = left + "px";
    menu.style.top = top + "px";
    menu.style.width = mw + "px";
}
function amsCloseRowMenus() {
    if (typeof amsDropdownClose === "function") { amsDropdownClose(); return; }
    document.querySelectorAll(".actions-menu.open").forEach(m => {
        m.classList.remove("open");
        m.style.position = ""; m.style.left = ""; m.style.top = "";
        m.style.right = ""; m.style.width = ""; m.style.zIndex = "";
    });
}

/* Toggles the row actions dropdown open/closed (viewport-anchored) */
function toggleRowActions(btn) {
    const menu = btn.parentElement.querySelector(".actions-menu");
    const wasOpen = menu.classList.contains("open");
    amsCloseRowMenus();
    if (!wasOpen) amsOpenRowMenu(btn, menu);
}

/* Clicking anywhere else closes all open action menus */
document.addEventListener("click", function (e) {
    if (!e.target.closest(".row-actions")) amsCloseRowMenus();
});

/* =============================================================================
   4) CREDENTIAL LEVEL (AMS Employee ID visibility - demo rule)
   ===========================================================================*/
function isAmsVisible() {
    const level = CREDENTIAL_LEVELS.find(l => l.name === currentCredentialLevel);
    return level ? level.amsVisible : false;
}

function onCredentialChange() {
    currentCredentialLevel = document.getElementById("emp-cred-level").value;
    renderEmployeeTable();
}

/* =============================================================================
   5) ADD / EDIT EMPLOYEE
   ===========================================================================*/
function openAddModal() {
    editingAmsId = null;
    document.getElementById("employee-modal-title").textContent = "Add Employee";

    /* Hide the AMS ID field (it is auto-generated) */
    document.getElementById("ams-field").style.display = "none";
    document.getElementById("emp-ams-preview").textContent = "";

    /* Clear the form */
    document.getElementById("f-empid").value = "EMP-000001";
    document.getElementById("f-name").value = "";
    document.getElementById("f-dept").value = "Admin";
    document.getElementById("f-desig").value = "";
    document.getElementById("f-manager").value = "";
    document.getElementById("f-manager-id").value = "";
    document.getElementById("f-contact").value = "";
    document.getElementById("f-email").value = "";
    hideFormError("employee-form-error");
    showModal("modal-employee");
}

function openEditModal(amsId) {
    const emp = findEmployee(amsId);
    if (!emp) return;

    editingAmsId = amsId;
    document.getElementById("employee-modal-title").textContent = "Edit Employee";

    /* AMS ID is read-only and only visible to Super Root */
    document.getElementById("ams-field").style.display = isAmsVisible() ? "" : "none";
    document.getElementById("f-amsid").value = emp.amsId;
    document.getElementById("emp-ams-preview").textContent = "";

    document.getElementById("f-empid").value = emp.empId;
    document.getElementById("f-name").value = getEmployeeFullName(emp);
    document.getElementById("f-dept").value = emp.department;
    document.getElementById("f-desig").value = emp.designation;
    document.getElementById("f-manager").value = emp.managerAmsId || "";
    document.getElementById("f-manager-id").value = onManagerChange() || "";
    document.getElementById("f-contact").value = emp.contact;
    document.getElementById("f-email").value = emp.email;
    hideFormError("employee-form-error");
    showModal("modal-employee");
}

/* Live preview of the AMS ID that will be generated for the selected department */
function onDeptChange() {
    if (isAmsVisible() && !editingAmsId) {
        const dept = document.getElementById("f-dept").value;
        document.getElementById("emp-ams-preview").textContent =
            "AMS ID will be generated as: " + generateAmsId(dept);
    }
}

function saveEmployee() {
    const data = {
        empId: document.getElementById("f-empid").value.trim(),
        name: document.getElementById("f-name").value.trim().replace(/\s+/g, " "),
        department: document.getElementById("f-dept").value,
        designation: document.getElementById("f-desig").value.trim(),
        managerAmsId: document.getElementById("f-manager").value || null,
        contact: document.getElementById("f-contact").value.trim(),
        email: document.getElementById("f-email").value.trim()
    };

    /* ---- Validation of required fields ---- */
    if (!data.name || !data.department || !data.designation || !data.empId) {
        showFormError("employee-form-error", "Please fill all required fields: Employee ID, Full Name, Department and Designation.");
        return;
    }

    if (editingAmsId) {
        updateEmployee(editingAmsId, data);
    } else {
        addEmployee(data);
    }

    hideModal("modal-employee");
    renderEmployeeTable();
    renderEmpStats();
}

/* =============================================================================
   6) VIEW EMPLOYEE PROFILE
   ===========================================================================*/
function viewEmployee(amsId) {
    const emp = findEmployee(amsId);
    if (!emp) return;

    const owned = amsOwnedEmployeeAssets(amsId);
    const subordinates = getSubordinates(amsId);
    const teamAssets = amsTeamEmployeeAssets(amsId);
    const manager = emp.managerAmsId ? findEmployee(emp.managerAmsId) : null;

    document.getElementById("view-avatar").textContent = getEmployeeInitials(emp);
    document.getElementById("view-name").textContent = getEmployeeFullName(emp);
    document.getElementById("view-meta").textContent =
        emp.designation + " - " + emp.department + " Department";

    /* AMS ID line only for Super Root */
    document.getElementById("view-ams-wrap").style.display = isAmsVisible() ? "" : "none";
    document.getElementById("view-ams").textContent = emp.amsId;

    document.getElementById("view-empid").textContent = emp.empId;
    document.getElementById("view-dept").textContent = emp.department;
    document.getElementById("view-desig").textContent = emp.designation;
    document.getElementById("view-manager").textContent = manager ? getEmployeeFullName(manager) : (emp.managerName || emp.managerId || "-");
    document.getElementById("view-contact").textContent = emp.contact || "-";
    document.getElementById("view-email").textContent = emp.email || "-";
    document.getElementById("view-status").innerHTML =
        `<span class="badge ${badgeClassFor(emp.status)}"><span class="badge-dot"></span>${escapeHtml(emp.status)}</span>`;
    document.getElementById("view-exit").style.display = emp.exitDate ? "" : "none";
    document.getElementById("view-exit").textContent = "Exited on: " + emp.exitDate;

    /* Assets owned list */
    const ownedList = document.getElementById("view-owned-list");
    ownedList.innerHTML = owned.length
        ? owned.map(a => `
            <li>
                <span><strong>${escapeHtml(a.id)}</strong> - ${escapeHtml(a.makeModel)}</span>
                <span class="badge ${badgeClassFor(a.status)}">${escapeHtml(a.status)}</span>
            </li>`).join("")
        : `<div class="empty-note">No assets assigned directly.</div>`;

    /* Subordinates' assets list (team assets: subordinates' own + custodian-held
       assets whose actual user is a subordinate/team member) */
    const teamList = document.getElementById("view-team-list");
    teamList.innerHTML = teamAssets.length
        ? teamAssets.map(a => {
            const holder = a.assignedTo === amsId
                ? (amsAssetHolderLabel(a) || "team")
                : (findEmployee(a.assignedTo) ? getEmployeeFullName(findEmployee(a.assignedTo)) : "team");
            return `
                <li>
                    <span><strong>${escapeHtml(a.id)}</strong> - ${escapeHtml(a.makeModel)}
                        <span class="muted">(with ${escapeHtml(holder)})</span>
                    </span>
                    <span class="badge ${badgeClassFor(a.status)}">${escapeHtml(a.status)}</span>
                </li>`;
          }).join("")
        : `<div class="empty-note">${subordinates.length ? "Subordinates hold no assets." : "No subordinates."}</div>`;

    document.getElementById("view-owned-count").textContent = owned.length;
    document.getElementById("view-team-count").textContent = teamAssets.length;

    currentEmployeeAmsId = amsId;
    showModal("modal-view");
}

/* Downloads the employee profile + asset holdings shown in the View modal as a
   CSV report (uses the shared amsCsvRow / amsDownloadFile helpers). */
function amsDownloadEmployeeView() {
    if (!currentEmployeeAmsId) return;
    const emp = findEmployee(currentEmployeeAmsId);
    if (!emp) return;
    const owned = amsOwnedEmployeeAssets(emp.amsId) || [];
    const team = amsTeamEmployeeAssets(emp.amsId) || [];
    const manager = emp.managerAmsId ? findEmployee(emp.managerAmsId) : null;

    const rows = [["Field", "Value", "", "Kind", "Asset ID", "Make / Model", "Status", "Holder"]];
    const p = (label, value) => rows.push([label, value == null || value === "" ? "-" : value, "", "", "", "", "", ""]);
    p("AMS Employee ID", emp.amsId);
    p("Employee ID", emp.empId);
    p("Name", getEmployeeFullName(emp));
    p("Department", emp.department);
    p("Designation", emp.designation);
    p("Manager", manager ? getEmployeeFullName(manager) : (emp.managerName || emp.managerId || "-"));
    p("Contact", emp.contact);
    p("Email", emp.email);
    p("Status", emp.status);
    p("Exit Date", emp.exitDate || "-");

    owned.forEach(a => rows.push(["", "", "", "Owned", a.id, a.makeModel || "-", a.status || "-", (typeof amsAssetHolderLabel === "function" && amsAssetHolderLabel(a)) || "-"]));
    team.forEach(a => rows.push(["", "", "", "Team", a.id, a.makeModel || "-", a.status || "-", "-"]));

    const csv = rows.map(amsCsvRow).join("\r\n");
    amsDownloadFile(csv, `Employee_${emp.empId}.csv`, "text/csv;charset=utf-8;");
}

/* =============================================================================
   7) ASSIGN ASSET
   ===========================================================================*/
function openAssignModal(amsId) {
    const emp = findEmployee(amsId);
    if (!emp) return;

    const unassigned = getUnassignedAssets();
    const select = document.getElementById("assign-asset");

    /* Fill the asset dropdown with unassigned assets */
    select.innerHTML = unassigned.length
        ? unassigned.map(a => `<option value="${a.id}">${escapeHtml(a.id)} - ${escapeHtml(a.makeModel)}</option>`).join("")
        : `<option value="">(No unassigned assets available)</option>`;

    document.getElementById("assign-employee-name").textContent = getEmployeeFullName(emp);
    document.getElementById("assign-remarks").value = "";
    currentEmployeeAmsId = amsId;
    showModal("modal-assign");
}

function confirmAssign() {
    const select = document.getElementById("assign-asset");
    const assetId = select.value;
    if (!assetId) {
        showFormError("assign-form-error", "There are no unassigned assets to assign. Please add assets first.");
        return;
    }
    assignAsset(assetId, currentEmployeeAmsId);
    hideModal("modal-assign");
    renderEmployeeTable();
}

/* =============================================================================
   8) REASSIGN ASSET
   ===========================================================================*/
function openReassignModal(amsId) {
    const emp = findEmployee(amsId);
    if (!emp) return;

    const hisAssets = getEmployeeAssets(amsId);
    const assetSelect = document.getElementById("reassign-asset");

    assetSelect.innerHTML = hisAssets.length
        ? hisAssets.map(a => `<option value="${a.id}">${escapeHtml(a.id)} - ${escapeHtml(a.makeModel)}</option>`).join("")
        : `<option value="">(This employee has no assets)</option>`;

    /* Target employees = all active employees except himself */
    const targetSelect = document.getElementById("reassign-target");
    targetSelect.innerHTML = DUMMY_EMPLOYEES
        .filter(e => e.status === "Active" && e.amsId !== amsId)
        .map(e => `<option value="${e.amsId}">${escapeHtml(getEmployeeFullName(e))} (${escapeHtml(e.department)})</option>`)
        .join("");

    document.getElementById("reassign-from-name").textContent = getEmployeeFullName(emp);
    document.getElementById("reassign-remarks").value = "";
    currentEmployeeAmsId = amsId;
    showModal("modal-reassign");
}

function confirmReassign() {
    const assetId = document.getElementById("reassign-asset").value;
    const targetAmsId = document.getElementById("reassign-target").value;
    if (!assetId || !targetAmsId) {
        showFormError("reassign-form-error", "Please select both an asset and a target employee.");
        return;
    }
    reassignAsset(assetId, targetAmsId);
    hideModal("modal-reassign");
    renderEmployeeTable();
}

/* =============================================================================
   9) EMPLOYEE EXIT / OFF-BOARDING  (includes facility check-off)
   ===========================================================================*/
function openExitModal(amsId) {
    const emp = findEmployee(amsId);
    if (!emp) return;

    document.getElementById("exit-name").textContent = getEmployeeFullName(emp);
    document.getElementById("exit-meta").textContent = emp.designation + " - " + emp.department;
    document.getElementById("exit-date").value = new Date().toISOString().slice(0, 10);

    /* Assets owned must be returned - one checkbox each */
    const assets = getEmployeeAssets(amsId);
    const assetList = document.getElementById("exit-asset-list");
    assetList.innerHTML = assets.length
        ? assets.map(a => `
            <li>
                <input type="checkbox" checked>
                <span class="fac-label">${escapeHtml(a.id)} - ${escapeHtml(a.makeModel)}</span>
                <span class="fac-state on">To Return</span>
            </li>`).join("")
        : `<li><span class="fac-label">No assets held by this employee.</span></li>`;

    /* Facilities to disable - Email Login & ERP Login are pre-checked per rule */
    const facList = document.getElementById("exit-facility-list");
    facList.innerHTML = FACILITIES_CHECKLIST.map(f => `
        <li>
            <input type="checkbox" ${f.revokedOnExit ? "checked" : ""} data-fac="${f.key}">
            <span class="fac-label">${escapeHtml(f.label)}</span>
            <span class="fac-state on">Active</span>
        </li>`).join("");

    /* Live update of each facility's state chip when checked */
    facList.addEventListener("change", function (e) {
        if (e.target.matches("input[data-fac]")) {
            const state = e.target.closest("li").querySelector(".fac-state");
            state.textContent = e.target.checked ? "Disabled" : "Active";
            state.className = "fac-state " + (e.target.checked ? "off" : "on");
        }
    });

    /* Subordinate / team assets - list who reports to this person and force a
       choice of the new Incharge / HOD so the team's asset records continue */
    const subordinates = getSubordinates(amsId);
    const subWithAssets = subordinates.filter(s => getEmployeeAssets(s.amsId).length > 0);
    const teamWrap = document.getElementById("exit-team-wrap");
    if (!subWithAssets.length) {
        teamWrap.style.display = "none";
        document.getElementById("exit-incharge").value = "";
    } else {
        teamWrap.style.display = "";
        document.getElementById("exit-team-list").innerHTML = subWithAssets.map(s => {
            const cnt = getEmployeeAssets(s.amsId).length;
            return `<li>
                <input type="checkbox" checked>
                <span class="fac-label">${escapeHtml(getEmployeeFullName(s))} (${escapeHtml(s.empId)})</span>
                <span class="fac-state on">${cnt} asset${cnt > 1 ? "s" : ""}</span>
            </li>`;
        }).join("");

        const inchargeSel = document.getElementById("exit-incharge");
        const options = DUMMY_EMPLOYEES
            .filter(e => e.status === "Active" && e.amsId !== amsId)
            .sort((a, b) => a.department.localeCompare(b.department) || getEmployeeFullName(a).localeCompare(getEmployeeFullName(b)))
            .map(e => `<option value="${e.amsId}">${escapeHtml(getEmployeeFullName(e))} - ${escapeHtml(e.designation)} (${escapeHtml(e.department)})</option>`)
            .join("");
        /* Default to this person's own manager, if they are still active */
        const currentManager = emp.managerAmsId ? findEmployee(emp.managerAmsId) : null;
        const defaultVal = (currentManager && currentManager.status === "Active" && currentManager.amsId !== amsId) ? currentManager.amsId : "";
        inchargeSel.innerHTML = `<option value="">Select new Incharge / HOD...</option>` + options;
        inchargeSel.value = defaultVal;
    }

    document.getElementById("exit-reason").value = "";
    document.getElementById("exit-remarks").value = "";
    document.getElementById("exit-emp-ams").textContent = isAmsVisible() ? emp.amsId : "*****";
    currentEmployeeAmsId = amsId;
    showModal("modal-exit");
}

function confirmExit() {
    const emp = findEmployee(currentEmployeeAmsId);
    if (!emp) return;

    const exitReason = document.getElementById("exit-reason").value;
    /* If this person has direct subordinates holding assets, the new Incharge /
       HOD must be chosen so the team's asset records continue under them */
    const subWithAssets = getSubordinates(currentEmployeeAmsId)
        .filter(s => getEmployeeAssets(s.amsId).length > 0);
    const teamIncharge = subWithAssets.length ? document.getElementById("exit-incharge").value : "";
    if (subWithAssets.length && !teamIncharge) {
        alert("This employee has " + subWithAssets.length + " direct subordinate(s) holding assets. Please select the New Incharge / HOD to take over the team's assets.");
        return;
    }

    /* Collect the facilities that were checked for the handover record */
    const disabledFacilities = [];
    document.querySelectorAll("#exit-facility-list input[data-fac]:checked").forEach(cb => {
        const fac = FACILITIES_CHECKLIST.find(f => f.key === cb.dataset.fac);
        if (fac) disabledFacilities.push(fac.label);
    });

    exitEmployee(
        currentEmployeeAmsId,
        document.getElementById("exit-date").value,
        document.getElementById("exit-remarks").value,
        disabledFacilities,
        exitReason,
        teamIncharge
    );

    /* Log the event to the permanent activity log */
    const logPieces = ["Facilities disabled: " + (disabledFacilities.join(", ") || "none")];
    if (exitReason) logPieces.push("Reason: " + exitReason);
    if (teamIncharge) {
        const ic = findEmployee(teamIncharge);
        if (ic) logPieces.push("Team transferred to: " + getEmployeeFullName(ic));
    }
    amsNotify(getEmployeeFullName(emp) + " exited. " + logPieces.join(" | "), "danger");

    hideModal("modal-exit");
    renderEmployeeTable();
    renderEmpStats();
}

/* =============================================================================
   10) ASSIGN REPORT  (Asset Issue Form) - professional printable document
       Available only for ACTIVE employees. Lists every asset the employee
       currently holds (live data), then opens the shared print-remarks modal.
   ===========================================================================*/
function openIssueForm(amsId) {
    const emp = findEmployee(amsId);
    if (!emp) return;
    if (emp.status !== "Active") {
        alert("The Assign Report (Asset Issue Form) is only available for active employees.");
        return;
    }
    const directCount = getEmployeeAssets(amsId).length;
    const subCount = getSubordinateAssets(amsId).length;
    if (directCount === 0 && subCount === 0) {
        alert("No Assign Report (Asset Issue Form) can be generated for " + getEmployeeFullName(emp) + " because they are not currently holding any assets.");
        return;
    }
    amsGenerateReport(amsId, "assign");
}

/* =============================================================================
   11) EXIT REPORT  (Asset Handover Form) - professional printable document
       Available only for employees who have exited. Reads the permanent EXIT
       RECORD snapshot captured at exit, so the printed form stays accurate
       even after the assets were released back to the store. Includes the new
       Incharge / HOD who took over the exiting employee's team.
   ===========================================================================*/
function openHandoverForm(amsId) {
    const emp = findEmployee(amsId);
    if (!emp) return;
    const exitRecord = getExitRecord(amsId);
    if (emp.status !== "Inactive" || !exitRecord) {
        alert("The Exit Report (Handover Form) is only available after the employee has been exited.");
        return;
    }
    amsGenerateReport(amsId, "exit");
}

/* =============================================================================
   12) SMALL SHARED FORM HELPERS
   ===========================================================================*/
function showFormError(id, message) {
    const el = document.getElementById(id);
    el.textContent = message;
    el.classList.add("show");
}

function hideFormError(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("show");
}

/* =============================================================================
   13) STATS STRIP + INIT
   ===========================================================================*/
function renderEmpStats() {
    const s = getEmployeeSummary();
    document.getElementById("stat-total").textContent = s.total;
    document.getElementById("stat-active").textContent = s.active;
    document.getElementById("stat-inactive").textContent = s.inactive;
    document.getElementById("stat-assigned").textContent = s.assignedAssets;
}

/* Fills the department / manager / designation dropdowns.
   Departments & designations come from BOTH the hardcoded seeds (DEPARTMENTS /
   DESIGNATIONS) AND the DB-backed masters (AMS_DUMMY_DEPARTMENTS /
   AMS_DESIGNATION_OPTIONS), so lookups added in either place show up here. */
function allDeptOptions() {
    const out = DEPARTMENTS.map(d => ({ name: d.name, short: d.short }));
    AMS_DUMMY_DEPARTMENTS.forEach(d => {
        if (!out.some(x => x.name.toLowerCase() === d.name.toLowerCase())) out.push({ name: d.name, short: d.shortform });
    });
    return out;
}
function allDesigOptions() {
    const out = DESIGNATIONS.slice();
    AMS_DESIGNATION_OPTIONS.forEach(d => {
        if (!out.some(x => x.toLowerCase() === d.name.toLowerCase())) out.push(d.name);
    });
    return out;
}

function populateSelects() {
    const deptFilter = document.getElementById("emp-dept-filter");
    const deptForm = document.getElementById("f-dept");
    const managerSelect = document.getElementById("f-manager");
    const desigList = document.getElementById("designation-list");

    const deptOptions = allDeptOptions();
    const desigOptions = allDesigOptions();

    /* Department filter options */
    deptFilter.innerHTML = `<option value="All">All Departments</option>` +
        deptOptions.map(d => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`).join("");

    /* Department field inside the form */
    deptForm.innerHTML = deptOptions.map(d => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`).join("");

    /* Manager (reports-to) dropdown - all active employees */
    managerSelect.innerHTML = `<option value="">(None - top level)</option>` +
        DUMMY_EMPLOYEES.filter(e => e.status === "Active")
            .map(e => `<option value="${e.amsId}">${escapeHtml(getEmployeeFullName(e))} (${escapeHtml(e.department)})</option>`)
            .join("");

    /* Designation suggestions (datalist) */
    desigList.innerHTML = desigOptions.map(d => `<option value="${escapeHtml(d)}"></option>`).join("");

    /* Credential level selector */
    const credSelect = document.getElementById("emp-cred-level");
    credSelect.innerHTML = CREDENTIAL_LEVELS.map(l => `<option>${l.name}</option>`).join("");
}

/* =============================================================================
   13b) REPORTING MANAGER ID  (read-only mirror of the Reports To field)
   ===========================================================================*/
/* Reads the selected manager and shows his company Employee ID (the short
   company ID, e.g. "00609") in the Reporting Manager ID field. Returns that
   company ID (or ""). The full AMS ID stays in the hidden select value and is
   what actually gets saved. */
function onManagerChange() {
    const amsId = document.getElementById("f-manager").value || "";
    const idField = document.getElementById("f-manager-id");
    if (!amsId) { idField.value = ""; return ""; }
    const manager = findEmployee(amsId);
    idField.value = manager && manager.empId ? manager.empId : "";
    return idField.value;
}

/* =============================================================================
   13c) QUICK-ADD  (+ button next to Department / Designation)
   ===========================================================================*/
/* Toggles a quick-add popover and closes the others */
function toggleQuickAddPopover(id) {
    ["qa-popover-dept", "qa-popover-desig"].forEach(pid => {
        const el = document.getElementById(pid);
        if (!el) return;
        el.classList.toggle("open", pid === id && !el.classList.contains("open"));
    });
}

function closeQuickAddPopovers() {
    ["qa-popover-dept", "qa-popover-desig"].forEach(pid => {
        const el = document.getElementById(pid);
        if (el) el.classList.remove("open");
    });
}

/* Adds a brand-new department from the popover.
   Uses the shared amsEnsureDepartment() helper so the department lands in BOTH
   master sources (Employee form + Department Master) and persists to SQL. */
function saveQuickAddDept() {
    const name = document.getElementById("qa-dept-name").value.trim();
    const short = document.getElementById("qa-dept-short").value.trim().toUpperCase();
    if (!name || !short) {
        alert("Enter both the department name and its shortform (e.g. EL).");
        return;
    }
    if (amsDeptKnown(name)) {
        alert("That department already exists.");
        return;
    }
    amsEnsureDepartment(name, short); /* -> DEPARTMENTS + AMS_DUMMY_DEPARTMENTS */
    populateSelects();
    document.getElementById("f-dept").value = name;
    document.getElementById("qa-dept-name").value = "";
    document.getElementById("qa-dept-short").value = "";
    closeQuickAddPopovers();
    onDeptChange();
}

/* Adds a brand-new designation from the popover.
   Uses the shared amsEnsureDesignation() helper so it lands in BOTH master
   sources and persists to SQL. */
function saveQuickAddDesig() {
    const name = document.getElementById("qa-desig-name").value.trim();
    if (!name) {
        alert("Enter the new designation name.");
        return;
    }
    if (amsDesigKnown(name)) {
        alert("That designation already exists.");
        return;
    }
    amsEnsureDesignation(name); /* -> DESIGNATIONS + AMS_DESIGNATION_OPTIONS */
    populateSelects();
    document.getElementById("f-desig").value = name;
    document.getElementById("qa-desig-name").value = "";
    closeQuickAddPopovers();
}

/* =============================================================================
   13d) CSV : TEMPLATE / IMPORT / EXPORT
   ---------------------------------------------------------------------------
   Headers mirror the Add Employee form exactly - a single "name" column for
   the full name (First Middle Last, exactly as typed), plus Reports To
   (manager) and the Manager ID (the manager's AMS ID, auto-filled on the
   form). Required form fields carry a * marker so the template/export clearly
   highlight what must be supplied.
   ===========================================================================*/
const EMP_CSV_HEADERS = ["empId*", "name*", "dept*", "designation*", "reportsTo", "managerId", "contact", "email", "status"];

function amsDownloadEmployeeTemplate() {
    if (typeof XLSX === "undefined") {
        alert("Excel export library not loaded. Check js/vendor/xlsx.full.min.js is present.");
        return;
    }
    const instructionRows = [
        ["Employee Master Import Template - Instructions"],
        ["Fields marked with * are required: empId, name, dept, designation."],
        ["AMS Employee ID is auto-generated - do not add it here. empId is the company ID (must be unique)."],
        ["name = the employee's FULL NAME in one column, e.g. Ravikumar Rajendra Tiparadi."],
        ["dept must match a Department in the Department Master. designation is auto-created if new."],
        ["reportsTo = the manager's full name (or company Employee ID / AMS ID). managerId = the manager's AMS ID (auto-filled on the form)."],
        ["The reporting manager's name and ID are saved AS IS - the manager does not have to exist in the system yet. The link is filled in automatically once that manager is added."],
        ["status = Active or Inactive (default Active)."],
    ];
    const sample = ["EMP-000001", "Example Employee", "IT", "Engineer", "", "", "+91 99999 99999", "example@company.com", "Active"];
    const wb = XLSX.utils.book_new();
    const instr = XLSX.utils.aoa_to_sheet(instructionRows);
    instr["!cols"] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(wb, instr, "Instructions");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([EMP_CSV_HEADERS, sample]), "Template");
    XLSX.writeFile(wb, "Employee_Master_import_template.xlsx");
}

function amsExportEmployees() {
    const rows = getFilteredEmployees().map(e => {
        const mgr = e.managerAmsId ? findEmployee(e.managerAmsId) : null;
        return [
            e.empId, getEmployeeFullName(e), e.department, e.designation,
            e.managerName || (mgr ? mgr.empId : ""), e.managerId || (mgr ? mgr.amsId : ""),
            e.contact || "", e.email || "", e.status,
        ];
    });
    amsExportXlsx("Employee_Master_export", EMP_CSV_HEADERS, rows);
}

function amsShowEmpImportSummary(results) {
    const banner = document.getElementById("emp-import-banner");
    if (banner) {
        banner.style.display = "block";
        const added = results.filter(r => r.result === "added").length;
        const updated = results.filter(r => r.result === "updated").length;
        const skipped = results.filter(r => r.result === "skipped").length;
        const errors = results.filter(r => r.result === "error").length;
        banner.textContent =
            `Import complete: ${added} added, ${updated} updated, ${skipped} skipped, ${errors} error(s). ` +
            `Skipped/error reasons are listed in the report.`;
    }
    amsShowImportReport(results);
}

function amsImportEmployeesFile(file) {
    amsReadImportRows(file).then((rows) => {
        rows = rows.filter(r => !(r[0] || "").trim().startsWith("#")); /* drop instruction/comment lines */
        if (!rows.length) { alert("File is empty or unreadable."); return; }
        const headers = rows[0].map(h => h.trim().replace(/\*$/, "")); /* strip the required-marker * */

        const results = [];
        const seenEmpIds = new Set(); /* in-file duplicate detection */
        const pendingManagerRefs = []; /* {emp, ref} rows whose manager was not found yet */

        /* ---- PASS 1: validate + add every employee. The reporting manager's
                name and ID are stored AS IS (verbatim) - the manager does NOT
                have to exist in the system yet. If the manager is found, the
                managerAmsId link is set immediately; otherwise it is remembered
                so amsResolvePendingManagers() auto-links it once that employee
                is added (same file PASS 2, or on a later day). ---- */
        for (let i = 1; i < rows.length; i++) {
            const raw = rows[i];
            if (!raw.length || raw.every(c => !c)) continue;
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = raw[idx] !== undefined ? raw[idx].trim() : ""; });
            const line = i + 1;

            const record = obj.empId || obj.name || obj.firstName || "(unnamed)";

            /* ---- Required-field validation (same set as the Add form) ---- */
            const missing = ["empId", "name", "dept", "designation"]
                .filter(k => !obj[k]);
            if (missing.length) {
                results.push({ row: line, record, result: "error", reason: "Missing required field(s): " + missing.join(", ") });
                continue;
            }

            /* ---- Employee ID must be unique (against the system + this file) ---- */
            if (seenEmpIds.has(obj.empId.toLowerCase())) {
                results.push({ row: line, record, result: "error", reason: `Duplicate empId "${obj.empId}" already used earlier in this file` });
                continue;
            }
            seenEmpIds.add(obj.empId.toLowerCase());

            const empIdExists = DUMMY_EMPLOYEES.some(emp => emp.empId.toLowerCase() === obj.empId.toLowerCase());
            if (empIdExists) {
                results.push({ row: line, record, result: "error", reason: `Employee ID "${obj.empId}" already exists in the system (use Edit to update)` });
                continue;
            }

            /* ---- Reference validation (checks BOTH the hardcoded seeds AND the
                    DB-backed masters so lookups added in either place import) ---- */
            if (!amsDeptKnown(obj.dept)) {
                results.push({ row: line, record, result: "skipped", reason: `Department "${obj.dept}" not found in the Department Master`, missingDept: obj.dept });
                continue;
            }
            if (obj.designation && !amsDesigKnown(obj.designation)) {
                results.push({ row: line, record, result: "skipped", reason: `Designation "${obj.designation}" not found in the Designation Master`, missingDesig: obj.designation });
                continue;
            }

            /* ---- Reporting manager: saved AS IS (name + ID verbatim) ----
               The manager does not need to exist. We still try to resolve the
               AMS ID so the link works immediately when the manager is in the
               system (by empId, AMS ID, or full name). */
            const managerRef = (obj.reportsTo && obj.reportsTo.trim()) || (obj.managerId && obj.managerId.trim()) || "";
            const manager = managerRef ? findEmployeeAny(managerRef) : null;

            /* ---- Create the employee ---- */
            const status = obj.status === "Inactive" ? "Inactive" : "Active";
            const emp = addEmployee({
                empId: obj.empId,
                name: obj.name,
                department: obj.dept, designation: obj.designation,
                contact: obj.contact || "", email: obj.email || "",
                managerAmsId: manager ? manager.amsId : null,
                managerName: (obj.reportsTo && obj.reportsTo.trim()) || (manager ? getEmployeeFullName(manager) : ""),
                managerId: (obj.managerId && obj.managerId.trim()) || (manager ? manager.empId : ""),
            });
            if (emp && status === "Inactive") emp.status = status;

            if (managerRef && !manager) {
                /* Manager not in the system yet - keep the raw reference and
                   defer the link instead of skipping the employee. */
                if (emp) emp.pendingManagerRef = managerRef;
                pendingManagerRefs.push({ ref: managerRef, empId: obj.empId });
                results.push({ row: line, record, result: "added", reason: `Added (manager "${managerRef}" saved as-is - will link automatically once that manager is added)` });
            } else {
                results.push({ row: line, record, result: "added", reason: status === "Inactive" ? "Added (Inactive)" : "Added" });
            }
        }

        /* ---- PASS 2: now every employee from the file exists, so link any
                manager that appeared LATER in the same file ---- */
        let linked = 0;
        pendingManagerRefs.forEach(({ ref, empId }) => {
            const emp = DUMMY_EMPLOYEES.find(x => x.empId.toLowerCase() === empId.toLowerCase());
            if (!emp || emp.managerAmsId) return;
            const mgr = findEmployeeAny(ref);
            if (mgr && mgr.amsId !== emp.amsId) {
                emp.managerAmsId = mgr.amsId;
                delete emp.pendingManagerRef;
                linked++;
                const row = results.find(r => r.record === empId);
                if (row) row.reason = `Added (manager "${ref}" linked)` + (emp.status === "Inactive" ? " - Inactive" : "");
            }
        });
        if (linked) amsDbSaveAsync("employees");

        /* Auto-link any employees who were waiting for a manager in this file */
        amsResolvePendingManagers();

        populateSelects();
        renderEmployeeTable();
        renderEmpStats();
        amsShowEmpImportSummary(results);
        document.getElementById("emp-import-file").value = "";
    }).catch((err) => {
        alert("Could not read import file: " + (err && err.message ? err.message : err));
    });
}

/* Initialises the whole page */
async function initEmployees() {
    if (typeof amsDbEnsureLoaded === "function") await amsDbEnsureLoaded();
    amsResolvePendingManagers();
    amsSortRegisterRenderer("employeeTable", renderEmployeeTable);
    populateSelects();
    renderEmpStats();
    renderEmployeeTable();

    /* Toolbar events */
    document.getElementById("emp-search").addEventListener("input", renderEmployeeTable);
    document.getElementById("emp-dept-filter").addEventListener("change", renderEmployeeTable);
    document.getElementById("emp-status-filter").addEventListener("change", renderEmployeeTable);
    document.getElementById("emp-cred-level").addEventListener("change", onCredentialChange);
    document.getElementById("emp-add-btn").addEventListener("click", openAddModal);

    /* Employee form events */
    document.getElementById("f-dept").addEventListener("change", onDeptChange);
    document.getElementById("f-manager").addEventListener("change", onManagerChange);
    document.getElementById("employee-save").addEventListener("click", saveEmployee);

    /* Quick-add (+ next to Department / Designation) */
    document.getElementById("qa-dept-btn").addEventListener("click", () => toggleQuickAddPopover("qa-popover-dept"));
    document.getElementById("qa-dept-cancel").addEventListener("click", closeQuickAddPopovers);
    document.getElementById("qa-dept-save").addEventListener("click", saveQuickAddDept);
    document.getElementById("qa-desig-btn").addEventListener("click", () => toggleQuickAddPopover("qa-popover-desig"));
    document.getElementById("qa-desig-cancel").addEventListener("click", closeQuickAddPopovers);
    document.getElementById("qa-desig-save").addEventListener("click", saveQuickAddDesig);

    /* CSV toolbar: Template / Import / Export */
    document.getElementById("emp-template-btn").addEventListener("click", amsDownloadEmployeeTemplate);
    document.getElementById("emp-export-btn").addEventListener("click", amsExportEmployees);
    document.getElementById("emp-import-btn").addEventListener("click", () => document.getElementById("emp-import-file").click());
    document.getElementById("emp-import-file").addEventListener("change", (e) => {
        if (e.target.files[0]) amsImportEmployeesFile(e.target.files[0]);
    });

    /* Detail report download (View profile modal) */
    document.getElementById("btnEmpViewCsv").addEventListener("click", amsDownloadEmployeeView);

    /* Assign / reassign events */
    document.getElementById("assign-confirm").addEventListener("click", confirmAssign);
    document.getElementById("reassign-confirm").addEventListener("click", confirmReassign);

    /* Exit events */
    document.getElementById("exit-confirm").addEventListener("click", confirmExit);

    /* Close buttons inside modals */
    document.querySelectorAll(".modal [data-close]").forEach(btn => {
        btn.addEventListener("click", hideCurrentModal);
    });

    /* Clicking the dark overlay closes the modal */
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) hideModal(overlay.id);
        });
    });
}

/*------------------------------------------------------------------------------
#-------------- End of the code : EMPLOYEE MASTER PAGE LOGIC -------------------
#------------------------------------------------------------------------------*/
