using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReinfApi.Data;
using ReinfApi.DTOs;
using ReinfApi.Models;
using ReinfApi.Services;

namespace ReinfApi.Controllers;

[ApiController]
[Route("api/empresas")]
[Authorize]
public class EmpresasController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtService _jwt;

    public EmpresasController(AppDbContext db, JwtService jwt)
    {
        _db = db;
        _jwt = jwt;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var userId       = _jwt.GetUserId(User);
        if (userId == null) return Unauthorized();
        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);
        var isAdmin      = _jwt.GetIsAdmin(User);

        List<Empresa> empresas;

        if (isSuperAdmin || isAdmin)
        {
            // SuperAdmin vê tudo; TenantAdmin vê todas do seu cliente
            empresas = await _db.Empresas
                .Where(e => isSuperAdmin || e.ClienteId == clienteId)
                .Include(e => e.Usuarios)
                .Include(e => e.Certificado)
                .OrderBy(e => e.Nome)
                .ToListAsync();
        }
        else
        {
            // TenantUser: apenas empresas que estão vinculadas a ele (e do mesmo cliente, por segurança)
            empresas = await _db.Usuarios
                .Where(u => u.Id == userId)
                .SelectMany(u => u.Empresas)
                .Where(e => e.ClienteId == clienteId)
                .Include(e => e.Usuarios)
                .Include(e => e.Certificado)
                .OrderBy(e => e.Nome)
                .ToListAsync();
        }

        var result = empresas.Select(e => new EmpresaDto(
            e.Id, e.Nome, e.Cnpj, e.Ativa,
            e.Usuarios.Select(u => u.Id).ToList(),
            e.IsEmissora,
            e.EmissoraId,
            e.CertificadoId,
            e.Certificado?.Nome,
            e.Certificado?.CnpjContribuinte,
            e.Certificado?.DtValidade
        ));

        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateEmpresaRequest req)
    {
        if (!_jwt.GetIsAdmin(User)) return Forbid();

        if (string.IsNullOrWhiteSpace(req.Nome) || string.IsNullOrWhiteSpace(req.Cnpj))
            return BadRequest(new { message = "Nome e CNPJ são obrigatórios." });

        var cnpj = req.Cnpj.Replace(".", "").Replace("/", "").Replace("-", "").Trim();
        if (cnpj.Length != 14)
            return BadRequest(new { message = "CNPJ deve ter 14 dígitos." });

        var clienteId = _jwt.GetClienteId(User);
        var empresa   = new Empresa { Nome = req.Nome.Trim(), Cnpj = cnpj, Ativa = true, IsEmissora = false, ClienteId = clienteId };
        _db.Empresas.Add(empresa);
        await _db.SaveChangesAsync();

        return Ok(new EmpresaDto(empresa.Id, empresa.Nome, empresa.Cnpj, empresa.Ativa, new List<int>()));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (!_jwt.GetIsAdmin(User)) return Forbid();

        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);

        var empresa = await _db.Empresas
            .FirstOrDefaultAsync(e => e.Id == id && (isSuperAdmin || e.ClienteId == clienteId));
        if (empresa == null) return NotFound();

        // Nula referências de EmissoraId que apontam para esta empresa (FK NoAction)
        await _db.Empresas
            .Where(e => e.EmissoraId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(e => e.EmissoraId, (int?)null));

        _db.Empresas.Remove(empresa);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id}/usuarios")]
    public async Task<IActionResult> AssociarUsuario(int id, [FromBody] AssociarUsuarioRequest req)
    {
        if (!_jwt.GetIsAdmin(User)) return Forbid();

        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);

        var empresa = await _db.Empresas
            .Include(e => e.Usuarios)
            .Include(e => e.Certificado)
            .FirstOrDefaultAsync(e => e.Id == id && (isSuperAdmin || e.ClienteId == clienteId));
        if (empresa == null) return NotFound(new { message = "Empresa não encontrada." });

        var usuario = await _db.Usuarios
            .FirstOrDefaultAsync(u => u.Id == req.UsuarioId && (isSuperAdmin || u.ClienteId == clienteId));
        if (usuario == null) return NotFound(new { message = "Usuário não encontrado." });

        if (empresa.Usuarios.Any(u => u.Id == req.UsuarioId))
            return BadRequest(new { message = "Usuário já está associado a esta empresa." });

        empresa.Usuarios.Add(usuario);
        await _db.SaveChangesAsync();

        return Ok(new EmpresaDto(
            empresa.Id, empresa.Nome, empresa.Cnpj, empresa.Ativa,
            empresa.Usuarios.Select(u => u.Id).ToList(),
            empresa.IsEmissora, empresa.EmissoraId,
            empresa.CertificadoId, empresa.Certificado?.Nome,
            empresa.Certificado?.CnpjContribuinte, empresa.Certificado?.DtValidade
        ));
    }

    [HttpDelete("{id}/usuarios/{uid}")]
    public async Task<IActionResult> DesassociarUsuario(int id, int uid)
    {
        if (!_jwt.GetIsAdmin(User)) return Forbid();

        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);

        var empresa = await _db.Empresas.Include(e => e.Usuarios)
            .FirstOrDefaultAsync(e => e.Id == id && (isSuperAdmin || e.ClienteId == clienteId));
        if (empresa == null) return NotFound();

        var usuario = empresa.Usuarios.FirstOrDefault(u => u.Id == uid);
        if (usuario == null) return NotFound(new { message = "Usuário não está associado a esta empresa." });

        empresa.Usuarios.Remove(usuario);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// PUT /api/empresas/{id}/certificado — Admin only.
    /// Vincula um certificado digital diretamente a este contribuinte.
    /// Enviar { certificadoId: null } para desvincular.
    /// </summary>
    [HttpPut("{id}/certificado")]
    public async Task<IActionResult> SetCertificado(int id, [FromBody] SetCertificadoRequest req)
    {
        var userId       = _jwt.GetUserId(User);
        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);
        var isAdmin      = _jwt.GetIsAdmin(User);

        var empresa = await _db.Empresas
            .Include(e => e.Usuarios)
            .FirstOrDefaultAsync(e => e.Id == id && (isSuperAdmin || e.ClienteId == clienteId));
        if (empresa == null) return NotFound();

        // Usuário comum só pode alterar o certificado de empresas em que é responsável
        if (!isSuperAdmin && !isAdmin && !empresa.Usuarios.Any(u => u.Id == userId))
            return Forbid();

        if (req.CertificadoId.HasValue)
        {
            var cert = await _db.Certificados
                .FirstOrDefaultAsync(c => c.Id == req.CertificadoId.Value && (isSuperAdmin || c.ClienteId == clienteId));
            if (cert == null)
                return BadRequest(new { message = "Certificado não encontrado." });
        }

        empresa.CertificadoId = req.CertificadoId;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
