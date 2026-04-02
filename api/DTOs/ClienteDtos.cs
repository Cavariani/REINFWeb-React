namespace ReinfApi.DTOs;

public record ClienteDto(int Id, string Nome, bool Ativa, DateTime DtCriacao, int TotalUsuarios);

public record CreateClienteRequest(string Nome);

public record UpdateClienteRequest(string? Nome, bool? Ativa);

public record CreateClienteAdminRequest(string Nome, string Email, string Senha);
