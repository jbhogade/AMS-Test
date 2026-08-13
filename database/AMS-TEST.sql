/* =============================================================================
   AMS-TEST DATABASE SCRIPT
   -----------------------------------------------------------------------------
   Creates the AMS-TEST database, its schema and the seeded Supreme Root login
   used by the Asset Management System test portal.

   IDEMPOTENT: safe to run more than once (IF NOT EXISTS guards everywhere).

   HOW TO RUN ON WINDOWS
   -----------------------------------------------------------------------------
   Option 1 (recommended): double-click database\Setup-AMS-TEST.bat
   Option 2 (manual, in SQL Server Management Studio):
       1. Open SSMS -> Connect to your SQL Server instance.
       2. Open this file (AMS-TEST.sql).
       3. Press F5 / Execute. (If AMS-TEST does not exist yet it is created.)

   NOTE: The API (server\AMS.API) ALSO auto-creates the database, schema and
   seed login on first run, so this script is optional - it exists for manual
   preparation and as documentation of the schema.
   =============================================================================*/

/* ---- 1. Create the database (if missing) ----------------------------------- */
IF DB_ID(N'AMS-TEST') IS NULL
BEGIN
    CREATE DATABASE [AMS-TEST];
END
GO

USE [AMS-TEST];
GO

/* ---- 2. Users table (relational - login is security critical) -------------- */
IF OBJECT_ID(N'dbo.ams_users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_users (
        username        NVARCHAR(100)  NOT NULL PRIMARY KEY,
        password_hash   NVARCHAR(256)  NOT NULL,
        password_salt   NVARCHAR(64)   NOT NULL,
        role            NVARCHAR(50)   NOT NULL,
        linked_employee NVARCHAR(100)  NULL,
        email           NVARCHAR(200)  NULL,
        remarks         NVARCHAR(500)  NULL,
        active          BIT            NOT NULL DEFAULT 1,
        display_name    NVARCHAR(200)  NULL,
        contact_no      NVARCHAR(50)   NULL,
        address         NVARCHAR(500)  NULL,
        dob             NVARCHAR(20)   NULL,
        gender          NVARCHAR(20)   NULL
    );
END
GO

/* ---- 3. Collections table (JSON documents per business entity) ------------- */
IF OBJECT_ID(N'dbo.ams_collections', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_collections (
        collection_key NVARCHAR(100) NOT NULL PRIMARY KEY,
        data_json      NVARCHAR(MAX) NOT NULL,
        updated_at     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

/* ---- 4. Seeded login accounts ----------------------------------------------
   Login names look like low-level accounts but hold root rights. The API
   inserts/re-hashes the same accounts automatically if they are missing, so
   this block is a no-op when the API already created them. */
IF NOT EXISTS (SELECT 1 FROM dbo.ams_users WHERE username = N'operator.sys')
BEGIN
    INSERT INTO dbo.ams_users (username, password_hash, password_salt, role, linked_employee, email, remarks, active, display_name)
    VALUES (N'operator.sys', N'<hash-set-by-api>', N'<salt-set-by-api>', N'Supreme Root', NULL, N'operator.sys@ams.local', N'Portal account (looks like a low-level operator login, but holds Supreme Root rights).', 1, N'Operator');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.ams_users WHERE username = N'testadmin')
BEGIN
    INSERT INTO dbo.ams_users (username, password_hash, password_salt, role, linked_employee, email, remarks, active, display_name)
    VALUES (N'testadmin', N'<hash-set-by-api>', N'<salt-set-by-api>', N'Super Root', NULL, N'testadmin@ams.local', N'Super Root account for creating other users (cannot create Supreme Root).', 1, N'Test Admin');
END
GO
