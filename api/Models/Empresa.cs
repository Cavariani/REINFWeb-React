using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ReinfApi.Models;

[Table("EMPRESAS")]
public class Empresa
{
    [Key]
    [Column("ID")]
    public int Id { get; set; }

    [Column("NOME")]
    [MaxLength(150)]
    public string Nome { get; set; } = "";

    [Column("CNPJ")]
    [MaxLength(14)]
    public string Cnpj { get; set; } = "";

    [Column("ATIVA")]
    public bool Ativa { get; set; } = true;

    /// <summary>
    /// true = empresa que detém certificado e assina os envios (ex: MLC, SLEGATE).
    /// false = empresa cliente/contribuinte (ex: BTC) — usuários são vinculados aqui.
    /// </summary>
    [Column("IS_EMISSORA")]
    public bool IsEmissora { get; set; } = false;

    /// <summary>
    /// ID da emissora responsável por assinar os envios deste contribuinte.
    /// Null se for uma emissora ou se não tiver emissora configurada.
    /// </summary>
    [Column("EMISSORA_ID")]
    public int? EmissoraId { get; set; }

    /// <summary>
    /// Certificado digital diretamente vinculado a este contribuinte (novo modelo).
    /// </summary>
    [Column("CERTIFICADO_ID")]
    public int? CertificadoId { get; set; }

    [Column("CLIENTE_ID")]
    public int ClienteId { get; set; }

    // Navigation
    public ICollection<AppUser> Usuarios { get; set; } = new List<AppUser>();
    public ICollection<Certificate> Certificados { get; set; } = new List<Certificate>();

    [ForeignKey("CertificadoId")]
    public Certificate? Certificado { get; set; }
}
