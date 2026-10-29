# AMS-Test Apple UI Style — Design

Date: 2026-10-27

## Goal

Add an optional **Apple** Appearance Style on AMS-Test only. Default stays
**Plain**. Operators can mix any of the nine color themes with Plain or Apple.
Apple is CSS chrome only. Layout, tables, forms, print, SQL, and APIs do not
change.

This replaces the earlier always-on Apple chrome restyle that was reverted.

## Decisions

- **Approach A**: one Style named Apple (`data-ui-style="apple"`), not separate
  macOS and iOS styles. Desktop uses a macOS-like quiet chrome; narrow
  viewports use iOS/iPadOS spacing and 44px tap targets.
- **Optional, not default**: HTML stays `data-ui-style="plain"`. `applyTheme`
  must stop forcing Plain.
- **Picker**: Style dropdown in the topbar next to Theme, and the same choice
  on Settings > Appearance.
- **Persistence**: per signed-in username, same pattern as Theme.
  Keys: `ams-ui-style-by-user` and shared `ams-ui-style` on the login page.
  Invalid or missing values fall back to `plain`.
- **Nine themes unchanged**: Apple uses existing `--bg-*`, `--text-*`,
  `--border`, `--accent`, `--shadow` tokens. No new palettes.
- **Tables and forms**: grid structure, filter row, and field layout stay.
  Style only changes font, radius, shadow, surface fill, and (on Apple) light
  blur on selected chrome.
- **Quick-add popovers stay opaque**: `.quickadd-popover` keeps solid
  `--bg-elevated`.
- **Reduced transparency**: `@media (prefers-reduced-transparency: reduce)`
  drops `backdrop-filter` and uses solid `--bg-card` / `--bg-sidebar`.
- **AMS-Test only**. Do not change AMS-v4-0.

## Constraints

- No SQL, API, JWT, or User Master Site work in this slice.
- No sidebar/topbar rebuild, no iOS tab bar, no Bento/Spatial layout.
- Print CSS stays as it is.
- Comment-block conventions stay. Theme-variable CSS only.
- Do not re-enable the old multi-style set (liquid-glass, clay, neo, etc.).
  Only Plain and Apple.

## Layout of changes

```
docs/superpowers/specs/2026-10-27-apple-ui-style-design.md
js/theme.js                 restore Style API: Plain + Apple; per-user save
js/layout.js                #style-select next to #theme-select
pages/settings.html         Style card on Appearance
js/settings.js              renderStyleGallery / markSelectedStyle
css/ui-styles.css           keep Plain solid rules; add [data-ui-style="apple"]
css/settings.css            style-grid cards if missing
login.html                  Style dropdown next to Theme (same compact select)
docs/CHANGELOG.md           operator note
README.md / docs/README.md  Style = Plain (default) or Apple
```

HTML `data-ui-style="plain"` on every page stays as the default attribute.
No mass HTML rewrite.

## Components

### Switcher (`js/theme.js`)

Restore a real Style API. `applyTheme` sets `data-theme` only.

- `UI_STYLES`: `{ name: "plain", label: "Plain" }`, `{ name: "apple", label: "Apple" }`.
- `DEFAULT_UI_STYLE = "plain"`.
- `applyUiStyle(name)` sets `data-ui-style`, writes storage, syncs every
  `#style-select`.
- `loadSavedUiStyle()` uses per-user map when signed in, else `ams-ui-style`.
- `buildStyleMenu(selectId)` fills options and listens for `change`.
- `initTheme()` applies saved theme then saved style.

Unknown stored names (old `glass`, `liquid-glass`, `default`) map to `plain`.

### Topbar (`js/layout.js`)

After `#theme-select`, add
`<select id="style-select" aria-label="Style">` and call
`buildStyleMenu("style-select")`. Compact sizing matches Theme.

### Login

Login already has a Theme select. Add a Style select beside it so Apple
can be previewed before sign-in. Login uses the shared `ams-ui-style`
key until a session exists.

### Settings Appearance

Keep the Theme gallery. Add a **Style** card (Plain / Apple) with a one-line
hint. Click applies the style, marks selected, toasts. Topbar and gallery
stay in sync through `applyUiStyle`.

### CSS (`css/ui-styles.css`)

**Plain** (current): solid `--bg-card` / `--bg-sidebar`, no blur, no lattice.

**Apple** (`html[data-ui-style="apple"]`):

| Surface | Treatment |
| --- | --- |
| `body` | Font stack `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif` |
| `.sidebar`, `.topbar`, menus, `.modal`, `.login-card` | Light `backdrop-filter` (about 12px), semi-opaque fill from theme tokens, 12–16px radius |
| `.card`, `.kpi-card` | Mostly solid `--bg-card`, 12px radius, quieter shadow |
| `.btn` | 10–12px radius; `.btn-primary` pill (`border-radius: 999px`) |
| inputs / `.select` | Slightly taller, 10px radius |
| tables | Unchanged structure; header uses `--bg-elevated` |
| `@media (max-width: 768px)` | More padding; buttons/inputs min-height 44px |

`.btn-primary` keeps `--accent` fill.

## Data flow

1. Page load: `initTheme()` -> saved theme + saved style.
2. Operator changes Style: `applyUiStyle` updates `<html>`, storage, every
   Style select / gallery.
3. Sign-in: Theme and Style load from that username's maps.
4. Reset Demo Data: clear `ams-ui-style` and `ams-ui-style-by-user` if that
   helper already clears theme keys.

## Out of scope

- AMS-v4-0
- Always-on Apple
- Separate macOS vs iOS Style names
- New navigation chrome or mobile tab bar
- Changing default theme (stays Dark Grey)
- Site filtering (User Master Step 2)

## Success

- Fresh load is Plain + Dark Grey.
- Choosing Apple restyles chrome without moving page controls.
- Choosing Plain restores the current look.
- Hard-refresh keeps the last Style for that user.
- After deploy, bump cache-bust on `theme.js` and `ui-styles.css` (for
  example `?v=t9` -> `?v=t9a`) and hard-refresh (Ctrl+F5).
