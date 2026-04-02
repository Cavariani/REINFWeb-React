using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ReinfApi.DTOs;
using ReinfApi.Services;

namespace ReinfApi.Controllers;

[ApiController]
[Route("api/envios")]
[Authorize]
public class EnviosController : ControllerBase
{
    private readonly ReinfService _reinf;
    private readonly JwtService _jwt;

    public EnviosController(ReinfService reinf, JwtService jwt)
    {
        _reinf = reinf;
        _jwt = jwt;
    }

    [HttpPost]
    public async Task<IActionResult> Enviar([FromBody] EnvioRequest req)
    {
        var userId = _jwt.GetUserId(User);
        if (userId == null) return Unauthorized();

        try
        {
            var response = await _reinf.EnviarAsync(req, userId.Value);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
