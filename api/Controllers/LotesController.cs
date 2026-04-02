using System.IO.Compression;
using System.Text;
using System.Text.Json;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReinfApi.Data;
using ReinfApi.DTOs;
using ReinfApi.Models;
using ReinfApi.Services;

namespace ReinfApi.Controllers;

[ApiController]
[Route("api/lotes")]
[Authorize]
public class LotesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtService _jwt;

    public LotesController(AppDbContext db, JwtService jwt)
    {
        _db = db;
        _jwt = jwt;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = _jwt.GetUserId(User);
        if (userId == null) return Unauthorized();

        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);
        var isAdmin      = _jwt.GetIsAdmin(User);

        IQueryable<ReinfApi.Models.Lote> query;

        if (isSuperAdmin)
        {
            // SuperAdmin vê todos os lotes
            query = _db.Lotes.Include(l => l.Usuario).OrderByDescending(l => l.DtRecepcao);
        }
        else if (isAdmin)
        {
            // TenantAdmin vê todos os lotes do seu cliente
            query = _db.Lotes
                .Include(l => l.Usuario)
                .Where(l => l.ClienteId == clienteId)
                .OrderByDescending(l => l.DtRecepcao);
        }
        else
        {
            // TenantUser: apenas lotes cujo NrInscricao pertence às suas empresas (dentro do cliente)
            var cnpjs = await _db.Usuarios
                .Where(u => u.Id == userId)
                .SelectMany(u => u.Empresas.Select(e => e.Cnpj))
                .ToListAsync();

            if (cnpjs.Count == 0)
            {
                query = _db.Lotes
                    .Include(l => l.Usuario)
                    .Where(l => l.UsuarioId == userId && l.ClienteId == clienteId)
                    .OrderByDescending(l => l.DtRecepcao);
            }
            else
            {
                var cnpjRaizes = cnpjs
                    .Select(c => System.Text.RegularExpressions.Regex.Replace(c, @"\D", ""))
                    .Where(c => c.Length >= 8)
                    .Select(c => c[..8])
                    .Distinct()
                    .ToList();
                var todosCnpjs = cnpjs.Concat(cnpjRaizes).Distinct().ToList();

                query = _db.Lotes
                    .Include(l => l.Usuario)
                    .Where(l => l.ClienteId == clienteId && todosCnpjs.Contains(l.NrInscricao))
                    .OrderByDescending(l => l.DtRecepcao);
            }
        }

        var total = await query.CountAsync();
        var rawItems = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // SpecifyKind fora do LINQ — EF Core não consegue traduzir DateTime.SpecifyKind para SQL
        var items = rawItems.Select(l => new LoteDto
        {
            IdEnvio = l.IdEnvio,
            Protocolo = l.ProtocoloEnvio,
            DtRecepcao = DateTime.SpecifyKind(l.DtRecepcao, DateTimeKind.Utc),
            TpEnvio = l.TpEnvio,
            Status = l.Status,
            Ambiente = l.Ambiente,
            NrInscricao = l.NrInscricao,
            PerApur = l.PerApur,
            CertificadoId = l.CertificadoId,
            EventosJson = l.EventosJson,
            UsuarioNome = l.Usuario?.Nome
        }).ToList();

        return Ok(new { total, page, pageSize, items });
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export()
    {
        var userId = _jwt.GetUserId(User);
        if (userId == null) return Unauthorized();

        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);
        var isAdmin      = _jwt.GetIsAdmin(User);

        IQueryable<ReinfApi.Models.Lote> query;
        if (isSuperAdmin)
        {
            query = _db.Lotes.OrderByDescending(l => l.DtRecepcao);
        }
        else if (isAdmin)
        {
            query = _db.Lotes.Where(l => l.ClienteId == clienteId).OrderByDescending(l => l.DtRecepcao);
        }
        else
        {
            var cnpjs = await _db.Usuarios
                .Where(u => u.Id == userId)
                .SelectMany(u => u.Empresas.Select(e => e.Cnpj))
                .ToListAsync();

            query = cnpjs.Count == 0
                ? _db.Lotes.Where(l => l.UsuarioId == userId && l.ClienteId == clienteId).OrderByDescending(l => l.DtRecepcao)
                : _db.Lotes.Where(l => l.ClienteId == clienteId && cnpjs.Contains(l.NrInscricao)).OrderByDescending(l => l.DtRecepcao);
        }

        var lotes = await query.ToListAsync();

        // Gera Excel
        byte[] xlsxBytes;
        using (var wb = new XLWorkbook())
        {
            var ws = wb.Worksheets.Add("Histórico REINF");
            string[] headers = { "ID", "Data / Hora", "Evento", "CNPJ", "Ambiente", "Protocolo", "Status" };
            for (int i = 0; i < headers.Length; i++)
            {
                var cell = ws.Cell(1, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#E97320");
                cell.Style.Font.FontColor = XLColor.White;
            }
            for (int r = 0; r < lotes.Count; r++)
            {
                var l = lotes[r];
                ws.Cell(r + 2, 1).Value = (double)l.IdEnvio;
                ws.Cell(r + 2, 2).Value = l.DtRecepcao.ToString("dd/MM/yyyy HH:mm");
                ws.Cell(r + 2, 3).Value = l.TpEnvio ?? "";
                ws.Cell(r + 2, 4).Value = l.NrInscricao ?? "";
                ws.Cell(r + 2, 5).Value = l.Ambiente ?? "";
                ws.Cell(r + 2, 6).Value = l.ProtocoloEnvio ?? "";
                ws.Cell(r + 2, 7).Value = l.Status ?? "";
            }
            ws.Columns().AdjustToContents();

            using var xlsxMs = new MemoryStream();
            wb.SaveAs(xlsxMs);
            xlsxBytes = xlsxMs.ToArray();
        }

        // Gera ZIP com Excel + XMLs individuais
        using var zipMs = new MemoryStream();
        using (var zip = new ZipArchive(zipMs, ZipArchiveMode.Create, leaveOpen: true))
        {
            // Adiciona o Excel
            var xlsxEntry = zip.CreateEntry($"historico-reinf-{DateTime.Now:yyyy-MM-dd}.xlsx");
            using (var entryStream = xlsxEntry.Open())
                await entryStream.WriteAsync(xlsxBytes);

            // Adiciona XMLs por lote
            foreach (var lote in lotes)
            {
                var safeId = ((long)lote.IdEnvio).ToString();
                if (!string.IsNullOrEmpty(lote.XmlEnvio))
                {
                    var envioEntry = zip.CreateEntry($"xml/lote_{safeId}_envio.xml");
                    using var envioStream = envioEntry.Open();
                    await envioStream.WriteAsync(Encoding.UTF8.GetBytes(lote.XmlEnvio));
                }
                if (!string.IsNullOrEmpty(lote.XmlRetorno))
                {
                    var retornoEntry = zip.CreateEntry($"xml/lote_{safeId}_retorno.xml");
                    using var retornoStream = retornoEntry.Open();
                    await retornoStream.WriteAsync(Encoding.UTF8.GetBytes(lote.XmlRetorno));
                }
            }
        }

        zipMs.Position = 0;
        var zipName = $"reinf-export-{DateTime.Now:yyyy-MM-dd}.zip";
        return File(zipMs.ToArray(), "application/zip", zipName);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(decimal id)
    {
        var userId = _jwt.GetUserId(User);
        if (userId == null) return Unauthorized();

        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);
        var isAdmin      = _jwt.GetIsAdmin(User);

        ReinfApi.Models.Lote? lote;
        if (isSuperAdmin)
        {
            lote = await _db.Lotes.Include(l => l.Usuario).FirstOrDefaultAsync(l => l.IdEnvio == id);
        }
        else if (isAdmin)
        {
            lote = await _db.Lotes.Include(l => l.Usuario)
                .FirstOrDefaultAsync(l => l.IdEnvio == id && l.ClienteId == clienteId);
        }
        else
        {
            var cnpjs = await _db.Usuarios
                .Where(u => u.Id == userId)
                .SelectMany(u => u.Empresas.Select(e => e.Cnpj))
                .ToListAsync();

            lote = await _db.Lotes
                .Include(l => l.Usuario)
                .FirstOrDefaultAsync(l => l.IdEnvio == id && l.ClienteId == clienteId
                    && (l.UsuarioId == userId || cnpjs.Contains(l.NrInscricao)));
        }
        if (lote == null) return NotFound();

        return Ok(new LoteDto
        {
            IdEnvio = lote.IdEnvio,
            Protocolo = lote.ProtocoloEnvio,
            DtRecepcao = DateTime.SpecifyKind(lote.DtRecepcao, DateTimeKind.Utc),
            TpEnvio = lote.TpEnvio,
            Status = lote.Status,
            Ambiente = lote.Ambiente,
            NrInscricao = lote.NrInscricao,
            PerApur = lote.PerApur,
            CertificadoId = lote.CertificadoId,
            EventosJson = lote.EventosJson,
            UsuarioNome = lote.Usuario?.Nome
        });
    }

    /// <summary>
    /// POST /api/lotes/finalizar
    /// Chamado pelo frontend após o polling do wizard concluir (situacaoLote=3).
    /// Salva o lote completo com status real, recibos e período de apuração.
    /// </summary>
    [HttpPost("finalizar")]
    public async Task<IActionResult> Finalizar([FromBody] FinalizarLoteRequest req)
    {
        var userId = _jwt.GetUserId(User);
        if (userId == null) return Unauthorized();

        // Idempotente: se o lote já foi salvo (ex: retry do frontend), retorna o existente
        var existing = await _db.Lotes.FirstOrDefaultAsync(l => l.ProtocoloEnvio == req.Protocolo);
        if (existing != null)
            return Ok(new { idEnvio = existing.IdEnvio, jaExistia = true });

        var (totBase, totIrrf, totInss, totCsll, totPis, totCofins) = ComputeTotais(req.TpEnvio, req.Rows);

        // Anexar dados originais da planilha a cada evento para permitir pré-preenchimento na retificação.
        // Os eventos são gerados na mesma ordem das linhas (EVT001 = linha 0, EVT002 = linha 1, etc.)
        for (var i = 0; i < req.Eventos.Count; i++)
        {
            if (i < req.Rows.Count)
                req.Eventos[i].RowData = req.Rows[i];
        }

        var loteId  = (decimal)(Math.Abs((long)Guid.NewGuid().GetHashCode()) % 999999999999999L + 1);
        var clienteId = _jwt.GetClienteId(User);
        var lote = new Lote
        {
            IdEnvio        = loteId,
            ProtocoloEnvio = req.Protocolo,
            DtRecepcao     = DateTime.UtcNow,
            NrInscricao    = req.NrInscricao,
            TpEnvio        = req.TpEnvio,
            Status         = req.Status,
            Ambiente       = req.Ambiente,
            UsuarioId      = userId,
            CertificadoId  = req.CertificadoId,
            ClienteId      = clienteId,
            PerApur        = req.PerApur,
            EventosJson    = JsonSerializer.Serialize(req.Eventos, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }),
            TotalBase      = totBase   > 0 ? totBase   : null,
            TotalIrrf      = totIrrf   > 0 ? totIrrf   : null,
            TotalInss      = totInss   > 0 ? totInss   : null,
            TotalCsll      = totCsll   > 0 ? totCsll   : null,
            TotalPis       = totPis    > 0 ? totPis    : null,
            TotalCofins    = totCofins > 0 ? totCofins : null,
        };

        _db.Lotes.Add(lote);
        await _db.SaveChangesAsync();

        return Ok(new { idEnvio = loteId, jaExistia = false });
    }

    private static (decimal base_, decimal irrf, decimal inss, decimal csll, decimal pis, decimal cofins)
        ComputeTotais(string tpEnvio, List<RowDto> rows)
    {
        decimal totBase = 0, totIrrf = 0, totInss = 0, totCsll = 0, totPis = 0, totCofins = 0;

        static decimal Parse(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return 0;
            s = s.Replace(',', '.');
            return decimal.TryParse(s, System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : 0;
        }

        if (tpEnvio == "R-4010")
            foreach (var row in rows) { var r = row.ToRow4010(); totBase += Parse(r.VlrRend); totIrrf += Parse(r.VlrIrrf); }
        else if (tpEnvio == "R-4020")
            foreach (var row in rows) { var r = row.ToRow4020(); totBase += Parse(r.VlrRend); totIrrf += Parse(r.VlrIrrf); totCsll += Parse(r.VlrRetCsrf); }
        else if (tpEnvio == "R-2010")
            foreach (var row in rows) { var r = row.ToRow2010(); totBase += Parse(r.VlrBrutoNF); totInss += Parse(r.VlrRetencao); }

        return (totBase, totIrrf, totInss, totCsll, totPis, totCofins);
    }
}
