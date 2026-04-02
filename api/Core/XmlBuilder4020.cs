using System.Globalization;
using System.Xml;

namespace ReinfApi.Core;

public static class XmlBuilder4020
{
    public readonly record struct Built4020(string Reinf, string Id, byte TpInsc, string NrInsc, string PerApur);

    public static string Serialize(string reinfXml) => reinfXml;

    private static readonly CultureInfo PtBR = new("pt-BR");

    private static string MoneyBR(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return "0,00";
        var s = v.Trim().Replace(".", ",");
        if (!decimal.TryParse(s, NumberStyles.Any, PtBR, out var d)) d = 0m;
        return d.ToString("0.00", PtBR);
    }

    private static decimal MoneyToDecimal(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return 0m;
        var s = v.Trim();
        if (s.IndexOf(',') < 0 && s.LastIndexOf('.') > s.Length - 4) s = s.Replace(".", ",");
        return decimal.TryParse(s, NumberStyles.Any, PtBR, out var d) ? d : 0m;
    }

    private static bool IsPos(string? v) => MoneyToDecimal(MoneyBR(v)) > 0m;

    private static void AppendText(XmlElement parent, string name, string value, string ns)
    {
        var el = parent.OwnerDocument!.CreateElement(name, ns);
        el.InnerText = value ?? "";
        parent.AppendChild(el);
    }

    private static bool IsValidCnpjLocal(string c)
    {
        if (string.IsNullOrWhiteSpace(c) || c.Length != 14) return false;
        bool allEqual = true;
        for (int i = 1; i < 14; i++) if (c[i] != c[0]) { allEqual = false; break; }
        if (allEqual) return false;
        int[] m1 = { 5,4,3,2,9,8,7,6,5,4,3,2 }, m2 = { 6,5,4,3,2,9,8,7,6,5,4,3,2 };
        int soma = 0;
        for (int i = 0; i < 12; i++) soma += (c[i]-'0') * m1[i];
        int r = soma % 11; int dv1 = r < 2 ? 0 : 11-r;
        soma = 0;
        for (int i = 0; i < 13; i++) soma += (c[i]-'0') * m2[i];
        r = soma % 11; int dv2 = r < 2 ? 0 : 11-r;
        return (c[12]-'0') == dv1 && (c[13]-'0') == dv2;
    }

    public static Built4020 Build(Row4020 r, byte tpAmb = 2)
        => BuildGrouped(new List<Row4020> { r }, tpAmb);

    public static Built4020 BuildGrouped(
        List<Row4020> linhas, byte tpAmb = 2, byte indRetif = 1, string? nrRecibo = null)
    {
        if (linhas == null || linhas.Count == 0)
            throw new ArgumentException("Nenhuma linha informada para o R-4020.");
        if (indRetif == 2 && string.IsNullOrWhiteSpace(nrRecibo))
            throw new ArgumentException("nrRecibo é obrigatório para retificação (indRetif=2).");
        if (indRetif != 1 && indRetif != 2)
            throw new ArgumentException($"indRetif deve ser 1 ou 2. Recebido: {indRetif}");

        var r0 = linhas[0];
        var perApur = ParseUtil.ToYearMonth(ParseUtil.CleanInvisibles(r0.PerApur));
        if (string.IsNullOrWhiteSpace(perApur) || perApur.Length != 7 || perApur[4] != '-')
            throw new ArgumentException("perApur inválido (esperado YYYY-MM).");
        perApur = perApur.Trim().Replace('\u00A0', ' ').Replace("\u200B", "");

        var cnpjEstab = ParseUtil.OnlyDigits(r0.CnpjEstab);
        if (!(cnpjEstab.Length == 8 || cnpjEstab.Length == 14))
            throw new ArgumentException("CnpjEstab inválido (8 ou 14 dígitos).");
        if (cnpjEstab.Length == 14 && !IsValidCnpjLocal(cnpjEstab))
            throw new ArgumentException("CnpjEstab inválido (DV).");

        var cnpjContrib = ParseUtil.OnlyDigits(r0.CnpjContrib);
        if (!(cnpjContrib.Length == 8 || cnpjContrib.Length == 14))
            throw new ArgumentException("CnpjContrib inválido.");

        var cnpjBenef = ParseUtil.OnlyDigits(r0.CnpjBenef);
        if (cnpjBenef.Length != 14 || !IsValidCnpjLocal(cnpjBenef))
            throw new ArgumentException("CnpjBenef inválido (14 dígitos com DV).");

        foreach (var r in linhas)
        {
            var p = ParseUtil.ToYearMonth(ParseUtil.CleanInvisibles(r.PerApur));
            if (!string.Equals(p, perApur)) throw new ArgumentException("Todas as linhas devem ter o mesmo perApur.");
            if (!string.Equals(ParseUtil.OnlyDigits(r.CnpjEstab), cnpjEstab)) throw new ArgumentException("Todas as linhas devem ter o mesmo CnpjEstab.");
            if (!string.Equals(ParseUtil.OnlyDigits(r.CnpjBenef), cnpjBenef)) throw new ArgumentException("Todas as linhas devem ter o mesmo CnpjBenef.");
        }

        const string ns = "http://www.reinf.esocial.gov.br/schemas/evt4020PagtoBeneficiarioPJ/v2_01_02";
        var doc = new XmlDocument { PreserveWhitespace = true };

        var reinf = doc.CreateElement("Reinf", ns);
        doc.AppendChild(reinf);

        // ideContri > nrInsc deve ser o CNPJ raiz (8 dígitos) — não o CNPJ completo
        var nrInscContri = cnpjContrib.Length == 14 ? cnpjContrib[..8] : cnpjContrib;
        string id = EventIdGenerator.Generate(1, nrInscContri);
        var evt = doc.CreateElement("evtRetPJ", ns);
        evt.SetAttribute("id", id);
        reinf.AppendChild(evt);

        var ideEvento = doc.CreateElement("ideEvento", ns);
        evt.AppendChild(ideEvento);
        AppendText(ideEvento, "indRetif", indRetif.ToString(), ns);
        if (indRetif == 2) AppendText(ideEvento, "nrRecibo", nrRecibo!.Trim(), ns);
        AppendText(ideEvento, "perApur", perApur, ns);
        AppendText(ideEvento, "tpAmb", tpAmb.ToString(), ns);
        AppendText(ideEvento, "procEmi", "1", ns);
        AppendText(ideEvento, "verProc", "ReinfSigner/2.0", ns);

        var ideContri = doc.CreateElement("ideContri", ns);
        evt.AppendChild(ideContri);
        AppendText(ideContri, "tpInsc", "1", ns);
        AppendText(ideContri, "nrInsc", nrInscContri, ns);

        var ideEstab = doc.CreateElement("ideEstab", ns);
        evt.AppendChild(ideEstab);
        AppendText(ideEstab, "tpInscEstab", "1", ns);
        AppendText(ideEstab, "nrInscEstab", cnpjEstab, ns);

        var ideBenefEl = doc.CreateElement("ideBenef", ns);
        ideEstab.AppendChild(ideBenefEl);
        AppendText(ideBenefEl, "cnpjBenef", cnpjBenef, ns);

        var gruposNat = linhas.GroupBy(x => ParseUtil.OnlyDigits(x.NatRend));
        foreach (var g in gruposNat)
        {
            var natRend = g.Key;
            if (natRend.Length != 5) throw new ArgumentException($"natRend inválido '{natRend}'.");

            var idePgto = doc.CreateElement("idePgto", ns);
            ideBenefEl.AppendChild(idePgto);
            AppendText(idePgto, "natRend", natRend, ns);

            foreach (var r in g)
            {
                var dtFgDt = ParseUtil.ParseDate(ParseUtil.CleanInvisibles(r.DtFg));
                var dtFgStr = dtFgDt.ToString("yyyy-MM-dd");
                if (!perApur.Equals($"{dtFgDt:yyyy-MM}"))
                    throw new ArgumentException($"dtFG ({dtFgStr}) deve estar no mesmo mês/ano de perApur ({perApur}).");

                var infoPgto = doc.CreateElement("infoPgto", ns);
                idePgto.AppendChild(infoPgto);
                AppendText(infoPgto, "dtFG", dtFgStr, ns);
                AppendText(infoPgto, "vlrBruto", MoneyBR(r.VlrRend), ns);
                AppendText(infoPgto, "indJud", string.IsNullOrWhiteSpace(ParseUtil.MapSNOrNull(r.IndJud)) ? "N" : ParseUtil.MapSNOrNull(r.IndJud)!, ns);

                bool hasRet = IsPos(r.VlrBaseRet) || IsPos(r.VlrIrrf) || IsPos(r.VlrBaseCsrf) || IsPos(r.VlrRetCsrf);
                if (hasRet)
                {
                    var retencoes = doc.CreateElement("retencoes", ns);
                    infoPgto.AppendChild(retencoes);
                    if (IsPos(r.VlrBaseRet)) AppendText(retencoes, "vlrBaseIR", MoneyBR(r.VlrBaseRet), ns);
                    if (IsPos(r.VlrIrrf)) AppendText(retencoes, "vlrIR", MoneyBR(r.VlrIrrf), ns);
                    if (IsPos(r.VlrBaseCsrf)) AppendText(retencoes, "vlrBaseAgreg", MoneyBR(r.VlrBaseCsrf), ns);
                    if (IsPos(r.VlrRetCsrf)) AppendText(retencoes, "vlrAgreg", MoneyBR(r.VlrRetCsrf), ns);
                }
            }
        }

        return new Built4020(Reinf: doc.OuterXml, Id: id, TpInsc: 1, NrInsc: cnpjContrib, PerApur: perApur);
    }

    public static (string Xml, string Id) BuildR9000(string cnpjContrib, string nrRecEvt, string perApur, byte tpAmb = 2)
    {
        if (string.IsNullOrWhiteSpace(nrRecEvt)) throw new ArgumentException("nrRecEvt é obrigatório.", nameof(nrRecEvt));
        cnpjContrib = ParseUtil.OnlyDigits(cnpjContrib);
        if (!(cnpjContrib.Length == 8 || cnpjContrib.Length == 14)) throw new ArgumentException("cnpjContrib inválido.");
        perApur = (perApur ?? "").Trim();
        if (perApur.Length != 7 || perApur[4] != '-') throw new ArgumentException("perApur inválido.");

        var nrInscContri = cnpjContrib.Length == 14 ? cnpjContrib[..8] : cnpjContrib;
        string id = EventIdGenerator.Generate(1, nrInscContri);

        var xml = $"<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
              $"<Reinf xmlns=\"http://www.reinf.esocial.gov.br/schemas/evtExclusao/v2_01_02\">" +
              $"<evtExclusao id=\"{id}\">" +
              $"<ideEvento><tpAmb>{tpAmb}</tpAmb><procEmi>1</procEmi><verProc>ReinfSigner/2.0</verProc></ideEvento>" +
              $"<ideContri><tpInsc>1</tpInsc><nrInsc>{nrInscContri}</nrInsc></ideContri>" +
              $"<infoExclusao><tpEvento>R-4020</tpEvento>" +
              $"<nrRecEvt>{System.Security.SecurityElement.Escape(nrRecEvt.Trim())}</nrRecEvt>" +
              $"<perApur>{perApur}</perApur></infoExclusao>" +
              $"</evtExclusao></Reinf>";

        return (xml, id);
    }
}
