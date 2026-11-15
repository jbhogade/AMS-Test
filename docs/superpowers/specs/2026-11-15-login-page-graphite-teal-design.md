# Login page Graphite Teal split (AMS-Test)

Restyle AMS-Test `login.html` to match AMS-Test-2's two-column login. Approach A: keep JWT auth, field IDs, and `js/login.js`. Do not copy Django/htmx. AMS-v4-0 is out of scope.

Source of visual truth: `https://github.com/jbhogade/AMS-Test-2` (`templates/login.html`, `static/css/ams.css` login block).

## Goal

Login should look like Test-2: dark hero on the left, sign-in card on the right, teal orbs, Inter. Sign-in still posts to AMS-API (`POST /api/auth/login`) and stores `ams_session`. Theme dropdown stays top-right. Graphite Teal palettes already in `css/themes.css` apply to the form side.

## Approach

Rewrite the login markup and CSS only. Keep `#login-form`, `#login-username`, `#login-password`, `#login-toggle-pass`, `#login-msg`, `#login-btn`, `#theme-select`. Keep `js/login.js` behavior (JWT, Show/Hide, theme init). Do not add Test-2 classes that fight the shell (`.btn.primary`); keep `.btn-login` / AMS-Test field classes.

## Layout

Two-column grid on `.login-wrap`: `1.1fr` hero + `1fr` form. Min-height 100vh.

### Left: `.login-hero`

- Background: `linear-gradient(160deg, #0b1220 0%, #10233b 55%, #0b3a3a 100%)` (fixed, not theme tokens; same as Test-2).
- Two blur orbs: teal `#0d9488` top-right, blue `#3b82f6` bottom-left.
- Brand: AM glyph (accent gradient, same language as sidebar logo) + "Asset Management" / "AMS-TEST".
- Headline: `Every asset, accounted for.`
- Blurb: AMS-TEST portal for assets, mobiles, SIM cards, consumables, spare parts and accessories.
- Three ticks: Smart Display IDs (base + site + department); Issue / Handover / Gate Pass printing; Role-gated pages with an audit trail.
- Text colors on the hero stay light (`#eaf2f6` / `#9db4c8` / `#c2d4e2`) so they read on the dark gradient in every theme.

### Right: `.login-form-side`

- Background: `var(--bg-body)` so graphite/paper/ice etc. tint the pane.
- Card max-width 400px, centered. Title "Sign in". Sub: ask administrator for credentials; this is the live AMS-TEST portal.
- Username, password + Show/Hide, `#login-msg`, full-width gradient Sign In button (existing `.btn-login`).
- Hint line under the form: SQL Server backed; no seeded passwords printed.

### Theme select

`#theme-select` stays, absolutely positioned top-right of `.login-wrap` (z-index above both columns). Writes shared `ams-theme` as today. No Style select.

### Responsive

`@media (max-width: 860px)`: single column; hide `.login-hero`; form-side fills the viewport; theme select remains top-right.

## Files

- Rewrite body of `login.html` to the split markup. Keep the HTML comment header (purpose, JWT, files used). Cache-bust CSS/JS (`?v=gt2` or next).
- Move login CSS out of the large inline `<style>` into `css/main.css` (login section at the end, gated with `html.login-page` so it never leaks). Inline block on `login.html` can shrink to nothing or a tiny override.
- `js/login.js`: no auth changes. Only touch if a new hero node would break an existing selector (it should not).
- Do not change print CSS, AMS-v4-0, or Django.

## Copy (AMS-TEST, not Django)

| Slot | Text |
|---|---|
| Brand name | Asset Management |
| Brand sub | AMS-TEST |
| Hero h1 | Every asset, accounted for. |
| Hero p | The Asset Management System portal for assets, mobiles, SIM cards, consumables, spare parts and accessories - with full lifecycle, prints and reports. |
| Ticks | Smart Display IDs (base + site + department); Issue / Handover / Gate Pass printing; Role-gated pages with an audit trail |
| Card h2 | Sign in |
| Card sub | Ask your administrator for credentials. This is the live AMS-TEST portal. |
| Hint | This is the live AMS-TEST portal (SQL Server backed). |

Do not mention Django. Do not print live passwords on the page.

## Out of scope

- Auth, JWT, field IDs, `amsRequireSession`
- AMS-v4-0
- Theme list / aliases (already Graphite Teal)
- Print layouts
- Deleting `css/ui-styles.css`

## Checks

- Login is two columns on desktop; hero hidden under 860px.
- Sign-in still uses `login.js` and the same IDs; invalid creds still set `#login-msg.error`.
- Theme dropdown still switches palettes on the form side; hero gradient stays dark.
- No Style dropdown. No Django strings.
- Graphite default: dark hero, light form pane, teal accent, Inter.
