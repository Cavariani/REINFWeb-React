using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ReinfApi.Models;

[Table("ENVIO_REINF")]
public class Lote
{
    [Key]
    [Column("ID_ENVIO")]
    [DatabaseGenerated(DatabaseGeneratedOption.None)] // NUMERIC(38,0) sem IDENTITY
    public decimal IdEnvio { get; set; }

    [Column("PROTOCOLO_ENVIO")]
    [MaxLength(200)]
    public string? ProtocoloEnvio { get; set; }

    [Column("DT_RECEPCAO", TypeName = "datetime2")]
    public DateTime DtRecepcao { get; set; } = DateTime.UtcNow;

    [Column("NR_INSCRICAO")]
    [MaxLength(30)]
    public string NrInscricao { get; set; } = "";

    [Column("TP_ENVIO")]
    [MaxLength(20)]
    public string TpEnvio { get; set; } = ""; // R-4010, R-4020, R-2010, R-1000

    // Colunas adicionadas via ALTER TABLE
    [Column("STATUS")]
    [MaxLength(30)]
    public string? Status { get; set; } // ACEITO, REJEITADO, ERRO, PENDENTE

    [Column("AMBIENTE")]
    [MaxLength(15)]
    public string? Ambiente { get; set; } // homologacao, producao

    [Column("ID_USUARIO")]
    public int? UsuarioId { get; set; }

    [Column("ID_CERTIFICADO")]
    public int? CertificadoId { get; set; }

    [Column("XML_RETORNO")]
    public string? XmlRetorno { get; set; }

    [Column("XML_ENVIO")]
    public string? XmlEnvio { get; set; }

    /// <summary>JSON com a lista de EventoResultDto (nrRecibo por evento).</summary>
    [Column("EVENTOS_JSON")]
    public string? EventosJson { get; set; }

    // Totais financeiros — populados na hora do envio para o Resumo do Mês
    [Column("TOTAL_BASE")]   public decimal? TotalBase { get; set; }
    [Column("TOTAL_IRRF")]   public decimal? TotalIrrf { get; set; }
    [Column("TOTAL_INSS")]   public decimal? TotalInss { get; set; }
    [Column("TOTAL_CSLL")]   public decimal? TotalCsll { get; set; }
    [Column("TOTAL_PIS")]    public decimal? TotalPis  { get; set; }
    [Column("TOTAL_COFINS")] public decimal? TotalCofins { get; set; }

    [Column("PERIODO_APURACAO")]
    [MaxLength(7)]
    public string? PerApur { get; set; }

    [Column("CLIENTE_ID")]
    public int ClienteId { get; set; }

    // Navigation
    [ForeignKey("UsuarioId")]
    public AppUser? Usuario { get; set; }

    [ForeignKey("CertificadoId")]
    public Certificate? Certificado { get; set; }
}
