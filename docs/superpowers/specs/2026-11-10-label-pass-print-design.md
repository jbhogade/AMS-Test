# Label/Pass Print Master

AMS-Test first. Port to AMS-v4-0 only after that is asked.

## Goal

Add a System Admin master named **Label/Pass Print Master**. This first slice ships the master shell and two options only: **Display ID Number** and **Gate Pass**. Admins can open the page and switch tabs. Item picker, label size, Gate Pass material, print, and download come in later slices.

## Placement and access

- New System Admin hub tab **Label/Pass Print Master** after Print Terms Master and before Access Rights Control Master.
- Dedicated page `pages/label-pass-print.html` (not the generic `masters.html` CRUD table).
- JS: `js/label-pass-print.js`. Reuse existing hub/embed CSS; add page CSS only if the tab strip needs it.
- Hub map: `AMS_ADMIN_TABS.labelPassPrint` -> `label-pass-print.html`.
- Page title in `js/layout.js`: `label-pass-print` -> "Label/Pass Print Master".
- Role Access key `labelPassPrint`: Admin / Super Root / Supreme Root = `full`; Standard User / Viewer = `none`.
- Add to `AMS_PAGE_REGISTRY` and `AMS_ROLE_ACCESS_RECOMMENDED`. Hub tab hidden when the signed-in user cannot access it.

## Page layout (this slice)

One page with two in-page tabs:

- **Display ID Number** (default)
- **Gate Pass**

Each tab shows a short placeholder only, for example:

- Display ID Number: "Label size and item picker come next."
- Gate Pass: "Gate Pass material and item picker come next."

Switching tabs does not save anything. No Asset/Mobile picker, no print, no download, no SQL collection in this slice.

## Later slices (not this slice)

1. Multi-select Assets (Laptop, Desktop, Printer, and other Asset Master records) and Mobiles.
2. User chooses Label size and Gate Pass size.
3. User chooses Gate Pass material / what to print on the pass.
4. Download file.

## Out of scope

- AMS-v4-0 until explicitly asked
- Print layout, barcode, or QR
- SIM cards, consumables, spare parts
- Per-company or per-site templates
- Label size and Gate Pass material fields (later slice)
- Item picker and download (later slice)
- SQL collection / schema (later slice, when there is something to persist)
