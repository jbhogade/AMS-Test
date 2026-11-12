# SQL Server instance auto-detect

AMS-Test first. Port to AMS-v4-0 only after that is asked.
Django `.env` `AMS_DB_SERVER` probe is later, not this slice.

## Goal

On ASP.NET API startup, find a reachable local SQL Server instance, use it for `AMS-TEST`, and if it differs from `appsettings.json`, rewrite only `Server=` in that file. Login 503 text stays the same when no instance answers.

## Placement

- New helper: `server/AMS.API/Data/SqlServerLocator.cs`
- Call site: `server/AMS.API/Program.cs`, before `InitializeAsync`
- Config file: `server/AMS.API/appsettings.json` `ConnectionStrings:Default`
- Database name stays `AMS-TEST`. Auth, `TrustServerCertificate`, and other keys stay as in the file.
- `database/Setup-AMS-TEST.bat` is unchanged (it already probes).

## Probe order

1. `Server=` already in `ConnectionStrings:Default`
2. `.\SQLEXPRESS`
3. `localhost\SQLEXPRESS`
4. `localhost`

Skip duplicates (same instance after normalizing `.` vs `localhost` and case). For each candidate, open `master` with the same credentials as the file (`Trusted_Connection` / user+password if present) and `TrustServerCertificate` unchanged. Connect timeout about 3 seconds.

First success wins.

## Rewrite

If the winning `Server=` differs from the file:

- Rewrite only `Server=` inside `ConnectionStrings:Default`.
- Keep `Database=AMS-TEST` (or whatever `InitialCatalog` / `Database` was; locator must not change the catalog name used by `AmsDb`, which is still `AMS-TEST`).
- Do not change passwords, user ids, or JWT settings.

If `appsettings.json` is locked or not writable: keep the in-memory winner, log a warning, do not fail startup.

If every probe fails: do not rewrite the file. Startup continues. Login stays 503 with the existing message (SQL Server not running / run `Setup-AMS-TEST.bat`).

## Logging

Log `AMS-TEST using SQL Server instance: <Server>`. If all probes fail, log each tried `Server=`.

## Out of scope (later)

- Django `.env` `AMS_DB_SERVER` probe
- SQL Browser / Windows registry instance enumeration
- AMS-v4-0 until explicitly asked
- Changing 503 wording
- Remote / named instances other than the list above
