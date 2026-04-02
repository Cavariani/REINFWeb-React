using System.Xml;

namespace ReinfApi.Core;

public static class XmlBuilderR1000
{
    public sealed record Built(string Id, string NrInsc, byte TpInsc, string Xml);

    public static Built Build(RowR1000 row, byte tpAmb)
        => Build(
            cnpj: row.Cnpj,
            iniValid: row.IniValid,
            fimValid: row.FimValid,
            acao: row.Acao,
            tpAmb: tpAmb,
            nmCtt: row.NmCtt,
            cpfCtt: row.CpfCtt,
            foneFixo: row.FoneFixo,
            email: row.Email,
            foneCel: row.FoneCel,
            classTrib: row.ClassTrib,
            indEscrituracao: row.IndEscrituracao,
            indDesoneracao: row.IndDesoneracao,
            indAcordoIsenMulta: row.IndAcordoIsenMulta,
            indSitPJ: row.IndSitPJ,
            cnpjSoftHouse: row.CnpjSoftHouse,
            razaoSoftHouse: row.RazaoSoftHouse,
            nomeContSoft: row.NomeContSoft,
            telefoneSoft: row.TelefoneSoft,
            emailSoft: row.EmailSoft
        );

    public static Built Build(
        string cnpj,
        string iniValid,
        byte tpAmb,
        string nmCtt,
        string cpfCtt,
        string? fimValid = null,
        string? acao = null,
        string? foneFixo = null,
        string? email = null,
        string? foneCel = null,
        string? classTrib = null,
        string? indEscrituracao = null,
        string? indDesoneracao = null,
        string? indAcordoIsenMulta = null,
        string? indSitPJ = null,
        string? cnpjSoftHouse = null,
        string? razaoSoftHouse = null,
        string? nomeContSoft = null,
        string? telefoneSoft = null,
        string? emailSoft = null)
    {
        var nrInsc = ParseUtil.OnlyDigits(cnpj);
        if (!(nrInsc.Length == 8 || nrInsc.Length == 14))
            throw new ArgumentException($"CNPJ inválido. Lido: '{cnpj}'");
        if (nrInsc.Length == 14 && !ParseUtil.IsValidCnpj(nrInsc))
            throw new ArgumentException($"CNPJ inválido (DV). Lido: '{cnpj}'");

        iniValid = ParseUtil.ToYearMonth(ParseUtil.CleanInvisibles(iniValid));
        if (string.IsNullOrWhiteSpace(iniValid) || iniValid.Length != 7 || iniValid[4] != '-')
            throw new ArgumentException($"iniValid deve estar no formato YYYY-MM. Lido: '{iniValid}'");

        // fimValid é opcional — só valida se vier preenchido
        var fimValidNorm = string.IsNullOrWhiteSpace(fimValid)
            ? null
            : ParseUtil.ToYearMonth(ParseUtil.CleanInvisibles(fimValid));
        if (fimValidNorm != null && (fimValidNorm.Length != 7 || fimValidNorm[4] != '-'))
            throw new ArgumentException($"fimValid deve estar no formato YYYY-MM. Lido: '{fimValid}'");

        var acaoUpper = (acao ?? "ENVIAR").Trim().ToUpperInvariant();

        var cpf = ParseUtil.OnlyDigits(cpfCtt ?? "");
        if (!string.IsNullOrEmpty(cpf) && !ParseUtil.IsValidCpf(cpf))
            throw new ArgumentException($"CPF do contato inválido. Lido: '{cpfCtt}'");

        static string Def(string? v, string dflt) => string.IsNullOrWhiteSpace(v) ? dflt : v.Trim();

        classTrib = Def(ParseUtil.OnlyDigits(classTrib), "99");
        indEscrituracao = Def(ParseUtil.OnlyDigits(indEscrituracao), "1");
        indDesoneracao = Def(ParseUtil.OnlyDigits(indDesoneracao), "0");
        indAcordoIsenMulta = Def(ParseUtil.OnlyDigits(indAcordoIsenMulta), "0");
        indSitPJ = Def(ParseUtil.OnlyDigits(indSitPJ), "0");

        foneFixo = ParseUtil.OnlyDigits(foneFixo);
        foneCel = ParseUtil.OnlyDigits(foneCel);
        telefoneSoft = ParseUtil.OnlyDigits(telefoneSoft);
        cnpjSoftHouse = ParseUtil.OnlyDigits(cnpjSoftHouse);
        email = ParseUtil.CleanInvisibles(email);
        emailSoft = ParseUtil.CleanInvisibles(emailSoft);

        if (!string.IsNullOrWhiteSpace(cnpjSoftHouse) && cnpjSoftHouse.Length == 14 && !ParseUtil.IsValidCnpj(cnpjSoftHouse))
            throw new ArgumentException($"cnpjSoftHouse inválido. Lido: '{cnpjSoftHouse}'");

        const byte tpInsc = 1;
        var evtId = EventIdGenerator.Generate(tpInsc, nrInsc);
        const string ns = "http://www.reinf.esocial.gov.br/schemas/evtInfoContribuinte/v2_01_02";

        var doc = new XmlDocument { PreserveWhitespace = true };
        var reinf = doc.CreateElement("Reinf", ns); doc.AppendChild(reinf);

        var evt = doc.CreateElement("evtInfoContri", ns);
        evt.SetAttribute("id", evtId);
        reinf.AppendChild(evt);

        var ideEvento = doc.CreateElement("ideEvento", ns); evt.AppendChild(ideEvento);
        AppendText(ideEvento, "tpAmb", tpAmb.ToString(), ns);
        AppendText(ideEvento, "procEmi", "1", ns);
        AppendText(ideEvento, "verProc", "REINFSignerPedroV2", ns);

        var ideContri = doc.CreateElement("ideContri", ns); evt.AppendChild(ideContri);
        AppendText(ideContri, "tpInsc", tpInsc.ToString(), ns);
        AppendText(ideContri, "nrInsc", nrInsc, ns);

        var infoContri = doc.CreateElement("infoContri", ns); evt.AppendChild(infoContri);

        // O elemento pai muda conforme a ação: inclusao / alteracao / exclusao
        var tagAcao = acaoUpper switch
        {
            "ALTERAR" => "alteracao",
            "EXCLUIR" => "exclusao",
            _         => "inclusao",
        };

        var bloco = doc.CreateElement(tagAcao, ns); infoContri.AppendChild(bloco);

        var idePeriodo = doc.CreateElement("idePeriodo", ns); bloco.AppendChild(idePeriodo);
        AppendText(idePeriodo, "iniValid", iniValid, ns);
        if (!string.IsNullOrWhiteSpace(fimValidNorm)) AppendText(idePeriodo, "fimValid", fimValidNorm!, ns);

        // EXCLUIR não leva infoCadastro
        if (acaoUpper != "EXCLUIR")
        {
            var infoCadastro = doc.CreateElement("infoCadastro", ns); bloco.AppendChild(infoCadastro);
            AppendText(infoCadastro, "classTrib", classTrib!, ns);
            AppendText(infoCadastro, "indEscrituracao", indEscrituracao!, ns);
            AppendText(infoCadastro, "indDesoneracao", indDesoneracao!, ns);
            AppendText(infoCadastro, "indAcordoIsenMulta", indAcordoIsenMulta!, ns);
            AppendText(infoCadastro, "indSitPJ", indSitPJ!, ns);

            var contato = doc.CreateElement("contato", ns); infoCadastro.AppendChild(contato);
            AppendText(contato, "nmCtt", nmCtt ?? "", ns);
            if (!string.IsNullOrEmpty(cpf)) AppendText(contato, "cpfCtt", cpf, ns);
            if (!string.IsNullOrWhiteSpace(foneFixo)) AppendText(contato, "foneFixo", foneFixo, ns);
            if (!string.IsNullOrWhiteSpace(foneCel)) AppendText(contato, "foneCel", foneCel, ns);
            if (!string.IsNullOrWhiteSpace(email)) AppendText(contato, "email", email.Trim(), ns);

            if (!string.IsNullOrWhiteSpace(cnpjSoftHouse))
            {
                var sh = doc.CreateElement("softHouse", ns); infoCadastro.AppendChild(sh);
                AppendText(sh, "cnpjSoftHouse", cnpjSoftHouse!, ns);
                if (!string.IsNullOrWhiteSpace(razaoSoftHouse)) AppendText(sh, "nmRazao", razaoSoftHouse!, ns);
                if (!string.IsNullOrWhiteSpace(nomeContSoft)) AppendText(sh, "nmCont", nomeContSoft!, ns);
                if (!string.IsNullOrWhiteSpace(telefoneSoft)) AppendText(sh, "telefone", telefoneSoft!, ns);
                if (!string.IsNullOrWhiteSpace(emailSoft)) AppendText(sh, "email", emailSoft!.Trim(), ns);
            }
        }

        return new Built(evtId, nrInsc, tpInsc, doc.OuterXml);
    }

    private static void AppendText(XmlElement parent, string name, string value, string ns)
    {
        var el = parent.OwnerDocument!.CreateElement(name, ns);
        el.InnerText = value ?? "";
        parent.AppendChild(el);
    }
}
