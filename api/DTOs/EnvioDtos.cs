using ReinfApi.Core;

namespace ReinfApi.DTOs;

/// <summary>Payload enviado pelo frontend para criar um novo envio.</summary>
public class EnvioRequest
{
    public int CertificateId { get; set; }
    public string Evento { get; set; } = "";        // R-4010, R-4020, R-2010, R-1000
    public string Ambiente { get; set; } = "homologacao";
    public List<RowDto> Rows { get; set; } = new();
}

/// <summary>
/// Linha genérica — campos em snake_case vindos do frontend React.
/// Os métodos ToRow*() convertem para os tipos específicos do Core.
/// </summary>
public class RowDto : Dictionary<string, string>
{
    private string G(string key) => TryGetValue(key, out var v) ? v ?? "" : "";

    public Row4010 ToRow4010() => new()
    {
        CnpjContrib   = G("cnpjContrib").Length > 0 ? G("cnpjContrib") : G("cnpjEstab"),
        CnpjEstab     = G("cnpjEstab"),
        CpfBenef      = G("cpfBenef"),
        NomeBenef     = G("nomeBenef"),
        DtFg          = G("dtFg"),
        PerApur       = G("perApur"),
        VlrRend       = G("vlrRend"),
        VlrRendTrib   = G("vlrRendTrib").Length > 0 ? G("vlrRendTrib") : G("vlrRend"),
        VlrIrrf       = G("vlrIrrf"),
        Rra           = G("rra"),
        IndFciScp     = G("indFciScp"),
        CnpjFciScp    = G("cnpjFciScp"),
        PercScp       = G("percScp"),
        IndJud        = G("indJud"),
        NatRend       = G("natRend"),
        NrRecibo      = G("nrRecibo"),
        Acao          = G("acao").ToUpperInvariant()
    };

    public Row4020 ToRow4020() => new()
    {
        CnpjContrib   = G("cnpjContrib").Length > 0 ? G("cnpjContrib") : G("cnpjEstab"),
        PerApur       = G("perApur"),
        CnpjEstab     = G("cnpjEstab"),
        CnpjBenef     = G("cnpjBenef"),
        NatRend       = G("natRend"),
        IndJud        = G("indJud"),
        DtFg          = G("dtFg"),
        VlrRend       = G("vlrRend"),
        VlrBaseRet    = G("vlrBaseRet"),
        VlrIrrf       = G("vlrIrrf"),
        VlrBaseCsrf   = G("vlrBaseCsrf"),
        VlrRetCsrf    = G("vlrRetCsrf"),
        NrRecibo      = G("nrRecibo"),
        Acao          = G("acao").ToUpperInvariant()
    };

    public Row2010 ToRow2010() => new()
    {
        CnpjContrib   = G("cnpjContrib").Length > 0 ? G("cnpjContrib") : G("cnpjEstabTom"),
        CnpjEstabTom  = G("cnpjEstabTom"),
        IndObra       = G("indObra"),
        CnpjPrestador = G("cnpjPrestador"),
        PerApur       = G("perApur"),
        NumNF         = G("numNF"),
        DtEmissaoNF   = G("dtEmissaoNF"),
        VlrBrutoNF    = G("vlrBrutoNF"),
        TpServ        = G("tpServ"),
        VlrBaseRet    = G("vlrBaseRet"),
        VlrRetencao   = G("vlrRetencao"),
        IndCPRB       = G("indCPRB"),
        ObsNF         = G("obsNF"),
        SerieNF       = G("serieNF"),
        NrRecibo      = G("nrRecibo"),
        Acao          = G("acao").ToUpperInvariant()
    };

    public RowR1000 ToRowR1000() => new()
    {
        Cnpj               = G("cnpj"),
        IniValid           = G("iniValid"),
        FimValid           = G("fimValid"),
        NmCtt              = G("nmCtt"),
        CpfCtt             = G("cpfCtt"),
        FoneFixo           = G("foneFixo"),
        FoneCel            = G("foneCel"),
        Email              = G("email"),
        ClassTrib          = G("classTrib"),
        IndEscrituracao    = G("indEscrituracao"),
        IndDesoneracao     = G("indDesoneracao"),
        IndAcordoIsenMulta = G("indAcordoIsenMulta"),
        IndSitPJ           = G("indSitPJ"),
        CnpjSoftHouse      = G("cnpjSoftHouse"),
        RazaoSoftHouse     = G("razaoSoftHouse"),
        NomeContSoft       = G("nomeContSoft"),
        TelefoneSoft       = G("telefoneSoft"),
        EmailSoft          = G("emailSoft"),
        NrRecibo           = G("nrRecibo"),
        Acao               = G("acao").ToUpperInvariant()
    };
}

public class EnvioResponse
{
    public string? Protocolo { get; set; }
    public string Status { get; set; } = "";
    public string? Mensagem { get; set; }
    public List<EventoResultDto> Eventos { get; set; } = new();

    // Campos extras extraídos do XML de retorno da RF
    public string? CdResposta { get; set; }
    public string? DescResposta { get; set; }
    public string? DhRecepcao { get; set; }
    public string? VersaoAplicativo { get; set; }
    public string? NrInsc { get; set; }
}

public class EventoResultDto
{
    public string Id { get; set; } = "";
    public string Tipo { get; set; } = "";
    public string Status { get; set; } = "";
    public string? Mensagem { get; set; }
    public string? NrRecibo { get; set; }
    /// <summary>CPF (R-4010) ou CNPJ (R-4020/R-2010) de quem recebeu a retenção.</summary>
    public string? CnpjCpfBenef { get; set; }
    /// <summary>CNPJ do estabelecimento (pode diferir do contribuinte em multi-filial).</summary>
    public string? CnpjEstab { get; set; }
    /// <summary>Período de apuração (YYYY-MM) do evento.</summary>
    public string? PerApur { get; set; }
    /// <summary>Natureza do rendimento (R-4010/R-4020).</summary>
    public string? NatRend { get; set; }
    /// <summary>Valor principal: vlrRend (R-4010/R-4020) ou vlrBrutoNF (R-2010). Formato decimal invariante.</summary>
    public string? VlrPrincipal { get; set; }
    /// <summary>Valor IR/INSS retido: vlrIrrf (R-4010/R-4020) ou vlrRetencao (R-2010). Formato decimal invariante.</summary>
    public string? VlrIrrf { get; set; }
    public List<OcorrenciaResultDto> Ocorrencias { get; set; } = new();
    /// <summary>Dados originais da linha da planilha — usados para pré-preencher o wizard de retificação.</summary>
    public Dictionary<string, string>? RowData { get; set; }
}

public class OcorrenciaResultDto
{
    public string? Tipo { get; set; }
    public string? Codigo { get; set; }
    public string? Descricao { get; set; }
    public string? Localizacao { get; set; }
}

// ── Validação Prévia ──────────────────────────────────────────────────────────

/// <summary>Resposta da validação prévia — verifica os dados sem assinar nem transmitir.</summary>
public class ValidacaoResponse
{
    public bool Valido { get; set; }
    public List<ValidacaoErro> Erros { get; set; } = new();
    public ValidacaoResumo Resumo { get; set; } = new();
}

public class ValidacaoErro
{
    public int Linha { get; set; }
    public string Mensagem { get; set; } = "";
}

public class ValidacaoResumo
{
    public int Total { get; set; }
    public int Enviar { get; set; }
    public int Alterar { get; set; }
    public int Excluir { get; set; }
    public int Erros { get; set; }
}

public class LoteDto
{
    public decimal IdEnvio { get; set; }
    public string? Protocolo { get; set; }
    public DateTime DtRecepcao { get; set; }
    public string TpEnvio { get; set; } = "";
    public string? Status { get; set; }
    public string? Ambiente { get; set; }
    public string NrInscricao { get; set; } = "";
    public string? PerApur { get; set; }
    public int? CertificadoId { get; set; }
    /// <summary>JSON com a lista de EventoResultDto (nrRecibo por evento).</summary>
    public string? EventosJson { get; set; }
    public string? UsuarioNome { get; set; }
}

/// <summary>Payload enviado pelo frontend após o polling do wizard ter completado com sucesso.</summary>
public class FinalizarLoteRequest
{
    public string Protocolo { get; set; } = "";
    public string TpEnvio { get; set; } = "";
    public string NrInscricao { get; set; } = "";
    public string Ambiente { get; set; } = "";
    public int CertificadoId { get; set; }
    public string? PerApur { get; set; }
    public string Status { get; set; } = "";
    public List<EventoResultDto> Eventos { get; set; } = new();
    public List<RowDto> Rows { get; set; } = new();
}
