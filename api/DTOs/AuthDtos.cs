namespace ReinfApi.DTOs;

public record LoginRequest(string Email, string Senha);

public record LoginResponse(string Token, int Id, string Nome, string Email, bool IsAdmin, bool IsSuperAdmin = false, int ClienteId = 0);

public record UserDto(int Id, string Nome, string Email, DateTime DtCriacao, bool IsAdmin, bool IsSuperAdmin = false, int ClienteId = 0);

public record CreateUserRequest(string Nome, string Email, string Senha, bool IsAdmin = false);

public record AlterarSenhaRequest(string NovaSenha);

public record UpdateUserRequest(string Nome, string Email);
