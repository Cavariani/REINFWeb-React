namespace ReinfApi.DTOs;

public class UploadCertificateRequest
{
    public string Nome { get; set; } = "";
    public string CnpjContribuinte { get; set; } = "";
    public string Senha { get; set; } = "";
    // IFormFile vem separado no controller
}

public class CertificateDto
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public string CnpjContribuinte { get; set; } = "";
    public DateTime DtUpload { get; set; }
    public DateTime? DtValidade { get; set; }
    public int? EmpresaId { get; set; }
    public string? EmpresaNome { get; set; }
}
