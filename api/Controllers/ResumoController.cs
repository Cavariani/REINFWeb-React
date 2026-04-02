using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReinfApi.Data;
using ReinfApi.DTOs;
using ReinfApi.Services;

namespace ReinfApi.Controllers;

[ApiController]
[Route("api/resumo")]
[Authorize]
public class ResumoController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtService _jwt;

    public ResumoController(AppDbContext db, JwtService jwt)
    {
        _db = db;
        _jwt = jwt;
    }

    /// <summary>
    /// GET /api/resumo?inicio=YYYY-MM&fim=YYYY-MM&cnpj=&ambiente=
    /// Retorna totais financeiros e breakdown por evento para o período.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string inicio,
        [FromQuery] string fim,
        [FromQuery] string? cnpj = null,
        [FromQuery] string? ambiente = null)
    {
        var userId = _jwt.GetUserId(User);
        if (userId == null) return Unauthorized();

        // Converte YYYY-MM para DateTime range
        if (!DateOnly.TryParseExact(inicio + "-01", "yyyy-MM-dd", out var dtInicioDate) ||
            !DateOnly.TryParseExact(fim + "-01", "yyyy-MM-dd", out var dtFimDateRaw))
            return BadRequest(new { message = "Formato de data inválido. Use YYYY-MM." });

        var dtInicio = dtInicioDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        // Fim = último dia do mês informado
        var dtFim    = dtFimDateRaw.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)
                         .AddMonths(1).AddSeconds(-1);

        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);
        var isAdmin      = _jwt.GetIsAdmin(User);

        // Monta query base
        IQueryable<ReinfApi.Models.Lote> query;
        if (isSuperAdmin)
        {
            query = _db.Lotes.AsQueryable();
        }
        else if (isAdmin)
        {
            query = _db.Lotes.Where(l => l.ClienteId == clienteId);
        }
        else
        {
            var cnpjs = await _db.Usuarios
                .Where(u => u.Id == userId)
                .SelectMany(u => u.Empresas.Select(e => e.Cnpj))
                .ToListAsync();

            query = cnpjs.Count == 0
                ? _db.Lotes.Where(l => l.UsuarioId == userId && l.ClienteId == clienteId)
                : _db.Lotes.Where(l => l.ClienteId == clienteId && cnpjs.Contains(l.NrInscricao));
        }

        // Aplica filtros
        query = query.Where(l => l.DtRecepcao >= dtInicio && l.DtRecepcao <= dtFim);

        if (!string.IsNullOrWhiteSpace(cnpj))
        {
            var cnpjDigits = new string(cnpj.Where(char.IsDigit).ToArray());
            var cnpjRoot = cnpjDigits.Length >= 8 ? cnpjDigits.Substring(0, 8) : cnpjDigits;
            query = query.Where(l => l.NrInscricao.StartsWith(cnpjRoot));
        }

        if (!string.IsNullOrWhiteSpace(ambiente))
            query = query.Where(l => l.Ambiente == ambiente);

        // Apenas lotes aceitos/parciais para o resumo financeiro
        query = query.Where(l => l.Status == "ACEITO" || l.Status == "PARCIAL");

        var lotes = await query.OrderByDescending(l => l.DtRecepcao).ToListAsync();

        // Agrega totais
        decimal totalBase   = lotes.Sum(l => l.TotalBase   ?? 0);
        decimal totalIrrf   = lotes.Sum(l => l.TotalIrrf   ?? 0);
        decimal totalInss   = lotes.Sum(l => l.TotalInss   ?? 0);
        decimal totalCsll   = lotes.Sum(l => l.TotalCsll   ?? 0);
        decimal totalPis    = lotes.Sum(l => l.TotalPis    ?? 0);
        decimal totalCofins = lotes.Sum(l => l.TotalCofins ?? 0);

        // Breakdown por evento
        var breakdown = lotes
            .GroupBy(l => l.TpEnvio)
            .Select(g => new {
                tipo   = g.Key,
                qtd    = g.Count(),
                base_  = g.Sum(l => l.TotalBase ?? 0),
                irrf   = g.Sum(l => l.TotalIrrf ?? 0),
                inss   = g.Sum(l => l.TotalInss ?? 0),
            })
            .OrderBy(x => x.tipo)
            .ToList();

        // Breakdown por natureza de rendimento (R-4010 e R-4020 — campo natRend no rowData)
        static decimal P(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return 0;
            return decimal.TryParse(s.Replace(',', '.'),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : 0;
        }

        var jsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        // Processamento natRend separado por R-4010 e R-4020
        var nat4010Base = new Dictionary<string, decimal>();
        var nat4010Irrf = new Dictionary<string, decimal>();
        var nat4010Qtd  = new Dictionary<string, int>();
        var nat4020Base = new Dictionary<string, decimal>();
        var nat4020Irrf = new Dictionary<string, decimal>();
        var nat4020Qtd  = new Dictionary<string, int>();

        foreach (var lote in lotes.Where(l =>
            (l.TpEnvio == "R-4010" || l.TpEnvio == "R-4020") &&
            !string.IsNullOrEmpty(l.EventosJson)))
        {
            try
            {
                var eventos = JsonSerializer.Deserialize<List<EventoResultDto>>(lote.EventosJson!, jsonOpts);
                if (eventos == null) continue;

                var isR4010 = lote.TpEnvio == "R-4010";
                var baseDict = isR4010 ? nat4010Base : nat4020Base;
                var irrfDict = isR4010 ? nat4010Irrf : nat4020Irrf;
                var qtdDict  = isR4010 ? nat4010Qtd  : nat4020Qtd;

                foreach (var ev in eventos)
                {
                    if (ev.RowData == null) continue;
                    ev.RowData.TryGetValue("natRend", out var nat);
                    if (string.IsNullOrWhiteSpace(nat)) continue;

                    ev.RowData.TryGetValue("vlrRend", out var vlrRendStr);
                    ev.RowData.TryGetValue("vlrIrrf",  out var vlrIrrfStr);

                    if (!baseDict.ContainsKey(nat)) { baseDict[nat] = 0; irrfDict[nat] = 0; qtdDict[nat] = 0; }
                    baseDict[nat] += P(vlrRendStr);
                    irrfDict[nat] += P(vlrIrrfStr);
                    qtdDict[nat]++;
                }
            }
            catch { /* JSON malformado — ignora */ }
        }

        static List<object> BuildNatRend(
            Dictionary<string, decimal> baseD,
            Dictionary<string, decimal> irrfD,
            Dictionary<string, int>     qtdD)
            => baseD
                .Select(kv => (object)new {
                    natRend    = kv.Key,
                    base_      = kv.Value,
                    irrf       = irrfD[kv.Key],
                    qtdEventos = qtdD[kv.Key],
                })
                .OrderByDescending(x => ((dynamic)x).base_)
                .ToList();

        var natRendBreakdown4010 = BuildNatRend(nat4010Base, nat4010Irrf, nat4010Qtd);
        var natRendBreakdown4020 = BuildNatRend(nat4020Base, nat4020Irrf, nat4020Qtd);
        // Mantém lista combinada para compatibilidade
        var natRendBreakdown = natRendBreakdown4010.Concat(natRendBreakdown4020)
            .Cast<dynamic>()
            .GroupBy(x => (string)x.natRend)
            .Select(g => (object)new {
                natRend    = g.Key,
                base_      = g.Sum(x => (decimal)x.base_),
                irrf       = g.Sum(x => (decimal)x.irrf),
                qtdEventos = g.Sum(x => (int)x.qtdEventos),
            })
            .OrderByDescending(x => ((dynamic)x).base_)
            .ToList();

        // Breakdown por tipo de serviço (R-2010 — campo tpServ no rowData)
        var tpServBruto    = new Dictionary<string, decimal>();
        var tpServRetencao = new Dictionary<string, decimal>();
        var tpServQtd      = new Dictionary<string, int>();

        foreach (var lote in lotes.Where(l =>
            l.TpEnvio == "R-2010" && !string.IsNullOrEmpty(l.EventosJson)))
        {
            try
            {
                var eventos = JsonSerializer.Deserialize<List<EventoResultDto>>(lote.EventosJson!, jsonOpts);
                if (eventos == null) continue;
                foreach (var ev in eventos)
                {
                    if (ev.RowData == null) continue;
                    ev.RowData.TryGetValue("tpServ", out var tpServ);
                    if (string.IsNullOrWhiteSpace(tpServ)) continue;

                    ev.RowData.TryGetValue("vlrBrutoNF", out var vlrBrutoStr);
                    ev.RowData.TryGetValue("vlrRetencao", out var vlrRetStr);

                    if (!tpServBruto.ContainsKey(tpServ))
                    { tpServBruto[tpServ] = 0; tpServRetencao[tpServ] = 0; tpServQtd[tpServ] = 0; }

                    tpServBruto[tpServ]    += P(vlrBrutoStr);
                    tpServRetencao[tpServ] += P(vlrRetStr);
                    tpServQtd[tpServ]++;
                }
            }
            catch { /* JSON malformado — ignora */ }
        }

        var tpServBreakdown = tpServBruto
            .Select(kv => new {
                tpServ      = kv.Key,
                vlrBruto    = kv.Value,
                vlrRetencao = tpServRetencao[kv.Key],
                qtdEventos  = tpServQtd[kv.Key],
            })
            .OrderByDescending(x => x.vlrBruto)
            .ToList();

        // Lista de lotes do período
        var lotesDto = lotes.Select(l => new {
            idEnvio    = l.IdEnvio,
            protocolo  = l.ProtocoloEnvio,
            dtRecepcao = l.DtRecepcao,
            tpEnvio    = l.TpEnvio,
            cnpj       = l.NrInscricao,
            status     = l.Status,
            ambiente   = l.Ambiente,
            totalBase  = l.TotalBase,
            totalIrrf  = l.TotalIrrf,
            totalInss  = l.TotalInss,
        }).ToList();

        return Ok(new {
            periodo    = new { inicio, fim },
            totalLotes = lotes.Count,
            totalAceitos    = lotes.Count(l => l.Status == "ACEITO"),
            totalParciais   = lotes.Count(l => l.Status == "PARCIAL"),
            totalBase, totalIrrf, totalInss, totalCsll, totalPis, totalCofins,
            breakdown,
            natRendBreakdown,
            natRendBreakdown4010,
            natRendBreakdown4020,
            tpServBreakdown,
            lotes = lotesDto
        });
    }
}
