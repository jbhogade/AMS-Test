using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;

namespace AMS.API.Data;

/// <summary>
/// Database access layer for the AMS-TEST database.
///
/// Business data (assets, employees, masters, settings, ...) is stored as JSON
/// documents in a single ams_collections table (one row per collection, e.g.
/// "assets", "employees"). The ams_users table is relational because login is
/// security critical (username primary key + PBKDF2 password hash).
///
/// Schema creation and the seeded Supreme Root login account are idempotent and
/// run automatically at startup, so the app works even if the AMS-TEST.sql
/// script was never executed manually.
/// </summary>
public class AmsDb
{
    private readonly string _connectionString;
    private readonly string _dbName;

    public AmsDb(IConfiguration config)
    {
        _connectionString = config.GetConnectionString("Default") ?? "";
        _dbName = "AMS-TEST";
    }

    /// <summary>Connection string targeted at the AMS-TEST database.</summary>
    public string ConnectionString => _connectionString;

    private string GetDbConnectionString()
    {
        // Point the same credentials at a specific database instead of master.
        var builder = new SqlConnectionStringBuilder(_connectionString) { InitialCatalog = _dbName };
        return builder.ConnectionString;
    }

    private string GetMasterConnectionString()
    {
        var builder = new SqlConnectionStringBuilder(_connectionString) { InitialCatalog = "master" };
        return builder.ConnectionString;
    }

    /// <summary>
    /// Ensures the database, schema and the seeded Supreme Root login exist.
    /// Each step is best-effort: if the caller lacks permission to create the
    /// database they will have run Setup-AMS-TEST.bat (sqlcmd) instead, and the
    /// remaining steps still run against the existing database.
    /// </summary>
    public async Task InitializeAsync()
    {
        await EnsureDatabaseExistsAsync();
        await EnsureSchemaAsync();
        await EnsureSeedUserAsync();
    }

    private async Task EnsureDatabaseExistsAsync()
    {
        try
        {
            await using var conn = new SqlConnection(GetMasterConnectionString());
            await conn.OpenAsync();
            var cmd = new SqlCommand(
                $"IF DB_ID(@db) IS NULL CREATE DATABASE [{_dbName}];", conn);
            cmd.Parameters.AddWithValue("@db", _dbName);
            await cmd.ExecuteNonQueryAsync();
        }
        catch
        {
            // Permission denied to create a database - the user should run the
            // provided Setup-AMS-TEST.bat (sqlcmd) as an administrator. The
            // schema step below will still run if the database already exists.
        }
    }

    private async Task EnsureSchemaAsync()
    {
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();

        await ExecuteAsync(conn, @"
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
            END");

        /* Idempotent column additions for databases created before the profile
           columns existed (ALTER TABLE ... ADD is not idempotent in T-SQL). */
        await ExecuteAsync(conn, @"
            IF COL_LENGTH(N'dbo.ams_users', N'display_name') IS NULL
                ALTER TABLE dbo.ams_users ADD display_name NVARCHAR(200) NULL;
            IF COL_LENGTH(N'dbo.ams_users', N'contact_no') IS NULL
                ALTER TABLE dbo.ams_users ADD contact_no NVARCHAR(50) NULL;
            IF COL_LENGTH(N'dbo.ams_users', N'address') IS NULL
                ALTER TABLE dbo.ams_users ADD address NVARCHAR(500) NULL;
            IF COL_LENGTH(N'dbo.ams_users', N'dob') IS NULL
                ALTER TABLE dbo.ams_users ADD dob NVARCHAR(20) NULL;
            IF COL_LENGTH(N'dbo.ams_users', N'gender') IS NULL
                ALTER TABLE dbo.ams_users ADD gender NVARCHAR(20) NULL;");

        await ExecuteAsync(conn, @"
            IF OBJECT_ID(N'dbo.ams_collections', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.ams_collections (
                    collection_key NVARCHAR(100) NOT NULL PRIMARY KEY,
                    data_json      NVARCHAR(MAX) NOT NULL,
                    updated_at     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
                );
            END");
    }

    private async Task EnsureSeedUserAsync()
    {
        /* (username, password, role, email, remarks, displayName) */
        (string, string, string, string, string, string)[] seeds =
        {
            ("operator.sys", "Sr#Ops@2026", "Supreme Root", "operator.sys@ams.local",
             "Portal account (looks like a low-level operator login, but holds Supreme Root rights).", "Operator"),
            ("testadmin", "Admin@#$12345", "Super Root", "testadmin@ams.local",
             "Super Root account for creating other users (cannot create Supreme Root).", "Test Admin"),
        };

        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();

        foreach (var (username, password, role, email, remarks, displayName) in seeds)
        {
            var exists = (int?)await ExecuteScalarAsync(conn,
                "SELECT COUNT(1) FROM dbo.ams_users WHERE username = @u",
                ("@u", username)) ?? 0;

            var salt = HashUtils.NewSalt();
            var hash = HashUtils.HashPassword(password, salt);

            if (exists > 0)
            {
                // Keep the seeded account in sync (re-hash + re-activate). A row
                // inserted by AMS-TEST.sql carries a placeholder hash until the
                // API first runs, so this update guarantees a valid login.
                var upd = new SqlCommand(@"
                    UPDATE dbo.ams_users
                    SET password_hash = @h, password_salt = @s, role = @r, active = 1
                    WHERE username = @u;", conn);
                upd.Parameters.AddWithValue("@h", hash);
                upd.Parameters.AddWithValue("@s", salt);
                upd.Parameters.AddWithValue("@r", role);
                upd.Parameters.AddWithValue("@u", username);
                await upd.ExecuteNonQueryAsync();
                continue;
            }

            var cmd = new SqlCommand(@"
                INSERT INTO dbo.ams_users (username, password_hash, password_salt, role, linked_employee, email, remarks, active, display_name)
                VALUES (@u, @h, @s, @r, NULL, @e, @m, 1, @dn);", conn);
            cmd.Parameters.AddWithValue("@u", username);
            cmd.Parameters.AddWithValue("@h", hash);
            cmd.Parameters.AddWithValue("@s", salt);
            cmd.Parameters.AddWithValue("@r", role);
            cmd.Parameters.AddWithValue("@e", email);
            cmd.Parameters.AddWithValue("@m", remarks);
            cmd.Parameters.AddWithValue("@dn", displayName);
            await cmd.ExecuteNonQueryAsync();
        }
    }

    /* ---- Collections (JSON documents) ----------------------------------- */

    public async Task<string?> GetCollectionAsync(string key)
    {
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();
        var result = await ExecuteScalarAsync(conn,
            "SELECT data_json FROM dbo.ams_collections WHERE collection_key = @k",
            ("@k", key));
        return result as string;
    }

    public async Task SaveCollectionAsync(string key, string dataJson)
    {
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();
        var cmd = new SqlCommand(@"
            IF EXISTS (SELECT 1 FROM dbo.ams_collections WHERE collection_key = @k)
                UPDATE dbo.ams_collections SET data_json = @d, updated_at = SYSUTCDATETIME() WHERE collection_key = @k;
            ELSE
                INSERT INTO dbo.ams_collections (collection_key, data_json, updated_at) VALUES (@k, @d, SYSUTCDATETIME());", conn);
        cmd.Parameters.AddWithValue("@k", key);
        cmd.Parameters.AddWithValue("@d", dataJson);
        await cmd.ExecuteNonQueryAsync();
    }

    /* ---- Users / login --------------------------------------------------- */

    public async Task<AmsUser?> FindUserAsync(string username)
    {
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();
        var cmd = new SqlCommand(@"
            SELECT username, password_hash, password_salt, role, linked_employee, email, remarks, active,
                   display_name, contact_no, address, dob, gender
            FROM dbo.ams_users WHERE username = @u;", conn);
        cmd.Parameters.AddWithValue("@u", username);
        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) return null;
        return new AmsUser
        {
            Username = reader.GetString(0),
            PasswordHash = reader.GetString(1),
            PasswordSalt = reader.GetString(2),
            Role = reader.GetString(3),
            LinkedEmployee = reader.IsDBNull(4) ? null : reader.GetString(4),
            Email = reader.IsDBNull(5) ? null : reader.GetString(5),
            Remarks = reader.IsDBNull(6) ? null : reader.GetString(6),
            Active = reader.GetBoolean(7),
            DisplayName = reader.IsDBNull(8) ? null : reader.GetString(8),
            ContactNo = reader.IsDBNull(9) ? null : reader.GetString(9),
            Address = reader.IsDBNull(10) ? null : reader.GetString(10),
            Dob = reader.IsDBNull(11) ? null : reader.GetString(11),
            Gender = reader.IsDBNull(12) ? null : reader.GetString(12),
        };
    }

    public bool VerifyPassword(AmsUser user, string password)
    {
        if (string.IsNullOrEmpty(password)) return false;
        var hash = HashUtils.HashPassword(password, user.PasswordSalt);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(hash),
            Encoding.UTF8.GetBytes(user.PasswordHash));
    }

    /* ---- User management (User Master page syncs login accounts to this table) */

    public async Task<List<AmsUser>> ListUsersAsync()
    {
        var users = new List<AmsUser>();
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();
        var cmd = new SqlCommand(@"
            SELECT username, password_hash, password_salt, role, linked_employee, email, remarks, active,
                   display_name, contact_no, address, dob, gender
            FROM dbo.ams_users ORDER BY username;", conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            users.Add(new AmsUser
            {
                Username = reader.GetString(0),
                PasswordHash = reader.GetString(1),
                PasswordSalt = reader.GetString(2),
                Role = reader.GetString(3),
                LinkedEmployee = reader.IsDBNull(4) ? null : reader.GetString(4),
                Email = reader.IsDBNull(5) ? null : reader.GetString(5),
                Remarks = reader.IsDBNull(6) ? null : reader.GetString(6),
                Active = reader.GetBoolean(7),
                DisplayName = reader.IsDBNull(8) ? null : reader.GetString(8),
                ContactNo = reader.IsDBNull(9) ? null : reader.GetString(9),
                Address = reader.IsDBNull(10) ? null : reader.GetString(10),
                Dob = reader.IsDBNull(11) ? null : reader.GetString(11),
                Gender = reader.IsDBNull(12) ? null : reader.GetString(12),
            });
        }
        return users;
    }

    public async Task CreateUserAsync(string username, string password, string role,
        string? linkedEmployee, string? email, string? remarks, bool active)
    {
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();
        var salt = HashUtils.NewSalt();
        var hash = HashUtils.HashPassword(password, salt);
        var cmd = new SqlCommand(@"
            INSERT INTO dbo.ams_users (username, password_hash, password_salt, role, linked_employee, email, remarks, active, display_name)
            VALUES (@u, @h, @s, @r, @le, @e, @m, @a, @le);", conn);
        cmd.Parameters.AddWithValue("@u", username);
        cmd.Parameters.AddWithValue("@h", hash);
        cmd.Parameters.AddWithValue("@s", salt);
        cmd.Parameters.AddWithValue("@r", role);
        cmd.Parameters.AddWithValue("@le", (object?)linkedEmployee ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@e", (object?)email ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@m", (object?)remarks ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@a", active);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task UpdateUserAsync(string username, string? newPassword, string? role,
        string? linkedEmployee, string? email, string? remarks, bool? active,
        string? displayName, string? contactNo, string? address, string? dob, string? gender)
    {
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();

        var sql = new List<string> {
            "role = ISNULL(@r, role)",
            "linked_employee = @le",
            "email = @e",
            "remarks = @m",
            "active = ISNULL(@a, active)",
            "display_name = @dn",
            "contact_no = @c",
            "address = @ad",
            "dob = @d",
            "gender = @g",
        };
        var ps = new List<(string, object?)>
        {
            ("@r", role), ("@le", (object?)linkedEmployee ?? DBNull.Value),
            ("@e", (object?)email ?? DBNull.Value), ("@m", (object?)remarks ?? DBNull.Value),
            ("@a", active), ("@dn", (object?)displayName ?? DBNull.Value),
            ("@c", (object?)contactNo ?? DBNull.Value), ("@ad", (object?)address ?? DBNull.Value),
            ("@d", (object?)dob ?? DBNull.Value), ("@g", (object?)gender ?? DBNull.Value),
        };

        if (!string.IsNullOrWhiteSpace(newPassword))
        {
            var salt = HashUtils.NewSalt();
            var hash = HashUtils.HashPassword(newPassword, salt);
            sql.Add("password_hash = @h");
            sql.Add("password_salt = @s");
            ps.Add(("@h", hash));
            ps.Add(("@s", salt));
        }

        var cmd = new SqlCommand($"UPDATE dbo.ams_users SET {string.Join(", ", sql)} WHERE username = @u;", conn);
        cmd.Parameters.AddWithValue("@u", username);
        foreach (var (name, value) in ps) cmd.Parameters.AddWithValue(name, value);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteUserAsync(string username)
    {
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();
        var cmd = new SqlCommand("DELETE FROM dbo.ams_users WHERE username = @u;", conn);
        cmd.Parameters.AddWithValue("@u", username);
        await cmd.ExecuteNonQueryAsync();
    }

    private static async Task ExecuteAsync(SqlConnection conn, string sql)
    {
        await using var cmd = new SqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }

    private static async Task<object?> ExecuteScalarAsync(SqlConnection conn, string sql, params (string, object)[] parameters)
    {
        await using var cmd = new SqlCommand(sql, conn);
        foreach (var (name, value) in parameters) cmd.Parameters.AddWithValue(name, value);
        return await cmd.ExecuteScalarAsync();
    }
}

public class AmsUser
{
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string PasswordSalt { get; set; } = "";
    public string Role { get; set; } = "";
    public string? LinkedEmployee { get; set; }
    public string? Email { get; set; }
    public string? Remarks { get; set; }
    public bool Active { get; set; }
    public string? DisplayName { get; set; }
    public string? ContactNo { get; set; }
    public string? Address { get; set; }
    public string? Dob { get; set; }
    public string? Gender { get; set; }
}

/// <summary>PBKDF2 password hashing (SHA-256, 100k iterations).</summary>
public static class HashUtils
{
    public static string NewSalt() => Convert.ToHexString(RandomNumberGenerator.GetBytes(16));

    public static string HashPassword(string password, string saltHex)
    {
        var salt = Convert.FromHexString(saltHex);
        return Convert.ToHexString(Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32));
    }
}
