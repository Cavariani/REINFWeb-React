using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ReinfApi.Models;

[Table("CLIENTES")]
public class Cliente
{
    [Key]
    [Column("ID")]
    public int Id { get; set; }

    [Column("NOME")]
    [MaxLength(200)]
    public string Nome { get; set; } = "";

    [Column("ATIVA")]
    public bool Ativa { get; set; } = true;

    [Column("DT_CRIACAO")]
    public DateTime DtCriacao { get; set; } = DateTime.UtcNow;
}
