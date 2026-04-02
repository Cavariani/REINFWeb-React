using System.Globalization;

namespace ReinfApi.Core;

public static class ParseUtil
{
    public static readonly CultureInfo PtBr = CultureInfo.GetCultureInfo("pt-BR");

    public static string CleanInvisibles(string? s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        return s.Trim()
                .Replace('\u00A0', ' ')
                .Replace("\u200B", "")
                .Trim();
    }

    public static string? ToDateIso(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        if (DateTime.TryParse(input, new CultureInfo("pt-BR"), DateTimeStyles.None, out var dt) ||
            DateTime.TryParse(input, CultureInfo.InvariantCulture, DateTimeStyles.None, out dt))
            return dt.ToString("yyyy-MM-dd");
        if (double.TryParse(input, NumberStyles.Any, CultureInfo.InvariantCulture, out var oa) ||
            double.TryParse(input, NumberStyles.Any, PtBr, out oa))
        {
            try { return DateTime.FromOADate(oa).ToString("yyyy-MM-dd"); } catch { }
        }
        return null;
    }

    public static DateTime ParseDate(string s)
    {
        s = CleanInvisibles(s);
        var formats = new[] { "dd/MM/yyyy", "yyyy-MM-dd", "dd/MM/yyyy HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "M/d/yyyy", "M/d/yyyy HH:mm:ss" };
        if (DateTime.TryParseExact(s, formats, PtBr, DateTimeStyles.AllowWhiteSpaces, out var dt))
            return dt;
        return DateTime.Parse(s!, PtBr);
    }

    public static string ToYearMonth(string? s)
    {
        var t = CleanInvisibles(s);
        if (string.IsNullOrWhiteSpace(t)) return "";
        t = t.Replace("/", "-").Replace(" ", "");
        var parts = t.Split('-', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 2)
        {
            if (parts[0].Length == 4 && int.TryParse(parts[0], out var y1) && int.TryParse(parts[1], out var m1) && m1 is >= 1 and <= 12)
                return $"{y1:D4}-{m1:D2}";
            if (parts[1].Length == 4 && int.TryParse(parts[1], out var y2) && int.TryParse(parts[0], out var m2) && m2 is >= 1 and <= 12)
                return $"{y2:D4}-{m2:D2}";
        }
        return t;
    }

    public static string NormalizeYearMonth(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "";
        try { var ym = ToYearMonth(s); return (ym.Length == 7 && ym[4] == '-') ? ym : ""; }
        catch { return ""; }
    }

    public static string NormalizeDate(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "";
        try { return ParseDate(s).ToString("yyyy-MM-dd"); }
        catch { return ""; }
    }

    public static string FmtMoneyBR2(string s) => MoneyToBR(s, 2);
    public static string FmtPercBR4(string s) => MoneyToBR(s, 4);

    public static string MoneyToBR(string? s, int scale)
    {
        s = (s ?? "").Trim().Replace(" ", "");
        if (s.Count(ch => ch == ',') == 1 && s.Contains('.')) s = s.Replace(".", "");
        s = s.Replace(",", ".");
        if (!decimal.TryParse(s, NumberStyles.Number, CultureInfo.InvariantCulture, out var v))
        {
            var digits = new string(s.Where(char.IsDigit).ToArray());
            v = string.IsNullOrEmpty(digits) ? 0m : decimal.Parse(digits, CultureInfo.InvariantCulture);
        }
        var fmt = scale == 4 ? "0,0000" : "0,00";
        return v.ToString(fmt, PtBr);
    }

    public static string? MapSNOrNull(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var v = s.Trim().ToUpperInvariant();
        if (v is "S" or "SIM" or "1" or "TRUE" or "T") return "S";
        if (v is "N" or "NAO" or "NÃO" or "0" or "FALSE" or "F") return "N";
        return null;
    }

    public static byte? MapFciFlag(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        s = s.Trim().ToUpperInvariant();
        if (s == "1" || s == "FCI") return 1;
        if (s == "2" || s == "SCP") return 2;
        return null;
    }

    public static string OnlyDigits(string? s)
        => new string((s ?? "").Where(char.IsDigit).ToArray());

    public static bool IsValidCnpj(string? s)
    {
        var c = OnlyDigits(s);
        if (c.Length != 14) return false;
        if (new string(c[0], 14) == c) return false;
        int[] p1 = { 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 };
        int[] p2 = { 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 };
        int soma = 0;
        for (int i = 0; i < 12; i++) soma += (c[i] - '0') * p1[i];
        int r = soma % 11; int d1 = r < 2 ? 0 : 11 - r;
        soma = 0;
        for (int i = 0; i < 13; i++) soma += ((i < 12 ? c[i] - '0' : d1) * p2[i]);
        r = soma % 11; int d2 = r < 2 ? 0 : 11 - r;
        return (c[12] - '0') == d1 && (c[13] - '0') == d2;
    }

    public static bool IsValidCpf(string? s)
    {
        var c = OnlyDigits(s);
        if (c.Length != 11) return false;
        if (new string(c[0], 11) == c) return false;
        int[] p1 = { 10, 9, 8, 7, 6, 5, 4, 3, 2 };
        int[] p2 = { 11, 10, 9, 8, 7, 6, 5, 4, 3, 2 };
        int soma = 0;
        for (int i = 0; i < 9; i++) soma += (c[i] - '0') * p1[i];
        int r = soma % 11; int d1 = r < 2 ? 0 : 11 - r;
        soma = 0;
        for (int i = 0; i < 10; i++) soma += ((i < 9 ? c[i] - '0' : d1) * p2[i]);
        r = soma % 11; int d2 = r < 2 ? 0 : 11 - r;
        return (c[9] - '0') == d1 && (c[10] - '0') == d2;
    }

    public static string NormalizeDarfTag(string? s)
    {
        var t = CleanInvisibles(s)?.Replace("|", "/") ?? "";
        if (t.Length == 0) return "";
        var d = OnlyDigits(t);
        return d.Length > 0 ? d : t;
    }
}
