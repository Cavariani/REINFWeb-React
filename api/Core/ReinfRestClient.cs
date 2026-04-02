using System.Net.Http.Headers;
using System.Security.Authentication;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Xml;

namespace ReinfApi.Core;

public static class ReinfRestClient
{
    private static HttpClient CreateClient(X509Certificate2 cert)
    {
        var handler = new HttpClientHandler
        {
            ClientCertificateOptions = ClientCertificateOption.Manual,
            SslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13,
            CheckCertificateRevocationList = true
        };
        handler.ClientCertificates.Add(cert);

        var http = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(90) };
        http.DefaultRequestHeaders.Accept.Clear();
        http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/xml"));
        http.DefaultRequestHeaders.UserAgent.ParseAdd("REINFSignerPedroV2/1.0");
        return http;
    }

    private static string BaseUrl(bool producao) =>
        producao ? "https://reinf.receita.economia.gov.br"
                 : "https://pre-reinf.receita.economia.gov.br";

    public static async Task<(string protocolo, string responseBody)> EnviarAsync(
        string loteXml, X509Certificate2 cert, bool producao, IAppLogger? log = null)
    {
        var url = $"{BaseUrl(producao)}/recepcao/lotes";
        using var http = CreateClient(cert);
        using var content = new StringContent(loteXml, new UTF8Encoding(false), "application/xml");
        content.Headers.ContentType!.CharSet = "utf-8";

        log?.Debug($"POST {url} …");
        var resp = await http.PostAsync(url, content).ConfigureAwait(false);
        var body = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);

        log?.Debug($"HTTP {(int)resp.StatusCode} {resp.ReasonPhrase}");

        if (!resp.IsSuccessStatusCode)
            throw new Exception($"Receita Federal retornou {(int)resp.StatusCode}: {body[..Math.Min(500, body.Length)]}");

        var protocolo = TryParseProtocolo(body);

        if (string.IsNullOrWhiteSpace(protocolo) && resp.Headers.Location != null)
        {
            var loc = resp.Headers.Location.ToString();
            var idx = loc.LastIndexOf('/');
            if (idx >= 0 && idx + 1 < loc.Length) protocolo = loc[(idx + 1)..];
        }

        if (string.IsNullOrWhiteSpace(protocolo))
        {
            log?.Warn("Servidor não retornou número de protocolo.");
            protocolo = "PROTOCOLO-NAO-IDENTIFICADO";
        }
        else
        {
            log?.Success($"Protocolo do lote: {protocolo}");
        }

        return (protocolo, body);
    }

    public static async Task<string> ConsultarAsync(
        string protocolo, X509Certificate2 cert, bool producao, IAppLogger? log = null)
    {
        using var http = CreateClient(cert);
        var baseUrl = BaseUrl(producao);

        var url1 = $"{baseUrl}/consulta/lotes/{Uri.EscapeDataString(protocolo)}";
        var resp1 = await http.GetAsync(url1).ConfigureAwait(false);
        if (resp1.IsSuccessStatusCode) return await resp1.Content.ReadAsStringAsync();

        var url2 = $"{baseUrl}/consulta/lotes?protocolo={Uri.EscapeDataString(protocolo)}";
        var resp2 = await http.GetAsync(url2).ConfigureAwait(false);
        if (resp2.IsSuccessStatusCode) return await resp2.Content.ReadAsStringAsync();

        throw new Exception("Falha na consulta do lote.");
    }

    /// <summary>
    /// Consulta se o contribuinte possui R-1000 ativo na Receita Federal.
    /// GET /api/v1/consulta/reciboevento/R1000/1/{cnpj14}
    /// Retorna (encontrado, xmlBody) — HTTP 404 significa não cadastrado, não é erro.
    /// </summary>
    public static async Task<(bool encontrado, string? xmlBody)> ConsultarContribuinteAsync(
        string cnpj14, X509Certificate2 cert, bool producao, IAppLogger? log = null)
    {
        using var http = CreateClient(cert);
        var baseUrl = BaseUrl(producao);

        // RF exige CNPJ raiz (8 dígitos) para consulta de R-1000
        var cnpjRaiz = cnpj14.Length >= 8 ? cnpj14[..8] : cnpj14;
        var url = $"{baseUrl}/consulta/reciboevento/R1000/1/{Uri.EscapeDataString(cnpjRaiz)}";
        log?.Debug($"GET {url} …");

        var resp = await http.GetAsync(url).ConfigureAwait(false);
        var body = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);

        log?.Debug($"HTTP {(int)resp.StatusCode} — ConsultarContribuinte");

        if (resp.StatusCode == System.Net.HttpStatusCode.NotFound)
            return (false, body); // body pode ser XML com detalhe do 404 — útil para diagnóstico

        // 422 Unprocessable Entity: RF retorna XML com detalhe do erro no corpo — tratar como resposta válida
        if (resp.IsSuccessStatusCode || (int)resp.StatusCode == 422)
            return (true, body);

        throw new Exception($"Receita Federal retornou {(int)resp.StatusCode}: {body[..Math.Min(400, body.Length)]}");
    }

    private static string TryParseProtocolo(string xml)
    {
        try
        {
            var doc = new XmlDocument { PreserveWhitespace = true };
            doc.LoadXml(xml);
            var n = doc.SelectSingleNode(
                "//*[local-name()='protocoloEnvio' or local-name()='protocolo' or local-name()='protocoloLote' or local-name()='numeroProtocolo']");
            return n?.InnerText?.Trim() ?? "";
        }
        catch { return ""; }
    }
}
