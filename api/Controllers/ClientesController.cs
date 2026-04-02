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
[Route("api/clientes")]
[Authorize]
public class ClientesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtService _jwt;

    public ClientesController(AppDbContext db, JwtService jwt)
    {
        _db = db;
        _jwt = jwt;
    }

    /// <summary>GET /api/clientes — SuperAdmin: lista todos os clientes com contagem de usuários.</summary>
    [HttpGet]
    public async Task<IActionResult> List()
    {
        if (!_jwt.GetIsSuperAdmin(User)) return Forbid();

        var clientes = await _db.Clientes
            .OrderBy(c => c.Nome)
            .ToListAsync();

        var userCounts = await _db.Usuarios
            .GroupBy(u => u.ClienteId)
            .Select(g => new { ClienteId = g.Key, Count = g.Count() })
            .ToListAsync();

        var result = clientes.Select(c => new ClienteDto(
            c.Id, c.Nome, c.Ativa, c.DtCriacao,
            userCounts.FirstOrDefault(x => x.ClienteId == c.Id)?.Count ?? 0
        ));

        return Ok(result);
    }

    /// <summary>POST /api/clientes — SuperAdmin: cria novo cliente.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateClienteRequest req)
    {
        if (!_jwt.GetIsSuperAdmin(User)) return Forbid();

        if (string.IsNullOrWhiteSpace(req.Nome))
            return BadRequest(new { message = "Nome do cliente é obrigatório." });

        var cliente = new Cliente { Nome = req.Nome.Trim() };
        _db.Clientes.Add(cliente);
        await _db.SaveChangesAsync();

        return Ok(new ClienteDto(cliente.Id, cliente.Nome, cliente.Ativa, cliente.DtCriacao, 0));
    }

    /// <summary>PUT /api/clientes/{id} — SuperAdmin: edita nome ou ativa/desativa.</summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateClienteRequest req)
    {
        if (!_jwt.GetIsSuperAdmin(User)) return Forbid();

        var cliente = await _db.Clientes.FindAsync(id);
        if (cliente == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(req.Nome))
            cliente.Nome = req.Nome.Trim();

        if (req.Ativa.HasValue)
            cliente.Ativa = req.Ativa.Value;

        await _db.SaveChangesAsync();

        var count = await _db.Usuarios.CountAsync(u => u.ClienteId == id);
        return Ok(new ClienteDto(cliente.Id, cliente.Nome, cliente.Ativa, cliente.DtCriacao, count));
    }

    /// <summary>
    /// POST /api/clientes/{id}/admin — SuperAdmin: cria o primeiro Admin para um cliente.
    /// </summary>
    [HttpPost("{id}/admin")]
    public async Task<IActionResult> CreateAdmin(int id, [FromBody] CreateClienteAdminRequest req)
    {
        if (!_jwt.GetIsSuperAdmin(User)) return Forbid();

        var cliente = await _db.Clientes.FindAsync(id);
        if (cliente == null) return NotFound(new { message = "Cliente não encontrado." });
        if (!cliente.Ativa) return BadRequest(new { message = "Cliente inativo." });

        if (string.IsNullOrWhiteSpace(req.Nome) || string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Senha))
            return BadRequest(new { message = "Nome, e-mail e senha são obrigatórios." });

        if (await _db.Usuarios.AnyAsync(u => u.Email == req.Email.Trim().ToLower()))
            return BadRequest(new { message = "Já existe um usuário com este e-mail." });

        var admin = new AppUser
        {
            Nome         = req.Nome.Trim(),
            Email        = req.Email.Trim().ToLower(),
            SenhaHash    = BCrypt.Net.BCrypt.HashPassword(req.Senha, 11),
            IsAdmin      = true,
            IsSuperAdmin = false,
            ClienteId    = id,
            DtCriacao    = DateTime.UtcNow,
        };

        _db.Usuarios.Add(admin);
        await _db.SaveChangesAsync();

        return Ok(new UserDto(admin.Id, admin.Nome, admin.Email, admin.DtCriacao, admin.IsAdmin, admin.IsSuperAdmin, admin.ClienteId));
    }

    /// <summary>DELETE /api/clientes/{id} — SuperAdmin: exclui cliente sem dados associados.</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (!_jwt.GetIsSuperAdmin(User)) return Forbid();

        var cliente = await _db.Clientes.FindAsync(id);
        if (cliente == null) return NotFound();

        var temUsuarios  = await _db.Usuarios.AnyAsync(u => u.ClienteId == id);
        var temEmpresas  = await _db.Empresas.AnyAsync(e => e.ClienteId == id);
        var temCerts     = await _db.Certificados.AnyAsync(c => c.ClienteId == id);
        var temLotes     = await _db.Lotes.AnyAsync(l => l.ClienteId == id);

        if (temUsuarios || temEmpresas || temCerts || temLotes)
            return BadRequest(new { message = "Não é possível excluir um cliente que possui dados associados. Desative-o em vez de excluir." });

        _db.Clientes.Remove(cliente);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>GET /api/clientes/{id}/usuarios — SuperAdmin: lista usuários de um cliente.</summary>
    [HttpGet("{id}/usuarios")]
    public async Task<IActionResult> ListUsuarios(int id)
    {
        if (!_jwt.GetIsSuperAdmin(User)) return Forbid();

        if (!await _db.Clientes.AnyAsync(c => c.Id == id)) return NotFound();

        var users = await _db.Usuarios
            .Where(u => u.ClienteId == id)
            .OrderByDescending(u => u.IsAdmin)
            .ThenBy(u => u.Nome)
            .Select(u => new UserDto(u.Id, u.Nome, u.Email, u.DtCriacao, u.IsAdmin, u.IsSuperAdmin, u.ClienteId))
            .ToListAsync();

        return Ok(users);
    }
}
