/*==============================================================================
#-------------- Start Code for : MASTER CONFIG REGISTRY (master-configs.js) ----
#
#  PURPOSE   : Each lookup master (Asset Type, Asset Make, Asset Category,
#              Site, Department, Designation) is defined here as a small
#              config object. The generic engine (js/master-table.js) turns
#              any one of these into a full CRUD page automatically.
#
#  HOW IT WORKS :
#    - pages/masters.html reads the "type" query parameter, looks it up in
#      AMS_MASTER_CONFIGS below, assigns it to the global AMS_MASTER_CONFIG,
#      and then master-table.js does the rest.
#    - To add a new master: add one entry here + one sidebar link in layout.js.
#
#  CONFIG SHAPE (see master-table.js for the full documentation) :
#    {
#      pageTitle, pageSub, dataArray, idKey,
#      fields: [ { key, label, required?, upper?, maxLength?, type? } ],
#      usageCount: (item) => number of records using this value
#    }
#------------------------------------------------------------------------------*/

/* ---- Registry: master type (query string) -> config ------------------------ */
const AMS_MASTER_CONFIGS = {
    "asset-type": {
        pageTitle: "Asset Type Master",
        pageSub: "Manage asset types and their shortform codes used in Smart Asset IDs",
        dataArray: AMS_DUMMY_ASSET_TYPES,
        idKey: "name",
        fields: [
            { key: "name",      label: "Asset Type Name",          required: true },
            { key: "shortform", label: "Shortform (for Asset ID)", required: true, upper: true, maxLength: 4 },
        ],
    },

    "asset-make": {
        pageTitle: "Asset Make Master",
        pageSub: "Manage brands / makes available when adding an asset",
        dataArray: AMS_DUMMY_ASSET_MAKES,
        idKey: "name",
        fields: [
            { key: "name", label: "Make Name", required: true },
        ],
    },

    "asset-category": {
        pageTitle: "Asset Category Master",
        pageSub: "Broader grouping of assets (e.g. IT Hardware, Vehicle)",
        dataArray: AMS_DUMMY_ASSET_CATEGORIES,
        idKey: "name",
        fields: [
            { key: "name", label: "Category Name", required: true },
        ],
        /* Blocks delete while any asset uses this category */
        usageCount: (item) => DUMMY_ASSETS.filter(a => a.category === item.name).length,
    },

    "site": {
        pageTitle: "Site Master",
        pageSub: "Manage locations / sites and their shortform codes for Smart Asset IDs",
        dataArray: AMS_DUMMY_SITES,
        idKey: "name",
        fields: [
            { key: "name",      label: "Site Name",   required: true },
            { key: "shortform", label: "Shortform (for Asset ID)", required: true, upper: true, maxLength: 4 },
            { key: "address",   label: "Address" },
        ],
    },

    "department": {
        pageTitle: "Department Master",
        pageSub: "Manage departments and the shortform used inside AMS Employee IDs",
        dataArray: AMS_DUMMY_DEPARTMENTS,
        idKey: "name",
        fields: [
            { key: "name",      label: "Department Name", required: true },
            { key: "shortform", label: "Shortform (for Employee ID)", required: true, upper: true, maxLength: 4 },
        ],
        /* Blocks delete while any employee belongs to this department */
        usageCount: (item) => DUMMY_EMPLOYEES.filter(e => e.department === item.name).length,
    },

    "designation": {
        pageTitle: "Designation Master",
        pageSub: "Manage employee designations used in the Employee Master dropdown",
        dataArray: AMS_DESIGNATION_OPTIONS,
        idKey: "name",
        fields: [
            { key: "name", label: "Designation Name", required: true },
        ],
        /* Blocks delete while any employee holds this designation */
        usageCount: (item) => DUMMY_EMPLOYEES.filter(e => e.designation === item.name).length,
    },
};

/* ---- Resolve the active config from the "type" query parameter ------------- */
function amsResolveMasterConfig() {
    const type = new URLSearchParams(location.search).get("type") || "asset-type";
    return AMS_MASTER_CONFIGS[type] || AMS_MASTER_CONFIGS["asset-type"];
}

/*------------------------------------------------------------------------------
#-------------- End of the code : MASTER CONFIG REGISTRY ----------------------
#------------------------------------------------------------------------------*/
