# Asset Management System (Web Portal) - v4.0

A web portal for recording company **assets**, **consumables**, **spare parts** and **equipment accessories**.

> **This is AMS-Test** - the live-testing copy backed by a **SQL Server database** through a C#/ASP.NET Core Web API. The original dummy-data version (all seed records + print fixes) is preserved unchanged in `../AMS-Backup/`. See `docs/MERGE_PLAN.md` Phase 15 for the full migration notes.

## Live Mode (SQL Server + ASP.NET Core API)

The portal is gated by `login.html`. On a Windows machine with SQL Server:

1. **Setup DB** (once): double-click `database\Setup-AMS-TEST.bat` (or let the API auto-create the DB on first run).
2. **Confirm connection**: `server\AMS.API\appsettings.json` -> `ConnectionStrings:Default` (default `Server=.\SQLEXPRESS;Database=AMS-TEST;Trusted_Connection=True;TrustServerCertificate=True;`).
3. **Run the API**:
   ```
   cd server\AMS.API
   dotnet run
   ```
   The API serves BOTH the backend and the frontend on one URL (open it in your browser).
4. **Log in** with the seeded Supreme Root account (delivered separately).

How it works: business data is stored as JSON documents in the `dbo.ams_collections` table; the frontend loads every collection at startup and PUTs a collection back whenever the in-memory data changes (`js/dummy-data.js` data layer). Login accounts live in the relational `dbo.ams_users` table (PBKDF2-SHA256 hashed passwords, JWT sessions).

## Folder Structure

```
AMS-Test/                       <- live-testing project (SQL Server backed)
├── login.html                 <- sign-in gate (live session required everywhere)
├── index.html                 <- Dashboard page (main landing page)
├── pages/                     <- All other pages (added one-by-one)
│   ├── _page-template.html    <- Template / cheat-sheet for building new pages
│   ├── employees.html         <- Employee Master (built)
│   ├── assets.html            <- Asset Master (built - Phase 5)
│   ├── consumables.html       <- Consumable Master (built - Phase 6A)
│   ├── spare-parts.html       <- Spare Parts Master (built - Phase 6B)
│   ├── accessories.html       <- Accessory Master (built - Phase 9A)
│   ├── masters.html           <- lookup masters (Asset Type/Category/Make, Site, Department, Designation) - embedded in the hub
│   ├── system-admin.html      <- System Administrator hub - tabs lazy-load the lookup masters + Company via ?embed=1
│   ├── company.html           <- Company Master - single-record form (default hub tab)
│   ├── user-master.html       <- User Master - roles/guards via the "Viewing As" simulator
│   ├── access-rights.html     <- Access Rights Control Master - per-user page access (Supreme Root, hub tab)
│   ├── role-access.html       <- Role Access Master - Role x Page default access matrix (Supreme Root, hub tab)
│   ├── log-report.html        <- Log Report - activity audit trail (Super Root / Supreme Root, hub tab)
│   ├── reports.html           <- Report Master - 7 tabs (lifecycle, issue/handover forms, consumable & spare-parts stock reports)
│   ├── vendors.html           <- Vendor Master - CRUD + "Used By" guard (built, hub tab)
│   └── settings.html          <- Settings - portal preferences hub (Appearance/General/Notifications/Data)
├── server/AMS.API/            <- ASP.NET Core Web API (net8.0, JWT, serves the UI too)
│   ├── Program.cs             <- JWT + CORS + static file serving + health endpoint
│   ├── Controllers/AuthController.cs
│   ├── Controllers/CollectionsController.cs
│   └── Data/AmsDb.cs          <- idempotent DB/schema/seed init + hashing
├── database/AMS-TEST.sql      <- SSMS setup script (idempotent)
├── database/Setup-AMS-TEST.bat<- sqlcmd setup script (Windows)
├── css/
│   ├── themes.css          <- 11 color themes (the only file with colors)
│   ├── main.css            <- shared layout & components (incl. font-size attr)
│   ├── dashboard.css       <- dashboard-only styles
│   ├── master-table.css    <- generic master-table engine styles
│   ├── assets.css          <- asset-master-only styles
│   ├── embed-mode.css      <- ?embed=1 hides sidebar/topbar for hub iframes
│   ├── system-admin.css    <- hub tab styling
│   ├── company.css         <- company form layout
│   ├── reports.css         <- report tab bar + filter rows
│   ├── role-gate.css       <- shared role-gated page styles (viewing-as bar, access-denied, actor badges)
│   ├── access-rights.css   <- access-rights checklist modal styles
│   ├── role-access.css     <- role-access matrix styles
│   └── settings.css        <- Settings page tab strip, theme gallery, stat rows
├── js/
│   ├── dummy-data.js       <- ALL dummy data + summary helpers (swap for SQL)
│   ├── theme.js            <- theme switcher (saves choice in browser)
│   ├── app.js              <- shared helpers (escape, badges, formatting)
│   ├── layout.js           <- renders sidebar + header from one list
│   ├── dashboard.js        <- renders the dashboard page
│   ├── employees.js        <- Employee Master page logic
│   ├── assets.js           <- Asset Master page logic
│   ├── master-table.js     <- generic CRUD engine for lookup masters
│   ├── master-configs.js   <- AMS_MASTER_CONFIGS registry (drives masters.html)
│   ├── consumables.js      <- Consumable Master config + Restock/Used/report actions
│   ├── spare-parts.js      <- Spare Parts Master config + Restock/Used/report actions
│   ├── embed-mode.js       <- adds embed-mode class when ?embed=1 (hub iframes)
│   ├── system-admin.js     <- System Administrator hub logic (AMS_ADMIN_TABS, tab switching)
│   ├── company.js          <- Company Master form logic
│   ├── access-rights.js    <- Access Rights Control Master logic (per-user allowedPages)
│   ├── role-access.js      <- Role Access Master logic (Role x Page matrix)
│   ├── log-report.js       <- Log Report logic (visibility split, filters, CSV, clear)
│   └── reports.js          <- Report Master logic (7 report tabs, print/CSV/Excel export)
│   ├── settings.js         <- Settings hub logic (tabs, theme gallery, prefs)
│   ├── print-docs.js       <- shared A4 print engine (open tab + .pf-* stylesheet)
│   ├── print-forms.js      <- Asset Issue (AIF) / Handover (AHF) forms for print
│   └── under-construction.js <- placeholder panel for future pages
└── assets/                 <- images / icons (currently unused)
```

## How to Run

**Live (recommended)** - requires SQL Server on Windows (see "Live Mode" above):

```
cd server\AMS.API
dotnet run
```

Then open the URL the console prints (it serves the UI and API together).

**Static / demo only** - no backend (collections stay empty because there is no
SQL Server to load from):

1. Double-click `index.html`, or
2. Serve the folder with a simple static server:

   ```
   npx serve .
   ```

## Themes

The portal ships with **11 themes** switchable from the dropdown in the top-right corner of the header. The choice is remembered by your browser.

| Theme       | Type     | Notes                                  |
|-------------|----------|----------------------------------------|
| Dark Grey   | dark     | **Default** - low glare, low power     |
| Midnight    | dark     | Very dark, high contrast               |
| Slate Blue  | dark     | Corporate blue-grey                    |
| Blue        | light    | Bright blue accent (requested)         |
| Lite        | light    | Bright / light theme (requested)       |
| Forest      | dark     | Dark green                             |
| Purple      | dark     | Dark purple                            |
| Amber       | dark     | Warm amber                             |
| Violet      | dark     | Dark violet (v3-3)                     |
| Crimson     | dark     | Dark crimson (v3-3)                    |
| Contrast    | dark     | High-contrast mono (v3-3)              |

## Build Roadmap (step by step)

- [x] Project setup + folder structure
- [x] Theme system (8 themes -> 11 themes, Phase 1)
- [x] Shared layout (sidebar + header)
- [x] Dashboard page (dummy data)
- [x] Employee Master (AMS IDs, assets owned/team, Issue & Handover forms, Exit with facility check-off + immutable exit snapshot)
- [x] Assets page (full lifecycle: Add/Edit/View, Assign/Reassign/Return/Transfer/Not Working/Retire/Replace, history popup, quick-add masters, Asset Issue Form print, CSV Import/Export/Template)
- [x] Print reconciliation (shared `print-docs.js` engine; Asset Issue Form, Employee Assign Report = AIF, Employee Exit Report = Handover Form built from the exit snapshot)
- [x] Consumables page (generic CRUD engine + Restock / Used-Assign with movement log, low-stock badge, Restock/Assign-Used reports)
- [x] Spare Parts page (same engine + Used/Assign links parts to the asset they were fitted on, with permanent AMS Asset ID link + display-ID snapshot in the log)
- [x] Accessories page (auto accCode, quick-add asset types, delete guarded while an asset has the accessory issued)
- [x] System Administrator hub (Company + lookup masters embedded via ?embed=1, tabs)
- [x] Company Master (single-record form feeding print letterheads)
- [x] User Master (roles + delete guards driven by the "Viewing As" role simulator, no password field)
- [x] Access Rights Control Master (Supreme Root - per-user page checklists, hub tab)
- [x] Role Access Master (Supreme Root - Role x Page default-access matrix, hub tab)
- [x] Log Report (Super Root / Supreme Root - activity audit trail, visibility split, CSV export, hub tab)
- [x] Report Master (7 tabs: asset lifecycle, AIF/AHF click-to-print, consumable & spare-parts restock/used; CSV + Excel export on every panel)
- [x] Vendors page (Vendor Master over the generic CRUD engine - contact, phone, email, city, supplies category, GSTIN; "Used By" guards delete while an asset/consumable/spare part references the vendor; live vendor list feeds the vendor fields on the Asset / Consumable / Spare Parts forms; System Admin hub tab)
- [x] Bulk CSV hardening (employee Template/Export cover every Add-Employee field incl. Reports-To-Manager + Manager ID; required fields marked with *; empId enforced unique against the system AND within the file; every master-table + Asset + Employee import shows a per-row Import Report - added/updated/skipped/error with reasons; within-file duplicate identities rejected; dashboard quick actions removed)
- [x] UX round 2 (Reporting Manager ID shows only the company ID; Import Report Download button + Supreme-Root quick-add of missing Department/Designation; Asset Stock-by-Type bar chart + 20-row scrollable/paginated list; all three-dot menus replaced with "Actions" buttons; Vendor fields are pick-lists with a (+) quick-add that creates + selects a new vendor)
- [x] UX round 3 (Consumable & Spare Parts Add/Edit modal's Vendor field upgraded from free-text to the same pick-list + (+) quick-add as Assets; the master-table engine now supports optional pick-list fields with in-modal quick-add and preserves legacy values no longer in the master when editing)
- [x] Settings page (portal preferences hub: Appearance - 11-theme gallery with live CSS-var previews + font size sm/md/lg; General - portal name shown in the sidebar brand + default list page size wired into the Asset table + currency note; Notifications - toast popup toggle, clear the bell / activity log; Data - "Viewing As" role shortcut + Reset Demo Data. Every choice is localStorage-backed and applies on all pages)
- [x] Report round (Company Master gains a Slogan + rectangular banner image upload; the Reports page has a Report Appearance editor - header style classic/banner, show/hide logo/name/slogan/address, live white-paper preview - persisted portal-wide via `ams_report_header_prefs`; every printable form now uses the shared `amsBuildPrintHeader` letterhead engine so Company + Appearance changes apply uniformly)
- [x] Assign fix (Asset Assign/Reassign: Subordinate and Department selects gain "Other / Not in the Master..." free-text options that store ONLY in `assignedSubText`/`assignedDeptText` - never in the Direct User field, which still requires a real User Master entry. In the printable Asset Issue Form, assets whose actual user was typed as free text go to the "Subordinates (For Reference)" section, while assets directly issued to the employee - including ones whose actual user is a User/Department master record - stay in "Assets Issued". Assets assigned to a Department/Use via the "Actual Usage / Team Details (Optional)" field also route to the reference section, with the note shown as the holder. The Asset Handover Form's Exit Reason is now a full-width box with a ruled writing line beneath it, and its signature order is Employee | Received By (IT/Admin) | Authorised By)
- [x] SQL Server migration (Phase 15) - ASP.NET Core Web API (`server/AMS.API`), JSON-document storage in `dbo.ams_collections`, relational `dbo.ams_users` + JWT login, login.html gate, every page loads from and saves to the DB. Live-testing copy = this project; original dummy-data version = `../AMS-Backup/`.

## Code Comments Convention

Every file has clear comment blocks like:

```
#-------------- Start Code for : SECTION NAME ----------------
... code ...
#-------------- End of the code : SECTION NAME ----------------
```

so you can find and edit any section easily.
