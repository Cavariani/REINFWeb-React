using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using ReinfApi.Models;

namespace ReinfApi.Services;

public class JwtService
{
    private readonly IConfiguration _cfg;

    public JwtService(IConfiguration cfg) => _cfg = cfg;

    public string Generate(AppUser user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_cfg["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddHours(double.Parse(_cfg["Jwt:ExpiresHours"] ?? "8"));

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Nome),
            new Claim("isAdmin",      user.IsAdmin      ? "true" : "false"),
            new Claim("isSuperAdmin", user.IsSuperAdmin ? "true" : "false"),
            new Claim("clienteId",    user.ClienteId.ToString()),
        };

        var token = new JwtSecurityToken(
            issuer: _cfg["Jwt:Issuer"],
            audience: _cfg["Jwt:Audience"],
            claims: claims,
            expires: expires,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public int? GetUserId(ClaimsPrincipal principal)
    {
        var val = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(val, out var id) ? id : null;
    }

    public bool GetIsAdmin(ClaimsPrincipal principal)
        => principal.FindFirstValue("isAdmin") == "true";

    public bool GetIsSuperAdmin(ClaimsPrincipal principal)
        => principal.FindFirstValue("isSuperAdmin") == "true";

    public int GetClienteId(ClaimsPrincipal principal)
    {
        var val = principal.FindFirstValue("clienteId");
        return int.TryParse(val, out var id) ? id : -1;
    }
}
