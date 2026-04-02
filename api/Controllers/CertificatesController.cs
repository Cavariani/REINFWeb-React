using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReinfApi.Core;
using ReinfApi.Data;
using ReinfApi.DTOs;
using ReinfApi.Models;
using ReinfApi.Services;

namespace ReinfApi.Controllers;

[ApiController]
[Route("api/certificates")]
[Authorize]
public class CertificatesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CryptoService _crypto;
    private readonly JwtService _jwt;
    private readonly AuditService _audit;

    public CertificatesController(AppDbContext db, CryptoService crypto, JwtService jwt, AuditService audit)
    {
        _db = db;
        _crypto = crypto;
        _jwt = jwt;
        _audit = audit;
    }

    /// <summary>
    /// GET /api/certificates
    /// Admin: retorna todos os certificados (gaveta completa).
    /// Usuário: retorna apenas os certs atribuídos às suas empresas contribuintes.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var userId = _jwt.GetUserId(User);
        if (userId == null) return Unauthorized();

        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);
        var isAdmin      = _jwt.GetIsAdmin(User);

        IQueryable<Certificate> query;

        if (isSuperAdmin)
        {
            // SuperAdmin vê todos os certificados do sistema
            query = _db.Certificados;
        }
        else if (isAdmin)
        {
            // TenantAdmin vê todos os certs do seu cliente (gaveta completa do cliente)
            query = _db.Certificados.Where(c => c.ClienteId == clienteId);
        }
        else
        {
            // TenantUser: apenas certs atribuídos às suas empresas via Empresa.CertificadoId
            var certIds = await _db.Usuarios
                .Where(u => u.Id == userId)
                .SelectMany(u => u.Empresas)
                .Where(e => e.CertificadoId.HasValue && e.ClienteId == clienteId)
                .Select(e => e.CertificadoId!.Value)
                .Distinct()
                .ToListAsync();

            query = _db.Certificados.Where(c => certIds.Contains(c.Id));
        }

        var certs = await query
            .Select(c => new CertificateDto
            {
                Id = c.Id,
                Nome = c.Nome,
                CnpjContribuinte = c.CnpjContribuinte,
                DtUpload = c.DtUpload,
                DtValidade = c.DtValidade,
                EmpresaId = c.EmpresaId,
                EmpresaNome = c.Empresa != null ? c.Empresa.Nome : null
            })
            .ToListAsync();

        return Ok(certs);
    }

    /// <summary>
    /// POST /api/certificates
    /// Todos os usuários autenticados podem fazer upload.
    /// Se já existir um certificado com o mesmo CNPJ, atualiza em lugar (preserva ID e FKs).
    /// Se não existir, insere novo.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Upload(
        [FromForm] string nome,
        [FromForm] string cnpjContribuinte,
        [FromForm] string senha,
        IFormFile arquivo)
    {
        var userId = _jwt.GetUserId(User);
        if (userId == null) return Unauthorized();

        if (arquivo == null || arquivo.Length == 0)
            return BadRequest(new { message = "Arquivo .pfx não enviado." });

        byte[] pfxBytes;
        using (var ms = new MemoryStream())
        {
            await arquivo.CopyToAsync(ms);
            pfxBytes = ms.ToArray();
        }

        // Valida o .pfx com a senha e extrai data de validade
        DateTime? dtValidade = null;
        try
        {
            var x509 = ReinfXmlSigner.LoadPfxFromBytes(pfxBytes, senha);
            dtValidade = x509.NotAfter.ToUniversalTime();

            if (dtValidade < DateTime.UtcNow)
                return BadRequest(new { message = $"Certificado já vencido em {dtValidade.Value.ToLocalTime():dd/MM/yyyy}. Utilize um certificado dentro da validade." });
        }
        catch
        {
            return BadRequest(new { message = "Certificado inválido ou senha incorreta. Verifique o arquivo e tente novamente." });
        }

        var senhaCripto = _crypto.Encrypt(senha);
        var cnpjDigits  = ParseUtil.OnlyDigits(cnpjContribuinte);
        var clienteId   = _jwt.GetClienteId(User);

        // Upsert por CNPJ dentro do mesmo cliente: atualiza se já existe
        var existente = await _db.Certificados
            .FirstOrDefaultAsync(c => c.CnpjContribuinte == cnpjDigits && c.ClienteId == clienteId);

        if (existente != null)
        {
            existente.Nome = nome;
            existente.PfxBytes = pfxBytes;
            existente.SenhaCriptografada = senhaCripto;
            existente.DtUpload = DateTime.UtcNow;
            existente.DtValidade = dtValidade;
            existente.UsuarioId = userId;
            await _db.SaveChangesAsync();

            await _audit.LogAsync("CERT_UPLOAD", usuarioId: userId,
                detalhe: $"Atualização — Nome={nome} CNPJ={cnpjDigits}",
                ip: HttpContext.Connection.RemoteIpAddress?.ToString(), clienteId: clienteId);

            return Ok(new CertificateDto
            {
                Id = existente.Id,
                Nome = existente.Nome,
                CnpjContribuinte = existente.CnpjContribuinte,
                DtUpload = existente.DtUpload,
                DtValidade = existente.DtValidade
            });
        }

        var cert = new Certificate
        {
            EmpresaId          = null,
            UsuarioId          = userId,
            ClienteId          = clienteId,
            Nome               = nome,
            CnpjContribuinte   = cnpjDigits,
            PfxBytes           = pfxBytes,
            SenhaCriptografada = senhaCripto,
            DtUpload           = DateTime.UtcNow,
            DtValidade         = dtValidade
        };

        _db.Certificados.Add(cert);
        await _db.SaveChangesAsync();

        await _audit.LogAsync("CERT_UPLOAD", usuarioId: userId,
            detalhe: $"Novo — Nome={nome} CNPJ={cnpjDigits}",
            ip: HttpContext.Connection.RemoteIpAddress?.ToString(), clienteId: clienteId);

        return Ok(new CertificateDto
        {
            Id = cert.Id,
            Nome = cert.Nome,
            CnpjContribuinte = cert.CnpjContribuinte,
            DtUpload = cert.DtUpload,
            DtValidade = cert.DtValidade
        });
    }

    /// <summary>
    /// DELETE /api/certificates/{id} — Admin only.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (!_jwt.GetIsAdmin(User)) return Forbid();

        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);

        var cert = await _db.Certificados
            .FirstOrDefaultAsync(c => c.Id == id && (isSuperAdmin || c.ClienteId == clienteId));
        if (cert == null) return NotFound();

        // Desnula FK nos lotes antes de deletar
        await _db.Lotes
            .Where(l => l.CertificadoId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(l => l.CertificadoId, (int?)null));

        // Desnula FK nas empresas antes de deletar
        await _db.Empresas
            .Where(e => e.CertificadoId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(e => e.CertificadoId, (int?)null));

        _db.Certificados.Remove(cert);
        await _db.SaveChangesAsync();

        var userId = _jwt.GetUserId(User);
        await _audit.LogAsync("CERT_DELETE", usuarioId: userId,
            detalhe: $"Id={id} Nome={cert.Nome} CNPJ={cert.CnpjContribuinte}",
            ip: HttpContext.Connection.RemoteIpAddress?.ToString(), clienteId: cert.ClienteId);

        return NoContent();
    }
}
