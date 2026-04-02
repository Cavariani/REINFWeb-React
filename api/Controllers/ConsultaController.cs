using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReinfApi.Core;
using ReinfApi.Data;
using ReinfApi.DTOs;
using ReinfApi.Models;
using ReinfApi.Services;
using System.Text.Json;
using System.Xml;

namespace ReinfApi.Controllers;

[ApiController]
[Route("api/consulta")]
[Authorize]
public class ConsultaController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtService _jwt;
    private readonly CryptoService _crypto;
    private readonly ILogger<ConsultaController> _log;

    public ConsultaController(AppDbContext db, JwtService jwt, CryptoService crypto, ILogger<ConsultaController> log)
    {
        _db = db;
        _jwt = jwt;
        _crypto = crypto;
        _log = log;
    }

    [HttpGet]
    public async Task<IActionResult> Consultar(
        [FromQuery] string protocolo,
        [FromQuery] int certId,
        [FromQuery] string ambiente = "homologacao",
        [FromQuery] string tpEnvio = "",
        [FromQuery] bool skipCreate = false)
    {
        if (string.IsNullOrWhiteSpace(protocolo))
            return BadRequest(new { message = "Protocolo é obrigatório." });

        var userId = _jwt.GetUserId(User);
        if (userId == null) return Unauthorized();

        var clienteId    = _jwt.GetClienteId(User);
        var isSuperAdmin = _jwt.GetIsSuperAdmin(User);

        // Certificado deve pertencer ao tenant do usuário (SuperAdmin bypassa)
        var cert = await _db.Certificados
            .FirstOrDefaultAsync(c => c.Id == certId && (isSuperAdmin || c.ClienteId == clienteId));

        if (cert == null)
            return NotFound(new { message = "Certificado não encontrado." });

        try
        {
            var pfxPassword = _crypto.Decrypt(cert.SenhaCriptografada);
            var x509 = ReinfXmlSigner.LoadPfxFromBytes(cert.PfxBytes, pfxPassword);

            bool producao = ambiente == "producao";
            var xmlRetorno = await ReinfRestClient.ConsultarAsync(protocolo, x509, producao);

            var resultado = ParseRetornoConsulta(protocolo, xmlRetorno);

            // Enriquece com TpEnvio do banco (necessário para pré-preencher retificação)
            var loteDb = await _db.Lotes.FirstOrDefaultAsync(l => l.ProtocoloEnvio == protocolo);
            resultado.TpEnvio = loteDb?.TpEnvio;

            // Persiste/cria lote no banco quando processamento RF completou
            if (resultado.SituacaoLote == 3 && resultado.Eventos.Count > 0)
            {
                try
                {
                    // Converte eventos da consulta para EventoResultDto
                    var eventosFinais = resultado.Eventos.Select(ev =>
                    {
                        var cd = ev.CdResposta;
                        var aceito = cd == "0" || cd == "100" || cd == "101" || !string.IsNullOrEmpty(ev.NrRec);
                        return new EventoResultDto
                        {
                            Id        = ev.EventoId,
                            Tipo      = tpEnvio,
                            Status    = aceito ? "ACEITO" : "ERRO",
                            NrRecibo  = string.IsNullOrEmpty(ev.NrRec) ? null : ev.NrRec,
                            Ocorrencias = ev.Ocorrencias?.Select(o => new OcorrenciaResultDto
                            {
                                Tipo = o.Tipo, Codigo = o.Codigo,
                                Descricao = o.Descricao, Localizacao = o.Localizacao
                            }).ToList() ?? new()
                        };
                    }).ToList();

                    bool anyErr = eventosFinais.Any(e => e.Status == "ERRO");
                    bool allErr = eventosFinais.All(e => e.Status == "ERRO");
                    var statusFinal = allErr ? "ERRO" : anyErr ? "PARCIAL" : "ACEITO";

                    if (loteDb != null)
                    {
                        // Atualiza lote existente — preserva CnpjCpfBenef do EventosJson original
                        // (este bloco sempre roda, independente de skipCreate)
                        var eventosDb = string.IsNullOrEmpty(loteDb.EventosJson)
                            ? new List<EventoResultDto>()
                            : JsonSerializer.Deserialize<List<EventoResultDto>>(loteDb.EventosJson) ?? new();

                        foreach (var evFinal in eventosFinais)
                        {
                            var evDb = !string.IsNullOrEmpty(evFinal.Id)
                                ? eventosDb.FirstOrDefault(e => e.Id == evFinal.Id)
                                : null;
                            if (evDb == null)   // fallback posicional quando RF não ecoa o Id
                            {
                                var pos = eventosFinais.IndexOf(evFinal);
                                if (pos >= 0 && pos < eventosDb.Count)
                                    evDb = eventosDb[pos];
                            }
                            if (evDb != null)
                            {
                                evDb.Status     = evFinal.Status;
                                evDb.NrRecibo   = evFinal.NrRecibo ?? evDb.NrRecibo;
                                evDb.Ocorrencias = evFinal.Ocorrencias.Count > 0 ? evFinal.Ocorrencias : evDb.Ocorrencias;
                            }
                        }
                        loteDb.EventosJson = JsonSerializer.Serialize(eventosDb, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
                        loteDb.Status      = statusFinal;
                        await _db.SaveChangesAsync();
                    }
                    else if (!skipCreate)
                    {
                        // Fallback: cria lote mínimo (usuário saiu da tela durante polling)
                        // Não executa quando chamado pelo wizard (skipCreate=true) — finalizarLote cuida disso
                        var loteId = (decimal)(Math.Abs((long)Guid.NewGuid().GetHashCode()) % 999999999999999L + 1);
                        _db.Lotes.Add(new Lote
                        {
                            IdEnvio        = loteId,
                            ProtocoloEnvio = protocolo,
                            DtRecepcao     = DateTime.UtcNow,
                            NrInscricao    = resultado.NrInscricao ?? "",
                            TpEnvio        = tpEnvio,
                            Status         = statusFinal,
                            Ambiente       = ambiente,
                            UsuarioId      = userId,
                            CertificadoId  = certId,
                            ClienteId      = clienteId,
                            EventosJson    = JsonSerializer.Serialize(eventosFinais),
                        });
                        await _db.SaveChangesAsync();
                    }
                }
                catch (Exception persistEx)
                {
                    _log.LogWarning(persistEx, "Não foi possível persistir lote para o protocolo {Protocolo}", protocolo);
                }
            }

            return Ok(resultado);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Erro ao consultar protocolo {Protocolo}", protocolo);
            return BadRequest(new { message = ex.Message });
        }
    }

    private static ConsultaResultDto ParseRetornoConsulta(string protocolo, string xml)
    {
        var result = new ConsultaResultDto
        {
            Protocolo = protocolo,
            XmlBruto = xml,
            Eventos = new List<EventoConsultaDto>()
        };

        try
        {
            var doc = new XmlDocument();
            doc.LoadXml(xml);

            var ns = new XmlNamespaceManager(doc.NameTable);
            ns.AddNamespace("r", "http://www.reinf.esocial.gov.br/schema/retornoConsultaLoteEventos/v1_0_0");

            // situacaoLote
            var sitNode = doc.SelectSingleNode("//*[local-name()='situacaoLote']");
            result.SituacaoLote = int.TryParse(sitNode?.InnerText?.Trim(), out var sit) ? sit : 0;
            result.SituacaoDescricao = result.SituacaoLote switch
            {
                1 => "Em Processamento",
                2 => "Inválido",
                3 => "Processado",
                _ => "Desconhecido"
            };

            // dtHrRecepcao do lote
            var dtNode = doc.SelectSingleNode("//*[local-name()='dadosRecepcaoLote']/*[local-name()='dtHrRecepcao']");
            result.DtRecepcao = dtNode?.InnerText?.Trim();

            // nrInsc do contribuinte (para o fallback de criação de lote)
            var nrInscNode = doc.SelectSingleNode("//*[local-name()='nrInsc']");
            result.NrInscricao = nrInscNode?.InnerText?.Trim();

            // Versão da aplicação
            var versNode = doc.SelectSingleNode("//*[local-name()='versaoAplicativoRecepcao']");
            result.VersaoAplicativo = versNode?.InnerText?.Trim();

            // Eventos retornados
            var eventos = doc.SelectNodes("//*[local-name()='retornoEventos']/*[local-name()='evento']");
            if (eventos != null)
            {
                foreach (XmlNode evt in eventos)
                {
                    var evtDto = new EventoConsultaDto();
                    // Atributo pode ser "Id" (maiúsculo) ou "id" (minúsculo) dependendo do schema
                    evtDto.EventoId = evt.Attributes?["Id"]?.Value
                                   ?? evt.Attributes?["id"]?.Value
                                   ?? "";

                    // Status do evento — RF usa <cdRetorno> (0=aceito, 1=erro) dentro de <ideStatus>
                    // Schema alternativo usa <cdResposta> (100/101=aceito)
                    var cdNode = evt.SelectSingleNode(".//*[local-name()='cdRetorno']")
                              ?? evt.SelectSingleNode(".//*[local-name()='cdResposta']");
                    evtDto.CdResposta = cdNode?.InnerText?.Trim() ?? "";

                    var dsNode = evt.SelectSingleNode(".//*[local-name()='descRetorno']")
                              ?? evt.SelectSingleNode(".//*[local-name()='dsResposta']");
                    evtDto.DsResposta = dsNode?.InnerText?.Trim() ?? "";

                    // Número de recibo
                    // RF usa <nrRec> ou <nrRecArqBase> dependendo da versão do schema
                    var nrRecNode = evt.SelectSingleNode(".//*[local-name()='nrRec']")
                                ?? evt.SelectSingleNode(".//*[local-name()='nrRecArqBase']");
                    evtDto.NrRec = nrRecNode?.InnerText?.Trim() ?? "";

                    // Hash
                    var hashNode = evt.SelectSingleNode(".//*[local-name()='hash']");
                    evtDto.Hash = hashNode?.InnerText?.Trim() ?? "";

                    // Data/hora recepção do evento
                    var dtEvtNode = evt.SelectSingleNode(".//*[local-name()='dadosRecepcaoEvento']/*[local-name()='dtHrRecepcao']");
                    evtDto.DtHrRecepcao = dtEvtNode?.InnerText?.Trim() ?? "";

                    // Ocorrências — RF retorna <regOcorrs> com <dscResp>/<codResp>/<localErroAviso>
                    // Schema alternativo: <ocorrencias>/<ocorrencia> com <descricao>/<codigo>/<localizacao>
                    var ocorrencias = evt.SelectNodes(".//*[local-name()='regOcorrs']");
                    if (ocorrencias == null || ocorrencias.Count == 0)
                        ocorrencias = evt.SelectNodes(".//*[local-name()='ocorrencias']/*[local-name()='ocorrencia']");

                    if (ocorrencias != null && ocorrencias.Count > 0)
                    {
                        evtDto.Ocorrencias = new List<OcorrenciaDto>();
                        foreach (XmlNode oc in ocorrencias)
                        {
                            evtDto.Ocorrencias.Add(new OcorrenciaDto
                            {
                                Tipo = oc.SelectSingleNode("*[local-name()='tpOcorr']")?.InnerText?.Trim()
                                    ?? oc.SelectSingleNode("*[local-name()='tipo']")?.InnerText?.Trim() ?? "",
                                Codigo = oc.SelectSingleNode("*[local-name()='codResp']")?.InnerText?.Trim()
                                    ?? oc.SelectSingleNode("*[local-name()='codigo']")?.InnerText?.Trim() ?? "",
                                Descricao = oc.SelectSingleNode("*[local-name()='dscResp']")?.InnerText?.Trim()
                                    ?? oc.SelectSingleNode("*[local-name()='descricao']")?.InnerText?.Trim() ?? "",
                                Localizacao = oc.SelectSingleNode("*[local-name()='localErroAviso']")?.InnerText?.Trim()
                                    ?? oc.SelectSingleNode("*[local-name()='localizacao']")?.InnerText?.Trim() ?? "",
                            });
                        }
                    }

                    result.Eventos.Add(evtDto);
                }
            }
        }
        catch (Exception ex)
        {
            result.ErroParsing = $"Não foi possível parsear o XML de retorno: {ex.Message}";
        }

        return result;
    }
}

public class ConsultaResultDto
{
    public string Protocolo { get; set; } = "";
    public int SituacaoLote { get; set; }
    public string SituacaoDescricao { get; set; } = "";
    public string? DtRecepcao { get; set; }
    public string? VersaoAplicativo { get; set; }
    public string? ErroParsing { get; set; }
    public string XmlBruto { get; set; } = "";
    public string? TpEnvio { get; set; }
    public string? NrInscricao { get; set; }
    public List<EventoConsultaDto> Eventos { get; set; } = new();
}

public class EventoConsultaDto
{
    public string EventoId { get; set; } = "";
    public string CdResposta { get; set; } = "";
    public string DsResposta { get; set; } = "";
    public string NrRec { get; set; } = "";
    public string Hash { get; set; } = "";
    public string DtHrRecepcao { get; set; } = "";
    public List<OcorrenciaDto>? Ocorrencias { get; set; }
}

public class OcorrenciaDto
{
    public string Tipo { get; set; } = "";
    public string Codigo { get; set; } = "";
    public string Descricao { get; set; } = "";
    public string Localizacao { get; set; } = "";
}
