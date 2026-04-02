using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Xml;

namespace ReinfApi.Core;

public static class ReinfXmlSigner
{
    // ===== Certificado (.pfx) — carrega dos bytes (banco de dados) =====
    public static X509Certificate2 LoadPfxFromBytes(byte[] pfxBytes, string? password)
    {
        return new X509Certificate2(
            pfxBytes,
            password,
            X509KeyStorageFlags.UserKeySet |
            X509KeyStorageFlags.PersistKeySet |
            X509KeyStorageFlags.Exportable
        );
    }

    // ===== Helpers internos =====
    private static void EnsureIdAttribute(XmlElement el)
    {
        var id = el.GetAttribute("id");
        if (string.IsNullOrWhiteSpace(id))
        {
            id = el.GetAttribute("Id");
            if (!string.IsNullOrWhiteSpace(id)) el.RemoveAttribute("Id");
        }
        if (string.IsNullOrWhiteSpace(id)) id = "ID" + Guid.NewGuid().ToString("N");
        el.SetAttribute("id", id);
    }

    private static XmlElement? FirstEvent(XmlDocument doc)
        => doc.SelectSingleNode("/*[local-name()='Reinf']/*[starts-with(local-name(),'evt')]") as XmlElement;

    private static XmlElement? FindSignature(XmlDocument doc)
        => doc.SelectSingleNode("//*[local-name()='Signature' and namespace-uri()='http://www.w3.org/2000/09/xmldsig#']") as XmlElement;

    private static void AddX509LeafOnly(KeyInfo ki, X509Certificate2 cert)
    {
        var leafOnly = new X509Certificate2(cert.RawData);
        var data = new KeyInfoX509Data();
        data.AddCertificate(leafOnly);
        ki.AddClause(data);
    }

    // ===== Assinatura R-4010 / R-4020 / R-2010 =====
    public static string SignAtRoot(string unsignedXml, X509Certificate2 cert)
    {
        var doc = new XmlDocument { PreserveWhitespace = true };
        doc.LoadXml(unsignedXml);

        var evt = FirstEvent(doc) ?? throw new Exception("Elemento de evento não encontrado.");
        EnsureIdAttribute(evt);

        var root = doc.DocumentElement ?? throw new Exception("Root <Reinf> não encontrado.");

        var sx = new SignedXmlEx(doc) { SigningKey = cert.GetRSAPrivateKey() };
        sx.KeyInfo = new KeyInfo();
        AddX509LeafOnly(sx.KeyInfo, cert);

        sx.SignedInfo.CanonicalizationMethod = SignedXml.XmlDsigExcC14NTransformUrl;
        sx.SignedInfo.SignatureMethod = SignedXml.XmlDsigRSASHA256Url;

        var r = new Reference { Uri = "#" + evt.GetAttribute("id") };
        r.AddTransform(new XmlDsigExcC14NTransform());
        sx.AddReference(r);

        sx.ComputeSignature();
        root.AppendChild(doc.ImportNode(sx.GetXml(), true));
        return doc.OuterXml;
    }

    // ===== Assinatura R-1000 =====
    public static string SignR1000(string unsignedEventXml, X509Certificate2 cert, System.Xml.Schema.XmlSchemaSet? _ = null)
    {
        var doc = new XmlDocument { PreserveWhitespace = true };
        doc.LoadXml(unsignedEventXml);

        var evtInfo = doc.SelectSingleNode(
            "/*[local-name()='Reinf']//*[local-name()='evtInfoContri' or local-name()='evtInfoContribuinte']"
        ) as XmlElement ?? throw new Exception("Elemento <evtInfoContri/evtInfoContribuinte> não encontrado.");

        EnsureIdAttribute(evtInfo);
        var root = doc.DocumentElement ?? throw new Exception("Root <Reinf> não encontrado.");

        var sx = new SignedXmlEx(doc) { SigningKey = cert.GetRSAPrivateKey() };
        sx.KeyInfo = new KeyInfo();
        AddX509LeafOnly(sx.KeyInfo, cert);

        sx.SignedInfo.CanonicalizationMethod = SignedXml.XmlDsigExcC14NTransformUrl;
        sx.SignedInfo.SignatureMethod = SignedXml.XmlDsigRSASHA256Url;

        var r = new Reference { Uri = "#" + evtInfo.GetAttribute("id") };
        r.AddTransform(new XmlDsigExcC14NTransform());
        sx.AddReference(r);

        sx.ComputeSignature();
        root.AppendChild(doc.ImportNode(sx.GetXml(), true));
        return doc.OuterXml;
    }

    // ===== Assinatura R-9000 (exclusão) =====
    public static string SignR9000(string unsignedXml, X509Certificate2 cert)
    {
        var doc = new XmlDocument { PreserveWhitespace = true };
        doc.LoadXml(unsignedXml);

        var evt = doc.SelectSingleNode("/*[local-name()='Reinf']/*[local-name()='evtExclusao']") as XmlElement
                  ?? throw new Exception("Elemento <evtExclusao> não encontrado.");

        var id = evt.GetAttribute("id");
        if (string.IsNullOrWhiteSpace(id)) id = evt.GetAttribute("Id");
        if (string.IsNullOrWhiteSpace(id)) throw new Exception("evtExclusao sem atributo id.");

        var root = doc.DocumentElement!;
        var sx = new SignedXmlEx(doc) { SigningKey = cert.GetRSAPrivateKey() };
        sx.KeyInfo = new KeyInfo();
        AddX509LeafOnly(sx.KeyInfo, cert);

        sx.SignedInfo.CanonicalizationMethod = SignedXml.XmlDsigCanonicalizationUrl;
        sx.SignedInfo.SignatureMethod = SignedXml.XmlDsigRSASHA256Url;

        var r = new Reference { Uri = "#" + id };
        r.AddTransform(new XmlDsigEnvelopedSignatureTransform());
        r.AddTransform(new XmlDsigC14NTransform());
        sx.AddReference(r);

        sx.ComputeSignature();
        root.AppendChild(doc.ImportNode(sx.GetXml(), true));
        return doc.OuterXml;
    }

    // ===== Verificação local =====
    public static bool VerifyLocal(string signedXml, out (string canon, string[] transforms) algos)
    {
        var ok = VerifyLocal(signedXml, out string canon, out string[] transforms);
        algos = (canon, transforms);
        return ok;
    }

    public static bool VerifyLocal(string signedXml, out string canonicalizationAlg, out string[] transforms)
    {
        canonicalizationAlg = "";
        transforms = Array.Empty<string>();

        var doc = new XmlDocument { PreserveWhitespace = true };
        doc.LoadXml(signedXml);

        var sigEl = FindSignature(doc);
        if (sigEl == null) return false;

        var sx = new SignedXmlEx(doc);
        sx.LoadXml(sigEl);
        canonicalizationAlg = sx.SignedInfo.CanonicalizationMethod;

        var list = new List<string>();
        if (sx.SignedInfo.References.Count > 0)
        {
            var re = (Reference)sx.SignedInfo.References[0];
            var chain = re.TransformChain;
            for (int i = 0; i < chain.Count; i++)
                if (chain[i] is Transform t && !string.IsNullOrEmpty(t.Algorithm))
                    list.Add(t.Algorithm);
        }
        transforms = list.ToArray();
        return sx.CheckSignature();
    }
}
