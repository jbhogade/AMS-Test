using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using AMS.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace AMS.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AmsDb _db;
    private readonly IConfiguration _config;

    public AuthController(AmsDb db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public record LoginRequest(string Username, string Password);

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Username and password are required." });

        var user = await _db.FindUserAsync(req.Username.Trim());
        if (user is null || !user.Active)
            return Unauthorized(new { error = "Invalid username or password." });

        if (!_db.VerifyPassword(user, req.Password))
            return Unauthorized(new { error = "Invalid username or password." });

        var token = CreateToken(user);
        return Ok(new
        {
            token,
            username = user.Username,
            role = user.Role,
            name = user.LinkedEmployee ?? user.Username,
            linkedEmployee = user.LinkedEmployee,
            email = user.Email,
        });
    }

    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        var username = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var role = User.FindFirstValue(ClaimTypes.Role);
        var name = User.FindFirstValue(ClaimTypes.Name);
        if (username is null) return Unauthorized();
        return Ok(new { username, role, name });
    }

    private string CreateToken(AmsUser user)
    {
        var jwtKey = _config["Jwt:Key"] ?? "AmsTestDbLoginSigningKey_2026_ChangeMeInProduction_0123456789ABCDEF";
        var issuer = _config["Jwt:Issuer"] ?? "AMS-API";
        var audience = _config["Jwt:Audience"] ?? "AMS-App";
        var expiryMinutes = int.TryParse(_config["Jwt:ExpiryMinutes"], out var m) ? m : 480;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Username),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(ClaimTypes.Name, user.LinkedEmployee ?? user.Username),
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
