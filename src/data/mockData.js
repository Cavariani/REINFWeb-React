// ── Dashboard: Lotes recentes (com campo acao para REINF) ───────────────────
export const recentLots = [
  { id:1,  competencia:'Fev/2026', tipo:'R-4010', acao:'Envio',        cnpj:'12.345.678/0001-90', qtdEventos:47, dataEnvio:'07/03/2026 08:52', nrRecibo:'1.10.001.4012187-3', status:'Aceito' },
  { id:2,  competencia:'Fev/2026', tipo:'R-4020', acao:'Envio',        cnpj:'12.345.678/0001-90', qtdEventos:12, dataEnvio:'07/03/2026 08:55', nrRecibo:'1.10.001.4012201-9', status:'Aceito' },
  { id:3,  competencia:'Fev/2026', tipo:'R-2010', acao:'Envio',        cnpj:'98.765.432/0001-55', qtdEventos:8,  dataEnvio:'07/03/2026 09:10', nrRecibo:null,                  status:'Rejeitado' },
  { id:4,  competencia:'Fev/2026', tipo:'R-4010', acao:'Retificação',  cnpj:'98.765.432/0001-55', qtdEventos:5,  dataEnvio:'06/03/2026 16:30', nrRecibo:'1.10.001.4011998-1', status:'Aceito' },
  { id:5,  competencia:'Fev/2026', tipo:'R-4020', acao:'Exclusão',     cnpj:'12.345.678/0001-90', qtdEventos:3,  dataEnvio:'06/03/2026 14:02', nrRecibo:'1.10.001.4011850-7', status:'Aceito' },
  { id:6,  competencia:'Mar/2026', tipo:'R-4010', acao:'Envio',        cnpj:'12.345.678/0001-90', qtdEventos:51, dataEnvio:'09/03/2026 07:30', nrRecibo:null,                  status:'Processando' },
];

// ── Dashboard: Métricas mensais REINF (últimos 6 meses) ─────────────────────
export const chartData = [
  { mes:'Out/25', envios:58, retificacoes:7,  exclusoes:2 },
  { mes:'Nov/25', envios:62, retificacoes:9,  exclusoes:1 },
  { mes:'Dez/25', envios:80, retificacoes:12, exclusoes:4 },
  { mes:'Jan/26', envios:73, retificacoes:8,  exclusoes:3 },
  { mes:'Fev/26', envios:90, retificacoes:11, exclusoes:5 },
  { mes:'Mar/26', envios:51, retificacoes:4,  exclusoes:1 },
];

// ── Dashboard: KPIs do mês corrente (Março/2026) ────────────────────────────
export const kpisMes = {
  competencia:       'Março/2026',
  ultimoMesEnviado:  'Fevereiro/2026',
  envios:            51,
  retificacoes:      4,
  exclusoes:         1,
  rejeitados:        1,
  taxaSucesso:       96,
  totalEventosMes:   56,
};

// ── Cores por tipo de evento (shared entre Dashboard, Historico, etc.) ──────
export const TIPO_CORES = {
  'R-4010': '#E97320',
  'R-4020': '#a78bfa',
  'R-2010': '#22c55e',
  'R-1000': '#5b8ff9',
}

// ── Dashboard: Breakdown por tipo de evento (mês corrente) ──────────────────
export const breakdownTipo = [
  { tipo:'R-4010', label:'Pagamentos PF',   envios:35, retif:3, excl:0, cor:'#E97320' },
  { tipo:'R-4020', label:'Pagamentos PJ',   envios:10, retif:1, excl:1, cor:'#a78bfa' },
  { tipo:'R-2010', label:'Serviços CPRB',   envios:5,  retif:0, excl:0, cor:'#22c55e' },
  { tipo:'R-1000', label:'Cadastro',        envios:1,  retif:0, excl:0, cor:'#5b8ff9' },
];

// ── Dashboard: Vencimentos ───────────────────────────────────────────────────
export const vencimentos = [
  { evento:'R-4010 · R-4020', competencia:'Mar/2026', prazo:'20/03/2026', diasRestantes:11, status:'ok' },
  { evento:'R-2010',          competencia:'Mar/2026', prazo:'20/03/2026', diasRestantes:11, status:'ok' },
  { evento:'R-4010 · R-4020', competencia:'Fev/2026', prazo:'20/02/2026', diasRestantes:0,  status:'concluido' },
];

// ── Dashboard: Certificates (mock inicial para o card do dashboard) ──────────
export const certificadosIniciais = [
  { id:1, alias:'Cavariani Indústrias LTDA', cnpj:'12.345.678/0001-90', tipo:'A1', validade:'2026-08-15', status:'ok' },
  { id:2, alias:'Tech Solutions S.A.',       cnpj:'98.765.432/0001-55', tipo:'A3', validade:'2026-04-02', status:'expirando' },
  { id:3, alias:'Comércio ABC LTDA',         cnpj:'11.222.333/0001-81', tipo:'A1', validade:'2027-01-20', status:'ok' },
];

// ── Normalization helpers (exportadas para o SpreadsheetEditor) ──────────────
const _MESES = { jan:1,fev:2,feb:2,mar:3,abr:4,apr:4,mai:5,may:5,jun:6,jul:7,ago:8,aug:8,set:9,sep:9,out:10,oct:10,nov:11,dez:12,dec:12 }

export function normalizePeriod(v) {
  const s = (v ?? '').trim()
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return s
  const m = s.match(/^([a-zA-Z]{3,4})[-\/. ]?(\d{2,4})$/i)
  if (m) {
    const mo = _MESES[m[1].slice(0,3).toLowerCase()]
    if (!mo) return null
    const raw = parseInt(m[2])
    const yr = m[2].length <= 2 ? (raw < 50 ? 2000 + raw : 1900 + raw) : raw
    return `${yr}-${String(mo).padStart(2,'0')}`
  }
  return null
}

export function normalizeDate(v) {
  const s = (v ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const mo = parseInt(m[1]), dy = parseInt(m[2]), yr = parseInt(m[3])
    if (mo >= 1 && mo <= 12 && dy >= 1 && dy <= 31)
      return `${yr}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')}`
  }
  return null
}

export function normalizeDecimal(v) {
  const s = String(v ?? '').trim().replace(/[R$\s]/g, '')
  if (!s) return ''
  let n
  if (s.includes(',') && s.includes('.')) {
    n = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? parseFloat(s.replace(/\./g, '').replace(',', '.'))
      : parseFloat(s.replace(/,/g, ''))
  } else if (s.includes(',')) {
    n = parseFloat(s.replace(',', '.'))
  } else {
    n = parseFloat(s)
  }
  if (isNaN(n)) return s
  return n.toFixed(2)
}

// ── Validation helpers ───────────────────────────────────────────────────────
function req(v, msg) { return v?.trim() ? null : msg; }
function num(v) { const n = parseFloat(normalizeDecimal(v)); return isNaN(n) || n < 0 ? 'Número inválido' : null; }
function period(v) { return normalizePeriod(v) ? null : 'AAAA-MM ou Jan-26'; }
function date(v) { return normalizeDate(v) ? null : 'AAAA-MM-DD ou M/D/AAAA'; }
function cpf(v) { return /^\d{11}$/.test(v?.replace(/\D/g,'')) ? null : '11 dígitos'; }
function cnpj(v) { return /^\d{14}$/.test(v?.replace(/\D/g,'')) ? null : '14 dígitos'; }
function acao(v) { return ['ENVIAR','ALTERAR','EXCLUIR'].includes(v?.trim().toUpperCase()) ? null : 'ENVIAR/ALTERAR/EXCLUIR'; }
function nat5(v) { return /^\d{5}$/.test(v?.trim()) ? null : '5 dígitos'; }
function nat9(v) { return /^\d{9}$/.test(v?.trim()) ? null : '9 dígitos'; }
function sn(v) { return ['S','N'].includes(v?.trim().toUpperCase()) ? null : 'S ou N'; }
function yn(v) { return ['0','1'].includes(v?.trim()) ? null : '0 ou 1'; }

// ── Cross-field validation helpers ──────────────────────────────────────────
function _n(v) { return parseFloat(normalizeDecimal(v ?? '')) || 0 }

// R-4010: vlrRendTrib ≤ vlrRend
function vlrRendTribVal(v, row) {
  const e = num(v); if (e) return e
  const trib = _n(v), bruto = _n(row?.vlrRend)
  if (bruto > 0 && trib > bruto) return `Vl.Trib maior que Vl.Bruto (${bruto.toFixed(2)})`
  return null
}
// R-4010: vlrIrrf ≤ vlrRend (opcional)
function vlrIrrfVal4010(v, row) {
  if (!v?.trim()) return null
  const e = num(v); if (e) return e
  const irrf = _n(v), bruto = _n(row?.vlrRend)
  if (bruto > 0 && irrf > bruto) return `IRRF maior que Vl.Bruto (${bruto.toFixed(2)})`
  return null
}
// R-4020: vlrBaseRet ≤ vlrRend
function vlrBaseRetVal4020(v, row) {
  const e = num(v); if (e) return e
  const base = _n(v), bruto = _n(row?.vlrRend)
  if (bruto > 0 && base > bruto) return `Base Ret. maior que Vl.Bruto (${bruto.toFixed(2)})`
  return null
}
// R-4020: vlrIrrf ≤ vlrBaseRet
function vlrIrrfVal4020(v, row) {
  const e = num(v); if (e) return e
  const irrf = _n(v), base = _n(row?.vlrBaseRet)
  if (base > 0 && irrf > base) return `IRRF maior que Base Ret. (${base.toFixed(2)})`
  return null
}
// R-4020: vlrRetCsrf ≤ vlrBaseCsrf (opcional)
function vlrRetCsrfVal(v, row) {
  if (!v?.trim()) return null
  const e = num(v); if (e) return e
  const ret = _n(v), base = _n(row?.vlrBaseCsrf)
  if (base > 0 && ret > base) return `Ret.CSRF maior que Base CSRF (${base.toFixed(2)})`
  return null
}
// R-2010: vlrBaseRet ≤ vlrBrutoNF
function vlrBaseRetVal2010(v, row) {
  const e = num(v); if (e) return e
  const base = _n(v), bruto = _n(row?.vlrBrutoNF)
  if (bruto > 0 && base > bruto) return `Base Cálc. maior que Vl.Bruto (${bruto.toFixed(2)})`
  return null
}
// R-2010: vlrRetencao ≤ vlrBaseRet
function vlrRetencaoVal(v, row) {
  const e = num(v); if (e) return e
  const ret = _n(v), base = _n(row?.vlrBaseRet)
  if (base > 0 && ret > base) return `Retenção maior que Base Cálc. (${base.toFixed(2)})`
  return null
}

export function validateRow(row, columns) {
  const errors = {}
  for (const col of columns) {
    if (!col.validate) continue
    const err = col.validate(row[col.key] ?? '', row)
    if (err) errors[col.key] = err
  }
  return errors
}

// ── Event column config for SpreadsheetEditor ───────────────────────────────
export const EVENT_CONFIGS = {
  'R-4010': {
    label: 'R-4010 — Pagamentos/Créditos a Beneficiário PF',
    columns: [
      { key: 'perApur',     label: 'Per.Apur',   fullLabel: 'Período de Apuração',            width: 85,  type: 'period',  tip: 'AAAA-MM ou Jan-26',         validate: period,
        desc: { text: 'Mês e ano de competência dos pagamentos. Deve coincidir com o período configurado no Passo 1.', example: '2026-01' } },
      { key: 'cnpjEstab',   label: 'CNPJ Estab', fullLabel: 'CNPJ do Estabelecimento',          width: 140, type: 'cnpj',    tip: '##.###.###/####-##',        validate: cnpj,
        desc: { text: 'CNPJ da empresa que efetuou o pagamento (estabelecimento pagador). Deve ter dígito verificador válido.', example: '14.292.540/0001-09' } },
      { key: 'cpfBenef',    label: 'CPF Benef',  fullLabel: 'CPF do Beneficiário',              width: 115, type: 'cpf',     tip: '###.###.###-##',            validate: cpf,
        desc: { text: 'CPF da pessoa física beneficiária do pagamento. Deve ter dígito verificador válido (11 dígitos).', example: '118.389.493-72' } },
      { key: 'dtFg',        label: 'Dt. Fg.',    fullLabel: 'Data do Fato Gerador',             width: 100, type: 'date',    tip: 'AAAA-MM-DD ou M/D/AAAA',    validate: date,
        desc: { text: 'Data do pagamento ou crédito ao beneficiário (fato gerador). Deve estar dentro do mês do período de apuração.', example: '2026-01-28' } },
      { key: 'vlrRend',     label: 'Vl. Bruto',  fullLabel: 'Valor Bruto do Rendimento',        width: 95,  type: 'number',  tip: 'Ex: 2786.33',               validate: num,
        desc: { text: 'Valor total bruto pago ou creditado ao beneficiário, antes de qualquer dedução.', example: '2786.33' } },
      { key: 'vlrRendTrib', label: 'Vl. Trib',   fullLabel: 'Valor do Rendimento Tributável',   width: 95,  type: 'number',  tip: 'Ex: 2786.33',               validate: vlrRendTribVal,
        desc: { text: 'Parcela do valor bruto sujeita à tributação pelo IRPF. Não pode ser maior que o Valor Bruto.', example: '2786.33' } },
      { key: 'vlrIrrf',     label: 'IRRF',        fullLabel: 'Valor do IRRF',                   width: 85,  type: 'number',  tip: 'Opcional',                  validate: vlrIrrfVal4010,
        desc: { text: 'Imposto de Renda Retido na Fonte. Opcional — deixe em branco se não houve retenção. Não pode superar o Valor Bruto.', example: '111.92' } },
      { key: 'natRend',     label: 'Nat.Rend',    fullLabel: 'Natureza do Rendimento',          width: 80,  type: 'digits',  tip: '5 dígitos (ex: 13002)',     validate: nat5,
        desc: { text: 'Código de 5 dígitos da Tabela 01 da RF. Ex: 13001 = Trabalho assalariado · 13002 = Prestação de serviços PF · 11001 = Aluguéis.', example: '13002' } },
      { key: 'indJud',      label: 'Dec.Jud',     fullLabel: 'Decisão Judicial',                width: 70,  type: 'select',  options: ['N','S'], tip: 'S ou N', validate: sn,
        desc: { text: 'Indica se o pagamento decorre de decisão judicial. Na grande maioria dos casos: N (Não).', example: 'N' } },
      { key: 'nrRecibo',    label: 'Nr.Recibo',   fullLabel: 'Número do Recibo',                width: 155, type: 'recibo',  tip: 'Para ALTERAR/EXCLUIR',      validate: null,
        desc: { text: 'Número do recibo gerado na transmissão original. Obrigatório apenas para ALTERAR ou EXCLUIR. Deixe vazio para novos envios.', example: '1.10.001.4012187-3' } },
      { key: 'acao',        label: 'Ação',         fullLabel: 'Ação',                           width: 100, type: 'select',  options: ['ENVIAR','ALTERAR','EXCLUIR'], tip: 'ENVIAR/ALTERAR/EXCLUIR', validate: acao,
        desc: { text: 'Operação: ENVIAR = novo registro · ALTERAR = retificação (exige Nr.Recibo) · EXCLUIR = exclusão (exige Nr.Recibo).', example: 'ENVIAR' } },
    ],
  },
  'R-4020': {
    label: 'R-4020 — Pagamentos/Créditos a Beneficiário PJ',
    columns: [
      { key: 'perApur',     label: 'Per.Apur',   fullLabel: 'Período de Apuração',            width: 85,  type: 'period',  tip: 'AAAA-MM ou Jan-26',         validate: period,
        desc: { text: 'Mês e ano de competência dos pagamentos. Deve coincidir com o período configurado no Passo 1.', example: '2026-01' } },
      { key: 'cnpjEstab',   label: 'CNPJ Estab', fullLabel: 'CNPJ do Estabelecimento',          width: 140, type: 'cnpj',    tip: '##.###.###/####-##',        validate: cnpj,
        desc: { text: 'CNPJ da empresa que efetuou o pagamento ao beneficiário PJ.', example: '14.292.540/0001-09' } },
      { key: 'cnpjBenef',   label: 'CNPJ Benef', fullLabel: 'CNPJ do Beneficiário',             width: 140, type: 'cnpj',    tip: '##.###.###/####-##',        validate: cnpj,
        desc: { text: 'CNPJ da pessoa jurídica que recebeu o pagamento. Deve ser diferente do CNPJ do Estabelecimento.', example: '06.175.128/0001-72' } },
      { key: 'natRend',     label: 'Nat.Rend',   fullLabel: 'Natureza do Rendimento',           width: 80,  type: 'digits',  tip: '5 dígitos',                 validate: nat5,
        desc: { text: 'Código de 5 dígitos da Tabela 01 da RF. Para PJ use: 15004 = Aluguéis PJ · 21001 = Serviços PJ · 26001 = Juros e encargos.', example: '15004' } },
      { key: 'indJud',      label: 'Dec.Jud',    fullLabel: 'Decisão Judicial',                 width: 70,  type: 'select',  options: ['N','S'], tip: 'S ou N', validate: sn,
        desc: { text: 'Indica se o pagamento decorre de decisão judicial. Na grande maioria dos casos: N (Não).', example: 'N' } },
      { key: 'dtFg',        label: 'Dt. Fg.',    fullLabel: 'Data do Fato Gerador',             width: 100, type: 'date',    tip: 'AAAA-MM-DD ou M/D/AAAA',    validate: date,
        desc: { text: 'Data do pagamento ou crédito ao beneficiário (fato gerador). Deve estar dentro do mês do período de apuração.', example: '2026-01-28' } },
      { key: 'vlrRend',     label: 'Vl. Bruto',  fullLabel: 'Valor Bruto do Rendimento',        width: 95,  type: 'number',  tip: 'Ex: 15000.00',              validate: num,
        desc: { text: 'Valor total bruto do pagamento ao beneficiário PJ, antes de deduções.', example: '15000.00' } },
      { key: 'vlrBaseRet',  label: 'Base Ret.',  fullLabel: 'Base de Retenção do IRRF',         width: 95,  type: 'number',  tip: 'Ex: 6977.54',               validate: vlrBaseRetVal4020,
        desc: { text: 'Base de cálculo do IRRF. Pode ser menor que o valor bruto quando há deduções admitidas. Não pode ser maior que o Valor Bruto.', example: '6977.54' } },
      { key: 'vlrIrrf',     label: 'IRRF',       fullLabel: 'Valor do IRRF',                    width: 85,  type: 'number',  tip: 'Ex: 1861.07',               validate: vlrIrrfVal4020,
        desc: { text: 'Valor do IRRF retido. Calculado sobre a Base de Retenção. Não pode ser maior que a Base Ret.', example: '1861.07' } },
      { key: 'vlrBaseCsrf', label: 'Base CSRF',  fullLabel: 'Base de Cálculo CSRF',             width: 95,  type: 'number',  tip: 'Ex: 6977.54',               validate: null,
        desc: { text: 'Base de cálculo da retenção agregada CSRF (CSLL + PIS + COFINS). Preencha apenas se há retenção CSRF na nota.', example: '6977.54' } },
      { key: 'vlrRetCsrf',  label: 'Ret. CSRF',  fullLabel: 'Retenção CSRF',                    width: 90,  type: 'number',  tip: 'Ex: 324.46',                validate: vlrRetCsrfVal,
        desc: { text: 'Valor total da retenção CSRF (CSLL + PIS + COFINS somados). Não pode ser maior que a Base CSRF.', example: '324.46' } },
      { key: 'nrRecibo',    label: 'Nr.Recibo',  fullLabel: 'Número do Recibo',                 width: 155, type: 'recibo',  tip: 'Para ALTERAR/EXCLUIR',       validate: null,
        desc: { text: 'Número do recibo gerado na transmissão original. Obrigatório apenas para ALTERAR ou EXCLUIR.', example: '1.10.001.4012187-3' } },
      { key: 'acao',        label: 'Ação',        fullLabel: 'Ação',                            width: 100, type: 'select',  options: ['ENVIAR','ALTERAR','EXCLUIR'], tip: 'ENVIAR/ALTERAR/EXCLUIR', validate: acao,
        desc: { text: 'Operação: ENVIAR = novo registro · ALTERAR = retificação (exige Nr.Recibo) · EXCLUIR = exclusão (exige Nr.Recibo).', example: 'ENVIAR' } },
    ],
  },
  'R-2010': {
    label: 'R-2010 — Retenções Contrib. Previdenciárias — Serviços',
    columns: [
      { key: 'perApur',       label: 'Per.Apur',     fullLabel: 'Período de Apuração',              width: 85,  type: 'period',  tip: 'AAAA-MM ou Jan-26',         validate: period,
        desc: { text: 'Mês e ano de competência das notas fiscais. Deve coincidir com o período configurado no Passo 1.', example: '2026-01' } },
      { key: 'cnpjEstabTom',  label: 'CNPJ Tomador', fullLabel: 'CNPJ do Tomador',                  width: 140, type: 'cnpj',    tip: '##.###.###/####-##',        validate: cnpj,
        desc: { text: 'CNPJ da empresa tomadora do serviço (quem contratou e recebeu o serviço).', example: '14.292.540/0001-09' } },
      { key: 'cnpjPrestador', label: 'CNPJ Prest.',  fullLabel: 'CNPJ do Prestador',                width: 140, type: 'cnpj',    tip: '##.###.###/####-##',        validate: cnpj,
        desc: { text: 'CNPJ da empresa prestadora do serviço (quem executou). Deve ser diferente do CNPJ Tomador.', example: '06.175.128/0001-72' } },
      { key: 'indObra',       label: 'Obra C.Civ',   fullLabel: 'Prestação em Obra de Construção Civil', width: 78, type: 'select', options: ['0','1'], tip: '0=Não / 1=Sim', validate: yn,
        desc: { text: '0 = Serviço NÃO é obra de construção civil. 1 = É obra de construção civil. Altera a forma de apuração e as alíquotas aplicáveis.', example: '0' } },
      { key: 'indCPRB',       label: 'CPRB',         fullLabel: 'Contribuinte CPRB',                width: 78,  type: 'select',  options: ['0','1'], tip: '0=Não / 1=Sim', validate: yn,
        autoFill: v => ({ aliq: v === '0' ? '11.00%' : v === '1' ? '3.50%' : '' }),
        desc: { text: '0 = Prestador recolhe 11% (regime normal ou Simples). 1 = Prestador é optante CPRB, retenção reduzida de 3,5%. Confirme com o prestador.', example: '0' } },
      { key: 'numNF',         label: 'Nº NF',        fullLabel: 'Número do Documento Fiscal',       width: 80,  type: 'text',    tip: 'Número do documento',       validate: v => req(v, 'Obrigatório'),
        desc: { text: 'Número da nota fiscal de serviços. Use apenas o número, sem série ou prefixo.', example: '18671' } },
      { key: 'dtEmissaoNF',   label: 'Dt. Emissão',  fullLabel: 'Data de Emissão da NF',            width: 100, type: 'date',    tip: 'AAAA-MM-DD ou M/D/AAAA',    validate: date,
        desc: { text: 'Data de emissão da nota fiscal. Deve estar dentro do mês do período de apuração.', example: '2026-01-28' } },
      { key: 'vlrBrutoNF',    label: 'Vl. Bruto',    fullLabel: 'Valor Bruto da NF',                width: 95,  type: 'number',  tip: 'Ex: 6042.36',               validate: num,
        desc: { text: 'Valor bruto total da nota fiscal de serviços, antes da retenção.', example: '6042.36' } },
      { key: 'tpServ',        label: 'Tp. Serv.',    fullLabel: 'Tipo de Serviço',                  width: 95,  type: 'digits',  tip: '9 dígitos (ex: 100000003)', validate: nat9,
        desc: { text: 'Código de 9 dígitos da Tabela 06 da RF. Ex: 100000003 = Limpeza e conservação · 100000007 = Vigilância e segurança · 300000003 = T.I.', example: '100000003' } },
      { key: 'vlrBaseRet',    label: 'Base Cálc.',   fullLabel: 'Base de Cálculo da Retenção',      width: 95,  type: 'number',  tip: 'Ex: 6042.36',               validate: vlrBaseRetVal2010,
        desc: { text: 'Base de cálculo da retenção previdenciária. Geralmente igual ao valor bruto. Não pode ser maior que o Valor Bruto.', example: '6042.36' } },
      { key: 'vlrRetencao',   label: 'Retenção',     fullLabel: 'Valor da Retenção',                width: 90,  type: 'number',  tip: 'Ex: 211.48',                validate: vlrRetencaoVal,
        desc: { text: 'Valor da retenção previdenciária efetivamente retida: 11% da base (indCPRB=0) ou 3,5% (indCPRB=1). Não pode ser maior que a Base.', example: '211.48' } },
      { key: 'aliq',          label: 'Alíq.',        fullLabel: 'Alíquota',                         width: 65,  type: 'text',    tip: 'Preenchido pelo campo CPRB', validate: null, computed: true,
        desc: { text: 'Preenchido automaticamente a partir do campo CPRB: 11,00% quando CPRB=0 (regime normal) · 3,50% quando CPRB=1 (optante CPRB).', example: '11.00%' } },
      { key: 'nrRecibo',      label: 'Nr.Recibo',    fullLabel: 'Número do Recibo',                 width: 155, type: 'recibo',  tip: 'Para ALTERAR/EXCLUIR',       validate: null,
        desc: { text: 'Número do recibo gerado na transmissão original. Obrigatório apenas para ALTERAR ou EXCLUIR.', example: '1.10.001.4012187-3' } },
      { key: 'acao',          label: 'Ação',          fullLabel: 'Ação',                            width: 100, type: 'select',  options: ['ENVIAR','ALTERAR','EXCLUIR'], tip: 'ENVIAR/ALTERAR/EXCLUIR', validate: acao,
        desc: { text: 'Operação: ENVIAR = novo registro · ALTERAR = retificação (exige Nr.Recibo) · EXCLUIR = exclusão (exige Nr.Recibo).', example: 'ENVIAR' } },
    ],
  },
  'R-1000': {
    label: 'R-1000 — Informações do Contribuinte',
    columns: [
      { key: 'cnpj',     label: 'CNPJ',        fullLabel: 'CNPJ',               width: 145, type: 'cnpj',   tip: '##.###.###/####-##', validate: v => /^\d{8}(\d{6})?$/.test(v?.replace(/\D/g,'')) ? null : '8 ou 14 dígitos',
        desc: { text: 'CNPJ (14 dígitos) ou Raiz do CNPJ (8 dígitos) do contribuinte a ser cadastrado no REINF.', example: '14.292.540/0001-09' } },
      { key: 'iniValid', label: 'IniValid',    fullLabel: 'Início de Vigência', width: 90,  type: 'period', tip: 'AAAA-MM',            validate: period,
        desc: { text: 'Período de início de validade das informações cadastrais. Geralmente o mês do primeiro envio ao REINF.', example: '2026-01' } },
      { key: 'fimValid', label: 'FimValid',    fullLabel: 'Fim de Vigência',    width: 90,  type: 'period', tip: 'AAAA-MM (opcional)',   validate: v => !v?.trim() ? null : period(v),
        desc: { text: 'Período de encerramento da vigência. Deixe em branco para ENVIAR. Use em ALTERAR para fechar o período atual (necessário para resolver o erro MS1578 em Produção Restrita).', example: '2026-03' } },
      { key: 'nmCtt',    label: 'Contato',     fullLabel: 'Nome do Contato',    width: 160, type: 'text',   tip: 'Nome do contato',    validate: v => req(v, 'Obrigatório'),
        desc: { text: 'Nome completo da pessoa de contato responsável pelas obrigações EFD-REINF da empresa.', example: 'Pedro Cavariani' } },
      { key: 'cpfCtt',   label: 'CPF Contato', fullLabel: 'CPF do Contato',     width: 120, type: 'cpf',   tip: '###.###.###-##',      validate: cpf,
        desc: { text: 'CPF da pessoa de contato. Deve ter dígito verificador válido.', example: '118.389.493-72' } },
      { key: 'foneFixo', label: 'Telefone',    fullLabel: 'Telefone',           width: 120, type: 'digits', tip: 'Somente dígitos',    validate: null,
        desc: { text: 'Telefone de contato com DDD. Somente dígitos, sem formatação (parênteses, traços ou espaços).', example: '11912345678' } },
      { key: 'email',    label: 'E-mail',      fullLabel: 'E-mail',             width: 180, type: 'text',   tip: 'email@dominio.com',  validate: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v?.trim()) ? null : 'E-mail inválido',
        desc: { text: 'E-mail para comunicações da Receita Federal. Use o e-mail corporativo oficial da empresa.', example: 'fiscal@empresa.com.br' } },
      { key: 'acao',     label: 'Ação',         fullLabel: 'Ação',              width: 110, type: 'select', options: ['ENVIAR','ALTERAR','EXCLUIR'], tip: 'ENVIAR/ALTERAR/EXCLUIR', validate: acao,
        desc: { text: 'Operação: ENVIAR = cadastro inicial · ALTERAR = atualização dos dados cadastrais · EXCLUIR = cancelamento do cadastro.', example: 'ENVIAR' } },
    ],
  },
};

// ── Pre-filled mock table rows per event (for demo) ─────────────────────────
export const MOCK_TABLE_ROWS = {
  'R-4010': [
    { perApur:'2026-03', cnpjEstab:'12.345.678/0001-90', cpfBenef:'123.456.789-09', dtFg:'2026-03-31', vlrRend:'5000.00', vlrRendTrib:'5000.00', vlrIrrf:'750.00', natRend:'13001', indJud:'N', nrRecibo:'', acao:'ENVIAR' },
    { perApur:'2026-03', cnpjEstab:'12.345.678/0001-90', cpfBenef:'234.567.890-92', dtFg:'2026-03-31', vlrRend:'8200.00', vlrRendTrib:'8200.00', vlrIrrf:'1230.00',natRend:'13001', indJud:'N', nrRecibo:'', acao:'ENVIAR' },
    { perApur:'2026-03', cnpjEstab:'12.345.678/0001-90', cpfBenef:'345.678.901-75', dtFg:'2026-03-31', vlrRend:'3100.50', vlrRendTrib:'3100.50', vlrIrrf:'465.08', natRend:'13001', indJud:'N', nrRecibo:'1.10.001.3900021-3', acao:'ALTERAR' },
    { perApur:'2026-03', cnpjEstab:'98.765.432/0001-55', cpfBenef:'456.789.012-49', dtFg:'2026-03-31', vlrRend:'6800.00', vlrRendTrib:'6800.00', vlrIrrf:'1020.00',natRend:'13001', indJud:'S', nrRecibo:'', acao:'ENVIAR' },
    { perApur:'2026-03', cnpjEstab:'98.765.432/0001-55', cpfBenef:'567.890.123-03', dtFg:'2026-03-28', vlrRend:'9300.00', vlrRendTrib:'9300.00', vlrIrrf:'1395.00',natRend:'13001', indJud:'N', nrRecibo:'', acao:'ENVIAR' },
  ],
  'R-4020': [
    { perApur:'2026-03', cnpjEstab:'12.345.678/0001-90', cnpjBenef:'45.678.901/0001-75', natRend:'21001', indJud:'N', dtFg:'2026-03-15', vlrRend:'15000.00', vlrBaseRet:'15000.00', vlrIrrf:'2250.00', vlrBaseCsrf:'', vlrRetCsrf:'', nrRecibo:'', acao:'ENVIAR' },
    { perApur:'2026-03', cnpjEstab:'12.345.678/0001-90', cnpjBenef:'56.789.012/0001-00', natRend:'21003', indJud:'N', dtFg:'2026-03-15', vlrRend:'7500.00',  vlrBaseRet:'7500.00',  vlrIrrf:'1125.00', vlrBaseCsrf:'', vlrRetCsrf:'', nrRecibo:'', acao:'ENVIAR' },
    { perApur:'2026-03', cnpjEstab:'98.765.432/0001-55', cnpjBenef:'22.333.444/0001-81', natRend:'21001', indJud:'N', dtFg:'2026-03-20', vlrRend:'11000.00', vlrBaseRet:'11000.00', vlrIrrf:'1650.00', vlrBaseCsrf:'', vlrRetCsrf:'', nrRecibo:'', acao:'ENVIAR' },
  ],
  'R-2010': [
    { perApur:'2026-03', cnpjEstabTom:'12.345.678/0001-90', cnpjPrestador:'11.222.333/0001-81', indObra:'0', indCPRB:'0', numNF:'1001', dtEmissaoNF:'2026-03-10', vlrBrutoNF:'22000.00', tpServ:'000000001', vlrBaseRet:'22000.00', vlrRetencao:'2420.00', nrRecibo:'', acao:'ENVIAR' },
    { perApur:'2026-03', cnpjEstabTom:'12.345.678/0001-90', cnpjPrestador:'33.444.555/0001-81', indObra:'1', indCPRB:'1', numNF:'2205', dtEmissaoNF:'2026-03-12', vlrBrutoNF:'18500.00', tpServ:'000000001', vlrBaseRet:'18500.00', vlrRetencao:'185.00',  nrRecibo:'', acao:'ENVIAR' },
  ],
  'R-1000': [
    { cnpj:'12.345.678/0001-90', iniValid:'2026-03', fimValid:'', nmCtt:'Pedro Cavariani', cpfCtt:'123.456.789-09', foneFixo:'11912345678', email:'pedro@mlegate.com.br', acao:'ENVIAR' },
  ],
};

// ── Processing simulation (15 rows) ─────────────────────────────────────────
export const MOCK_PROCESS_ROWS = [
  { id:1,  evento:'R-4010', perApur:'2025-03', benef:'123.456.789-00', vlrRend:5000.00,  acao:'ENVIAR' },
  { id:2,  evento:'R-4010', perApur:'2025-03', benef:'234.567.890-11', vlrRend:8200.00,  acao:'ENVIAR' },
  { id:3,  evento:'R-4010', perApur:'2025-03', benef:'345.678.901-22', vlrRend:3100.50,  acao:'ALTERAR' },
  { id:4,  evento:'R-4020', perApur:'2025-03', benef:'45.678.901/0001-33', vlrRend:15000.00, acao:'ENVIAR' },
  { id:5,  evento:'R-4020', perApur:'2025-03', benef:'56.789.012/0001-44', vlrRend:7500.00,  acao:'ENVIAR' },
  { id:6,  evento:'R-4010', perApur:'2025-03', benef:'678.901.234-55', vlrRend:0,         acao:'ENVIAR' },
  { id:7,  evento:'R-2010', perApur:'2025-03', benef:'11.222.333/0001-81', vlrRend:22000.00, acao:'ENVIAR' },
  { id:8,  evento:'R-4010', perApur:'2025-03', benef:'789.012.345-66', vlrRend:4200.00,  acao:'EXCLUIR' },
  { id:9,  evento:'R-4020', perApur:'2025-03', benef:'22.333.444/0001-92', vlrRend:11000.00, acao:'ENVIAR' },
  { id:10, evento:'R-4010', perApur:'2025-03', benef:'890.123.456-77', vlrRend:6800.00,  acao:'ENVIAR' },
  { id:11, evento:'R-2010', perApur:'2025-03', benef:'33.444.555/0001-03', vlrRend:18500.00, acao:'ALTERAR' },
  { id:12, evento:'R-4010', perApur:'2025-03', benef:'901.234.567-88', vlrRend:9300.00,  acao:'ENVIAR' },
  { id:13, evento:'R-1000', perApur:'2025-03', benef:'12.345.678/0001-90', vlrRend:0,       acao:'ENVIAR' },
  { id:14, evento:'R-4020', perApur:'2025-03', benef:'44.555.666/0001-14', vlrRend:31000.00, acao:'ENVIAR' },
  { id:15, evento:'R-4010', perApur:'2025-03', benef:'012.345.678-99', vlrRend:2900.00,  acao:'ENVIAR' },
];

const ERRORS = {
  6:  { codigo:'MS0083', mensagem:'Valor do rendimento deve ser maior que zero.' },
  9:  { codigo:'MS0021', mensagem:'Evento duplicado para o período informado.' },
};

function gerarNrRecibo() {
  const seq = Math.floor(Math.random() * 9000000) + 1000000;
  const dv  = Math.floor(Math.random() * 9) + 1;
  return `1.10.001.${seq}-${dv}`;
}

export function processarMock(id) {
  return new Promise(resolve => {
    setTimeout(() => {
      if (ERRORS[id]) resolve({ sucesso: false, ...ERRORS[id] });
      else resolve({ sucesso: true, nrRecibo: gerarNrRecibo() });
    }, 350 + Math.random() * 750);
  });
}

// ── Mock histórico inicial (pré-carregado para demo) ─────────────────────────
export const MOCK_HISTORICO = [
  {
    id: 'h1',
    competencia: 'Fev/2026',
    perApur: '2026-02',
    evento: 'R-4010',
    operacao: 'Envio',
    certAlias: 'Cavariani Indústrias LTDA',
    certId: null,
    qtdLinhas: 3,
    dataHora: '07/03/2026 08:52',
    status: 'Aceito',
    linhas: [
      { perApur:'2026-02', cnpjEstab:'12.345.678/0001-90', cpfBenef:'123.456.789-00', dtFg:'2026-02-28', vlrRend:'5000.00', vlrRendTrib:'5000.00', vlrIrrf:'750.00',  natRend:'13001', indJud:'N', nrRecibo:'1.10.001.4012187-3', acao:'ENVIAR', _status:'Aceito' },
      { perApur:'2026-02', cnpjEstab:'12.345.678/0001-90', cpfBenef:'234.567.890-11', dtFg:'2026-02-28', vlrRend:'8200.00', vlrRendTrib:'8200.00', vlrIrrf:'1230.00', natRend:'13001', indJud:'N', nrRecibo:'1.10.001.4012188-4', acao:'ENVIAR', _status:'Aceito' },
      { perApur:'2026-02', cnpjEstab:'98.765.432/0001-55', cpfBenef:'345.678.901-22', dtFg:'2026-02-28', vlrRend:'3100.50', vlrRendTrib:'3100.50', vlrIrrf:'465.08',  natRend:'13001', indJud:'N', nrRecibo:'1.10.001.4012189-5', acao:'ENVIAR', _status:'Aceito' },
    ],
  },
  {
    id: 'h2',
    competencia: 'Fev/2026',
    perApur: '2026-02',
    evento: 'R-4020',
    operacao: 'Envio',
    certAlias: 'Tech Solutions S.A.',
    certId: null,
    qtdLinhas: 2,
    dataHora: '07/03/2026 09:10',
    status: 'Parcial',
    linhas: [
      { perApur:'2026-02', cnpjEstab:'12.345.678/0001-90', cnpjBenef:'45.678.901/0001-33', natRend:'21001', indJud:'N', dtFg:'2026-02-15', vlrRend:'15000.00', vlrBaseRet:'', vlrIrrf:'2250.00', vlrBaseCsrf:'', vlrRetCsrf:'', nrRecibo:'1.10.001.4012201-9', acao:'ENVIAR', _status:'Aceito' },
      { perApur:'2026-02', cnpjEstab:'98.765.432/0001-55', cnpjBenef:'22.333.444/0001-92', natRend:'21001', indJud:'N', dtFg:'2026-02-15', vlrRend:'11000.00', vlrBaseRet:'', vlrIrrf:'1650.00', vlrBaseCsrf:'', vlrRetCsrf:'', nrRecibo:null,               acao:'ENVIAR', _status:'Rejeitado' },
    ],
  },
  {
    id: 'h3',
    competencia: 'Jan/2026',
    perApur: '2026-01',
    evento: 'R-4010',
    operacao: 'Retificação',
    certAlias: 'Cavariani Indústrias LTDA',
    certId: null,
    qtdLinhas: 2,
    dataHora: '06/02/2026 14:30',
    status: 'Aceito',
    linhas: [
      { perApur:'2026-01', cnpjEstab:'12.345.678/0001-90', cpfBenef:'123.456.789-00', dtFg:'2026-01-31', vlrRend:'4800.00', vlrRendTrib:'4800.00', vlrIrrf:'720.00',  natRend:'13001', indJud:'N', nrRecibo:'1.10.001.3950041-1', acao:'ALTERAR', _status:'Aceito' },
      { perApur:'2026-01', cnpjEstab:'12.345.678/0001-90', cpfBenef:'234.567.890-11', dtFg:'2026-01-31', vlrRend:'8000.00', vlrRendTrib:'8000.00', vlrIrrf:'1200.00', natRend:'13001', indJud:'N', nrRecibo:'1.10.001.3950042-2', acao:'ALTERAR', _status:'Aceito' },
    ],
  },
];
