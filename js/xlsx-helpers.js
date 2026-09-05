/*==============================================================================
#-------------- Start Code for : REAL XLSX HELPERS (xlsx-helpers.js) -----------
#
#  PURPOSE   : Native .xlsx support for every Import / Export / Template flow in
#              the app, powered by the vendored SheetJS build
#              (js/vendor/xlsx.full.min.js). Replaces the old "HTML table as
#              .xls" trick and CSV-only imports.
#
#  EXPORT    : amsExportXlsx(filename, headers, rows)  -> downloads .xlsx
#              amsExportTableToXlsx(filename, tableEl)  -> DOM table -> .xlsx
#  IMPORT    : amsReadImportRows(file) -> Promise<2D array of strings>, the same
#              shape amsParseCsv() produces, so every existing import handler
#              works for BOTH .csv and .xlsx with a one-line change.
#------------------------------------------------------------------------------*/

/* Downloads a real .xlsx workbook from column headers + 2D row array. */
function amsExportXlsx(filename, headers, rows) {
    if (typeof XLSX === "undefined") {
        alert("Excel export library not loaded. Check js/vendor/xlsx.full.min.js is present.");
        return;
    }
    const ws = XLSX.utils.aoa_to_sheet([headers].concat(rows || []));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

/* Exports a rendered DOM <table> as a real .xlsx workbook. */
function amsExportTableToXlsx(filename, tableEl) {
    const rows = [...tableEl.querySelectorAll("tr")].map(tr => [...tr.children].map(cell => cell.textContent.trim()));
    if (!rows.length) return;
    amsExportXlsx(filename, rows[0], rows.slice(1));
}

/* Templates put an Instructions sheet first. Prefer "Template", then the first
   sheet that is not named Instructions, then sheet 0. */
function amsPickImportSheet(wb) {
    const names = wb.SheetNames || [];
    const preferred = names.find(n => /^template$/i.test(n))
        || names.find(n => !/^instructions?$/i.test(n))
        || names[0];
    return wb.Sheets[preferred];
}

/* Reads an uploaded file and resolves to a 2D array of strings (header row
   first), whether the file is CSV or Excel (.xlsx / legacy .xls). Empty rows
   are dropped, matching amsParseCsv() behaviour so downstream handlers that
   already expect an array-of-arrays can process both formats unchanged. */
function amsReadImportRows(file) {
    const lower = (file.name || "").toLowerCase();
    const isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls");

    if (isExcel) {
        return new Promise((resolve, reject) => {
            if (typeof XLSX === "undefined") {
                reject(new Error("Excel import library not loaded. Check js/vendor/xlsx.full.min.js is present."));
                return;
            }
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error);
            reader.onload = (e) => {
                try {
                    const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
                    const ws = amsPickImportSheet(wb);
                    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
                    const cleaned = aoa
                        .map(row => row.map(c => c == null ? "" : String(c)))
                        .filter(row => row.some(c => c.trim() !== ""));
                    resolve(cleaned);
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = (e) => resolve(amsParseCsv(String(e.target.result)));
        reader.readAsText(file);
    });
}
