using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReinfApi.Data;
using ReinfApi.DTOs;
using ReinfApi.Services;

namespace ReinfApi.Controllers;

[ApiController]
[Route("api/informe")]
[Authorize]
public class InformeController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtService   _jwt;

    // Tabela 01 RF — naturezas mais comuns. Código → Descrição resumida.
    private static readonly Dictionary<string, string> NatRendDesc = new()
    {
        { "10001", "Rendimentos do Trabalho com Vínculo Empregatício" },
        { "10002", "Férias" },
        { "10003", "13º Salário" },
        { "11001", "Rendimentos do Trabalho Sem Vínculo Empregatício — PF" },
        { "11002", "Transporte de Cargas — Autônomo" },
        { "11003", "Transporte de Passageiros — Autônomo" },
        { "12001", "Aluguéis e Royalties — PF" },
        { "13001", "Lucros e Dividendos" },
        { "13002", "Lucros e Dividendos — Participações" },
        { "14001", "Prêmios em Dinheiro" },
        { "14002", "Prêmios em Bens" },
        { "15001", "Outros Rendimentos a PF" },
        { "20001", "Serviços Profissionais — PJ" },
        { "20011", "Serviços de Limpeza e Conservação — PJ" },
        { "20012", "Vigilância e Segurança — PJ" },
        { "20013", "Locação de Mão-de-Obra — PJ" },
        { "20014", "Transporte de Cargas — PJ" },
        { "20015", "Transporte de Passageiros — PJ" },
        { "20021", "Publicidade e Propaganda — PJ" },
        { "20022", "Mediação de Negócios — PJ" },
        { "20023", "Factoring — PJ" },
        { "20030", "Consultoria — PJ" },
        { "20031", "Assessoria e Análise — PJ" },
        { "21001", "Aluguéis e Royalties — PJ" },
        { "22001", "Outros Rendimentos a PJ" },
        { "40001", "Serviços — INSS Retenção R-2010" },
    };

    public InformeController(AppDbContext db, JwtService jwt)
    {
        _db  = db;
        _jwt = jwt;
    }

    /// <summary>
    /// GET /api/informe?cnpjContrib=XX.XXX...&ano=2025
    /// Retorna lista de beneficiários com totais anuais e breakdown mensal.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string cnpjContrib,
        [FromQuery] int    ano)
    {
        if (string.IsNullOrWhiteSpace(cnpjContrib))
            return BadRequest(new { message = "Informe o CNPJ da empresa contribuinte." });
        if (ano < 2020 || ano > 2099)
            return BadRequest(new { message = "Ano inválido." });

        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);
        var isAdmin      = _jwt.GetIsAdmin(User);

        // Normaliza CNPJ (apenas dígitos → prefixo de 8 dígitos para suportar filiais)
        var cnpjDigits = new string(cnpjContrib.Where(char.IsDigit).ToArray());
        var cnpjRoot   = cnpjDigits.Length >= 8 ? cnpjDigits[..8] : cnpjDigits;

        var periodoPrefix = ano.ToString();   // "2025" — filtra PERIODO_APURACAO LIKE '2025-%'

        IQueryable<ReinfApi.Models.Lote> query = _db.Lotes;

        if (!isSuperAdmin)
            query = query.Where(l => l.ClienteId == clienteId);

        query = query
            .Where(l => l.NrInscricao.StartsWith(cnpjRoot))
            .Where(l => l.PerApur != null && l.PerApur.StartsWith(periodoPrefix))
            .Where(l => l.Status == "ACEITO" || l.Status == "PARCIAL")
            .Where(l => l.EventosJson != null);

        var lotes = await query.ToListAsync();

        if (lotes.Count == 0)
            return Ok(new List<InformeDto>());

        var jsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        static decimal P(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return 0;
            return decimal.TryParse(s.Replace(',', '.'),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : 0;
        }

        // Chave: (tipo, cpfCnpjBenef, natRend) → acumulador por período
        var acc = new Dictionary<string, BenefKey>();

        foreach (var lote in lotes)
        {
            List<EventoResultDto>? eventos;
            try { eventos = JsonSerializer.Deserialize<List<EventoResultDto>>(lote.EventosJson!, jsonOpts); }
            catch { continue; }
            if (eventos == null) continue;

            foreach (var ev in eventos)
            {
                if (ev.RowData == null) continue;

                var rd    = ev.RowData;
                var tipo  = lote.TpEnvio;
                var per   = lote.PerApur ?? "";

                string benef, nome, nat;
                decimal rend, irrf, csll, inss;

                switch (tipo)
                {
                    case "R-4010":
                        benef = rd.GetValueOrDefault("cpfBenef", "");
                        nome  = rd.GetValueOrDefault("nomeBenef", "");
                        nat   = rd.GetValueOrDefault("natRend", "");
                        rend  = P(rd.GetValueOrDefault("vlrRend"));
                        irrf  = P(rd.GetValueOrDefault("vlrIrrf"));
                        csll  = 0;
                        inss  = 0;
                        break;

                    case "R-4020":
                        benef = rd.GetValueOrDefault("cnpjBenef", "");
                        nome  = rd.GetValueOrDefault("nomeBenef", rd.GetValueOrDefault("razaoBenef", ""));
                        nat   = rd.GetValueOrDefault("natRend", "");
                        rend  = P(rd.GetValueOrDefault("vlrRend"));
                        irrf  = P(rd.GetValueOrDefault("vlrIrrf"));
                        csll  = P(rd.GetValueOrDefault("vlrRetCsrf"));
                        inss  = 0;
                        break;

                    case "R-2010":
                        benef = rd.GetValueOrDefault("cnpjPrestador", "");
                        nome  = rd.GetValueOrDefault("nomePrestador", rd.GetValueOrDefault("razaoPrestador", ""));
                        nat   = "40001";   // Código sintético para serviços R-2010
                        rend  = P(rd.GetValueOrDefault("vlrBrutoNF"));
                        irrf  = 0;
                        csll  = 0;
                        inss  = P(rd.GetValueOrDefault("vlrRetencao"));
                        break;

                    default:
                        continue;
                }

                if (string.IsNullOrWhiteSpace(benef)) continue;

                var chave = $"{tipo}|{benef}|{nat}";
                if (!acc.TryGetValue(chave, out var bk))
                {
                    bk = new BenefKey { Tipo = tipo, Benef = benef, Nome = nome, Nat = nat };
                    acc[chave] = bk;
                }
                // Atualiza nome se ainda vazio
                if (string.IsNullOrWhiteSpace(bk.Nome) && !string.IsNullOrWhiteSpace(nome))
                    bk.Nome = nome;

                bk.TotalRend += rend;
                bk.TotalIrrf += irrf;
                bk.TotalCsll += csll;
                bk.TotalInss += inss;

                if (!bk.Periodos.TryGetValue(per, out var pd))
                {
                    pd = new PeriodAcc();
                    bk.Periodos[per] = pd;
                }
                pd.Rend += rend;
                pd.Irrf += irrf;
                pd.Csll += csll;
                pd.Inss += inss;
            }
        }

        var result = acc.Values
            .OrderBy(b => b.Tipo)
            .ThenByDescending(b => b.TotalRend)
            .Select(b => new InformeDto
            {
                Tipo          = b.Tipo,
                CpfCnpjBenef  = b.Benef,
                NomeBenef     = b.Nome,
                NatRend       = b.Nat,
                NatRendDesc   = NatRendDesc.GetValueOrDefault(b.Nat, $"Natureza {b.Nat}"),
                VlrRend       = b.TotalRend,
                VlrIrrf       = b.TotalIrrf,
                VlrCsll       = b.TotalCsll,
                VlrInss       = b.TotalInss,
                Periodos      = b.Periodos
                    .OrderBy(p => p.Key)
                    .Select(p => new InformePeriodoDto
                    {
                        Periodo = p.Key,
                        VlrRend = p.Value.Rend,
                        VlrIrrf = p.Value.Irrf,
                        VlrCsll = p.Value.Csll,
                        VlrInss = p.Value.Inss,
                    })
                    .ToList(),
            })
            .ToList();

        return Ok(result);
    }

    private class BenefKey
    {
        public string Tipo  { get; set; } = "";
        public string Benef { get; set; } = "";
        public string Nome  { get; set; } = "";
        public string Nat   { get; set; } = "";
        public decimal TotalRend { get; set; }
        public decimal TotalIrrf { get; set; }
        public decimal TotalCsll { get; set; }
        public decimal TotalInss { get; set; }
        public Dictionary<string, PeriodAcc> Periodos { get; set; } = new();
    }

    private class PeriodAcc
    {
        public decimal Rend { get; set; }
        public decimal Irrf { get; set; }
        public decimal Csll { get; set; }
        public decimal Inss { get; set; }
    }
}
