# MLEGATE Assinador EFD-REINF

Ferramenta web para transmissão de eventos EFD-REINF à Receita Federal do Brasil, desenvolvida pela MLEGATE. Migrada de um protótipo C# WinForms para stack moderna.

## Stack

**Frontend:** React 19 + Vite, CSS Modules, Framer Motion, Recharts, XLSX
**Backend:** ASP.NET Core 8 Web API, JWT Bearer, BCrypt.Net, AES-256
**Banco de dados:** SQL Server

## Funcionalidades

- Transmissão dos eventos R-4010 (PF), R-4020 (PJ), R-2010 (Serviços/CPRB) e R-1000 (Cadastro)
- Ações de envio, retificação e exclusão de eventos
- Validação prévia antes do envio à RF
- Consulta de lotes por protocolo
- Histórico de envios com retificação por evento individual
- Gestão de certificados digitais (.pfx) com criptografia AES-256
- Gestão de empresas e usuários com controle de acesso
- Resumo mensal de envios
- Suporte a ambientes de Homologação e Produção

## Pré-requisitos

- Node.js 18+
- .NET 8 SDK
- SQL Server

## Configuração

### Backend

Crie o arquivo `api/appsettings.Development.json` (não versionado) com:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=...;Database=...;User ID=...;Password=...;TrustServerCertificate=True;"
  },
  "Jwt": {
    "Key": "sua-chave-jwt-minimo-32-caracteres"
  },
  "Crypto": {
    "PfxKey": "sua-chave-aes"
  }
}
```

### Frontend

Sem configuração adicional necessária para desenvolvimento local.

## Executando localmente

```bash
# Frontend (porta 5100)
npm install
npm run dev

# Backend (porta 5000)
$env:ASPNETCORE_ENVIRONMENT="Development"; dotnet run --project api
```

## Deploy (IIS)

1. Build do frontend: `npm run build`
2. Publish do backend: `dotnet publish api -c Release -o ./publish`
3. Configure as variáveis de ambiente no IIS Application Pool com os valores de `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Crypto__PfxKey` e `Cors__Origins__0`
4. Defina `ASPNETCORE_ENVIRONMENT=Production` no Application Pool

## Arquitetura

```
src/
  pages/          Telas principais (Login, Dashboard, NovoEnvio, Historico, etc.)
  components/     Componentes reutilizáveis (Sidebar, SpreadsheetEditor)
  api/            HTTP client com JWT auto-attach

api/
  Controllers/    Auth, Envios, Lotes, Consulta, Certificados, Empresas, Usuarios
  Services/       ReinfService, ValidacaoService, CryptoService, JwtService
  Models/         Entidades do banco
  DTOs/           Contratos de entrada e saída
```

## Licença

Código aberto. Os dados de configuração (connection strings, chaves) são de responsabilidade do operador e nunca devem ser versionados.
