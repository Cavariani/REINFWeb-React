using System.Xml;
using System.Security.Cryptography.Xml;

namespace ReinfApi.Core;

/// <summary>
/// SignedXml com resolução de alvo por @Id/@id/@ID (REINF aceita variações).
/// </summary>
public sealed class SignedXmlEx : SignedXml
{
    public SignedXmlEx() : base() { }
    public SignedXmlEx(XmlDocument? document) : base(document) { }
    public SignedXmlEx(XmlElement element) : base(element) { }

    public override XmlElement? GetIdElement(XmlDocument? document, string idValue)
    {
        if (document == null || string.IsNullOrEmpty(idValue))
            return base.GetIdElement(document, idValue);

        var byId = document.GetElementById(idValue);
        if (byId != null) return byId;

        var elem = document.SelectSingleNode($"//*[@Id='{idValue}']") as XmlElement;
        if (elem != null) return elem;

        elem = document.SelectSingleNode($"//*[@id='{idValue}']") as XmlElement;
        if (elem != null) return elem;

        elem = document.SelectSingleNode($"//*[@ID='{idValue}']") as XmlElement;
        if (elem != null) return elem;

        return base.GetIdElement(document, idValue);
    }
}
