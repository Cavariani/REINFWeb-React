namespace ReinfApi.DTOs;

public class InformeDto
{
    public string Tipo          { get; set; } = "";   // R-4010, R-4020, R-2010
    public string CpfCnpjBenef { get; set; } = "";
    public string NomeBenef    { get; set; } = "";
    public string NatRend      { get; set; } = "";
    public string NatRendDesc  { get; set; } = "";
    public decimal VlrRend     { get; set; }
    public decimal VlrIrrf     { get; set; }
    public decimal VlrCsll     { get; set; }
    public decimal VlrInss     { get; set; }
    public List<InformePeriodoDto> Periodos { get; set; } = new();
}

public class InformePeriodoDto
{
    public string  Periodo { get; set; } = "";
    public decimal VlrRend { get; set; }
    public decimal VlrIrrf { get; set; }
    public decimal VlrCsll { get; set; }
    public decimal VlrInss { get; set; }
}
