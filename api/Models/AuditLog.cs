using System.ComponentModel.DataAnnotations.Schema;

namespace ReinfApi.Models;

[Table("AUDIT_LOG")]
public class AuditLog
{
    [Column("ID")]
    public int Id { get; set; }

    [Column("DT_ACAO")]
    public DateTime DtAcao { get; set; } = DateTime.UtcNow;

    [Column("USUARIO_ID")]
    public int? UsuarioId { get; set; }

    [Column("USUARIO_NOME")]
    public string? UsuarioNome { get; set; }

    [Column("ACAO")]
    public string Acao { get; set; } = string.Empty;

    [Column("DETALHE")]
    public string? Detalhe { get; set; }

    [Column("IP")]
    public string? Ip { get; set; }

    [Column("CLIENTE_ID")]
    public int? ClienteId { get; set; }
}
