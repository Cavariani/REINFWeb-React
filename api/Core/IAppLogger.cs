namespace ReinfApi.Core;

public interface IAppLogger
{
    void Info(string msg);
    void Debug(string msg);
    void Warn(string msg);
    void Error(string msg);
    void Success(string msg);
}

/// <summary>Logger simples para uso no servidor (sem WinForms).</summary>
public sealed class ConsoleLogger : IAppLogger
{
    public void Info(string msg)    => Console.WriteLine($"[INFO ] {msg}");
    public void Debug(string msg)   => Console.WriteLine($"[DEBUG] {msg}");
    public void Warn(string msg)    => Console.WriteLine($"[WARN ] {msg}");
    public void Error(string msg)   => Console.Error.WriteLine($"[ERROR] {msg}");
    public void Success(string msg) => Console.WriteLine($"[SUCC ] {msg}");
}
