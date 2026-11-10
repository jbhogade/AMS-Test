/*==============================================================================
#-------------- Start Code for : LABEL/PASS PRINT MASTER (label-pass-print.js) --
#
#  PURPOSE   : Tab shell for Label/Pass Print Master. Display ID Number and
#              Gate Pass are placeholders in this slice. Picker, size,
#              material, and download come later.
#------------------------------------------------------------------------------*/

function amsWireLabelPassTabs() {
    document.querySelectorAll("[data-lpp-tab]").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll("[data-lpp-tab]").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".report-panel").forEach(p => p.classList.remove("active"));
            tab.classList.add("active");
            const panel = document.getElementById("panel-" + tab.getAttribute("data-lpp-tab"));
            if (panel) panel.classList.add("active");
        });
    });
}

async function initLabelPassPrint() {
    initLayout("label-pass-print");
    if (typeof amsDbEnsureLoaded === "function") await amsDbEnsureLoaded();
    if (typeof amsYieldToBrowser === "function") await amsYieldToBrowser();
    amsWireLabelPassTabs();
}

document.addEventListener("DOMContentLoaded", initLabelPassPrint);
/*-------------- End of the code ----------------------------------------------*/
/*==============================================================================
#-------------- End of the code : LABEL/PASS PRINT MASTER -----------------------
#------------------------------------------------------------------------------*/
