/*==============================================================================
#-------------- Start Code for : SQL DATABASE BACKUP (sql-backup.js) ------------
#
#  PURPOSE   : Super Root / Supreme Root take a full SQL Server backup into
#              SQL-DB-Backup. Wired from System Administrator Master.
#------------------------------------------------------------------------------*/

function amsApplySqlBackupGate() {
    const allowed = false;
    const denied = document.getElementById("accessDeniedCard");
    const content = document.getElementById("sqlBackupContent");
    if (denied) denied.style.display = allowed ? "none" : "block";
    if (content) content.style.display = allowed ? "block" : "none";
    const hint = document.getElementById("viewingAsHint");
    if (hint) {
        hint.textContent = allowed
            ? "This role can take a full SQL database backup."
            : "This role cannot take a SQL database backup.";
    }
    return allowed;
}

function amsSqlBackupProgressSet(running, label, done) {
    const wrap = document.getElementById("sqlBackupProgressWrap");
    const bar = document.getElementById("sqlBackupProgress");
    const text = document.getElementById("sqlBackupProgressLabel");
    if (wrap) wrap.hidden = !running && !done;
    if (bar) {
        bar.classList.toggle("is-running", !!running);
        bar.classList.toggle("is-done", !!done);
    }
    if (text) text.textContent = label || "";
}

async function amsTakeSqlBackup() {
    const btn = document.getElementById("btnSqlBackup");
    const status = document.getElementById("sqlBackupStatus");
    if (!confirm("Take a full SQL database backup now? It will be saved in SQL-DB-Backup as AMS-Test-<date-time>.bak.")) return;
    if (btn) btn.disabled = true;
    if (status) status.textContent = "";
    amsSqlBackupProgressSet(true, "Backing up database...", false);
    try {
            const result = await amsApiFetch("/api/backup", { method: "POST" });
            const name = (result && result.fileName) ? result.fileName : "backup file";
            const extra = (result && result.note) ? " " + result.note : "";
            const packed = result && result.compressed === false ? " Uncompressed." : " Compressed.";
            amsSqlBackupProgressSet(false, "Backup complete.", true);
            if (status) status.textContent = "Saved " + name + " in SQL-DB-Backup." + packed + extra;
            if (typeof amsNotify === "function") amsNotify("SQL backup saved: " + name, "success");
    } catch (err) {
        const msg = (err && err.message) ? err.message : "SQL backup failed.";
        amsSqlBackupProgressSet(false, "Backup failed.", false);
        if (status) status.textContent = msg;
        if (typeof amsNotify === "function") amsNotify(msg, "error");
    } finally {
        if (btn) btn.disabled = false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (typeof initLayout === "function") initLayout("sql-backup");
    const roleInput = document.getElementById("viewingAsRole");
    if (roleInput && typeof amsGetViewingAsRole === "function") roleInput.value = amsGetViewingAsRole();
    const allowed = amsApplySqlBackupGate();
    const btn = document.getElementById("btnSqlBackup");
    if (btn && allowed) btn.addEventListener("click", amsTakeSqlBackup);
});

/*==============================================================================
#-------------- End of the code : SQL DATABASE BACKUP ---------------------------
#------------------------------------------------------------------------------*/
