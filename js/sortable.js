/*==============================================================================
#-------------- Start Code for : SHARED SORTABLE TABLE HELPER (sortable.js) ----
#
#  PURPOSE   : Click-to-sort column headers for every record table in the app.
#              One shared, tiny engine so all pages get identical behaviour.
#
#  USAGE     : 1. Register the page's renderer:
#                  amsSortRegisterRenderer("assetTable", renderAssetTable);
#               2. Build the table header with amsSortableTh(tableId, key, label);
#               3. In the renderer, sort the row array before rendering:
#                  rows = amsSortRows("assetTable", rows, getterMap);
#              getterMap maps each sort key to a fn(row)->comparable value.
#
#  BEHAVIOUR : First click on a column sorts ascending; second click reverses;
#              clicking another column resets to ascending on that column.
#              Numeric getters compare numerically; everything else compares
#              case-insensitively with numeric-aware collation.
#------------------------------------------------------------------------------*/

/* ---- Per-table sort state: { key, dir } ----------------------------------- */
const AMS_SORT = {};
const AMS_SORT_RENDERERS = {};

function amsSortRegisterRenderer(tableId, renderer) {
    AMS_SORT_RENDERERS[tableId] = renderer;
}

/* Toggle sort state for a column and re-render the owning table. */
function amsSortToggle(tableId, key) {
    const st = AMS_SORT[tableId] || (AMS_SORT[tableId] = { key: null, dir: "asc" });
    if (st.key === key) {
        st.dir = st.dir === "asc" ? "desc" : "asc";
    } else {
        st.key = key;
        st.dir = "asc";
    }
    const renderer = AMS_SORT_RENDERERS[tableId];
    if (typeof renderer === "function") renderer();
}

/* Builds a clickable header cell for a sortable column. Optional htmlId is
   added to the <th> so pages can still target it by id (e.g. show/hide). */
function amsSortableTh(tableId, key, label, htmlId) {
    const st = AMS_SORT[tableId] || {};
    const active = st.key === key;
    const arrow = active ? (st.dir === "asc" ? " \u2191" : " \u2193") : " \u2195";
    const idAttr = htmlId ? ` id="${amsEsc(htmlId)}"` : "";
    return `<th${idAttr} class="sortable ${active ? "sort-active" : ""}" title="Sort by ${amsEsc(label)}" onclick="amsSortToggle('${amsEsc(tableId)}','${amsEsc(key)}')">${amsEsc(label)}<span class="sort-arrow">${arrow}</span></th>`;
}

/* Applies the table's current sort to a row array using a getter map. Null /
   undefined values always sort last regardless of direction. */
function amsSortRows(tableId, rows, getterMap) {
    const st = AMS_SORT[tableId];
    if (!st || !st.key || !getterMap[st.key]) return rows;
    const getter = getterMap[st.key];
    const dir = st.dir === "desc" ? -1 : 1;
    const sorted = rows.slice().sort((a, b) => {
        const va = getter(a);
        const vb = getter(b);
        const aNull = va == null || va === "";
        const bNull = vb == null || vb === "";
        if (aNull && bNull) return 0;
        if (aNull) return 1;
        if (bNull) return -1;
        const cmp = (typeof va === "number" && typeof vb === "number")
            ? va - vb
            : String(va).toLowerCase().localeCompare(String(vb).toLowerCase(), undefined, { numeric: true });
        return cmp * dir;
    });
    return sorted;
}

/* Resets any applied sort on a table (e.g. when its filter changes and the
   current column is meaningless). */
function amsSortReset(tableId) {
    delete AMS_SORT[tableId];
}
