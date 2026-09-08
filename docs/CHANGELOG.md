# AMS-Test change log

## 2026-09-08 — Asset Type by Category (Used on)

Assets Master and Mobile Master only offer Asset Types that belong to
Categories tagged for that page.

- **Asset Type Master:** required **Asset Category**. SQL `ams_asset_types.category`.
- **Asset Category Master:** required **Used on** (`Assets` / `Mobiles` / `Both`).
  SQL `ams_asset_categories.used_on`.
- **Assets Master:** Types whose Category Used on is Assets or Both
  (IT Hardware, IT Materials). **Mobile Master:** Mobiles or Both
  (Communication).
- Add/Edit cascade: Category (page-scoped) → Type → Make. Category sits
  above Type on the form.
- **Plus (+):** `+ Category` saves Used on for the current page.
  `+ Type` inherits the selected Category. `+ Make` still inherits Type.
- Untagged Types/Categories stay in their master lists but are hidden on
  Assets/Mobiles until tagged.
- Spec: `docs/superpowers/specs/2026-09-08-asset-type-by-category-design.md`.

Restart the API or re-run `database/AMS-TEST.sql`, then hard-refresh
(Ctrl+F5). Tag Categories (Used on) and Types (Category) before they
appear on Add Asset / Add Mobile.

## 2026-09-08 — Asset Make by Asset Type

Asset Make Master works like Accessory Master: each Make belongs to one
Asset Type. Add Asset / Add Mobile Make lists only Makes for the selected
Type.

- Uniqueness: Make Name + Asset Type (Dell + Desktop and Dell + Laptop
  are two rows). Hidden `makeCode` (`MAKE-000001`).
- Untagged legacy Makes stay in Make Master but are hidden in dropdowns
  until you pick a Type.
- SQL: `ams_asset_makes.make_code`, `asset_type`; `record_key` is
  `makeCode`. Index `IX_ams_asset_makes_asset_type`.
- Spec: `docs/superpowers/specs/2026-09-08-asset-make-by-type-design.md`.
