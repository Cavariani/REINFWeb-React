using System.Text.RegularExpressions;
using ReinfApi.Core;
using ReinfApi.DTOs;

namespace ReinfApi.Services;

/// <summary>
/// Validação prévia robusta — replica as regras de negócio da Receita Federal
/// para R-4010, R-4020, R-2010 e R-1000, sem assinar nem transmitir.
///
/// Camada 1: regras explícitas por campo e por linha (com número de linha).
/// Camada 2: consistência entre linhas (CNPJs, períodos, duplicatas).
/// Camada 3: XmlBuilder como safety-net final (feita no ValidarAsync do ReinfService).
/// </summary>
public static class ValidacaoService
{
    public static List<ValidacaoErro> Validar(EnvioRequest req)
    {
        var erros = new List<ValidacaoErro>();

        if (req.Rows == null || req.Rows.Count == 0)
        {
            erros.Add(Erro(0, "Nenhuma linha encontrada. A planilha ou tabela de dados está vazia."));
            return erros;
        }

        switch (req.Evento)
        {
            case "R-4010": ValidarR4010(req.Rows, erros); break;
            case "R-4020": ValidarR4020(req.Rows, erros); break;
            case "R-2010": ValidarR2010(req.Rows, erros); break;
            case "R-1000": ValidarR1000(req.Rows, erros); break;
        }

        return erros;
    }

    // ════════════════════════════════════════════════════════════════════════
    // R-4010 — Rendimentos pagos/creditados a Pessoa Física
    // ════════════════════════════════════════════════════════════════════════
    private static void ValidarR4010(List<RowDto> rows, List<ValidacaoErro> erros)
    {
        var vistos = new HashSet<string>();

        for (int i = 0; i < rows.Count; i++)
        {
            int ln = i + 1;
            var r = rows[i].ToRow4010();

            // ── Ação ──────────────────────────────────────────────────────
            var acaoNorm = NormalizarAcao(r.Acao);
            if (acaoNorm == null)
                erros.Add(Erro(ln, $"Coluna AÇÃO contém '{r.Acao}', que é inválido. " +
                    "Use ENVIAR (para envio normal), ALTERAR (para retificação) ou EXCLUIR."));

            // ── nrRecibo obrigatório para ALTERAR/EXCLUIR; indevido para ENVIAR ─
            if (acaoNorm is "ALTERAR" or "EXCLUIR")
            {
                if (string.IsNullOrWhiteSpace(r.NrRecibo))
                    erros.Add(Erro(ln, $"Ação '{r.Acao}' exige o preenchimento do Nº RECIBO (coluna nrRecibo). "
                        + "Sem o número do recibo original, a Receita não consegue localizar o evento para alterar ou excluir."));
            }
            else if (acaoNorm == "ENVIAR" && !string.IsNullOrWhiteSpace(r.NrRecibo))
            {
                erros.Add(Erro(ln, $"Nº RECIBO preenchido ('{r.NrRecibo}') mas a ação é ENVIAR (novo envio). "
                    + "Para novos envios o campo nrRecibo deve estar VAZIO. "
                    + "Se deseja retificar, altere a ação para ALTERAR."));
            }

            // ── CNPJ do estabelecimento ────────────────────────────────────
            var cnpjEstab4010 = OnlyDigits(r.CnpjEstab);
            if (string.IsNullOrWhiteSpace(cnpjEstab4010))
                erros.Add(Erro(ln, "CNPJ do estabelecimento está vazio. Este campo é obrigatório."));
            else if (cnpjEstab4010.Length != 14)
                erros.Add(Erro(ln, $"CNPJ do estabelecimento '{r.CnpjEstab}' tem {cnpjEstab4010.Length} dígitos, mas CNPJ deve ter 14."));
            else if (!IsValidCnpj(cnpjEstab4010))
                erros.Add(Erro(ln, $"CNPJ do estabelecimento '{r.CnpjEstab}' possui dígitos verificadores inválidos. Verifique se o CNPJ foi digitado corretamente."));

            // ── CPF do beneficiário ────────────────────────────────────────
            var cpfLimpo = OnlyDigits(r.CpfBenef);
            if (string.IsNullOrWhiteSpace(cpfLimpo))
            {
                if (string.IsNullOrWhiteSpace(r.NomeBenef))
                    erros.Add(Erro(ln, "O CPF do beneficiário está vazio. Quando o CPF não for informado, "
                        + "o NOME do beneficiário (coluna nomeBenef) é obrigatório pela Receita Federal."));
            }
            else if (cpfLimpo.Length != 11)
                erros.Add(Erro(ln, $"CPF '{r.CpfBenef}' tem {cpfLimpo.Length} dígitos, mas CPF tem 11. Verifique se não está faltando ou sobrando dígito."));
            else if (!IsValidCpf(cpfLimpo))
                erros.Add(Erro(ln, $"CPF '{r.CpfBenef}' possui dígitos verificadores inválidos. "
                    + "Confira se o número foi digitado corretamente."));

            // ── Período de apuração ────────────────────────────────────────
            if (!IsValidPeriod(r.PerApur, out var perYear, out var perMonth))
                erros.Add(Erro(ln, $"Período de apuração '{r.PerApur}' está no formato errado. "
                    + "O formato correto é AAAA-MM (exemplo: 2025-03)."));

            // ── Data do fato gerador ───────────────────────────────────────
            if (string.IsNullOrWhiteSpace(r.DtFg))
                erros.Add(Erro(ln, "Data de pagamento/crédito (dtFg) está vazia. Este campo é obrigatório."));
            else if (!DateTime.TryParse(r.DtFg, out var dtFg))
                erros.Add(Erro(ln, $"Data de pagamento '{r.DtFg}' não é uma data válida. Use o formato AAAA-MM-DD."));
            else if (dtFg > DateTime.UtcNow.AddDays(1))
                erros.Add(Erro(ln, $"Data de pagamento {dtFg:dd/MM/yyyy} está no FUTURO. "
                    + "Verifique se o ano foi digitado corretamente."));
            else if (IsValidPeriod(r.PerApur, out var py, out var pm)
                     && (dtFg.Year != py || dtFg.Month != pm))
                erros.Add(Erro(ln, $"Data de pagamento {dtFg:dd/MM/yyyy} está FORA do período de apuração {r.PerApur}. "
                    + "A data do pagamento deve estar dentro do mês de apuração. "
                    + "Exemplo: se o período é 2025-03, a data deve ser entre 01/03/2025 e 31/03/2025."));

            // ── Natureza do rendimento ─────────────────────────────────────
            if (string.IsNullOrWhiteSpace(r.NatRend))
                erros.Add(Erro(ln, "Natureza do rendimento (natRend) está vazia. "
                    + "Preencha com o código de 5 dígitos da Tabela 01 da Receita Federal."));
            else if (!Regex.IsMatch(r.NatRend.Trim(), @"^\d{5}$"))
                erros.Add(Erro(ln, $"Natureza do rendimento '{r.NatRend}' deve ter exatamente 5 dígitos "
                    + "(conforme Tabela 01 da Receita Federal). Valor informado tem formato inválido."));

            // ── Valor do rendimento ────────────────────────────────────────
            if (!TryParseVal(r.VlrRend, out var vlrRend))
                erros.Add(Erro(ln, $"Valor do rendimento '{r.VlrRend}' não é um número válido. Use ponto ou vírgula como separador decimal."));
            else if (vlrRend <= 0)
                erros.Add(Erro(ln, $"Valor do rendimento é R$ {vlrRend:N2}. "
                    + "Não é permitido transmitir eventos com valor zero ou negativo."));

            // ── Valor Rendimento Tributável ≤ Valor Bruto ─────────────────
            if (TryParseVal(r.VlrRendTrib, out var vlrTrib) && TryParseVal(r.VlrRend, out var vlrBruto4010))
            {
                if (vlrTrib > vlrBruto4010 && vlrBruto4010 > 0)
                    erros.Add(Erro(ln, $"Valor tributável (R$ {vlrTrib:N2}) é MAIOR que o rendimento bruto "
                        + $"(R$ {vlrBruto4010:N2}). O rendimento tributável nunca pode superar o valor bruto pago."));
            }

            // ── Valor do IRRF ──────────────────────────────────────────────
            if (!TryParseVal(r.VlrIrrf, out var vlrIrrf))
                erros.Add(Erro(ln, $"Valor do IRRF '{r.VlrIrrf}' não é um número válido."));
            else
            {
                if (vlrIrrf < 0)
                    erros.Add(Erro(ln, $"Valor do IRRF é R$ {vlrIrrf:N2}. "
                        + "O imposto retido não pode ser negativo."));
                else if (TryParseVal(r.VlrRend, out var vr) && vlrIrrf > vr)
                    erros.Add(Erro(ln, $"IRRF retido (R$ {vlrIrrf:N2}) é MAIOR que o rendimento bruto "
                        + $"(R$ {vr:N2}). É matematicamente impossível reter mais imposto do que o valor pago. "
                        + "Verifique se os campos não foram invertidos."));
            }

            // ── Duplicata ──────────────────────────────────────────────────
            var chave = $"{cpfLimpo}|{r.PerApur}|{r.NatRend?.Trim()}|{r.DtFg}|{r.VlrRend}";
            if (!string.IsNullOrEmpty(cpfLimpo) && vistos.Contains(chave))
                erros.Add(Erro(ln, $"Linha possivelmente duplicada: o CPF {r.CpfBenef}, período {r.PerApur}, "
                    + $"natureza {r.NatRend} e valor R$ {vlrRend:N2} já apareceram em uma linha anterior. "
                    + "Verifique se houve cópia acidental na planilha."));
            else
                vistos.Add(chave);
        }

        // ── Consistência entre linhas ──────────────────────────────────────
        var cnpjRoots = rows
            .Select(r => r.ToRow4010())
            .Select(r => OnlyDigits(r.CnpjContrib.Length > 0 ? r.CnpjContrib : r.CnpjEstab))
            .Where(c => c.Length >= 8)
            .Select(c => c[..8])
            .Distinct().ToList();
        if (cnpjRoots.Count > 1)
            erros.Add(Erro(0, $"ATENÇÃO — Raízes de CNPJ DIVERGENTES nas linhas: {string.Join(", ", cnpjRoots)}. "
                + "Todas as linhas devem pertencer ao mesmo grupo empresarial (mesma raiz de CNPJ). Filiais da mesma empresa são permitidas."));

        var periodos = rows.Select(r => r.ToRow4010().PerApur)
            .Where(p => IsValidPeriod(p, out _, out _))
            .Distinct().ToList();
        if (periodos.Count > 1)
            erros.Add(Erro(0, $"ATENÇÃO — Períodos de apuração DIVERGENTES nas linhas: {string.Join(", ", periodos)}. "
                + "Todas as linhas devem ser do mesmo mês de apuração. "
                + "Verifique se não há linhas de meses anteriores misturadas na planilha."));
    }

    // ════════════════════════════════════════════════════════════════════════
    // R-4020 — Rendimentos pagos/creditados a Pessoa Jurídica
    // ════════════════════════════════════════════════════════════════════════
    private static void ValidarR4020(List<RowDto> rows, List<ValidacaoErro> erros)
    {
        var vistos = new HashSet<string>();

        for (int i = 0; i < rows.Count; i++)
        {
            int ln = i + 1;
            var r = rows[i].ToRow4020();

            // Ação
            var acaoNorm = NormalizarAcao(r.Acao);
            if (acaoNorm == null)
                erros.Add(Erro(ln, $"Coluna AÇÃO contém '{r.Acao}', que é inválido. Use ENVIAR, ALTERAR ou EXCLUIR."));

            if (acaoNorm is "ALTERAR" or "EXCLUIR")
            {
                if (string.IsNullOrWhiteSpace(r.NrRecibo))
                    erros.Add(Erro(ln, $"Ação '{r.Acao}' exige o Nº RECIBO preenchido. "
                        + "Sem o recibo original, a Receita não consegue localizar o evento."));
            }
            else if (acaoNorm == "ENVIAR" && !string.IsNullOrWhiteSpace(r.NrRecibo))
            {
                erros.Add(Erro(ln, $"Nº RECIBO preenchido mas a ação é ENVIAR. "
                    + "Para novos envios o campo nrRecibo deve estar VAZIO."));
            }

            // CNPJ do estabelecimento
            var cnpjEstab4020 = OnlyDigits(r.CnpjEstab);
            if (string.IsNullOrWhiteSpace(cnpjEstab4020))
                erros.Add(Erro(ln, "CNPJ do estabelecimento está vazio. Este campo é obrigatório."));
            else if (cnpjEstab4020.Length != 14)
                erros.Add(Erro(ln, $"CNPJ do estabelecimento '{r.CnpjEstab}' tem {cnpjEstab4020.Length} dígitos. CNPJ deve ter 14."));
            else if (!IsValidCnpj(cnpjEstab4020))
                erros.Add(Erro(ln, $"CNPJ do estabelecimento '{r.CnpjEstab}' possui dígitos verificadores inválidos."));

            // CNPJ do beneficiário
            var cnpjBenef = OnlyDigits(r.CnpjBenef);
            if (string.IsNullOrWhiteSpace(cnpjBenef))
                erros.Add(Erro(ln, "CNPJ do beneficiário (cnpjBenef) está vazio. Este campo é obrigatório."));
            else if (cnpjBenef.Length != 14)
                erros.Add(Erro(ln, $"CNPJ do beneficiário '{r.CnpjBenef}' tem {cnpjBenef.Length} dígitos, "
                    + "mas CNPJ tem 14. Verifique se não está faltando dígito."));
            else if (!IsValidCnpj(cnpjBenef))
                erros.Add(Erro(ln, $"CNPJ do beneficiário '{r.CnpjBenef}' possui dígitos verificadores inválidos. "
                    + "Confira se o CNPJ foi digitado corretamente."));
            else if (cnpjBenef == cnpjEstab4020 && cnpjBenef.Length == 14)
                erros.Add(Erro(ln, $"CNPJ do beneficiário ({r.CnpjBenef}) é IGUAL ao CNPJ do estabelecimento. "
                    + "Uma empresa não pode ser beneficiária de seus próprios pagamentos no R-4020."));

            // Período
            if (!IsValidPeriod(r.PerApur, out _, out _))
                erros.Add(Erro(ln, $"Período de apuração '{r.PerApur}' está no formato errado. Use AAAA-MM."));

            // Natureza do rendimento
            if (string.IsNullOrWhiteSpace(r.NatRend))
                erros.Add(Erro(ln, "Natureza do rendimento (natRend) está vazia. Obrigatório."));
            else if (!Regex.IsMatch(r.NatRend.Trim(), @"^\d{5}$"))
                erros.Add(Erro(ln, $"Natureza do rendimento '{r.NatRend}' deve ter exatamente 5 dígitos."));

            // Valor do rendimento
            if (!TryParseVal(r.VlrRend, out var vlrRend) || vlrRend <= 0)
                erros.Add(Erro(ln, $"Valor do rendimento '{r.VlrRend}' deve ser um número maior que zero."));

            // IRRF — deve ser ≤ vlrBaseRet (base de retenção), não vlrRend
            if (TryParseVal(r.VlrIrrf, out var vlrIrrf4020))
            {
                if (vlrIrrf4020 < 0)
                    erros.Add(Erro(ln, $"Valor do IRRF R$ {vlrIrrf4020:N2} é negativo. Imposto não pode ser negativo."));
                else if (TryParseVal(r.VlrBaseRet, out var baseRet4020) && baseRet4020 > 0 && vlrIrrf4020 > baseRet4020)
                    erros.Add(Erro(ln, $"IRRF retido (R$ {vlrIrrf4020:N2}) é MAIOR que a base de retenção (R$ {baseRet4020:N2}). "
                        + "O IRRF é calculado sobre a base de retenção, não pode superá-la."));
                else if (TryParseVal(r.VlrRend, out var vr4020) && vr4020 > 0 && vlrIrrf4020 > vr4020)
                    erros.Add(Erro(ln, $"IRRF retido (R$ {vlrIrrf4020:N2}) é MAIOR que o valor bruto (R$ {vr4020:N2}). "
                        + "Verifique se os campos não foram invertidos."));
            }

            // Duplicata
            var chave = $"{cnpjBenef}|{OnlyDigits(r.CnpjEstab)}|{r.PerApur}|{r.NatRend?.Trim()}|{r.VlrRend}";
            if (vistos.Contains(chave))
                erros.Add(Erro(ln, $"Linha possivelmente duplicada — CNPJ beneficiário {r.CnpjBenef}, "
                    + $"estabelecimento {r.CnpjEstab}, período {r.PerApur} e valor já aparecem em linha anterior. "
                    + "Verifique se houve cópia acidental."));
            else
                vistos.Add(chave);
        }

        // Consistência entre linhas
        var periodos = rows.Select(r => r.ToRow4020().PerApur)
            .Where(p => IsValidPeriod(p, out _, out _)).Distinct().ToList();
        if (periodos.Count > 1)
            erros.Add(Erro(0, $"ATENÇÃO — Períodos divergentes: {string.Join(", ", periodos)}. "
                + "Todas as linhas devem ser do mesmo mês de apuração."));

        var cnpjRoots4020 = rows.Select(r => r.ToRow4020())
            .Select(r => OnlyDigits(r.CnpjContrib.Length > 0 ? r.CnpjContrib : r.CnpjEstab))
            .Where(c => c.Length >= 8)
            .Select(c => c[..8])
            .Distinct().ToList();
        if (cnpjRoots4020.Count > 1)
            erros.Add(Erro(0, $"ATENÇÃO — Raízes de CNPJ divergentes: {string.Join(", ", cnpjRoots4020)}. "
                + "Todas as linhas devem pertencer ao mesmo grupo empresarial (mesma raiz de CNPJ). Filiais da mesma empresa são permitidas."));
    }

    // ════════════════════════════════════════════════════════════════════════
    // R-2010 — Retenções Contribuições Previdenciárias — Serviços Tomados
    // ════════════════════════════════════════════════════════════════════════
    private static void ValidarR2010(List<RowDto> rows, List<ValidacaoErro> erros)
    {
        var vistos = new HashSet<string>();

        for (int i = 0; i < rows.Count; i++)
        {
            int ln = i + 1;
            var r = rows[i].ToRow2010();

            // Ação
            var acaoNorm = NormalizarAcao(r.Acao);
            if (acaoNorm == null)
                erros.Add(Erro(ln, $"Coluna AÇÃO contém '{r.Acao}', que é inválido. Use ENVIAR, ALTERAR ou EXCLUIR."));

            if (acaoNorm is "ALTERAR" or "EXCLUIR")
            {
                if (string.IsNullOrWhiteSpace(r.NrRecibo))
                    erros.Add(Erro(ln, $"Ação '{r.Acao}' exige o Nº RECIBO. "
                        + "Sem o recibo original, a Receita não consegue localizar o evento."));
            }
            else if (acaoNorm == "ENVIAR" && !string.IsNullOrWhiteSpace(r.NrRecibo))
            {
                erros.Add(Erro(ln, $"Nº RECIBO preenchido mas a ação é ENVIAR. "
                    + "Para novos envios o campo nrRecibo deve estar VAZIO."));
            }

            // CNPJ do tomador
            var cnpjTom = OnlyDigits(r.CnpjEstabTom);
            if (string.IsNullOrWhiteSpace(cnpjTom))
                erros.Add(Erro(ln, "CNPJ do tomador está vazio. Este campo é obrigatório."));
            else if (cnpjTom.Length != 14)
                erros.Add(Erro(ln, $"CNPJ do tomador '{r.CnpjEstabTom}' tem {cnpjTom.Length} dígitos. CNPJ deve ter 14."));
            else if (!IsValidCnpj(cnpjTom))
                erros.Add(Erro(ln, $"CNPJ do tomador '{r.CnpjEstabTom}' possui dígitos verificadores inválidos."));

            // CNPJ do prestador
            var cnpjPrest = OnlyDigits(r.CnpjPrestador);
            if (string.IsNullOrWhiteSpace(cnpjPrest))
                erros.Add(Erro(ln, "CNPJ do prestador de serviço está vazio. Este campo é obrigatório."));
            else if (cnpjPrest.Length != 14)
                erros.Add(Erro(ln, $"CNPJ do prestador '{r.CnpjPrestador}' tem {cnpjPrest.Length} dígitos. CNPJ deve ter 14."));
            else if (!IsValidCnpj(cnpjPrest))
                erros.Add(Erro(ln, $"CNPJ do prestador '{r.CnpjPrestador}' possui dígitos verificadores inválidos. "
                    + "Confira se foi digitado corretamente."));
            else if (!string.IsNullOrEmpty(cnpjTom) && cnpjTom.Length == 14 && cnpjPrest == cnpjTom)
                erros.Add(Erro(ln, $"CNPJ do prestador ({r.CnpjPrestador}) é IGUAL ao CNPJ do tomador. "
                    + "O tomador e o prestador de serviço devem ser empresas diferentes."));

            // Período
            if (!IsValidPeriod(r.PerApur, out _, out _))
                erros.Add(Erro(ln, $"Período de apuração '{r.PerApur}' está no formato errado. Use AAAA-MM."));

            // Número da NF
            if (string.IsNullOrWhiteSpace(r.NumNF))
                erros.Add(Erro(ln, "Número do documento fiscal (numNF) está vazio. Este campo é obrigatório."));

            // Data de emissão da NF
            if (string.IsNullOrWhiteSpace(r.DtEmissaoNF))
                erros.Add(Erro(ln, "Data de emissão do documento fiscal (dtEmissaoNF) está vazia. Este campo é obrigatório."));
            else if (!DateTime.TryParse(r.DtEmissaoNF, out var dtNF))
                erros.Add(Erro(ln, $"Data de emissão '{r.DtEmissaoNF}' não é uma data válida. Use o formato AAAA-MM-DD."));
            else if (dtNF > DateTime.UtcNow.AddDays(1))
                erros.Add(Erro(ln, $"Data de emissão {dtNF:dd/MM/yyyy} está no FUTURO. "
                    + "Verifique se o ano foi digitado corretamente."));
            else if (IsValidPeriod(r.PerApur, out var py, out var pm)
                     && (dtNF.Year != py || dtNF.Month != pm))
                erros.Add(Erro(ln, $"Data de emissão do documento {dtNF:dd/MM/yyyy} está FORA do período de apuração {r.PerApur}. "
                    + "A data de emissão deve estar dentro do mês de apuração informado."));

            // Tipo de serviço
            if (string.IsNullOrWhiteSpace(r.TpServ))
                erros.Add(Erro(ln, "Tipo de serviço (tpServ) está vazio. "
                    + "Preencha com o código de 9 dígitos da Tabela 06 da Receita Federal."));
            else if (!Regex.IsMatch(r.TpServ.Trim(), @"^\d{9}$"))
                erros.Add(Erro(ln, $"Tipo de serviço '{r.TpServ}' deve ter exatamente 9 dígitos (Tabela 06 da Receita Federal)."));
            else if (r.TpServ.Trim() == "000000000")
                erros.Add(Erro(ln, "Tipo de serviço '000000000' é inválido. "
                    + "Informe o código real do tipo de serviço prestado (Tabela 06)."));

            // Indicadores
            if (r.IndObra != "0" && r.IndObra != "1")
                erros.Add(Erro(ln, $"Indicador de obra (indObra) '{r.IndObra}' é inválido. "
                    + "Use 0 para serviços sem obra de construção civil, ou 1 para serviços em obra."));

            if (r.IndCPRB != "0" && r.IndCPRB != "1")
                erros.Add(Erro(ln, $"Indicador CPRB (indCPRB) '{r.IndCPRB}' é inválido. "
                    + "Use 0 se o prestador não é contribuinte da CPRB, ou 1 se é."));

            // Valor bruto da NF
            if (!TryParseVal(r.VlrBrutoNF, out var vlrBruto) || vlrBruto <= 0)
                erros.Add(Erro(ln, $"Valor bruto da nota fiscal '{r.VlrBrutoNF}' deve ser um número maior que zero."));

            // Valor de retenção + consistência com alíquota
            if (TryParseVal(r.VlrRetencao, out var vlrRet))
            {
                if (vlrRet < 0)
                    erros.Add(Erro(ln, $"Valor de retenção R$ {vlrRet:N2} é negativo. Retenção não pode ser negativa."));
                else if (TryParseVal(r.VlrBrutoNF, out var vb) && vlrRet > vb)
                    erros.Add(Erro(ln, $"Retenção (R$ {vlrRet:N2}) é MAIOR que o valor bruto da NF (R$ {vb:N2}). "
                        + "Impossível — verifique se os campos não foram invertidos."));
                else if (TryParseVal(r.VlrBaseRet, out var baseRet2010) && baseRet2010 > 0 && vlrRet > 0)
                {
                    // Verifica coerência da alíquota: 11% (indCPRB=0) ou 3,5% (indCPRB=1)
                    decimal aliqEsperada = r.IndCPRB == "1" ? 0.035m : 0.11m;
                    decimal retEsperada = Math.Round(baseRet2010 * aliqEsperada, 2);
                    decimal tolerancia = 0.10m; // R$ 0,10 de tolerância para arredondamentos
                    if (Math.Abs(vlrRet - retEsperada) > tolerancia)
                    {
                        string aliqNome = r.IndCPRB == "1" ? "3,5% (CPRB)" : "11% (regime normal)";
                        erros.Add(Erro(ln, $"Retenção informada R$ {vlrRet:N2} diverge do esperado para alíquota {aliqNome}: "
                            + $"R$ {retEsperada:N2} ({aliqNome} × base R$ {baseRet2010:N2}). "
                            + "Verifique se indCPRB e os valores estão corretos."));
                    }
                }
            }

            // Duplicata de NF
            var chave = $"{cnpjPrest}|{r.NumNF?.Trim()}|{r.DtEmissaoNF}";
            if (!string.IsNullOrEmpty(r.NumNF) && vistos.Contains(chave))
                erros.Add(Erro(ln, $"Nota fiscal Nº {r.NumNF} do prestador {r.CnpjPrestador} "
                    + "já aparece em uma linha anterior. Verifique se não houve duplicação."));
            else
                vistos.Add(chave);
        }

        // Consistência entre linhas
        var periodos = rows.Select(r => r.ToRow2010().PerApur)
            .Where(p => IsValidPeriod(p, out _, out _)).Distinct().ToList();
        if (periodos.Count > 1)
            erros.Add(Erro(0, $"ATENÇÃO — Períodos divergentes: {string.Join(", ", periodos)}. "
                + "Todas as linhas devem ser do mesmo mês de apuração."));

        var cnpjRoots2010 = rows.Select(r => r.ToRow2010())
            .Select(r => OnlyDigits(r.CnpjContrib.Length > 0 ? r.CnpjContrib : r.CnpjEstabTom))
            .Where(c => c.Length >= 8)
            .Select(c => c[..8])
            .Distinct().ToList();
        if (cnpjRoots2010.Count > 1)
            erros.Add(Erro(0, $"ATENÇÃO — Raízes de CNPJ divergentes: {string.Join(", ", cnpjRoots2010)}. "
                + "Todas as linhas devem pertencer ao mesmo grupo empresarial (mesma raiz de CNPJ). Filiais da mesma empresa são permitidas."));
    }

    // ════════════════════════════════════════════════════════════════════════
    // R-1000 — Informações do Contribuinte
    // ════════════════════════════════════════════════════════════════════════
    private static void ValidarR1000(List<RowDto> rows, List<ValidacaoErro> erros)
    {
        var r = rows[0].ToRowR1000();

        if (string.IsNullOrWhiteSpace(r.Cnpj))
            erros.Add(Erro(1, "CNPJ do contribuinte está vazio."));
        else
        {
            var cnpj = OnlyDigits(r.Cnpj);
            if (cnpj.Length != 8 && cnpj.Length != 14)
                erros.Add(Erro(1, $"CNPJ '{r.Cnpj}' tem {cnpj.Length} dígitos. Deve ter 8 (raiz) ou 14."));
            else if (cnpj.Length == 14 && !IsValidCnpj(cnpj))
                erros.Add(Erro(1, $"CNPJ '{r.Cnpj}' possui dígitos verificadores inválidos."));
        }

        if (!IsValidPeriod(r.IniValid, out _, out _))
            erros.Add(Erro(1, $"Período inicial de validade '{r.IniValid}' está no formato errado. Use AAAA-MM."));

        if (!string.IsNullOrWhiteSpace(r.CpfCtt))
        {
            var cpf = OnlyDigits(r.CpfCtt);
            if (cpf.Length != 11 || !IsValidCpf(cpf))
                erros.Add(Erro(1, $"CPF do contato '{r.CpfCtt}' é inválido. Verifique os dígitos verificadores."));
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Helpers
    // ════════════════════════════════════════════════════════════════════════

    private static ValidacaoErro Erro(int linha, string mensagem) =>
        new() { Linha = linha, Mensagem = mensagem };

    /// <summary>Normaliza aliases de ação para ENVIAR/ALTERAR/EXCLUIR. Retorna null se inválido.</summary>
    private static string? NormalizarAcao(string? acao)
    {
        return acao?.ToUpperInvariant().Trim() switch
        {
            "ENVIAR" or "INCLUIR" or "NOVO" => "ENVIAR",
            "ALTERAR" or "RETIFICAR"        => "ALTERAR",
            "EXCLUIR" or "DELETAR"          => "EXCLUIR",
            _                               => null
        };
    }

    private static bool IsValidPeriod(string? s, out int year, out int month)
    {
        year = 0; month = 0;
        if (string.IsNullOrWhiteSpace(s)) return false;
        var parts = s.Trim().Split('-');
        return parts.Length == 2
            && int.TryParse(parts[0], out year) && year >= 2000 && year <= 2099
            && int.TryParse(parts[1], out month) && month >= 1 && month <= 12;
    }

    /// <summary>Tenta parsear decimal (vírgula ou ponto). Retorna true e value=0 para string vazia.</summary>
    private static bool TryParseVal(string? s, out decimal value)
    {
        value = 0;
        if (string.IsNullOrWhiteSpace(s)) return true;
        return decimal.TryParse(
            s.Replace(',', '.'),
            System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture,
            out value);
    }

    private static string OnlyDigits(string? s) =>
        string.IsNullOrEmpty(s) ? "" : Regex.Replace(s, @"\D", "");

    private static bool IsValidCpf(string cpf)
    {
        if (cpf.Length != 11 || cpf.Distinct().Count() == 1) return false;
        var sum = 0;
        for (int i = 0; i < 9; i++) sum += (cpf[i] - '0') * (10 - i);
        var r1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        if (r1 != cpf[9] - '0') return false;
        sum = 0;
        for (int i = 0; i < 10; i++) sum += (cpf[i] - '0') * (11 - i);
        var r2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        return r2 == cpf[10] - '0';
    }

    private static bool IsValidCnpj(string cnpj)
    {
        if (cnpj.Length != 14 || cnpj.Distinct().Count() == 1) return false;
        int[] m1 = { 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 };
        int[] m2 = { 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 };
        var sum = 0;
        for (int i = 0; i < 12; i++) sum += (cnpj[i] - '0') * m1[i];
        var d1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        if (d1 != cnpj[12] - '0') return false;
        sum = 0;
        for (int i = 0; i < 13; i++) sum += (cnpj[i] - '0') * m2[i];
        var d2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        return d2 == cnpj[13] - '0';
    }
}
