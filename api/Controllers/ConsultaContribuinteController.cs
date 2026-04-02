using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReinfApi.Core;
using ReinfApi.Data;
using ReinfApi.Services;
using System.Xml;

namespace ReinfApi.Controllers;

[ApiController]
[Route("api/consulta/contribuinte")]
[Authorize]
public class ConsultaContribuinteController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtService _jwt;
    private readonly CryptoService _crypto;
    private readonly ILogger<ConsultaContribuinteController> _log;

    public ConsultaContribuinteController(
        AppDbContext db, JwtService jwt, CryptoService crypto,
        ILogger<ConsultaContribuinteController> log)
    {
        _db = db;
        _jwt = jwt;
        _crypto = crypto;
        _log = log;
    }

    /// <summary>
    /// Consulta se o contribuinte possui R-1000 cadastrado na Receita Federal.
    /// GET /api/consulta/contribuinte?cnpj=...&amp;certId=...&amp;ambiente=homologacao
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Consultar(
        [FromQuery] string cnpj,
        [FromQuery] int certId,
        [FromQuery] string ambiente = "homologacao")
    {
        // ── Validação de entrada ──────────────────────────────────────────────
        if (string.IsNullOrWhiteSpace(cnpj))
            return BadRequest(new { message = "O CNPJ do contribuinte é obrigatório." });

        var cnpj14 = System.Text.RegularExpressions.Regex.Replace(cnpj, @"\D", "");
        if (cnpj14.Length != 14)
            return BadRequest(new { message = "O CNPJ informado deve ter 14 dígitos numéricos." });

        if (certId <= 0)
            return BadRequest(new { message = "É necessário selecionar um certificado digital." });

        var userId = _jwt.GetUserId(User);
        if (userId == null) return Unauthorized();

        // ── Carrega certificado (mesma lógica do ConsultaController) ──────────
        var cert = _jwt.GetIsAdmin(User)
            ? await _db.Certificados
                .Include(c => c.Empresa)
                .FirstOrDefaultAsync(c => c.Id == certId)
            : await _db.Certificados
                .Include(c => c.Empresa)
                .FirstOrDefaultAsync(c =>
                    c.Id == certId &&
                    (c.Empresa != null && c.Empresa.IsEmissora
                     || c.EmpresaId == null
                     || c.UsuarioId == userId));

        if (cert == null)
            return NotFound(new { message = "Certificado não encontrado ou sem permissão de acesso." });

        try
        {
            var pfxPassword = _crypto.Decrypt(cert.SenhaCriptografada);
            var x509 = ReinfXmlSigner.LoadPfxFromBytes(cert.PfxBytes, pfxPassword);

            bool producao = ambiente == "producao";
            var (encontrado, xmlBody) = await ReinfRestClient.ConsultarContribuinteAsync(cnpj14, x509, producao);

            _log.LogInformation(
                "ConsultarContribuinte {Cnpj8}/{Amb}: encontrado={Found} bodyLen={Len} body={Body}",
                cnpj14[..8], ambiente, encontrado, xmlBody?.Length ?? 0,
                string.IsNullOrWhiteSpace(xmlBody) ? "(vazio)" : xmlBody);

            if (!encontrado)
            {
                return Ok(new ConsultaContribuinteResultDto
                {
                    Cadastrado = false,
                    Mensagem = "Contribuinte não possui R-1000 cadastrado neste ambiente.",
                    RawXml = string.IsNullOrWhiteSpace(xmlBody) ? null : xmlBody
                });
            }

            // ── Parseia o XML retornado pela RF ───────────────────────────────
            var resultado = ParseRetornoContribuinte(xmlBody!);
            resultado.RawXml = xmlBody; // temporário: expõe o XML para diagnóstico
            return Ok(resultado);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Erro ao consultar contribuinte {Cnpj} (certId={CertId}, ambiente={Ambiente})",
                cnpj14, certId, ambiente);
            return BadRequest(new
            {
                message = "Não foi possível consultar o cadastro na Receita Federal. " +
                          "Verifique se o certificado está válido e tente novamente."
            });
        }
    }

    private static ConsultaContribuinteResultDto ParseRetornoContribuinte(string xml)
    {
        var dto = new ConsultaContribuinteResultDto { Cadastrado = true };

        try
        {
            var doc = new XmlDocument();
            doc.LoadXml(xml);

            string Get(string tag) =>
                doc.SelectSingleNode($"//*[local-name()='{tag}']")?.InnerText?.Trim() ?? "";

            var cdRetorno  = Get("cdRetorno");
            var descRetorno = Get("descRetorno");

            // cdRetorno=0 → nenhum evento cadastrado
            // cdRetorno=1 → "Um ou mais eventos encontrados" = SUCESSO, recibos estão no XML
            // cdRetorno=3 ou outro → erro real da RF
            if (cdRetorno == "0")
            {
                return new ConsultaContribuinteResultDto
                {
                    Cadastrado = false,
                    Mensagem = "Contribuinte não possui R-1000 cadastrado neste ambiente."
                };
            }

            if (cdRetorno != "1" && cdRetorno.Length > 0)
            {
                var dscResp = Get("dscResp") is { Length: > 0 } d ? d : descRetorno;
                return new ConsultaContribuinteResultDto
                {
                    Cadastrado  = false,
                    Mensagem    = "A Receita Federal retornou um erro ao consultar o cadastro.",
                    ErroParsing = dscResp is { Length: > 0 } ? dscResp : $"Código RF: {cdRetorno}"
                };
            }

            // cdRetorno=1: a RF pode retornar dois formatos distintos:
            //   Formato A (novo): retornoEventos > evento   (sem nrRec)
            //   Formato B (antigo): recibosEventos > ideEventoRecibo (com nrRec)
            // Tenta formato A primeiro; cai no B se não encontrar.
            var eventoNodes = doc.SelectNodes("//*[local-name()='retornoEventos']//*[local-name()='evento']");
            if (eventoNodes == null || eventoNodes.Count == 0)
                eventoNodes = doc.SelectNodes("//*[local-name()='recibosEventos']//*[local-name()='ideEventoRecibo']");

            XmlNode? recibo = null;
            if (eventoNodes != null && eventoNodes.Count > 0)
                recibo = eventoNodes[eventoNodes.Count - 1]; // o mais recente

            // .//* = busca em todos os descendentes, não apenas filhos diretos
            string GetFrom(XmlNode? node, string tag) =>
                node?.SelectSingleNode($".//*[local-name()='{tag}']")?.InnerText?.Trim() ?? "";

            // nrRec pode não existir no formato A — tratar como opcional
            dto.NrRecibo = GetFrom(recibo, "nrRec") is { Length: > 0 } r ? r :
                           GetFrom(recibo, "nrRecibo") is { Length: > 0 } r2 ? r2 :
                           GetFrom(recibo, "NrRecibo") is { Length: > 0 } r3 ? r3 :
                           Get("nrRec") is { Length: > 0 } r4 ? r4 :
                           Get("nrRecibo") is { Length: > 0 } r5 ? r5 : null;

            // iniValid/fimValid: tenta no nó do evento primeiro, depois em todo o documento
            dto.IniValid = GetFrom(recibo, "iniValid") is { Length: > 0 } i ? i :
                           GetFrom(recibo, "InicioValidade") is { Length: > 0 } i2 ? i2 :
                           Get("iniValid");

            dto.FimValid = GetFrom(recibo, "fimValid") is { Length: > 0 } f ? f :
                           GetFrom(recibo, "FimValidade") is { Length: > 0 } f2 ? f2 :
                           Get("fimValid");
            if (string.IsNullOrWhiteSpace(dto.FimValid)) dto.FimValid = null;

            var sitRaw = GetFrom(recibo, "cdSitEvento") is { Length: > 0 } s ? s :
                         GetFrom(recibo, "SituacaoEvento") is { Length: > 0 } s2 ? s2 :
                         Get("cdSitEvento");
            dto.Situacao = sitRaw;

            // Se não achamos nem iniValid, não conseguimos confirmar nada
            if (string.IsNullOrEmpty(dto.IniValid) && string.IsNullOrEmpty(dto.NrRecibo))
            {
                dto.Mensagem = "Cadastro encontrado na Receita Federal, mas não foi possível ler os detalhes.";
                dto.ErroParsing = "O XML retornado não contém iniValid nem nrRec reconhecíveis.";
                return dto;
            }

            // Determina se está ativo: sem fimValid = ativo indefinidamente
            bool ativo = sitRaw != "9" && string.IsNullOrEmpty(dto.FimValid);
            dto.Mensagem = ativo
                ? $"R-1000 ativo desde {dto.IniValid}. Contribuinte cadastrado na Receita Federal."
                : sitRaw == "9"
                    ? $"R-1000 encerrado (iniValid={dto.IniValid}, fimValid={dto.FimValid})."
                    : $"R-1000 encontrado (iniValid={dto.IniValid}{(dto.FimValid != null ? $", fimValid={dto.FimValid}" : "")}).";
        }
        catch (Exception ex)
        {
            dto.ErroParsing = $"Não foi possível ler os detalhes do retorno: {ex.Message}";
            dto.Mensagem    = "Cadastro encontrado, mas não foi possível ler os detalhes.";
        }

        return dto;
    }
}

public class ConsultaContribuinteResultDto
{
    public bool    Cadastrado   { get; set; }
    public string? NrRecibo     { get; set; }
    public string? IniValid     { get; set; }
    public string? FimValid     { get; set; }
    /// <summary>1 = Ativo, 9 = Encerrado</summary>
    public string? Situacao     { get; set; }
    public string? Mensagem     { get; set; }
    public string? ErroParsing  { get; set; }
    /// <summary>XML bruto da RF — exposto temporariamente para diagnóstico</summary>
    public string? RawXml       { get; set; }
}
