using System.Text;

namespace ReinfApi.Core;

public static class EventIdGenerator
{
    private static int _seq;

    public static string Generate(byte tpInsc, string nrInsc)
    {
        var digits = OnlyDigits(nrInsc);
        int len = (tpInsc == 1) ? 14 : 11;
        if (digits.Length < len) digits = digits.PadRight(len, '0');
        else if (digits.Length > len) digits = digits.Substring(0, len);

        string now = DateTime.Now.ToString("yyyyMMddHHmmss");
        int seq = Interlocked.Increment(ref _seq);
        seq = ((seq - 1) % 99999) + 1;
        string q = seq.ToString("D5");

        return $"ID{tpInsc}{digits}{now}{q}";
    }

    private static string OnlyDigits(string? s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        var sb = new StringBuilder(s.Length);
        foreach (var ch in s) if (ch >= '0' && ch <= '9') sb.Append(ch);
        return sb.ToString();
    }
}
