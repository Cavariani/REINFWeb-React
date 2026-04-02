using System.Globalization;
using System.Text;
using System.Xml;
using System.Xml.Serialization;
using ES = ReinfApi.Core;

namespace ReinfApi.Core;

public static class XmlBuilder4010
{
    private static string MoneyBR(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return "0,00";
        var s = v.Trim().Replace(".", ",");
        if (!decimal.TryParse(s, NumberStyles.Any, new CultureInfo("pt-BR"), out var d)) d = 0m;
        return d.ToString("0.00", new CultureInfo("pt-BR"));
    }

    public static Built4010 Build(Row4010 r, byte tpAmb = 2, byte indRetif = 1, string? nrRecibo = null)
    {
        if (indRetif == 2 && string.IsNullOrWhiteSpace(nrRecibo))
            throw new ArgumentException("nrRecibo é obrigatório para retificação (indRetif=2).", nameof(nrRecibo));
        if (indRetif != 1 && indRetif != 2)
            throw new ArgumentException($"indRetif deve ser 1 ou 2. Recebido: {indRetif}", nameof(indRetif));

        var cnpjContrib = ParseUtil.OnlyDigits(r.CnpjContrib);
        if (!(cnpjContrib.Length == 8 || cnpjContrib.Length == 14))
            throw new ArgumentException($"CnpjContrib inválido (esperado 8 ou 14 dígitos). Lido: '{r.CnpjContrib}'");
        if (cnpjContrib.Length == 14 && !ParseUtil.IsValidCnpj(cnpjContrib))
            throw new ArgumentException($"CnpjContrib inválido (DV). Lido: '{r.CnpjContrib}'");

        var nrInscEstab = ParseUtil.OnlyDigits(string.IsNullOrWhiteSpace(r.CpfEstab) ? cnpjContrib : r.CpfEstab);
        byte tpInscEstab = (byte)(nrInscEstab?.Length == 11 ? 2 : 1);

        if (tpInscEstab == 1)
        {
            if (nrInscEstab.Length != 14 || !ParseUtil.IsValidCnpj(nrInscEstab))
                throw new ArgumentException($"nrInscEstab inválido (CNPJ 14 dígitos com DV). Lido: '{r.CpfEstab}'");
        }
        else
        {
            if (nrInscEstab.Length != 11 || !ParseUtil.IsValidCpf(nrInscEstab))
                throw new ArgumentException($"nrInscEstab inválido (CPF 11 dígitos com DV). Lido: '{r.CpfEstab}'");
        }

        var cpfBenef = ParseUtil.OnlyDigits(r.CpfBenef);
        string? nmBenefToSend = null;
        string? cpfBenefToSend = null;

        if (!string.IsNullOrWhiteSpace(cpfBenef))
        {
            if (cpfBenef.Length != 11 || !ParseUtil.IsValidCpf(cpfBenef))
                throw new ArgumentException($"cpfBenef inválido (11 dígitos com DV). Lido: '{r.CpfBenef}'");
            cpfBenefToSend = cpfBenef;
        }
        else
        {
            nmBenefToSend = (r.NomeBenef ?? "").Trim();
            if (string.IsNullOrWhiteSpace(nmBenefToSend))
                throw new ArgumentException("nmBenef obrigatório quando cpfBenef não for informado.");
        }

        var perApur = ParseUtil.ToYearMonth(ParseUtil.CleanInvisibles(r.PerApur));
        if (string.IsNullOrWhiteSpace(perApur) || perApur.Length != 7 || perApur[4] != '-')
            throw new ArgumentException($"perApur inválido (esperado YYYY-MM). Lido: '{r.PerApur}'");
        perApur = perApur.Trim().Replace('\u00A0', ' ').Replace("\u200B", "");

        var dtFg = ParseUtil.ParseDate(ParseUtil.CleanInvisibles(r.DtFg));
        if (!perApur.Equals($"{dtFg:yyyy-MM}", StringComparison.Ordinal))
            throw new ArgumentException($"dtFG ({dtFg:yyyy-MM-dd}) deve estar no mesmo mês/ano de perApur ({perApur}).");

        var _nat = ParseUtil.OnlyDigits(r.NatRend);
        if (_nat.Length != 5)
            throw new ArgumentException($"natRend inválido (esperado 5 dígitos Tabela 01). Lido: '{r.NatRend}'");

        var indJudNorm = ParseUtil.MapSNOrNull(r.IndJud);
        var vlrRendBruto = MoneyBR(r.VlrRend);
        var vlrRendTrib = MoneyBR(r.VlrRendTrib);
        var vlrIR = MoneyBR(r.VlrIrrf);

        // ideContri > nrInsc deve ser o CNPJ raiz (8 dígitos) — não o CNPJ completo
        var nrInscContri = cnpjContrib.Length == 14 ? cnpjContrib[..8] : cnpjContrib;
        string id = EventIdGenerator.Generate(1, nrInscContri);

        var ideEvento = new ReinfEvtRetPFIdeEvento
        {
            indRetif = indRetif,
            nrRecibo = (indRetif == 2) ? nrRecibo?.Trim() : null,
            perApur = perApur,
            tpAmb = tpAmb,
            procEmi = 1,
            verProc = "ReinfSigner/2.0"
        };

        var ideContri = new ReinfEvtRetPFIdeContri { tpInsc = 1, nrInsc = nrInscContri };

        var infoPgto = new ReinfEvtRetPFIdeEstabIdeBenefIdePgtoInfoPgto
        {
            dtFG = dtFg,
            vlrRendBruto = vlrRendBruto,
            vlrRendTrib = vlrRendTrib,
            vlrIR = vlrIR
        };

        var rra = ParseUtil.MapSNOrNull(r.Rra);
        if (!string.IsNullOrWhiteSpace(rra)) infoPgto.indRRA = rra;
        infoPgto.indJud = string.IsNullOrWhiteSpace(indJudNorm) ? "N" : indJudNorm;

        byte? fciFlag = ParseUtil.MapFciFlag(r.IndFciScp);
        if (fciFlag.HasValue && (fciFlag.Value == 1 || fciFlag.Value == 2))
        {
            infoPgto.indFciScp = fciFlag.Value;
            infoPgto.indFciScpSpecified = true;
            var cnpjFci = ParseUtil.OnlyDigits(r.CnpjFciScp);
            if (!string.IsNullOrWhiteSpace(cnpjFci)) infoPgto.nrInscFciScp = cnpjFci;
            if (!string.IsNullOrWhiteSpace(r.PercScp)) infoPgto.percSCP = ParseUtil.FmtPercBR4(r.PercScp);
        }

        var idePgto = new ReinfEvtRetPFIdeEstabIdeBenefIdePgto
        {
            natRend = _nat,
            infoPgto = new[] { infoPgto }
        };

        var ideBenef = new ReinfEvtRetPFIdeEstabIdeBenef { idePgto = new[] { idePgto } };
        if (cpfBenefToSend != null) ideBenef.cpfBenef = cpfBenefToSend;
        if (nmBenefToSend != null) ideBenef.nmBenef = nmBenefToSend;

        var ideEstab = new ReinfEvtRetPFIdeEstab
        {
            tpInscEstab = tpInscEstab,
            nrInscEstab = nrInscEstab,
            ideBenef = ideBenef
        };

        var evt = new ReinfEvtRetPF
        {
            ideEvento = ideEvento,
            ideContri = ideContri,
            ideEstab = ideEstab,
            id = id
        };

        var reinf = new Reinf { evtRetPF = evt, Signature = null };
        return new Built4010(reinf, id, 1, cnpjContrib, perApur);
    }

    public static (string Xml, string Id) BuildR9000(
        string cnpjContrib, string nrRecEvt, string perApur, byte tpAmb = 2)
    {
        if (string.IsNullOrWhiteSpace(nrRecEvt))
            throw new ArgumentException("nrRecEvt é obrigatório para exclusão R-9000.", nameof(nrRecEvt));

        cnpjContrib = ParseUtil.OnlyDigits(cnpjContrib);
        if (!(cnpjContrib.Length == 8 || cnpjContrib.Length == 14))
            throw new ArgumentException($"cnpjContrib inválido. Lido: '{cnpjContrib}'");

        perApur = (perApur ?? "").Trim();
        if (perApur.Length != 7 || perApur[4] != '-')
            throw new ArgumentException($"perApur inválido (esperado YYYY-MM). Lido: '{perApur}'");

        var nrInscContri = cnpjContrib.Length == 14 ? cnpjContrib[..8] : cnpjContrib;
        string id = EventIdGenerator.Generate(1, nrInscContri);

        var xml = $"<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
              $"<Reinf xmlns=\"http://www.reinf.esocial.gov.br/schemas/evtExclusao/v2_01_02\">" +
              $"<evtExclusao id=\"{id}\">" +
              $"<ideEvento><tpAmb>{tpAmb}</tpAmb><procEmi>1</procEmi><verProc>ReinfSigner/2.0</verProc></ideEvento>" +
              $"<ideContri><tpInsc>1</tpInsc><nrInsc>{nrInscContri}</nrInsc></ideContri>" +
              $"<infoExclusao><tpEvento>R-4010</tpEvento>" +
              $"<nrRecEvt>{System.Security.SecurityElement.Escape(nrRecEvt.Trim())}</nrRecEvt>" +
              $"<perApur>{perApur}</perApur></infoExclusao>" +
              $"</evtExclusao></Reinf>";

        return (xml, id);
    }

    public static string Serialize(Reinf reinf)
    {
        var ns = new XmlSerializerNamespaces();
        ns.Add(string.Empty, "http://www.reinf.esocial.gov.br/schemas/evt4010PagtoBeneficiarioPF/v2_01_02");
        var ser = new XmlSerializer(typeof(Reinf));
        var settings = new System.Xml.XmlWriterSettings
        {
            Encoding = new UTF8Encoding(false),
            OmitXmlDeclaration = false,
            Indent = false,
            NewLineHandling = NewLineHandling.None
        };
        using var sw = new Utf8StringWriter();
        using (var xw = XmlWriter.Create(sw, settings))
            ser.Serialize(xw, reinf, ns);
        return sw.ToString();
    }

    private sealed class Utf8StringWriter : StringWriter
    {
        public override Encoding Encoding => new UTF8Encoding(false);
    }

    public readonly record struct Built4010(
        Reinf Reinf,
        string Id,
        byte TpInsc,
        string NrInsc,
        string PerApur);
}
