using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReinfApi.Data;
using ReinfApi.DTOs;
using ReinfApi.Models;
using ReinfApi.Services;

namespace ReinfApi.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtService _jwt;

    public UsersController(AppDbContext db, JwtService jwt)
    {
        _db = db;
        _jwt = jwt;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);

        var users = await _db.Usuarios
            .Where(u => isSuperAdmin || u.ClienteId == clienteId)
            .OrderByDescending(u => u.IsAdmin)
            .ThenBy(u => u.Nome)
            .Select(u => new UserDto(u.Id, u.Nome, u.Email, u.DtCriacao, u.IsAdmin, u.IsSuperAdmin, u.ClienteId))
            .ToListAsync();

        return Ok(users);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest req)
    {
        if (!_jwt.GetIsAdmin(User)) return Forbid();

        if (string.IsNullOrWhiteSpace(req.Nome) || string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Senha))
            return BadRequest(new { message = "Nome, e-mail e senha são obrigatórios." });

        if (await _db.Usuarios.AnyAsync(u => u.Email == req.Email))
            return BadRequest(new { message = "Já existe um usuário com este e-mail." });

        // TenantAdmin cria usuário no seu próprio cliente; SuperAdmin cria no cliente do seu JWT
        var clienteId = _jwt.GetClienteId(User);

        var user = new AppUser
        {
            Nome      = req.Nome.Trim(),
            Email     = req.Email.Trim().ToLower(),
            SenhaHash = BCrypt.Net.BCrypt.HashPassword(req.Senha, 11),
            IsAdmin   = req.IsAdmin,
            ClienteId = clienteId,
            DtCriacao = DateTime.UtcNow,
        };

        _db.Usuarios.Add(user);
        await _db.SaveChangesAsync();

        return Ok(new UserDto(user.Id, user.Nome, user.Email, user.DtCriacao, user.IsAdmin, user.IsSuperAdmin, user.ClienteId));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserRequest req)
    {
        if (!_jwt.GetIsAdmin(User)) return Forbid();

        if (string.IsNullOrWhiteSpace(req.Nome) || string.IsNullOrWhiteSpace(req.Email))
            return BadRequest(new { message = "Nome e e-mail são obrigatórios." });

        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);

        var user = await _db.Usuarios.FindAsync(id);
        if (user == null) return NotFound();
        if (!isSuperAdmin && user.ClienteId != clienteId) return Forbid();

        var emailNormalizado = req.Email.Trim().ToLower();
        if (await _db.Usuarios.AnyAsync(u => u.Email == emailNormalizado && u.Id != id))
            return BadRequest(new { message = "Já existe um usuário com este e-mail." });

        user.Nome  = req.Nome.Trim();
        user.Email = emailNormalizado;
        await _db.SaveChangesAsync();

        return Ok(new UserDto(user.Id, user.Nome, user.Email, user.DtCriacao, user.IsAdmin, user.IsSuperAdmin, user.ClienteId));
    }

    [HttpPut("{id}/senha")]
    public async Task<IActionResult> AlterarSenha(int id, [FromBody] AlterarSenhaRequest req)
    {
        if (!_jwt.GetIsAdmin(User)) return Forbid();

        if (string.IsNullOrWhiteSpace(req.NovaSenha) || req.NovaSenha.Length < 6)
            return BadRequest(new { message = "A senha deve ter pelo menos 6 caracteres." });

        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);

        var user = await _db.Usuarios.FindAsync(id);
        if (user == null) return NotFound();
        if (!isSuperAdmin && user.ClienteId != clienteId) return Forbid();

        user.SenhaHash = BCrypt.Net.BCrypt.HashPassword(req.NovaSenha, 11);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (!_jwt.GetIsAdmin(User)) return Forbid();

        var selfId       = _jwt.GetUserId(User);
        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);

        if (selfId == id)
            return BadRequest(new { message = "Você não pode excluir sua própria conta." });

        var user = await _db.Usuarios.FindAsync(id);
        if (user == null) return NotFound();
        if (!isSuperAdmin && user.ClienteId != clienteId) return Forbid();

        _db.Usuarios.Remove(user);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
