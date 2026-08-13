/*==============================================================================
#-------------- Start Code for : ROLE ACCESS LOGIC (role-access.js) --------------
#
#  PURPOSE   : Powers Role Access Master - ported from v3-3
#              (role-access-master-v1-0.js) to the v4-0 data layer. Gated to
#              Supreme Root only via the "Viewing As" role simulator. Renders
#              a Role x Page checkbox matrix from AMS_PAGE_REGISTRY (pages +
#              report.* keys) and saves it through amsSaveRoleAccessDefaults()
#              (localStorage), which Access Rights Control Master's
#              amsResolveAllowedPages() then picks up for users with no
#              per-user override.
#
#  v4-0 ADAPTATIONS :
#    - Uses the shared amsEsc() from js/dummy-data.js (no local copy needed).
#    - Badge var names use the v4-0 theme tokens (--border/--bg-elevated).
#    - Role options come from AMS_USER_ROLES and stay in sync with the shared
#      topbar selector via amsGet/SetViewingAsRole.
#------------------------------------------------------------------------------*/

/*-------------- Start Code for GATE: SUPREME ROOT ONLY -------------------------*/
/* Pages whose access is enforced purely by the simulated role itself - their
   checkboxes are shown for transparency but locked, since toggling them here
   wouldn't actually change anything. */
const RAM_LOCKED_KEYS = {
    accessRights: "Always Supreme Root only",
    roleAccess: "Always Supreme Root only",
    log: "Always Super Root + Supreme Root only",
};

function amsIsSupremeRootRAM() {
    return amsGetViewingAsRole() === "Supreme Root";
}

function amsApplyRoleAccessGate() {
    const unlocked = amsIsSupremeRootRAM();
    document.getElementById("unlockedView").style.display = unlocked ? "block" : "none";
    document.getElementById("lockedView").style.display = unlocked ? "none" : "block";
    if (unlocked) renderRoleAccessTable();
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for RENDER MATRIX ------------------------------------*/
function renderRoleAccessTable() {
    const map = amsGetRoleAccessDefaults();
    const pages = AMS_PAGE_REGISTRY.filter(p => !p.key.startsWith("report."));
    const reports = AMS_PAGE_REGISTRY.filter(p => p.key.startsWith("report."));

    const rowHtml = (p) => {
        const locked = RAM_LOCKED_KEYS[p.key];
        const cells = AMS_USER_ROLES.map(role => {
            const checked = map[role] && map[role][p.key] !== false;
            return `<td><input type="checkbox" class="ram-check ${locked ? "ram-locked-check" : ""}"
                data-role="${amsEsc(role)}" data-page="${p.key}" ${checked ? "checked" : ""} ${locked ? "disabled" : ""}></td>`;
        }).join("");
        return `<tr>
            <td><div class="ram-page-label">${amsEsc(p.label.split(" (")[0])}${locked ? `<span class="ram-page-note">${locked}</span>` : ""}</div></td>
            ${cells}
        </tr>`;
    };

    const sectionRow = (label) => `<tr class="ram-section-row"><td colspan="${AMS_USER_ROLES.length + 1}">${label}</td></tr>`;

    document.getElementById("roleAccessTable").innerHTML = `
        <thead><tr><th>Page</th>${AMS_USER_ROLES.map(r => `<th>${amsEsc(r)}</th>`).join("")}</tr></thead>
        <tbody>
            ${sectionRow("Pages")}
            ${pages.map(rowHtml).join("")}
            ${sectionRow("Reports (Report Master)")}
            ${reports.map(rowHtml).join("")}
        </tbody>`;
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for SAVE / RESET -------------------------------------*/
function amsCollectRoleAccessMap() {
    const map = {};
    AMS_USER_ROLES.forEach(role => { map[role] = {}; });
    document.querySelectorAll(".ram-check").forEach(cb => {
        if (cb.disabled) return; /* locked rows always resolve from the role/gate check itself, not this map */
        map[cb.getAttribute("data-role")][cb.getAttribute("data-page")] = cb.checked;
    });
    /* Locked keys still need SOME value stored so amsResolveAllowedPages() has
       something to read for non-Supreme-Root/Super-Root roles - carry over
       whatever the current defaults already say. */
    const existing = amsGetRoleAccessDefaults();
    Object.keys(RAM_LOCKED_KEYS).forEach(key => {
        AMS_USER_ROLES.forEach(role => {
            map[role][key] = existing[role] ? existing[role][key] : false;
        });
    });
    return map;
}

document.getElementById("btnSaveRoleDefaults").addEventListener("click", () => {
    amsSaveRoleAccessDefaults(amsCollectRoleAccessMap());
    amsNotify("Role Access Master: default page access saved", "success");
});

document.getElementById("btnResetRoleDefaults").addEventListener("click", () => {
    if (!confirm("Reset every role's default page access back to the suggested starting point? This does not affect any per-user overrides in Access Rights Control Master.")) return;
    amsSaveRoleAccessDefaults(amsDefaultRoleAccessMap());
    renderRoleAccessTable();
    amsNotify("Role Access Master: defaults reset", "info");
});
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for PAGE INIT ----------------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
    if (typeof initLayout === "function") initLayout("role-access");
    const roleInput = document.getElementById("viewingAsRole");
    if (roleInput) roleInput.value = amsGetViewingAsRole();
    (typeof amsDbEnsureLoaded === "function" ? amsDbEnsureLoaded() : Promise.resolve()).then(() => amsApplyRoleAccessGate());
});
/*-------------- End of the code ------------------------------------------------*/
/*==============================================================================
#-------------- End of the code : ROLE ACCESS LOGIC ------------------------------
#------------------------------------------------------------------------------*/
