using BCrypt.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ReinfApi.Data;
using ReinfApi.DTOs;
using ReinfApi.Services;

namespace ReinfApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtService _jwt;
    private readonly AuditService _audit;
    private readonly ILogger<AuthController> _logger;

    public AuthController(AppDbContext db, JwtService jwt, AuditService audit, ILogger<AuthController> logger)
    {
        _db = db;
        _jwt = jwt;
        _audit = audit;
        _logger = logger;
    }

    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "?";
        var user = await _db.Usuarios.FirstOrDefaultAsync(u => u.Email == req.Email);

        // Executa BCrypt mesmo se o usuário não existir — evita timing attack (enumeração de e-mails)
        var hashParaValidar = user?.SenhaHash ?? "$2a$11$invalidhashinvalidhashinvalidhash00000000000000000000u";
        var senhaValida = user != null && BCrypt.Net.BCrypt.Verify(req.Senha, hashParaValidar);

        if (!senhaValida)
        {
            _logger.LogWarning("LOGIN_FAIL | Email={Email} | IP={IP}", req.Email, ip);
            await _audit.LogAsync("LOGIN_FAIL", detalhe: $"Email={req.Email}", ip: ip);
            return Unauthorized(new { message = "E-mail ou senha incorretos." });
        }

        _logger.LogInformation("LOGIN_OK | UserId={UserId} | Nome={Nome} | IP={IP}", user!.Id, user.Nome, ip);
        await _audit.LogAsync("LOGIN", usuarioId: user.Id, usuarioNome: user.Nome,
            detalhe: $"Email={user.Email}", ip: ip, clienteId: user.ClienteId);
        var token = _jwt.Generate(user);
        return Ok(new LoginResponse(token, user.Id, user.Nome, user.Email, user.IsAdmin, user.IsSuperAdmin, user.ClienteId));
    }
}
