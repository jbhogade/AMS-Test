/*==============================================================================
#-------------- Start Code for : THEME SWITCHER (theme.js) --------------------
#
#  PURPOSE   : Handles switching between the 11 themes defined in themes.css.
#
#  HOW IT WORKS :
#    - The chosen theme name is saved in localStorage so it survives
#      page refreshes and is remembered on the next visit.
#    - Switching applies the data-theme attribute to the <html> tag.
#
#  TO ADD A NEW THEME :
#    1. Add the [data-theme="name"] block in css/themes.css
#    2. Add { name: "...", label: "..." } to THEMES below
#    3. It will automatically appear in the dropdown menu.
#------------------------------------------------------------------------------*/

/* ---- Available themes (must match the blocks in themes.css) ---------------- */
const THEMES = [
    { name: "dark-grey",  label: "Dark Grey" },
    { name: "midnight",   label: "Midnight"  },
    { name: "slate-blue", label: "Slate Blue" },
    { name: "blue",       label: "Blue"      },
    { name: "lite",       label: "Lite"      },
    { name: "forest",     label: "Forest"    },
    { name: "purple",     label: "Purple"    },
    { name: "amber",      label: "Amber"     },
    { name: "violet",     label: "Violet"    },
    { name: "crimson",    label: "Crimson"   },
    { name: "contrast",   label: "Contrast"  }
];

const THEME_STORAGE_KEY = "ams-theme";   /* localStorage key that stores the theme */

/* ---- Default theme used on the very first visit ---------------------------- */
const DEFAULT_THEME = "dark-grey";

/* ---- Apply a theme by name -------------------------------------------------- */
function applyTheme(themeName) {
    document.documentElement.setAttribute("data-theme", themeName);
    localStorage.setItem(THEME_STORAGE_KEY, themeName);
}

/* ---- Load the saved theme, or fall back to the default ---------------------- */
function loadSavedTheme() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.some(t => t.name === saved) ? saved : DEFAULT_THEME;
}

/* ---- Build the theme dropdown menu options ---------------------------------- */
function buildThemeMenu(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    THEMES.forEach(theme => {
        const option = document.createElement("option");
        option.value = theme.name;
        option.textContent = theme.label;
        select.appendChild(option);
    });

    select.value = loadSavedTheme();

    /* Change theme when the user picks a new one from the dropdown */
    select.addEventListener("change", function () {
        applyTheme(this.value);
    });
}

/* ---- Initialise the theme system when the page loads ------------------------ */
function initTheme() {
    applyTheme(loadSavedTheme());
}

/*------------------------------------------------------------------------------
#-------------- End of the code : THEME SWITCHER ------------------------------
#------------------------------------------------------------------------------*/
