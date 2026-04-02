namespace ReinfApi.DTOs;

public record EmpresaDto(
    int Id,
    string Nome,
    string Cnpj,
    bool Ativa,
    List<int> UsuarioIds,
    bool IsEmissora = false,
    int? EmissoraId = null,
    int? CertificadoId = null,
    string? CertificadoNome = null,
    string? CertificadoCnpj = null,
    DateTime? CertificadoDtValidade = null
);

public record CreateEmpresaRequest(string Nome, string Cnpj, bool IsEmissora = false);
public record AssociarUsuarioRequest(int UsuarioId);
public record SetEmissoraRequest(int? EmissoraId);
public record SetCertificadoRequest(int? CertificadoId);
