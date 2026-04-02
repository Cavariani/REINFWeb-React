using System.Text;

namespace ReinfApi.Core;

public class BatchBuilder
{
    private readonly List<(string id, string xml, byte tpInsc, string nrInsc)> _events = new();

    public void AddEvent(string id, string xml, byte tpInsc, string nrInsc)
        => _events.Add((id, xml, tpInsc, nrInsc));

    public (byte tpInsc, string nrInsc) FirstContrib()
        => _events.Count > 0 ? (_events[0].tpInsc, _events[0].nrInsc)
            : throw new InvalidOperationException("Sem eventos no lote.");

    public string BuildXml(byte tpInsc, string nrInsc)
    {
        // ideContribuinte > nrInsc no envelope do lote também deve ser o CNPJ raiz (8 dígitos)
        var nrInscEnvelope = (tpInsc == 1 && nrInsc.Length == 14) ? nrInsc[..8] : nrInsc;

        var sb = new StringBuilder();
        sb.AppendLine(@"<?xml version=""1.0"" encoding=""utf-8""?>");
        sb.AppendLine(@"<Reinf xmlns=""http://www.reinf.esocial.gov.br/schemas/envioLoteEventosAssincrono/v1_00_00"">");
        sb.AppendLine(@"  <envioLoteEventos>");
        sb.AppendLine(@"    <ideContribuinte>");
        sb.AppendLine($"      <tpInsc>{tpInsc}</tpInsc>");
        sb.AppendLine($"      <nrInsc>{nrInscEnvelope}</nrInsc>");
        sb.AppendLine(@"    </ideContribuinte>");
        sb.AppendLine(@"    <eventos>");

        foreach (var e in _events)
        {
            sb.AppendLine($@"      <evento Id=""{e.id}"">");
            sb.AppendLine(StripXmlDecl(e.xml));
            sb.AppendLine(@"      </evento>");
        }

        sb.AppendLine(@"    </eventos>");
        sb.AppendLine(@"  </envioLoteEventos>");
        sb.AppendLine(@"</Reinf>");
        return sb.ToString();
    }

    private static string StripXmlDecl(string xml)
    {
        if (string.IsNullOrEmpty(xml)) return string.Empty;
        if (xml.Length > 0 && xml[0] == '\uFEFF') xml = xml.Substring(1);
        if (xml.StartsWith("<?xml", StringComparison.OrdinalIgnoreCase))
        {
            int end = xml.IndexOf("?>");
            if (end >= 0) xml = xml.Substring(end + 2);
        }
        return xml;
    }
}
