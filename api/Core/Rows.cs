namespace ReinfApi.Core;

// ── Dados de uma linha do evento R-4010 (vêm do frontend como JSON) ──
public sealed class Row4010
{
    public string CnpjContrib   { get; set; } = "";
    public string CnpjEstab     { get; set; } = "";
    public string CpfEstab      { get => CnpjEstab; set => CnpjEstab = value; }
    public string CpfBenef      { get; set; } = "";
    public string NomeBenef     { get; set; } = "";
    public string DtFg          { get; set; } = "";
    public string PerApur       { get; set; } = "";
    public string VlrRend       { get; set; } = "";
    public string VlrRendTrib   { get; set; } = "";
    public string VlrIrrf       { get; set; } = "";
    public string Rra            { get; set; } = "";
    public string IndFciScp     { get; set; } = "";
    public string CnpjFciScp    { get; set; } = "";
    public string PercScp       { get; set; } = "";
    public string IndJud        { get; set; } = "";
    public string NatRend       { get; set; } = "";
    public string NrRecibo      { get; set; } = "";
    public string Acao          { get; set; } = "";
}

// ── Dados de uma linha do evento R-4020 ──
public sealed class Row4020
{
    public string CnpjContrib   { get; set; } = "";
    public string PerApur       { get; set; } = "";
    public string CnpjEstab     { get; set; } = "";
    public string CnpjBenef     { get; set; } = "";
    public string NatRend       { get; set; } = "";
    public string IndJud        { get; set; } = "N";
    public string DtFg          { get; set; } = "";
    public string VlrRend       { get; set; } = "";
    public string VlrBaseRet    { get; set; } = "";
    public string VlrIrrf       { get; set; } = "";
    public string VlrBaseCsrf   { get; set; } = "";
    public string VlrRetCsrf    { get; set; } = "";
    public string NrRecibo      { get; set; } = "";
    public string Acao          { get; set; } = "";
    public string Grupo         { get; set; } = "";
    public int    RowNumber     { get; set; }
}

// ── Dados de uma linha do evento R-2010 ──
public sealed class Row2010
{
    public string CnpjContrib   { get; set; } = "";
    public string CnpjEstabTom  { get; set; } = "";
    public string IndObra       { get; set; } = "";
    public string CnpjPrestador { get; set; } = "";
    public string PerApur       { get; set; } = "";
    public string NumNF         { get; set; } = "";
    public string DtEmissaoNF   { get; set; } = "";
    public string VlrBrutoNF    { get; set; } = "";
    public string TpServ        { get; set; } = "";
    public string VlrBaseRet    { get; set; } = "";
    public string VlrRetencao   { get; set; } = "";
    public string IndCPRB       { get; set; } = "";
    public string ObsNF         { get; set; } = "";
    public string SerieNF       { get; set; } = "";
    public string NrRecibo      { get; set; } = "";
    public string Acao          { get; set; } = "";
    public int    RowNumber     { get; set; }
}

// ── Dados de uma linha do evento R-1000 ──
public sealed class RowR1000
{
    public string Cnpj                { get; set; } = "";
    public string IniValid            { get; set; } = "";
    public string FimValid            { get; set; } = "";
    public string NmCtt               { get; set; } = "";
    public string CpfCtt              { get; set; } = "";
    public string FoneFixo            { get; set; } = "";
    public string FoneCel             { get; set; } = "";
    public string Email               { get; set; } = "";
    public string ClassTrib           { get; set; } = "";
    public string IndEscrituracao     { get; set; } = "";
    public string IndDesoneracao      { get; set; } = "";
    public string IndAcordoIsenMulta  { get; set; } = "";
    public string IndSitPJ            { get; set; } = "";
    public string CnpjSoftHouse       { get; set; } = "";
    public string RazaoSoftHouse      { get; set; } = "";
    public string NomeContSoft        { get; set; } = "";
    public string TelefoneSoft        { get; set; } = "";
    public string EmailSoft           { get; set; } = "";
    public string NrRecibo            { get; set; } = "";
    public string Acao                { get; set; } = "";
}
