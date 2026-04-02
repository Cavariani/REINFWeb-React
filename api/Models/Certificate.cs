using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ReinfApi.Models;

[Table("CERTIFICADOS")]
public class Certificate
{
    [Key]
    [Column("ID")]
    public int Id { get; set; }

    /// <summary>FK para empresa dona do certificado (novo modelo).</summary>
    [Column("EMPRESA_ID")]
    public int? EmpresaId { get; set; }

    /// <summary>Mantido nullable para compatibilidade com dados antigos.</summary>
    [Column("ID_USUARIO")]
    public int? UsuarioId { get; set; }

    [Column("NOME")]
    [MaxLength(200)]
    public string Nome { get; set; } = "";

    [Column("CNPJ_CONTRIBUINTE")]
    [MaxLength(14)]
    public string CnpjContribuinte { get; set; } = "";

    [Column("PFX_BYTES")]
    public byte[] PfxBytes { get; set; } = Array.Empty<byte>();

    /// <summary>Senha criptografada com AES-256 (chave em appsettings).</summary>
    [Column("SENHA_CRIPTOGRAFADA")]
    [MaxLength(500)]
    public string SenhaCriptografada { get; set; } = "";

    [Column("DT_UPLOAD")]
    public DateTime DtUpload { get; set; } = DateTime.UtcNow;

    /// <summary>Data de vencimento extraída do X.509 no upload.</summary>
    [Column("DT_VALIDADE")]
    public DateTime? DtValidade { get; set; }

    [Column("CLIENTE_ID")]
    public int ClienteId { get; set; }

    // Navigation
    [ForeignKey("EmpresaId")]
    public Empresa? Empresa { get; set; }

    public ICollection<Lote> Lotes { get; set; } = new List<Lote>();
}
