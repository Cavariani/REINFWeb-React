using ReinfApi.Data;
using ReinfApi.Models;

namespace ReinfApi.Services;

public class AuditService
{
    private readonly AppDbContext _db;

    public AuditService(AppDbContext db) => _db = db;

    public async Task LogAsync(string acao, int? usuarioId = null, string? usuarioNome = null,
        string? detalhe = null, string? ip = null, int? clienteId = null)
    {
        _db.AuditLogs.Add(new AuditLog
        {
            Acao        = acao,
            UsuarioId   = usuarioId,
            UsuarioNome = usuarioNome,
            Detalhe     = detalhe,
            Ip          = ip,
            ClienteId   = clienteId,
            DtAcao      = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
    }
}
