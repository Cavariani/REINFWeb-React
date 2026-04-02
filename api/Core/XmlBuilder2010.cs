using System.Globalization;
using System.Xml;

namespace ReinfApi.Core;

public static class XmlBuilder2010
{
    public readonly record struct Built2010(string Reinf, string Id, byte TpInsc, string NrInsc, string PerApur);

    public static string Serialize(string reinfXml) => reinfXml;

    private static readonly CultureInfo PtBR = new CultureInfo("pt-BR");

    private static string MoneyBR(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return "0,00";
        var s = v.Trim().Replace(".", ",");
        if (!decimal.TryParse(s, NumberStyles.Any, PtBR, out var d)) d = 0m;
        return d.ToString("0.00", PtBR);
    }

    private static string MoneyBR(decimal v) => v.ToString("0.00", PtBR);

    private static decimal MoneyToDecimal(string v)
    {
        if (string.IsNullOrWhiteSpace(v)) return 0m;
        var s = v.Trim();
        if (s.IndexOf(',') < 0 && s.LastIndexOf('.') > s.Length - 4) s = s.Replace(".", ",");
        return decimal.TryParse(s, NumberStyles.Any, PtBR, out var d) ? d : 0m;
    }

    private static void AppendText(XmlElement parent, string name, string value, string ns)
    {
        var el = parent.OwnerDocument!.CreateElement(name, ns);
        el.InnerText = value ?? "";
        parent.AppendChild(el);
    }

    private static string CleanIndCprb(string? raw)
    {
        var s = (raw ?? "").Trim();
        if (s.StartsWith("1")) return "1";
        if (s.StartsWith("0")) return "0";
        if (s.Contains("1")) return "1";
        return "0";
    }

    private static decimal Round2(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

    public static Built2010 Build(Row2010 r, byte tpAmb = 2)
    {
        var cnpjContrib = ParseUtil.OnlyDigits(r.CnpjContrib);
        if (!(cnpjContrib.Length == 8 || cnpjContrib.Length == 14))
            throw new ArgumentException("CnpjContrib inválido.");
        if (cnpjContrib.Length == 14 && !ParseUtil.IsValidCnpj(cnpjContrib))
            throw new ArgumentException("CnpjContrib inválido (DV).");

        var perApur = ParseUtil.ToYearMonth(ParseUtil.CleanInvisibles(r.PerApur));
        if (string.IsNullOrWhiteSpace(perApur) || perApur.Length != 7 || perApur[4] != '-')
            throw new ArgumentException("perApur inválido (esperado YYYY-MM).");
        perApur = perApur.Trim().Replace('\u00A0', ' ').Replace("\u200B", string.Empty);

        var indObra = (r.IndObra ?? "0").Trim();
        if (indObra != "0" && indObra != "1") throw new ArgumentException("indObra inválido (0 ou 1).");

        var cnpjEstabTom = ParseUtil.OnlyDigits(r.CnpjEstabTom);
        if (!(cnpjEstabTom.Length == 8 || cnpjEstabTom.Length == 14))
            throw new ArgumentException("CnpjEstabTom inválido.");
        if (cnpjEstabTom.Length == 14 && !ParseUtil.IsValidCnpj(cnpjEstabTom))
            throw new ArgumentException("CnpjEstabTom inválido (DV).");

        var cnpjPrest = ParseUtil.OnlyDigits(r.CnpjPrestador);
        if (cnpjPrest.Length != 14 || !ParseUtil.IsValidCnpj(cnpjPrest))
            throw new ArgumentException("CnpjPrestador inválido (14 dígitos com DV).");

        var nf = (r.NumNF ?? "").Trim();
        if (string.IsNullOrWhiteSpace(nf)) throw new ArgumentException("NumNF obrigatório.");

        var dtEmissaoDt = ParseUtil.ParseDate(ParseUtil.CleanInvisibles(r.DtEmissaoNF));
        var dtEmissao = dtEmissaoDt.ToString("yyyy-MM-dd");

        int perYear = int.Parse(perApur.Substring(0, 4));
        int perMonth = int.Parse(perApur.Substring(5, 2));
        if (dtEmissaoDt.Year != perYear || dtEmissaoDt.Month != perMonth)
            throw new ArgumentException($"DtEmissaoNF ({dtEmissao}) deve estar no mesmo mês/ano de perApur ({perApur}).");

        var tpServDigits = ParseUtil.OnlyDigits(r.TpServ);
        if (string.IsNullOrWhiteSpace(tpServDigits)) throw new ArgumentException("TpServ obrigatório.");
        if (tpServDigits.Length != 9) throw new ArgumentException($"TpServ inválido '{tpServDigits}' (9 dígitos).");
        if (tpServDigits == "000000000") throw new ArgumentException("TpServ não pode ser '000000000'.");

        var vlrBrutoNF = MoneyBR(r.VlrBrutoNF);
        var vlrBaseRet = MoneyBR(r.VlrBaseRet);
        var indCPRB = CleanIndCprb(r.IndCPRB);
        var aliquota = (indCPRB == "1") ? 0.035m : 0.11m;
        var retCalc = Round2(MoneyToDecimal(vlrBaseRet) * aliquota);

        // ideContri > nrInsc deve ser o CNPJ raiz (8 dígitos) — não o CNPJ completo
        var nrInscContri = cnpjContrib.Length == 14 ? cnpjContrib[..8] : cnpjContrib;
        string id = EventIdGenerator.Generate(1, nrInscContri);
        const string ns = "http://www.reinf.esocial.gov.br/schemas/evtTomadorServicos/v2_01_02";

        var doc = new XmlDocument { PreserveWhitespace = true };
        var reinf = doc.CreateElement("Reinf", ns); doc.AppendChild(reinf);
        var evt = doc.CreateElement("evtServTom", ns); evt.SetAttribute("id", id); reinf.AppendChild(evt);

        var ideEvento = doc.CreateElement("ideEvento", ns); evt.AppendChild(ideEvento);
        AppendText(ideEvento, "indRetif", "1", ns);
        AppendText(ideEvento, "perApur", perApur, ns);
        AppendText(ideEvento, "tpAmb", tpAmb.ToString(), ns);
        AppendText(ideEvento, "procEmi", "1", ns);
        AppendText(ideEvento, "verProc", "ReinfSigner/2.0", ns);

        var ideContri = doc.CreateElement("ideContri", ns); evt.AppendChild(ideContri);
        AppendText(ideContri, "tpInsc", "1", ns);
        AppendText(ideContri, "nrInsc", nrInscContri, ns);

        var infoServTom = doc.CreateElement("infoServTom", ns); evt.AppendChild(infoServTom);
        var ideEstabObra = doc.CreateElement("ideEstabObra", ns); infoServTom.AppendChild(ideEstabObra);
        AppendText(ideEstabObra, "tpInscEstab", "1", ns);
        AppendText(ideEstabObra, "nrInscEstab", cnpjEstabTom, ns);
        AppendText(ideEstabObra, "indObra", indObra, ns);

        var idePrestServ = doc.CreateElement("idePrestServ", ns); ideEstabObra.AppendChild(idePrestServ);
        AppendText(idePrestServ, "cnpjPrestador", cnpjPrest, ns);
        AppendText(idePrestServ, "vlrTotalBruto", vlrBrutoNF, ns);
        AppendText(idePrestServ, "vlrTotalBaseRet", vlrBaseRet, ns);
        AppendText(idePrestServ, "vlrTotalRetPrinc", MoneyBR(retCalc), ns);
        AppendText(idePrestServ, "indCPRB", indCPRB, ns);

        var nfs = doc.CreateElement("nfs", ns); idePrestServ.AppendChild(nfs);
        var serie = string.IsNullOrWhiteSpace(r.SerieNF) ? "1" : r.SerieNF.Trim();
        AppendText(nfs, "serie", serie, ns);
        AppendText(nfs, "numDocto", nf, ns);
        AppendText(nfs, "dtEmissaoNF", dtEmissao, ns);
        AppendText(nfs, "vlrBruto", vlrBrutoNF, ns);
        if (!string.IsNullOrWhiteSpace(r.ObsNF)) AppendText(nfs, "obs", r.ObsNF.Trim(), ns);

        var infoTpServ = doc.CreateElement("infoTpServ", ns); nfs.AppendChild(infoTpServ);
        AppendText(infoTpServ, "tpServico", tpServDigits, ns);
        AppendText(infoTpServ, "vlrBaseRet", vlrBaseRet, ns);
        AppendText(infoTpServ, "vlrRetencao", MoneyBR(retCalc), ns);

        return new Built2010(Reinf: doc.OuterXml, Id: id, TpInsc: 1, NrInsc: cnpjContrib, PerApur: perApur);
    }

    public static Built2010 BuildGrouped(List<Row2010> linhas, byte tpAmb = 2, byte indRetif = 1, string? nrRecibo = null)
    {
        if (linhas == null || linhas.Count == 0) throw new ArgumentException("Nenhuma linha informada.");
        if (indRetif == 2 && string.IsNullOrWhiteSpace(nrRecibo)) throw new ArgumentException("nrRecibo é obrigatório para retificação.");
        if (indRetif != 1 && indRetif != 2) throw new ArgumentException($"indRetif deve ser 1 ou 2.");

        var r0 = linhas[0];
        var cnpjContrib = ParseUtil.OnlyDigits(r0.CnpjContrib);
        if (!(cnpjContrib.Length == 8 || cnpjContrib.Length == 14)) throw new ArgumentException("CnpjContrib inválido.");
        if (cnpjContrib.Length == 14 && !ParseUtil.IsValidCnpj(cnpjContrib)) throw new ArgumentException("CnpjContrib inválido (DV).");

        var perApur = ParseUtil.ToYearMonth(ParseUtil.CleanInvisibles(r0.PerApur));
        if (string.IsNullOrWhiteSpace(perApur) || perApur.Length != 7 || perApur[4] != '-') throw new ArgumentException("perApur inválido.");
        perApur = perApur.Trim().Replace('\u00A0', ' ').Replace("\u200B", string.Empty);

        var indObra = (r0.IndObra ?? "0").Trim(); indObra = (indObra == "1") ? "1" : "0";
        var cnpjEstabTom = ParseUtil.OnlyDigits(r0.CnpjEstabTom);
        var cnpjPrest = ParseUtil.OnlyDigits(r0.CnpjPrestador);
        if (cnpjPrest.Length != 14 || !ParseUtil.IsValidCnpj(cnpjPrest)) throw new ArgumentException("CnpjPrestador inválido.");

        var indCprbGroup = linhas.Any(x => CleanIndCprb(x.IndCPRB) == "1") ? "1" : "0";
        var aliquota = (indCprbGroup == "1") ? 0.035m : 0.11m;

        // ideContri > nrInsc deve ser o CNPJ raiz (8 dígitos) — não o CNPJ completo
        var nrInscContri = cnpjContrib.Length == 14 ? cnpjContrib[..8] : cnpjContrib;
        string id = EventIdGenerator.Generate(1, nrInscContri);
        const string ns = "http://www.reinf.esocial.gov.br/schemas/evtTomadorServicos/v2_01_02";

        var doc = new XmlDocument { PreserveWhitespace = true };
        var reinf = doc.CreateElement("Reinf", ns); doc.AppendChild(reinf);
        var evt = doc.CreateElement("evtServTom", ns); evt.SetAttribute("id", id); reinf.AppendChild(evt);

        var ideEvento = doc.CreateElement("ideEvento", ns); evt.AppendChild(ideEvento);
        AppendText(ideEvento, "indRetif", indRetif.ToString(), ns);
        if (indRetif == 2) AppendText(ideEvento, "nrRecibo", nrRecibo!.Trim(), ns);
        AppendText(ideEvento, "perApur", perApur, ns);
        AppendText(ideEvento, "tpAmb", tpAmb.ToString(), ns);
        AppendText(ideEvento, "procEmi", "1", ns);
        AppendText(ideEvento, "verProc", "ReinfSigner/2.0", ns);

        var ideContri = doc.CreateElement("ideContri", ns); evt.AppendChild(ideContri);
        AppendText(ideContri, "tpInsc", "1", ns);
        AppendText(ideContri, "nrInsc", nrInscContri, ns);

        var infoServTom = doc.CreateElement("infoServTom", ns); evt.AppendChild(infoServTom);
        var ideEstabObra = doc.CreateElement("ideEstabObra", ns); infoServTom.AppendChild(ideEstabObra);
        AppendText(ideEstabObra, "tpInscEstab", "1", ns);
        AppendText(ideEstabObra, "nrInscEstab", cnpjEstabTom, ns);
        AppendText(ideEstabObra, "indObra", indObra, ns);

        var idePrestServ = doc.CreateElement("idePrestServ", ns); ideEstabObra.AppendChild(idePrestServ);
        AppendText(idePrestServ, "cnpjPrestador", cnpjPrest, ns);

        var buffer = new List<(string serie, string nf, string dt, decimal bruto, string? obs, string tpServ, decimal baseRet, decimal ret)>();
        decimal totBruto = 0m, totBase = 0m, totRet = 0m;

        foreach (var r in linhas)
        {
            var nf = (r.NumNF ?? "").Trim();
            if (string.IsNullOrWhiteSpace(nf)) throw new ArgumentException("NumNF obrigatório.");
            var dtEmissaoDt = ParseUtil.ParseDate(ParseUtil.CleanInvisibles(r.DtEmissaoNF));
            var dtEmissao = dtEmissaoDt.ToString("yyyy-MM-dd");
            if (dtEmissaoDt.ToString("yyyy-MM") != perApur) throw new ArgumentException($"DtEmissaoNF ({dtEmissao}) deve estar no mesmo mês de perApur ({perApur}).");
            var tpServDigits = ParseUtil.OnlyDigits(r.TpServ);
            if (string.IsNullOrWhiteSpace(tpServDigits) || tpServDigits.Length != 9 || tpServDigits == "000000000")
                throw new ArgumentException($"TpServ inválido '{tpServDigits}'.");
            var bruto = MoneyToDecimal(MoneyBR(r.VlrBrutoNF));
            var baseRet = MoneyToDecimal(MoneyBR(r.VlrBaseRet));
            var ret = Round2(baseRet * aliquota);
            totBruto += bruto; totBase += baseRet; totRet += ret;
            var serie = string.IsNullOrWhiteSpace(r.SerieNF) ? "1" : r.SerieNF.Trim();
            buffer.Add((serie, nf, dtEmissao, bruto, r.ObsNF, tpServDigits, baseRet, ret));
        }

        AppendText(idePrestServ, "vlrTotalBruto", MoneyBR(totBruto), ns);
        AppendText(idePrestServ, "vlrTotalBaseRet", MoneyBR(totBase), ns);
        AppendText(idePrestServ, "vlrTotalRetPrinc", MoneyBR(totRet), ns);
        AppendText(idePrestServ, "indCPRB", indCprbGroup, ns);

        foreach (var it in buffer)
        {
            var nfsEl = doc.CreateElement("nfs", ns); idePrestServ.AppendChild(nfsEl);
            AppendText(nfsEl, "serie", it.serie, ns);
            AppendText(nfsEl, "numDocto", it.nf, ns);
            AppendText(nfsEl, "dtEmissaoNF", it.dt, ns);
            AppendText(nfsEl, "vlrBruto", MoneyBR(it.bruto), ns);
            if (!string.IsNullOrWhiteSpace(it.obs)) AppendText(nfsEl, "obs", it.obs!.Trim(), ns);
            var infoTpServ = doc.CreateElement("infoTpServ", ns); nfsEl.AppendChild(infoTpServ);
            AppendText(infoTpServ, "tpServico", it.tpServ, ns);
            AppendText(infoTpServ, "vlrBaseRet", MoneyBR(it.baseRet), ns);
            AppendText(infoTpServ, "vlrRetencao", MoneyBR(it.ret), ns);
        }

        return new Built2010(Reinf: doc.OuterXml, Id: id, TpInsc: 1, NrInsc: cnpjContrib, PerApur: perApur);
    }

    public static (string Xml, string Id) BuildR9000(string cnpjContrib, string nrRecEvt, string perApur, byte tpAmb = 2)
    {
        if (string.IsNullOrWhiteSpace(nrRecEvt)) throw new ArgumentException("nrRecEvt é obrigatório.");
        cnpjContrib = ParseUtil.OnlyDigits(cnpjContrib);
        perApur = (perApur ?? "").Trim();
        if (perApur.Length != 7 || perApur[4] != '-') throw new ArgumentException("perApur inválido.");
        var nrInscContri = cnpjContrib.Length == 14 ? cnpjContrib[..8] : cnpjContrib;
        string id = EventIdGenerator.Generate(1, nrInscContri);

        var xml = $"<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
              $"<Reinf xmlns=\"http://www.reinf.esocial.gov.br/schemas/evtExclusao/v2_01_02\">" +
              $"<evtExclusao id=\"{id}\">" +
              $"<ideEvento><tpAmb>{tpAmb}</tpAmb><procEmi>1</procEmi><verProc>ReinfSigner/2.0</verProc></ideEvento>" +
              $"<ideContri><tpInsc>1</tpInsc><nrInsc>{nrInscContri}</nrInsc></ideContri>" +
              $"<infoExclusao><tpEvento>R-2010</tpEvento>" +
              $"<nrRecEvt>{System.Security.SecurityElement.Escape(nrRecEvt.Trim())}</nrRecEvt>" +
              $"<perApur>{perApur}</perApur></infoExclusao>" +
              $"</evtExclusao></Reinf>";
        return (xml, id);
    }
}
