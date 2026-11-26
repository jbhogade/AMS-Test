using System.Security.Claims;
using AMS.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace AMS.API.Controllers;

[ApiController]
[Route("api/backup")]
[Authorize]
public class BackupController : ControllerBase
{
    private readonly AmsDb _db;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<BackupController> _log;

    public BackupController(AmsDb db, IWebHostEnvironment env, ILogger<BackupController> log)
    {
        _db = db;
        _env = env;
        _log = log;
    }

    [HttpPost]
    public async Task<IActionResult> Create()
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role is not ("Super Root" or "Supreme Root"))
            return StatusCode(403, new { error = "Only Super Root and Supreme Root can take a SQL backup." });

        var projectRoot = Path.GetFullPath(Path.Combine(_env.ContentRootPath, "..", ".."));
        try
        {
            var result = await _db.BackupDatabaseAsync(projectRoot);
            return Ok(result);
        }
        catch (SqlException ex)
        {
            _log.LogError(ex, "SQL backup failed.");
            return StatusCode(500, new { error = "SQL backup failed. Check the API logs for details." });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "SQL backup failed.");
            return StatusCode(500, new { error = "SQL backup failed. Check the API logs for details." });
        }
    }
}
