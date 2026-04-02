using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ReinfApi.Models;

[Table("USUARIOS")]
public class AppUser
{
    [Key]
    [Column("ID")]
    public int Id { get; set; }

    [Column("EMAIL")]
    [MaxLength(255)]
    public string Email { get; set; } = "";

    [Column("SENHA_HASH")]
    [MaxLength(255)]
    public string SenhaHash { get; set; } = "";

    [Column("NOME")]
    [MaxLength(150)]
    public string Nome { get; set; } = "";

    [Column("DT_CRIACAO")]
    public DateTime DtCriacao { get; set; } = DateTime.UtcNow;

    [Column("IS_ADMIN")]
    public bool IsAdmin { get; set; } = false;

    [Column("IS_SUPER_ADMIN")]
    public bool IsSuperAdmin { get; set; } = false;

    [Column("CLIENTE_ID")]
    public int ClienteId { get; set; }

    // Navigation
    public ICollection<Lote> Lotes { get; set; } = new List<Lote>();
    public ICollection<Empresa> Empresas { get; set; } = new List<Empresa>();
}
