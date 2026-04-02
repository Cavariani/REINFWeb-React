using System.Text.Json;
using System.Xml;
using ReinfApi.Core;
using ReinfApi.Data;
using ReinfApi.DTOs;
using ReinfApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ReinfApi.Services;

public class ReinfService
{
    private readonly AppDbContext _db;
    private readonly CryptoService _crypto;
    private readonly ILogger<ReinfService> _log;

    public ReinfService(AppDbContext db, CryptoService crypto, ILogger<ReinfService> log)
    {
        _db = db;
        _crypto = crypto;
        _log = log;
    }

    public async Task<EnvioResponse> EnviarAsync(EnvioRequest req, int userId)
    {
        // 1. Carrega certificado — qualquer cert na gaveta pode ser usado por qualquer usuário
        var cert = await _db.Certificados
            .FirstOrDefaultAsync(c => c.Id == req.CertificateId)
            ?? throw new InvalidOperationException("Certificado não encontrado ou sem permissão de acesso.");

        var pfxPassword = _crypto.Decrypt(cert.SenhaCriptografada);
        var x509 = ReinfXmlSigner.LoadPfxFromBytes(cert.PfxBytes, pfxPassword);

        bool producao = req.Ambiente == "producao";
        byte tpAmb = (byte)(producao ? 1 : 2);

        var batch = new BatchBuilder();
        var results = new List<EventoResultDto>();

        // 2. Monta e assina cada evento
        switch (req.Evento)
        {
            case "R-4010":
                foreach (var row in req.Rows)
                {
                    var r4010 = row.ToRow4010();
                    try
                    {
                        if (r4010.Acao == "EXCLUIR")
                        {
                            var cnpj = Core.ParseUtil.OnlyDigits(r4010.CnpjContrib.Length > 0 ? r4010.CnpjContrib : r4010.CnpjEstab);
                            var (xmlR9, idR9) = XmlBuilder4010.BuildR9000(cnpj, r4010.NrRecibo, r4010.PerApur, tpAmb);
                            var signedR9 = ReinfXmlSigner.SignR9000(xmlR9, x509);
                            batch.AddEvent(idR9, signedR9, 1, cnpj.Length == 14 ? cnpj[..8] : cnpj);
                            results.Add(new EventoResultDto { Id = idR9, Tipo = "R-9000", Status = "PENDENTE" });
                        }
                        else
                        {
                            byte indRetif = r4010.Acao == "ALTERAR" ? (byte)2 : (byte)1;
                            var built = XmlBuilder4010.Build(r4010, tpAmb, indRetif, r4010.NrRecibo);
                            var xml = XmlBuilder4010.Serialize(built.Reinf);
                            var signed = ReinfXmlSigner.SignAtRoot(xml, x509);
                            batch.AddEvent(built.Id, signed, built.TpInsc, built.NrInsc);
                            results.Add(new EventoResultDto
                            {
                                Id           = built.Id,
                                Tipo         = "R-4010",
                                Status       = "PENDENTE",
                                CnpjCpfBenef = r4010.CpfBenef,
                                CnpjEstab    = Core.ParseUtil.OnlyDigits(r4010.CnpjEstab.Length > 0 ? r4010.CnpjEstab : r4010.CnpjContrib),
                                PerApur      = r4010.PerApur,
                                NatRend      = r4010.NatRend,
                                VlrPrincipal = SumMoney([r4010.VlrRend]),
                                VlrIrrf      = SumMoney([r4010.VlrIrrf]),
                            });
                        }
                    }
                    catch (Exception ex)
                    {
                        results.Add(new EventoResultDto { Id = "", Tipo = "R-4010", Status = "ERRO", Mensagem = ex.Message });
                    }
                }
                break;

            case "R-4020":
                // Agrupa por (perApur, cnpjEstab, cnpjBenef)
                var grupos4020 = req.Rows
                    .Select(r => r.ToRow4020())
                    .GroupBy(r => (r.PerApur, r.CnpjEstab, r.CnpjBenef));

                foreach (var g in grupos4020)
                {
                    var linhas = g.ToList();
                    try
                    {
                        if (linhas[0].Acao == "EXCLUIR")
                        {
                            var cnpj = Core.ParseUtil.OnlyDigits(linhas[0].CnpjContrib);
                            var (xmlR9, idR9) = XmlBuilder4020.BuildR9000(cnpj, linhas[0].NrRecibo, linhas[0].PerApur, tpAmb);
                            var signedR9 = ReinfXmlSigner.SignR9000(xmlR9, x509);
                            batch.AddEvent(idR9, signedR9, 1, cnpj.Length == 14 ? cnpj[..8] : cnpj);
                            results.Add(new EventoResultDto { Id = idR9, Tipo = "R-9000", Status = "PENDENTE" });
                        }
                        else
                        {
                            byte indRetif = linhas[0].Acao == "ALTERAR" ? (byte)2 : (byte)1;
                            var built = XmlBuilder4020.BuildGrouped(linhas, tpAmb, indRetif, linhas[0].NrRecibo);
                            var signed = ReinfXmlSigner.SignAtRoot(built.Reinf, x509);
                            batch.AddEvent(built.Id, signed, built.TpInsc, built.NrInsc);
                            results.Add(new EventoResultDto
                            {
                                Id           = built.Id,
                                Tipo         = "R-4020",
                                Status       = "PENDENTE",
                                CnpjCpfBenef = linhas[0].CnpjBenef,
                                CnpjEstab    = Core.ParseUtil.OnlyDigits(linhas[0].CnpjEstab.Length > 0 ? linhas[0].CnpjEstab : linhas[0].CnpjContrib),
                                PerApur      = linhas[0].PerApur,
                                NatRend      = linhas[0].NatRend,
                                VlrPrincipal = SumMoney(linhas.Select(l => l.VlrRend)),
                                VlrIrrf      = SumMoney(linhas.Select(l => l.VlrIrrf)),
                            });
                        }
                    }
                    catch (Exception ex)
                    {
                        results.Add(new EventoResultDto { Id = "", Tipo = "R-4020", Status = "ERRO", Mensagem = ex.Message });
                    }
                }
                break;

            case "R-2010":
                // Agrupa por (perApur, cnpjEstabTom, cnpjPrestador, indObra)
                var grupos2010 = req.Rows
                    .Select(r => r.ToRow2010())
                    .GroupBy(r => (r.PerApur, r.CnpjEstabTom, r.CnpjPrestador, r.IndObra));

                foreach (var g in grupos2010)
                {
                    var linhas = g.ToList();
                    try
                    {
                        if (linhas[0].Acao == "EXCLUIR")
                        {
                            var cnpj = Core.ParseUtil.OnlyDigits(linhas[0].CnpjContrib);
                            var (xmlR9, idR9) = XmlBuilder2010.BuildR9000(cnpj, linhas[0].NrRecibo, linhas[0].PerApur, tpAmb);
                            var signedR9 = ReinfXmlSigner.SignR9000(xmlR9, x509);
                            batch.AddEvent(idR9, signedR9, 1, cnpj.Length == 14 ? cnpj[..8] : cnpj);
                            results.Add(new EventoResultDto { Id = idR9, Tipo = "R-9000", Status = "PENDENTE" });
                        }
                        else
                        {
                            byte indRetif = linhas[0].Acao == "ALTERAR" ? (byte)2 : (byte)1;
                            var built = XmlBuilder2010.BuildGrouped(linhas, tpAmb, indRetif, linhas[0].NrRecibo);
                            var signed = ReinfXmlSigner.SignAtRoot(built.Reinf, x509);
                            batch.AddEvent(built.Id, signed, built.TpInsc, built.NrInsc);
                            results.Add(new EventoResultDto
                            {
                                Id           = built.Id,
                                Tipo         = "R-2010",
                                Status       = "PENDENTE",
                                CnpjCpfBenef = linhas[0].CnpjPrestador,
                                CnpjEstab    = Core.ParseUtil.OnlyDigits(linhas[0].CnpjEstabTom.Length > 0 ? linhas[0].CnpjEstabTom : linhas[0].CnpjContrib),
                                PerApur      = linhas[0].PerApur,
                                VlrPrincipal = SumMoney(linhas.Select(l => l.VlrBrutoNF)),
                                VlrIrrf      = SumMoney(linhas.Select(l => l.VlrRetencao)),
                            });
                        }
                    }
                    catch (Exception ex)
                    {
                        results.Add(new EventoResultDto { Id = "", Tipo = "R-2010", Status = "ERRO", Mensagem = ex.Message });
                    }
                }
                break;

            case "R-1000":
                var r1000 = req.Rows[0].ToRowR1000();
                try
                {
                    var built1000 = XmlBuilderR1000.Build(r1000, tpAmb);
                    var signed1000 = ReinfXmlSigner.SignR1000(built1000.Xml, x509);
                    batch.AddEvent(built1000.Id, signed1000, built1000.TpInsc, built1000.NrInsc);
                    results.Add(new EventoResultDto { Id = built1000.Id, Tipo = "R-1000", Status = "PENDENTE" });
                }
                catch (Exception ex)
                {
                    results.Add(new EventoResultDto { Id = "", Tipo = "R-1000", Status = "ERRO", Mensagem = ex.Message });
                }
                break;

            default:
                throw new ArgumentException($"Evento desconhecido: {req.Evento}");
        }

        // Se todos falharam na montagem, não envia
        var buildErrors = results.Where(r => r.Status == "ERRO").ToList();
        if (buildErrors.Count == results.Count)
        {
            return new EnvioResponse
            {
                Protocolo = null,
                Status = "ERRO",
                Mensagem = "Todos os eventos falharam na montagem/assinatura.",
                Eventos = results
            };
        }

        // 3. Monta lote e envia
        var (tpInsc, nrInsc) = batch.FirstContrib();
        var loteXml = batch.BuildXml(tpInsc, nrInsc);

        string? protocolo = null;
        string status = "PENDENTE";
        string? xmlRetorno = null;
        string? cdResposta = null;
        string? descResposta = null;
        string? dhRecepcao = null;
        string? versaoAplicativo = null;
        string? nrInscRet = null;

        try
        {
            var (prot, retBody) = await ReinfRestClient.EnviarAsync(loteXml, x509, producao);
            protocolo = prot;
            xmlRetorno = retBody;

            // Parseia XML de retorno para extrair campos relevantes
            ParseRetornoXml(retBody, results, out cdResposta, out descResposta,
                out dhRecepcao, out versaoAplicativo, out nrInscRet);

            // RF API é assíncrona: cdResposta=1 (aguardando) ou 2 (processando) → salvar PENDENTE.
            // O status real (ACEITO/PARCIAL/REJEITADO) só vem no polling via ConsultaController.
            // cdResposta=4 → rejeitado imediatamente; cdResposta=3 → raro, síncrono.
            bool isAsync = cdResposta == "1" || cdResposta == "2" || string.IsNullOrEmpty(cdResposta);
            bool allRejected = cdResposta == "4";
            bool partial = !isAsync && (cdResposta == "3" || results.Any(r => r.Status == "ERRO" || r.Ocorrencias.Count > 0));
            status = isAsync ? "PENDENTE" : allRejected ? "REJEITADO" : partial ? "PARCIAL" : "ACEITO";
            // Só marca eventos como ACEITO se o processamento foi síncrono e completo
            if (!isAsync)
                foreach (var r in results.Where(r => r.Status == "PENDENTE")) r.Status = "ACEITO";
        }
        catch (Exception ex)
        {
            status = "ERRO";
            xmlRetorno = ex.Message;
            foreach (var r in results.Where(r => r.Status == "PENDENTE")) r.Status = "ERRO";
            _log.LogError(ex, "Erro ao enviar lote para a Receita Federal");
        }

        // O save no banco acontece APÓS o polling, via POST /api/lotes/finalizar chamado pelo frontend.
        return new EnvioResponse
        {
            Protocolo = protocolo,
            Status = status,
            Mensagem = status is "ACEITO" or "PARCIAL"
                ? (descResposta ?? $"Lote enviado com protocolo {protocolo}")
                : xmlRetorno,
            Eventos = results,
            CdResposta = cdResposta,
            DescResposta = descResposta,
            DhRecepcao = dhRecepcao,
            VersaoAplicativo = versaoAplicativo,
            NrInsc = nrInscRet ?? nrInsc
        };
    }

    /// <summary>
    /// Valida os dados de um envio sem assinar, transmitir nem persistir.
    /// Camada 1: ValidacaoService — regras de negócio explícitas por campo, linha e cross-row.
    /// Camada 2: XmlBuilder — safety-net estrutural (só executado se camada 1 passar).
    /// </summary>
    public async Task<ValidacaoResponse> ValidarAsync(EnvioRequest req)
    {
        // Verifica apenas que o certificado existe — não descriptografa nem carrega X509
        var certExists = await _db.Certificados.AnyAsync(c => c.Id == req.CertificateId);
        if (!certExists)
            return new ValidacaoResponse
            {
                Valido = false,
                Erros = new List<ValidacaoErro>
                {
                    new() { Linha = 0, Mensagem = "Certificado não encontrado. Verifique se o certificado selecionado ainda existe." }
                }
            };

        // ── Camada 1: validação de regras de negócio ──────────────────────
        var errosNegocio = ValidacaoService.Validar(req);
        if (errosNegocio.Count > 0)
        {
            // Calcula resumo mesmo em caso de erro para dar contexto ao usuário
            var resumoErr = new ValidacaoResumo { Total = req.Rows?.Count ?? 0, Erros = errosNegocio.Count };
            return new ValidacaoResponse { Valido = false, Erros = errosNegocio, Resumo = resumoErr };
        }

        bool producao = req.Ambiente == "producao";
        byte tpAmb = (byte)(producao ? 1 : 2);

        // ── Camada 2: safety-net estrutural via XmlBuilder ────────────────
        var erros = new List<ValidacaoErro>();
        var resumo = new ValidacaoResumo();

        switch (req.Evento)
        {
            case "R-4010":
                for (int i = 0; i < req.Rows.Count; i++)
                {
                    var r4010 = req.Rows[i].ToRow4010();
                    resumo.Total++;
                    try
                    {
                        if (r4010.Acao == "EXCLUIR")
                        {
                            var cnpj = Core.ParseUtil.OnlyDigits(r4010.CnpjContrib.Length > 0 ? r4010.CnpjContrib : r4010.CnpjEstab);
                            XmlBuilder4010.BuildR9000(cnpj, r4010.NrRecibo, r4010.PerApur, tpAmb);
                            resumo.Excluir++;
                        }
                        else
                        {
                            byte indRetif = r4010.Acao == "ALTERAR" ? (byte)2 : (byte)1;
                            XmlBuilder4010.Build(r4010, tpAmb, indRetif, r4010.NrRecibo);
                            if (r4010.Acao == "ALTERAR") resumo.Alterar++; else resumo.Enviar++;
                        }
                    }
                    catch (Exception ex)
                    {
                        erros.Add(new ValidacaoErro { Linha = i + 1, Mensagem = ex.Message });
                        resumo.Erros++;
                    }
                }
                break;

            case "R-4020":
                var grupos4020 = req.Rows
                    .Select((r, idx) => (row: r.ToRow4020(), idx))
                    .GroupBy(x => (x.row.PerApur, x.row.CnpjEstab, x.row.CnpjBenef))
                    .ToList();

                foreach (var g in grupos4020)
                {
                    var items = g.ToList();
                    resumo.Total += items.Count;
                    try
                    {
                        if (items[0].row.Acao == "EXCLUIR")
                        {
                            var cnpj = Core.ParseUtil.OnlyDigits(items[0].row.CnpjContrib);
                            XmlBuilder4020.BuildR9000(cnpj, items[0].row.NrRecibo, items[0].row.PerApur, tpAmb);
                            resumo.Excluir += items.Count;
                        }
                        else
                        {
                            byte indRetif = items[0].row.Acao == "ALTERAR" ? (byte)2 : (byte)1;
                            XmlBuilder4020.BuildGrouped(items.Select(x => x.row).ToList(), tpAmb, indRetif, items[0].row.NrRecibo);
                            if (items[0].row.Acao == "ALTERAR") resumo.Alterar += items.Count; else resumo.Enviar += items.Count;
                        }
                    }
                    catch (Exception ex)
                    {
                        erros.Add(new ValidacaoErro { Linha = items[0].idx + 1, Mensagem = ex.Message });
                        resumo.Erros += items.Count;
                    }
                }
                break;

            case "R-2010":
                var grupos2010 = req.Rows
                    .Select((r, idx) => (row: r.ToRow2010(), idx))
                    .GroupBy(x => (x.row.PerApur, x.row.CnpjEstabTom, x.row.CnpjPrestador, x.row.IndObra))
                    .ToList();

                foreach (var g in grupos2010)
                {
                    var items = g.ToList();
                    resumo.Total += items.Count;
                    try
                    {
                        if (items[0].row.Acao == "EXCLUIR")
                        {
                            var cnpj = Core.ParseUtil.OnlyDigits(items[0].row.CnpjContrib);
                            XmlBuilder2010.BuildR9000(cnpj, items[0].row.NrRecibo, items[0].row.PerApur, tpAmb);
                            resumo.Excluir += items.Count;
                        }
                        else
                        {
                            byte indRetif = items[0].row.Acao == "ALTERAR" ? (byte)2 : (byte)1;
                            XmlBuilder2010.BuildGrouped(items.Select(x => x.row).ToList(), tpAmb, indRetif, items[0].row.NrRecibo);
                            if (items[0].row.Acao == "ALTERAR") resumo.Alterar += items.Count; else resumo.Enviar += items.Count;
                        }
                    }
                    catch (Exception ex)
                    {
                        erros.Add(new ValidacaoErro { Linha = items[0].idx + 1, Mensagem = ex.Message });
                        resumo.Erros += items.Count;
                    }
                }
                break;

            case "R-1000":
                if (req.Rows.Count > 0)
                {
                    resumo.Total++;
                    var r1000 = req.Rows[0].ToRowR1000();
                    try
                    {
                        XmlBuilderR1000.Build(r1000, tpAmb);
                        if (r1000.Acao == "ALTERAR") resumo.Alterar++;
                        else if (r1000.Acao == "EXCLUIR") resumo.Excluir++;
                        else resumo.Enviar++;
                    }
                    catch (Exception ex)
                    {
                        erros.Add(new ValidacaoErro { Linha = 1, Mensagem = ex.Message });
                        resumo.Erros++;
                    }
                }
                break;

            default:
                return new ValidacaoResponse
                {
                    Valido = false,
                    Erros = new List<ValidacaoErro>
                    {
                        new() { Linha = 0, Mensagem = $"Evento desconhecido: {req.Evento}" }
                    }
                };
        }

        return new ValidacaoResponse
        {
            Valido = erros.Count == 0,
            Erros = erros,
            Resumo = resumo
        };
    }

    /// <summary>Soma valores monetários em string (aceita vírgula ou ponto) e retorna string invariant.</summary>
    private static string SumMoney(IEnumerable<string?> values)
    {
        static decimal Parse(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return 0;
            s = s.Replace(',', '.');
            return decimal.TryParse(s, System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : 0;
        }
        var total = values.Sum(Parse);
        return total.ToString("F2", System.Globalization.CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Parseia o XML de retorno da Receita Federal e extrai campos relevantes,
    /// incluindo ocorrências de erro por evento.
    /// </summary>
    private static void ParseRetornoXml(
        string? xml,
        List<EventoResultDto> results,
        out string? cdResposta,
        out string? descResposta,
        out string? dhRecepcao,
        out string? versaoAplicativo,
        out string? nrInsc)
    {
        cdResposta = descResposta = dhRecepcao = versaoAplicativo = nrInsc = null;
        if (string.IsNullOrWhiteSpace(xml)) return;

        try
        {
            var doc = new XmlDocument();
            doc.LoadXml(xml);

            // Usa local-name() para ignorar namespaces do schema REINF
            // (evita falha silenciosa quando elementos têm prefixo de namespace)
            string Get(string tag) =>
                doc.SelectSingleNode($"//*[local-name()='{tag}']")?.InnerText?.Trim() ?? "";

            cdResposta       = Get("cdResposta") is { Length: > 0 } s ? s : null;
            descResposta     = Get("descResposta") is { Length: > 0 } d ? d : null;
            dhRecepcao       = Get("dhRecepcao") is { Length: > 0 } t ? t : null;
            versaoAplicativo = Get("versaoAplicativoRecepcao") is { Length: > 0 } v ? v : null;
            nrInsc           = Get("nrInsc") is { Length: > 0 } n ? n : null;

            // Processa ocorrências por evento
            // O ID do evento vem no atributo id="..." do <evento>, NÃO como elemento filho
            var eventoNodes = doc.SelectNodes("//*[local-name()='evento']");
            if (eventoNodes != null)
            {
                foreach (XmlNode evNode in eventoNodes)
                {
                    // ID: atributo pode ser "Id" (maiúsculo, schema RF) ou "id" (minúsculo)
                    var evId = evNode.Attributes?["Id"]?.Value?.Trim()
                               ?? evNode.Attributes?["id"]?.Value?.Trim()
                               ?? evNode.SelectSingleNode("*[local-name()='id']")?.InnerText?.Trim()
                               ?? "";

                    // cdResposta: schema de consulta (100/101=ok) | cdRetorno: schema de envio síncrono (0=ok, 1=erro)
                    var evCd  = evNode.SelectSingleNode(".//*[local-name()='cdResposta']")?.InnerText?.Trim()
                             ?? evNode.SelectSingleNode(".//*[local-name()='cdRetorno']")?.InnerText?.Trim()
                             ?? "";
                    var evRec = evNode.SelectSingleNode(".//*[local-name()='nrRec']")?.InnerText?.Trim();

                    var matching = results.FirstOrDefault(r =>
                        (!string.IsNullOrEmpty(evId) && r.Id == evId) ||
                        (string.IsNullOrEmpty(evId) && r.Status == "PENDENTE"));
                    if (matching == null) continue;

                    if (!string.IsNullOrEmpty(evRec)) matching.NrRecibo = evRec;

                    // cdResposta 100/101 = aceito (schema consulta); cdRetorno 0 = aceito (schema envio síncrono)
                    if (evCd == "100" || evCd == "101" || evCd == "0")
                        matching.Status = "ACEITO";
                    else if (!string.IsNullOrEmpty(evCd))
                        matching.Status = "ERRO";

                    // Coleta ocorrências — suporta dois schemas:
                    // Schema consulta:  <ocorrencia>  com <tipo>, <codigo>, <descricao>, <localizacao>
                    // Schema envio sync: <regOcorrs>  com <tpOcorr>, <codResp>, <dscResp>, <localErroAviso>
                    var ocorrNodes = evNode.SelectNodes(".//*[local-name()='ocorrencia']");
                    if (ocorrNodes == null || ocorrNodes.Count == 0)
                        ocorrNodes = evNode.SelectNodes(".//*[local-name()='regOcorrs']");
                    if (ocorrNodes == null) continue;
                    foreach (XmlNode oc in ocorrNodes)
                    {
                        matching.Ocorrencias.Add(new OcorrenciaResultDto
                        {
                            Tipo      = oc.SelectSingleNode("*[local-name()='tipo']")?.InnerText?.Trim()
                                     ?? oc.SelectSingleNode("*[local-name()='tpOcorr']")?.InnerText?.Trim(),
                            Codigo    = oc.SelectSingleNode("*[local-name()='codigo']")?.InnerText?.Trim()
                                     ?? oc.SelectSingleNode("*[local-name()='codResp']")?.InnerText?.Trim(),
                            Descricao = oc.SelectSingleNode("*[local-name()='descricao']")?.InnerText?.Trim()
                                     ?? oc.SelectSingleNode("*[local-name()='dscResp']")?.InnerText?.Trim(),
                            Localizacao = oc.SelectSingleNode("*[local-name()='localizacao']")?.InnerText?.Trim()
                                       ?? oc.SelectSingleNode("*[local-name()='localErroAviso']")?.InnerText?.Trim()
                        });
                    }
                }
            }
        }
        catch { /* XML de retorno inválido — ignora e usa defaults */ }
    }
}
