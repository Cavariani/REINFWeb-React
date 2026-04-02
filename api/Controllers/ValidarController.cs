using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ReinfApi.DTOs;
using ReinfApi.Services;

namespace ReinfApi.Controllers;

[ApiController]
[Route("api/envios/validar")]
[Authorize]
public class ValidarController : ControllerBase
{
    private readonly ReinfService _reinf;

    public ValidarController(ReinfService reinf)
    {
        _reinf = reinf;
    }

    /// <summary>
    /// Valida os dados de um envio sem assinar, transmitir nem salvar no banco.
    /// Monta os XMLs de todos os eventos e retorna erros detalhados por linha.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Validar([FromBody] EnvioRequest req)
    {
        try
        {
            var response = await _reinf.ValidarAsync(req);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
