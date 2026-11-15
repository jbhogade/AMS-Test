# Graphite Teal appearance (AMS-Test)

Port AMS-Test-2's Graphite Teal look onto AMS-Test using approach A: keep AMS-Test HTML/JS class names, remap tokens, restyle the existing shell. AMS-v4-0 is out of scope.

Source of visual truth: `https://github.com/jbhogade/AMS-Test-2` (`static/css/ams.css`, settings theme list).

## Goal

AMS-Test should look and feel like AMS-Test-2: dark navy sidebar, light content, teal accent, Inter, 14px cards, nine palettes. Apple / macOS / iOS / iPadOS surface styles are removed. Features, IDs, print layouts, and the money-parse work stay unchanged.

## Approach

Token remap + restyle existing shell. Do not copy Django templates, htmx, or Test-2 class names (`.shell`, `.kpi`, `table.ams`, `.btn.primary`). Keep `.app`, `.sidebar`, `.topbar`, `.kpi-card`, `.btn`, `.table`, `.card`, `.modal`.

## Palettes

Default theme id: `graphite` (Graphite Teal). Nine ids, matching Test-2:

| id | Label | Kind |
|---|---|---|
| graphite | Graphite Teal | dark sidebar + light content (default) |
| midnight | Midnight | dark |
| slate-blue | Slate Blue | dark |
| forest | Forest | dark |
| plum | Plum | dark |
| gold | Dark Gold | dark |
| ice | Ice | light |
| paper | Paper | light |
| contrast | Contrast | dark |

`ice` is the Test-2 light cool-blue theme, not the current AMS-Test dark ice. `paper` is the Test-2 warm light theme.

Color values come from Test-2 `ams.css` (`:root` = graphite; `[data-theme="..."]` for the rest). Map them onto AMS-Test variable names so existing page CSS keeps working:

| AMS-Test variable | Test-2 source |
|---|---|
| `--bg-body` | `--bg-app` |
| `--bg-sidebar` | `--sidebar-bg` (may be a gradient) |
| `--bg-card` | `--bg-card` |
| `--bg-elevated` | `--bg-inset` |
| `--bg-input` | `--input-bg` |
| `--text-primary` | `--text` |
| `--text-secondary` / `--text-muted` | `--muted` |
| `--border` | `--border` |
| `--accent` | `--accent` |
| `--accent-hover` | `--accent-2` |
| `--accent-soft` | `--accent-soft` |
| `--accent-contrast` | `--accent-ink` |
| `--success` / `--warning` / `--danger` / `--info` | `--ok` / `--warn` / `--danger` / `--info` |
| `--shadow` | `--shadow` |

Also set on each theme (new, used by restyled shell): `--accent-2`, `--accent-ink`, `--sidebar-bg`, `--sidebar-text`, `--sidebar-active`, `--sidebar-sec`, `--topbar-bg`, `--radius` (14px), `--radius-sm` (10px), `--shadow-sm`, `--border-strong`.

## Aliases

`THEME_ALIASES` in `js/theme.js` must map old saved names so existing users land on the new set:

- `dark-grey` → `graphite`
- `lite` → `paper`
- `purple` → `plum`
- `dark-gold` → `gold`
- keep existing unused aliases pointing at a valid new id (e.g. `teal` → `ice`, `emerald` → `forest`, `violet` → `plum`)

Unknown names fall back to `graphite`. Default constant: `DEFAULT_THEME = "graphite"`. Theme still saved per signed-in user in `ams-theme-by-user`. Font size stays `data-font-size` sm / md / lg via existing helpers.

## Files

- Rewrite `css/themes.css` with the nine palettes and aliases documented above.
- Restyle shell/components in `css/main.css` and `css/dashboard.css` (and login rules in `css/main.css` or `login.html` styles) to match Test-2: 236px sticky gradient sidebar, frosted topbar, 14px cards, KPI icon + blur orb, accent→accent-2 bars, 9px buttons with gradient primary, uppercase muted table headers, hover `--accent-soft`.
- Add Inter woff2 (400/500/600/700/800) under `css/fonts/` and `@font-face` in `css/themes.css`. Body font: Inter, then system fallbacks.
- `js/theme.js`: new `THEMES` list; `DEFAULT_THEME = "graphite"`; aliases; remove `UI_STYLES`, `applyUiStyle`, `buildStyleMenu`, `data-ui-style`.
- `js/layout.js`: remove `#style-select` and `buildStyleMenu`. Keep `#theme-select`.
- `js/login.js` and `login.html`: graphite default; remove Style select; keep Theme select.
- `js/settings.js` and `pages/settings.html`: Appearance = 9-theme gallery + font size. Remove Style gallery (`#styleGallery`).
- Remove `css/ui-styles.css` `<link>` from every HTML page. Do not delete `css/ui-styles.css` in this slice. Strip `data-ui-style` from `<html>` tags; default `data-theme="graphite"`.
- Cache-bust `themes.css` / `main.css` / `theme.js` query strings on pages that already version them.

Do not rewrite page class names. Do not change print CSS (`css/label-pass-print.css`, print docs). Do not change AMS-v4-0.

## Shell details

- Sidebar ~236px, sticky, `overflow-y: auto`, gradient `--sidebar-bg`, muted nav, 9px rounded links, teal left bar on `.sidebar-link.active`, brand glyph with accent gradient.
- Topbar sticky, `--topbar-bg` + blur, theme dropdown only.
- Content padding ~20–22px. Cards 14px radius, `--shadow-sm`.
- Primary buttons: linear-gradient(accent, accent-2), text `--accent-ink`.
- Login: same Graphite language; no Style dropdown.

## Out of scope

- AMS-v4-0
- Django / htmx / Test-2 templates
- Print layouts and print CSS
- Feature, ID, or money-parse changes
- Deleting `css/ui-styles.css` from git if other docs still mention it (links off pages is enough)

## Checks

- Login and dashboard render in graphite (dark sidebar, light content, teal accent, Inter).
- All nine themes switch from the topbar and Settings gallery.
- Saved `dark-grey` / `lite` / `purple` / `dark-gold` resolve via aliases.
- No Style dropdown or Style gallery.
- Tables, modals, KPIs, forms still work.
- Label / Gate Pass print layout unchanged.
