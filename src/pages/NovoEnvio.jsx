import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Check, Upload, TableProperties,
  FileSpreadsheet, CheckCircle2, Trash2,
  XCircle, Loader2, AlertTriangle, RotateCcw, LayoutDashboard,
  ShieldCheck, Send, Download, Copy, ChevronDown, ChevronUp,
  Clock, Server, Building2, ExternalLink, Search, Info,
  User, FileText, BookOpen, FlaskConical,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import UploadZone from '../components/UploadZone'
import SpreadsheetEditor from '../components/SpreadsheetEditor'
import { EVENT_CONFIGS, MOCK_TABLE_ROWS, validateRow, TIPO_CORES, normalizePeriod } from '../data/mockData'
import { listCertificados, listEmpresas, enviar, validar, consultarLote, consultarContribuinte, finalizarLote } from '../api/client'
import styles from './NovoEnvio.module.css'

// Mapeamento: cabeçalho da planilha modelo (normalizado) → chave da coluna
// Cobre as abas R2010, R4010, R4020 da Planilha Modelo MLEGATE
const PLANILHA_HEADER_MAP = {
  'R-2010': {
    'periodo de apuracao':                       'perApur',
    'cnpj do estabelecimento':                   'cnpjEstabTom',
    'estabelecimento (cnpj)':                    'cnpjEstabTom',  // variante planilha modelo
    'cnpj prestador de servico':                 'cnpjPrestador',
    'prestador (cnpj)':                          'cnpjPrestador',
    'prestacao em obra constr civil':            'indObra',
    'prestacao em obra const civil':             'indObra',   // "Const." abreviado
    'prestacao em obra construcao civil':        'indObra',
    'prestador e contribuinte cprb':             'indCPRB',
    'prestador e contrib cprb':                  'indCPRB',   // "Contrib." abreviado
    'prestador contribuinte cprb':               'indCPRB',
    'numero do documento':                       'numNF',
    'data da emissao':                           'dtEmissaoNF',
    'valor bruto':                               'vlrBrutoNF',
    'tipo de servico':                           'tpServ',
    'valor da base de calculo':                  'vlrBaseRet',
    'valor da retencao':                         'vlrRetencao',
    'aliq':                                      'aliq',
    'nrrecibo (auto)':                           'nrRecibo',
    'nrrecibo':                                  'nrRecibo',
    'acao':                                      'acao',
    'enviar':                                    'acao',      // header "ENVIAR" na planilha modelo R2010
  },
  'R-4010': {
    'periodo de apuracao':                       'perApur',
    'cnpj do estabelecimento':                   'cnpjEstab',
    'estabelecimento (cnpj)':                    'cnpjEstab',     // variante planilha modelo
    'cnpj beneficiario':                         'cpfBenef',
    'cpf do beneficiario':                       'cpfBenef',      // variante PF planilha modelo
    'beneficiario (cpf)':                        'cpfBenef',
    'data fato gerador':                         'dtFg',
    'valor bruto':                               'vlrRend',
    'valor do rendimento tributavel':            'vlrRendTrib',
    'valor do imposto (irrf)':                   'vlrIrrf',
    'valor do imposto irrf':                     'vlrIrrf',
    'natureza do rendimento':                    'natRend',
    'decisao judicial':                          'indJud',
    'decisao judicial (sn)':                     'indJud',
    'nrrecibo (auto)':                           'nrRecibo',
    'nrrecibo':                                  'nrRecibo',
    'acao':                                      'acao',
  },
  'R-4020': {
    'periodo de apuracao':                       'perApur',
    'cnpj do estabelecimento':                   'cnpjEstab',
    'estabelecimento (cnpj)':                    'cnpjEstab',     // variante planilha modelo
    'cnpj beneficiario':                         'cnpjBenef',
    'cnpj do beneficiario':                      'cnpjBenef',
    'beneficiario (cnpj)':                       'cnpjBenef',
    'natureza do rendimento':                    'natRend',
    'decisao judicial':                          'indJud',
    'decisao judicial (sn)':                     'indJud',
    'data fato gerador':                         'dtFg',
    'valor bruto':                               'vlrRend',
    'valor da base de retencao':                 'vlrBaseRet',
    'valor do imposto irrf':                     'vlrIrrf',
    'valor do imposto (irrf)':                   'vlrIrrf',
    'valor da base retencao agregada (csrf)':    'vlrBaseCsrf',
    'valor da retencao agregada (csrf)':         'vlrRetCsrf',
    'nrrecibo (auto)':                           'nrRecibo',
    'nrrecibo':                                  'nrRecibo',
    'acao':                                      'acao',
  },
}

// Normaliza string de cabeçalho: minúsculo, sem acentos, sem pontuação extra
function normHeader(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s()]/g, '')                    // remove pontuação exceto parênteses
    .trim()
    .replace(/\s+/g, ' ')
}

// Converte valor de célula SheetJS para string pronta para o campo
// Com raw:false o SheetJS retorna o valor formatado como exibido no Excel
function cellStr(v) {
  if (v === null || v === undefined || v === '') return ''
  const s = String(v).trim()
  // Strip separador de milhares: "6,042.36" → "6042.36"
  const noCommas = s.replace(/,/g, '')
  if (noCommas !== s && noCommas !== '' && !isNaN(Number(noCommas))) return noCommas
  // Expande ano 2 dígitos em datas M/D/YY → M/D/20YY (ex: "2/13/26" → "2/13/2026")
  const shortDate = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (shortDate) return `${shortDate[1]}/${shortDate[2]}/20${shortDate[3]}`
  return s
}

// Pós-processa campos com semântica específica após cellStr
function fieldPostProcess(key, val) {
  if (!val) return val
  // indObra, indCPRB: extrai o "0" ou "1" de "0-Não é obra de constr.Cívil" / "1-É obra..."
  if (key === 'indObra' || key === 'indCPRB') {
    const m = val.match(/^([01])/)
    return m ? m[1] : val
  }
  // perApur: normaliza qualquer formato (AAAA-MM, Nov-25, M/D/YYYY Excel, etc.)
  if (key === 'perApur') {
    return normalizePeriod(val) ?? val
  }
  return val
}

const STEPS = [
  { n: 1, label: 'Configuração' },
  { n: 2, label: 'Dados'        },
  { n: 3, label: 'Revisão'      },
  { n: 4, label: 'Verificação'  },
  { n: 5, label: 'Envio'        },
]

const EVENTO_OPTS = [
  { id: 'R-1000', title: 'R-1000', desc: 'Informações do Contribuinte (Cadastro)' },
  { id: 'R-2010', title: 'R-2010', desc: 'Retenções Contribuições Previdenciárias — Serviços Tomados' },
  { id: 'R-4010', title: 'R-4010', desc: 'Pagamentos / Créditos a Beneficiário Pessoa Física' },
  { id: 'R-4020', title: 'R-4020', desc: 'Pagamentos / Créditos a Beneficiário Pessoa Jurídica' },
]

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function parseYYYYMM(v) {
  if (!v || !/^\d{4}-\d{2}$/.test(v)) return null
  const [y, m] = v.split('-').map(Number)
  return { year: y, month: m } // month 1-12
}

function MonthPicker({ value, onChange }) {
  const now = new Date()
  const parsed = parseYYYYMM(value) ?? { year: now.getFullYear(), month: now.getMonth() + 1 }
  const { year, month } = parsed

  function shift(delta) {
    let m = month + delta
    let y = year
    if (m < 1)  { m = 12; y-- }
    if (m > 12) { m = 1;  y++ }
    onChange(`${y}-${String(m).padStart(2, '0')}`)
  }

  return (
    <div className={styles.monthPicker}>
      <button type="button" className={styles.monthArrow} onClick={() => shift(-1)} aria-label="Mês anterior">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M7 1L3 5L7 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <span className={styles.monthLabel}>
        {MESES_PT[month - 1]} {year}
      </span>
      <button type="button" className={styles.monthArrow} onClick={() => shift(1)} aria-label="Próximo mês">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  )
}

const PAGE = {
  initial:  { opacity: 0, x: 20  },
  animate:  { opacity: 1, x: 0, transition: { duration: 0.25 } },
  exit:     { opacity: 0, x: -20, transition: { duration: 0.18 } },
}

function maskCnpj(v) {
  const d = (v ?? '').replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2)  return d
  if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

function maskCnpjRaiz(v) {
  const d = (v ?? '').replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
}

function getCnpjFieldKey(evento) {
  if (evento === 'R-2010') return 'cnpjEstabTom'
  if (evento === 'R-1000') return 'cnpj'
  return 'cnpjEstab'
}


// ── R-1000 Query Panel ───────────────────────────────────────────────────────
function R1kQueryPanel({ cnpj14, certId, query, onConsultar, onUsarRecibo }) {
  const canQuery = cnpj14.length === 14 && !!certId
  const [copied, setCopied] = useState(false)

  function handleCopy(text) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  // Badge config
  function badgeInfo(result) {
    if (!result.cadastrado) return { cls: styles.r1kBadgeNone, label: 'Não cadastrado' }
    if (result.situacao === '9') return { cls: styles.r1kBadgeNone, label: 'Encerrado' }
    if (result.fimValid) return { cls: styles.r1kBadgeWarn, label: 'Cadastro com prazo definido' }
    return { cls: styles.r1kBadgeOk, label: 'Ativo' }
  }

  return (
    <div className={styles.r1kWrap}>
      <div className={styles.r1kHeader}>
        <span className={styles.r1kLabel}>
          <Search size={12} />
          Verificar cadastro na Receita Federal
        </span>
        <button
          type="button"
          className={styles.r1kBtn}
          onClick={onConsultar}
          disabled={!canQuery || query.loading}
          title={!canQuery ? 'Preencha o CNPJ (14 dígitos) e selecione um certificado' : undefined}
        >
          {query.loading
            ? <><Loader2 size={13} className={styles.spin} /> Consultando...</>
            : <><Search size={13} /> Verificar R-1000</>
          }
        </button>
      </div>

      {!canQuery && (
        <p className={styles.step1CardSub} style={{ margin: 0, paddingLeft: '0.1rem' }}>
          Preencha o CNPJ completo (14 dígitos) e selecione um certificado para habilitar a consulta.
        </p>
      )}

      {query.error && (
        <div className={styles.r1kError}>
          <XCircle size={14} style={{ flexShrink: 0 }} />
          <span>{query.error}</span>
        </div>
      )}

      {query.result && (() => {
        const { cls, label } = badgeInfo(query.result)
        const r = query.result
        return (
          <div className={styles.r1kPanel}>
            <div className={styles.r1kPanelTop}>
              <span className={`${styles.r1kBadge} ${cls}`}>{label}</span>
              {r.mensagem && <p className={styles.r1kMsg}>{r.mensagem}</p>}
            </div>

            {r.erroParsing && (
              <p className={styles.r1kMsg} style={{ color: 'var(--warning)', fontSize: '0.75rem' }}>
                {r.erroParsing}
              </p>
            )}


            {r.nrRecibo && (
              <div className={styles.r1kRecibo}>
                <span className={styles.r1kReciboLabel}>Recibo</span>
                <span className={styles.r1kReciboValue}>{r.nrRecibo}</span>
                <button
                  type="button"
                  className={styles.r1kCopyBtn}
                  onClick={() => handleCopy(r.nrRecibo)}
                  title="Copiar número do recibo"
                >
                  <Copy size={11} />
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            )}

            {(r.iniValid || r.fimValid) && (
              <div className={styles.r1kDates}>
                {r.iniValid && (
                  <div className={styles.r1kDateItem}>
                    <span className={styles.r1kDateKey}>Início validade</span>
                    <span className={styles.r1kDateVal}>{r.iniValid}</span>
                  </div>
                )}
                {r.fimValid && (
                  <div className={styles.r1kDateItem}>
                    <span className={styles.r1kDateKey}>Fim validade</span>
                    <span className={styles.r1kDateVal}>{r.fimValid}</span>
                  </div>
                )}
              </div>
            )}

            {r.cadastrado && r.nrRecibo && (
              <button
                type="button"
                className={styles.r1kUseBtn}
                onClick={() => onUsarRecibo(r.nrRecibo)}
              >
                <RotateCcw size={13} />
                Usar recibo para retificar
              </button>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ── Step 1 ──────────────────────────────────────────────────────────────────
function Step1({ config, setConfig, certificados, loadingCerts, ambiente, onAmbienteChange,
                 r1kQuery, onR1kConsultar, onR1kUsarRecibo, empresasContrib = [] }) {
  function applyCNPJMask(v) {
    if (!v) return ''
    const d = v.replace(/\D/g,'').slice(0,14)
    if (d.length <= 2)  return d
    if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`
    if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }

  function fmtCnpjDisplay(cnpj) {
    const d = (cnpj ?? '').replace(/\D/g, '')
    if (d.length !== 14) return cnpj
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }

  function hexAlpha(hex, alpha) {
    const a = Math.round(alpha * 255).toString(16).padStart(2, '0')
    return hex + a
  }

  const EVENTO_META = EVENTO_META_MAP

  const selectedCert = config.certId ? certificados.find(c => c.id === config.certId) : null
  const certVencInfo = selectedCert?.dtValidade ? (() => {
    const expiry = new Date(selectedCert.dtValidade)
    const dias = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24))
    if (dias < 0)   return { tipo: 'exp',  label: `Certificado expirado há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? 's' : ''}` }
    if (dias <= 30) return { tipo: 'warn', label: `Válido — expira em ${dias} dia${dias !== 1 ? 's' : ''}` }
    return { tipo: 'ok', label: `Válido — expira em ${dias} dias` }
  })() : null

  return (
    <div className={styles.stepContent}>

      {/* ZONA 1 — Quem e Quando */}
      <div className={styles.step1ZonaQuem}>

        {/* Linha 1: Empresa / CNPJ — largura total */}
        <div className={styles.step1Card}>
          <h3 className={styles.step1CardTitle}>
            <span className={styles.s1Num}>1</span>
            <Building2 size={14} className={styles.step1CardTitleIcon} />
            {empresasContrib.length > 0 ? 'Empresa Contribuinte' : 'CNPJ do Contribuinte'}
          </h3>
          {empresasContrib.length > 0 ? (
            <>
              <p className={styles.step1CardSub}>
                Selecione a empresa — o CNPJ será preenchido automaticamente.
              </p>
              <div className={styles.empresaSelectorWrap}>
                <select
                  className={styles.empresaSelect}
                  value={config.empresaId ?? ''}
                  onChange={e => {
                    const emp = empresasContrib.find(x => String(x.id) === e.target.value)
                    if (emp) {
                      setConfig(c => ({ ...c, empresaId: emp.id, cnpj: fmtCnpjDisplay(emp.cnpj), filiais: false, certId: emp.certificadoId ?? null }))
                    } else {
                      setConfig(c => ({ ...c, empresaId: null, certId: null }))
                    }
                  }}
                >
                  <option value="">— Selecione a empresa contribuinte —</option>
                  {empresasContrib.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nome} · {fmtCnpjDisplay(emp.cnpj)}</option>
                  ))}
                </select>
                <Building2 size={14} className={styles.empresaSelectIcon} />
              </div>
            </>
          ) : (
            <p className={styles.step1CardSub}>
              Empresa <strong>para a qual</strong> o envio está sendo feito — não necessariamente o CNPJ do certificado.
            </p>
          )}
          <div className={styles.step1CnpjRow}>
            <input
              className={styles.input}
              placeholder={config.filiais ? '00.000.000 (raiz — 8 dígitos)' : '00.000.000/0001-00'}
              value={config.cnpj}
              onChange={e => setConfig(c => ({ ...c, cnpj: c.filiais ? maskCnpjRaiz(e.target.value) : applyCNPJMask(e.target.value) }))}
              maxLength={config.filiais ? 10 : 18}
              style={{ fontWeight: 600, fontSize: '0.95rem' }}
            />
            <label className={styles.filiaisToggle} style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={!!config.filiais}
                onChange={e => {
                  const on = e.target.checked
                  const emp = empresasContrib.find(x => x.id === config.empresaId)
                  let novoCnpj = ''
                  if (emp) {
                    const digits = emp.cnpj.replace(/\D/g, '')
                    novoCnpj = on ? maskCnpjRaiz(digits) : fmtCnpjDisplay(digits)
                  }
                  setConfig(c => ({ ...c, filiais: on, cnpj: novoCnpj }))
                }}
              />
              <span>Múltiplas filiais <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(CNPJ varia por linha)</span></span>
            </label>
          </div>
          {!config.filiais && config.cnpj.replace(/\D/g,'').length === 14 && (
            <p className={styles.step1CardSub} style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
              ✓ CNPJ será preenchido e bloqueado na planilha automaticamente.
            </p>
          )}
        </div>

        {/* Linha 2: Período + Certificado lado a lado */}
        <div className={styles.step1ZonaQuemRow}>
          <div className={styles.step1Card}>
            <h3 className={styles.step1CardTitle}>
              <span className={styles.s1Num}>2</span>
              <Clock size={14} className={styles.step1CardTitleIcon} />
              Período de Apuração
            </h3>
            <p className={styles.step1CardSub}>
              Competência à qual os eventos se referem.
            </p>
            <MonthPicker
              value={config.perApur}
              onChange={v => setConfig(c => ({ ...c, perApur: v }))}
            />
          </div>

          <div className={styles.step1Card}>
            <h3 className={styles.step1CardTitle}>
              <span className={styles.s1Num}>3</span>
              <ShieldCheck size={14} className={styles.step1CardTitleIcon} />
              Certificado Digital
            </h3>
            {loadingCerts ? (
              <div className={styles.certWarning}>
                <Loader2 size={13} className={styles.spin} />
                <span>Carregando certificados...</span>
              </div>
            ) : (() => {
              // Se empresa selecionada não tem cert configurado: bloqueio
              const selectedEmp = config.empresaId ? empresasContrib.find(x => x.id === config.empresaId) : null
              if (selectedEmp && !selectedEmp.certificadoId) {
                return (
                  <div className={styles.certWarning}>
                    <AlertTriangle size={13} />
                    <span>
                      Esta empresa não tem certificado digital configurado.{' '}
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Solicite ao administrador.</span>
                    </span>
                  </div>
                )
              }
              // Lista filtrada: se empresa selecionada, mostra só o cert dela; senão mostra todos
              const certsVisiveis = selectedEmp
                ? certificados.filter(c => c.id === selectedEmp.certificadoId)
                : certificados
              if (certsVisiveis.length === 0) {
                return (
                  <div className={styles.certWarning}>
                    <AlertTriangle size={13} />
                    <span>
                      Nenhum certificado cadastrado.{' '}
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Acesse Certificados no menu lateral para adicionar.</span>
                    </span>
                  </div>
                )
              }
              return (
                <>
                  <div className={styles.certSelectWrap}>
                    <select
                      className={styles.certSelect}
                      value={config.certId ?? ''}
                      onChange={e => {
                        const id = Number(e.target.value) || null
                        setConfig(c => ({ ...c, certId: id }))
                      }}
                    >
                      <option value="">— Selecione um certificado —</option>
                      {certsVisiveis.map(cert => (
                        <option key={cert.id} value={cert.id}>{cert.nome} · {cert.cnpjContribuinte}</option>
                      ))}
                    </select>
                    <ShieldCheck size={14} className={styles.certSelectIcon} />
                  </div>
                  {certVencInfo && (
                    <div className={`${styles.certValidBadge} ${styles[`certValid${certVencInfo.tipo.charAt(0).toUpperCase() + certVencInfo.tipo.slice(1)}`]}`}>
                      {certVencInfo.tipo === 'exp'  && <XCircle size={13} />}
                      {certVencInfo.tipo === 'warn' && <AlertTriangle size={13} />}
                      {certVencInfo.tipo === 'ok'   && <ShieldCheck size={13} />}
                      <span>{certVencInfo.label}</span>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ZONA 2 — Tipo de Evento (HERO) */}
      <div className={styles.step1ZonaEvento}>
        <p className={styles.step1EvenLabel}>Tipo de Evento</p>
        <div className={styles.eventoGrid}>
          {EVENTO_OPTS.map(opt => {
            const meta = EVENTO_META[opt.id]
            const EventIcon = meta.Icon
            const isActive = config.evento === opt.id
            return (
              <button
                key={opt.id}
                className={`${styles.eventoCardV2} ${isActive ? styles.eventoCardV2Active : ''}`}
                style={{
                  '--ec':           meta.color,
                  '--ec-lo':        hexAlpha(meta.color, 0.35),
                  '--ec-hi':        hexAlpha(meta.color, 0.85),
                  '--ec-bg':        hexAlpha(meta.color, 0.06),
                  '--ec-hover':     hexAlpha(meta.color, 0.10),
                  '--ec-active-bg': hexAlpha(meta.color, 0.13),
                  '--ec-glow':      hexAlpha(meta.color, 0.18),
                }}
                onClick={() => setConfig(c => ({ ...c, evento: opt.id }))}
              >
                <div className={styles.eventoCardV2Header}>
                  <span className={styles.eventoCardCode}>{opt.id}</span>
                  <EventIcon size={18} style={{ color: meta.color, opacity: isActive ? 1 : 0.45, flexShrink: 0 }} />
                </div>
                <p className={styles.eventoDesc}>{opt.desc}</p>
                {isActive && <div className={styles.eventoCheck}><Check size={11} /></div>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ZONA 3 — Ambiente */}
      <div className={`${styles.step1ZonaAmb} ${ambiente === 'producao' ? styles.step1ZonaAmbProd : ''}`}>
        <h3 className={styles.step1CardTitle}>
          <span className={styles.s1Num}>4</span>
          <Server size={14} className={styles.step1CardTitleIcon} />
          Ambiente de Transmissão
        </h3>
        <p className={styles.step1CardSub}>
          Selecione onde os dados serão enviados. <strong style={{ color: '#22c55e' }}>Produção = envio real.</strong>
        </p>
        <div className={styles.ambienteToggle}>
          <button
            className={`${styles.ambBtn} ${ambiente === 'homologacao' ? styles.ambBtnHom : ''}`}
            onClick={() => onAmbienteChange('homologacao')}
          >
            Homologação
          </button>
          <button
            className={`${styles.ambBtn} ${styles.ambBtnProdBase} ${ambiente === 'producao' ? styles.ambBtnProd : ''}`}
            onClick={() => onAmbienteChange('producao')}
          >
            <AlertTriangle size={13} /> Produção
          </button>
        </div>
        {ambiente === 'producao' ? (
          <div className={styles.ambWarning} style={{ borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.05)' }}>
            <AlertTriangle size={13} style={{ color: '#22c55e', flexShrink: 0 }} />
            <span style={{ color: '#22c55e' }}>
              <strong>Produção selecionada</strong> — o envio será real e irreversível. Não é um teste.
            </span>
          </div>
        ) : (
          <div className={styles.ambWarning} style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
            <AlertTriangle size={13} style={{ color: '#F59E0B', flexShrink: 0 }} />
            <span style={{ color: '#F59E0B' }}>
              <strong>Homologação</strong> — envio de teste, não valerá como declaração oficial.
            </span>
          </div>
        )}
      </div>

      {/* R-1000: verificação de cadastro — só aparece quando evento=R-1000 */}
      {config.evento === 'R-1000' && (
        <R1kQueryPanel
          cnpj14={config.cnpj.replace(/\D/g, '')}
          certId={config.certId}
          query={r1kQuery}
          onConsultar={onR1kConsultar}
          onUsarRecibo={onR1kUsarRecibo}
        />
      )}
    </div>
  )
}

// ── TotalizadorBar ───────────────────────────────────────────────────────────
function hexToRgba(hex, a) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

// Cores semânticas por tipo de campo — independentes do evento
const TOTCORES = {
  bruto:    '#5b8ff9',  // azul    — valor bruto / total pago
  base:     '#f59e0b',  // âmbar   — base de cálculo
  irrf:     '#E97320',  // laranja — IR retido na fonte
  retencao: '#22c55e',  // verde   — retenção previdenciária
  csrf:     '#a78bfa',  // roxo    — base CSRF
  retCsrf:  '#ef4444',  // vermelho— retenção CSRF
}

function TotalizadorBar({ evento, rows }) {
  const _n  = v => parseFloat((v ?? '').toString().replace(',', '.')) || 0
  const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const count = rows.length
  if (count === 0) return null

  // R-1000: sem valores financeiros — só breakdown por ação
  if (evento === 'R-1000') {
    const enviar  = rows.filter(r => r.acao?.toUpperCase() === 'ENVIAR').length
    const alterar = rows.filter(r => r.acao?.toUpperCase() === 'ALTERAR').length
    const excluir = rows.filter(r => r.acao?.toUpperCase() === 'EXCLUIR').length
    return (
      <motion.div
        className={styles.totalizadorBar}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <div className={styles.totalizadorHeader}>
          <span className={styles.totalizadorLabel}>Totalizadores</span>
          <span className={styles.totalizadorCountBadge}>
            {count} registro{count !== 1 ? 's' : ''}
          </span>
        </div>
        <div className={styles.totalizadorR1kGrid}>
          {enviar  > 0 && <span className={styles.totalizadorAcaoBadge} style={{ background: hexToRgba('#22c55e', 0.1),  color: '#22c55e', borderColor: hexToRgba('#22c55e', 0.3)  }}>{enviar} ENVIAR</span>}
          {alterar > 0 && <span className={styles.totalizadorAcaoBadge} style={{ background: hexToRgba('#f59e0b', 0.1),  color: '#f59e0b', borderColor: hexToRgba('#f59e0b', 0.3)  }}>{alterar} ALTERAR</span>}
          {excluir > 0 && <span className={styles.totalizadorAcaoBadge} style={{ background: hexToRgba('#ef4444', 0.08), color: '#ef4444', borderColor: hexToRgba('#ef4444', 0.25) }}>{excluir} EXCLUIR</span>}
          {enviar === 0 && alterar === 0 && excluir === 0 && (
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Preencha a coluna Ação</span>
          )}
        </div>
      </motion.div>
    )
  }

  let metrics = []
  if (evento === 'R-4010') {
    const vlrRend     = rows.reduce((s, r) => s + _n(r.vlrRend), 0)
    const vlrRendTrib = rows.reduce((s, r) => s + _n(r.vlrRendTrib), 0)
    const vlrIrrf     = rows.reduce((s, r) => s + _n(r.vlrIrrf), 0)
    metrics = [
      { label: 'Vl. Bruto Total', value: brl(vlrRend),     raw: vlrRend,     cor: TOTCORES.bruto },
      { label: 'Vl. Tributável',  value: brl(vlrRendTrib), raw: vlrRendTrib, cor: TOTCORES.base  },
      { label: 'IRRF Retido',     value: brl(vlrIrrf),     raw: vlrIrrf,     cor: TOTCORES.irrf  },
    ]
  } else if (evento === 'R-4020') {
    const vlrRend     = rows.reduce((s, r) => s + _n(r.vlrRend), 0)
    const vlrBaseRet  = rows.reduce((s, r) => s + _n(r.vlrBaseRet), 0)
    const vlrIrrf     = rows.reduce((s, r) => s + _n(r.vlrIrrf), 0)
    const vlrBaseCsrf = rows.reduce((s, r) => s + _n(r.vlrBaseCsrf), 0)
    const vlrRetCsrf  = rows.reduce((s, r) => s + _n(r.vlrRetCsrf), 0)
    metrics = [
      { label: 'Vl. Bruto Total', value: brl(vlrRend),     raw: vlrRend,     cor: TOTCORES.bruto   },
      { label: 'Base IRRF',       value: brl(vlrBaseRet),  raw: vlrBaseRet,  cor: TOTCORES.base    },
      { label: 'IRRF Retido',     value: brl(vlrIrrf),     raw: vlrIrrf,     cor: TOTCORES.irrf    },
      ...(vlrBaseCsrf > 0 ? [
        { label: 'Base CSRF',  value: brl(vlrBaseCsrf), raw: vlrBaseCsrf, cor: TOTCORES.csrf    },
        { label: 'Ret. CSRF',  value: brl(vlrRetCsrf),  raw: vlrRetCsrf,  cor: TOTCORES.retCsrf },
      ] : []),
    ]
  } else if (evento === 'R-2010') {
    const vlrBrutoNF  = rows.reduce((s, r) => s + _n(r.vlrBrutoNF), 0)
    const vlrBaseRet  = rows.reduce((s, r) => s + _n(r.vlrBaseRet), 0)
    const vlrRetencao = rows.reduce((s, r) => s + _n(r.vlrRetencao), 0)
    metrics = [
      { label: 'Vl. Bruto NF',   value: brl(vlrBrutoNF),  raw: vlrBrutoNF,  cor: TOTCORES.bruto    },
      { label: 'Base Cálculo',   value: brl(vlrBaseRet),  raw: vlrBaseRet,  cor: TOTCORES.base     },
      { label: 'Retenção Prev.', value: brl(vlrRetencao), raw: vlrRetencao, cor: TOTCORES.retencao },
    ]
  }

  if (metrics.length === 0) return null

  return (
    <motion.div
      className={styles.totalizadorBar}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className={styles.totalizadorHeader}>
        <span className={styles.totalizadorLabel}>Totalizadores</span>
        <span className={styles.totalizadorCountBadge}>
          {count} registro{count !== 1 ? 's' : ''}
        </span>
      </div>
      <div className={styles.totalizadorGrid}>
        {metrics.map((m, i) => (
          <div
            key={i}
            className={styles.totalizadorCard}
            style={{
              opacity:     m.raw === 0 ? 0.42 : 1,
              background:  hexToRgba(m.cor, 0.09),
              borderColor: hexToRgba(m.cor, 0.28),
            }}
          >
            <span className={styles.totalizadorCardLabel}>{m.label}</span>
            <span className={styles.totalizadorCardValue} style={{ color: m.cor }}>{m.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ── Cores e ícones por evento (escopo de módulo, usado em Step1 e Step2) ────
const EVENTO_META_MAP = {
  'R-4010': { color: '#E97320', Icon: User },
  'R-4020': { color: '#a78bfa', Icon: Building2 },
  'R-2010': { color: '#22c55e', Icon: FileText },
  'R-1000': { color: '#5b8ff9', Icon: BookOpen },
}

// ── Step 2 ──────────────────────────────────────────────────────────────────
const CHUNK_SIZE = 100 // linhas por chunk ao processar planilha grande

function Step2({
  config,
  dadosMode,
  setDadosMode,
  planilha,
  setPlanilha,
  tabelaRows,
  setTabelaRows,
  validationError,
  cnpjDefault,
  perApurDefault,
  parseError,
  setParseError,
  lockedCnpjCols = [],
}) {
  const eventConfig = EVENT_CONFIGS[config.evento]
  const columns = eventConfig?.columns ?? []
  const cnpjFieldKey = getCnpjFieldKey(config.evento)
  const rowDefaults = {
    ...(cnpjDefault ? { [cnpjFieldKey]: cnpjDefault } : {}),
    ...(perApurDefault ? { perApur: perApurDefault } : {}),
  }
  const [parseProgress, setParseProgress] = useState(null) // { current, total } | null

  // Aviso se alguma linha importada tiver perApur diferente do configurado no Step1
  const perApurMismatch = perApurDefault && tabelaRows.length > 0
    ? tabelaRows.filter(r => r.perApur && r.perApur !== perApurDefault).length
    : 0

  async function handlePlanilhaFile(file) {
    setPlanilha(file)
    setParseError(null)
    if (!file || !config.evento) { setParseProgress(null); return }

    // Mostra loading ANTES do trabalho síncrono do XLSX
    setParseProgress({ current: 0, total: 0 })
    // Yield de 50ms para o React renderizar a tela de loading antes de travar a thread
    await new Promise(resolve => setTimeout(resolve, 50))

    try {
      const buf = await file.arrayBuffer()
      // XLSX.read é síncrono — pode travar a thread por ~1-2s em planilhas grandes
      const wb = XLSX.read(buf, { type: 'array' })

      // 1. Encontra a aba correta pelo evento (ex: "R4010", "R-4010", "r4010")
      const eventKey = config.evento.replace('-', '').toUpperCase()
      const sheetName =
        wb.SheetNames.find(n => n.replace(/[-\s]/g, '').toUpperCase() === eventKey) ??
        wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]

      if (!ws) {
        setParseError(`Aba para ${config.evento} não encontrada na planilha.`)
        return
      }

      // 2. Converte para matriz
      const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, raw: false })
      if (!matrix || matrix.length < 2) {
        setParseError('Planilha sem dados (mínimo 1 linha de cabeçalho + 1 linha de dados).')
        return
      }

      // 3. Mapeia índice de coluna → chave do campo
      const rawHeaders = matrix[0]
      const headerMap = PLANILHA_HEADER_MAP[config.evento] ?? {}
      const idxToKey = {}

      rawHeaders.forEach((h, idx) => {
        const nH = normHeader(h)
        if (headerMap[nH]) { idxToKey[idx] = headerMap[nH]; return }
        const prefixKey = Object.keys(headerMap).find(k => nH.startsWith(k + ' '))
        if (prefixKey) { idxToKey[idx] = headerMap[prefixKey]; return }
        const colMatch = columns.find(c => normHeader(c.label) === nH)
        if (colMatch) { idxToKey[idx] = colMatch.key; return }
        if (nH) console.warn(`[Planilha] header não mapeado (col ${idx}): "${nH}" (original: "${h}")`)
      })

      if (Object.keys(idxToKey).length === 0) {
        setParseError(
          `Nenhuma coluna reconhecida na aba "${sheetName}". ` +
          'Use a Planilha Modelo MLEGATE para este evento.'
        )
        return
      }

      // 4. Monta linhas em chunks para manter UI responsiva
      const totalRows = matrix.length - 1
      setParseProgress({ current: 0, total: totalRows })

      const rows = []
      for (let i = 1; i < matrix.length; i += CHUNK_SIZE) {
        // Yield para o browser re-renderizar antes do próximo chunk
        await new Promise(resolve => setTimeout(resolve, 0))

        const end = Math.min(i + CHUNK_SIZE, matrix.length)
        for (let j = i; j < end; j++) {
          const cells = matrix[j]
          const row = {}
          for (const [idx, key] of Object.entries(idxToKey)) {
            row[key] = fieldPostProcess(key, cellStr(cells[idx]))
          }
          if (Object.values(row).some(v => v !== '')) rows.push(row)
        }
        setParseProgress({ current: Math.min(i + CHUNK_SIZE - 1, totalRows), total: totalRows })
      }

      setParseProgress(null)
      if (rows.length === 0) { setParseError('Nenhuma linha de dados encontrada na planilha.'); return }
      setTabelaRows(rows)
      setDadosMode('tabela')
    } catch (err) {
      setParseProgress(null)
      setParseError('Erro ao ler o arquivo: ' + (err?.message ?? 'verifique se é um Excel ou CSV válido.'))
    }
  }

  function loadMockData() {
    const mockRows = MOCK_TABLE_ROWS[config.evento] ?? []
    if (cnpjDefault) {
      setTabelaRows(mockRows.map(r => ({ ...r, [cnpjFieldKey]: cnpjDefault })))
    } else {
      setTabelaRows(mockRows)
    }
  }

  function addDebugRow() {
    const mockRows = MOCK_TABLE_ROWS[config.evento] ?? []
    if (!mockRows.length) return
    const base = mockRows[tabelaRows.length % mockRows.length]
    const row = { ...base }
    if (perApurDefault) {
      row.perApur = perApurDefault
      const [year, month] = perApurDefault.split('-')
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
      if ('dtFg' in row) row.dtFg = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
      if ('dtEmissaoNF' in row) row.dtEmissaoNF = `${year}-${month}-10`
    }
    if (cnpjDefault) row[cnpjFieldKey] = cnpjDefault
    setTabelaRows(prev => [...prev, row])
  }

  if (parseProgress !== null) {
    const indeterminate = parseProgress.total === 0
    const pct = !indeterminate
      ? Math.round((parseProgress.current / parseProgress.total) * 100)
      : 0
    return (
      <div className={styles.stepContent}>
        <div className={styles.parseLoadingWrap}>
          <FileSpreadsheet size={36} className={styles.parseLoadingIcon} />
          <h3 className={styles.parseLoadingTitle}>
            {indeterminate ? 'Abrindo planilha…' : 'Lendo linhas…'}
          </h3>
          <div className={styles.parseProgressBarTrack}>
            <div
              className={`${styles.parseProgressBarFill} ${indeterminate ? styles.parseProgressBarIndeterminate : ''}`}
              style={indeterminate ? undefined : { width: `${pct}%` }}
            />
          </div>
          <p className={styles.parseProgressText}>
            {indeterminate
              ? 'Aguarde, isso pode levar alguns segundos em planilhas grandes…'
              : `${parseProgress.current.toLocaleString('pt-BR')} de ${parseProgress.total.toLocaleString('pt-BR')} linhas · ${pct}%`
            }
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepHeroRow}>
        <div>
          <h2 className={styles.stepQuestion}>Como você vai fornecer os dados?</h2>
          <p className={styles.stepSub}>
            Evento{' '}
            <strong style={{ color: EVENTO_META_MAP[config.evento]?.color ?? 'var(--accent)' }}>
              {eventConfig?.label}
            </strong>
          </p>
        </div>
        <div className={styles.modeTabs}>
          <button
            className={`${styles.modeTab} ${dadosMode === 'upload' ? styles.modeTabActive : ''}`}
            onClick={() => setDadosMode('upload')}
          >
            <Upload size={13} /> Planilha
          </button>
          <button
            className={`${styles.modeTab} ${dadosMode === 'tabela' ? styles.modeTabActive : ''}`}
            onClick={() => setDadosMode('tabela')}
          >
            <TableProperties size={13} /> Inserção Direta
          </button>
        </div>
      </div>

      {validationError && (
        <div className={styles.validationBanner}>
          <AlertTriangle size={14} />
          <span>{validationError}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {dadosMode === 'upload' ? (
          <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className={styles.modeloWarning}>
              <AlertTriangle size={15} className={styles.modeloWarningIcon} />
              <div className={styles.modeloWarningText}>
                <strong>Atenção:</strong> Para importar via planilha, utilize exclusivamente a{' '}
                <strong>Planilha Modelo MLEGATE</strong>. O arquivo deve seguir o formato do evento{' '}
                <strong>{config.evento || 'selecionado'}</strong>.
              </div>
              <a
                className={styles.downloadModeloBtn}
                href="/Planilha_Modelo_REINF.xlsx"
                download="Planilha_Modelo_REINF.xlsx"
                title="Baixar planilha modelo"
              >
                <Download size={13} /> Baixar modelo
              </a>
            </div>
            <UploadZone type="excel" file={planilha} onFile={handlePlanilhaFile} />
            {planilha && !parseError && tabelaRows.length > 0 && (
              <div className={styles.parseSuccess}>
                <CheckCircle2 size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span>
                  <strong>{tabelaRows.length} linha{tabelaRows.length !== 1 ? 's' : ''}</strong> importada{tabelaRows.length !== 1 ? 's' : ''} com sucesso — visualizando na aba de inserção direta.
                </span>
              </div>
            )}
            {parseError && (
              <div className={styles.validationBanner}>
                <AlertTriangle size={14} />
                <span>{parseError}</span>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="tabela" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={styles.tabelaWrap}>
            {planilha && !parseError && tabelaRows.length > 0 && (
              <div className={styles.parseSuccess}>
                <CheckCircle2 size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span>
                  <strong>{tabelaRows.length} linha{tabelaRows.length !== 1 ? 's' : ''}</strong> importada{tabelaRows.length !== 1 ? 's' : ''} de <em>{planilha.name}</em>. Revise antes de enviar.
                </span>
              </div>
            )}
            {perApurMismatch > 0 && (
              <div className={styles.perApurWarnBanner}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>
                  <strong>{perApurMismatch} linha{perApurMismatch !== 1 ? 's' : ''}</strong> com período diferente do configurado no Step 1 ({perApurDefault}). Verifique antes de enviar.
                </span>
              </div>
            )}
            <div className={styles.tabelaHeader}>
              <span className={styles.tabelaHint}>
                Campos <span style={{ color: 'var(--accent)' }}>*</span> são obrigatórios · Hover para ver erros
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {import.meta.env.DEV && (
                  <>
                    <button className={styles.debugAddBtn} onClick={addDebugRow} disabled={!config.evento} title="Adiciona uma linha pré-preenchida para teste (cycling pelas linhas de exemplo)">
                      <FlaskConical size={12} /> + Linha de teste
                    </button>
                    <button className={styles.mockBtn} onClick={loadMockData}>
                      Carregar exemplo
                    </button>
                  </>
                )}
                {tabelaRows.length > 0 && (
                  <button
                    className={styles.clearTableBtn}
                    onClick={() => setTabelaRows([])}
                    title="Limpar todas as linhas"
                  >
                    <Trash2 size={12} /> Limpar
                  </button>
                )}
              </div>
            </div>
            <SpreadsheetEditor
              columns={columns}
              rows={tabelaRows}
              onChange={setTabelaRows}
              rowDefaults={rowDefaults}
              perApurExpected={perApurDefault || null}
              lockedCols={lockedCnpjCols}
            />
            <TotalizadorBar evento={config.evento} rows={tabelaRows} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Step 3 ──────────────────────────────────────────────────────────────────
function Step3({ config, dadosMode, planilha, tabelaRows, ambiente, certificados }) {
  const cert = certificados?.find(c => c.id === config.certId)
  const inclusoes    = dadosMode === 'tabela' ? tabelaRows.filter(r => r.acao === 'ENVIAR').length : null
  const retificacoes = dadosMode === 'tabela' ? tabelaRows.filter(r => r.acao === 'ALTERAR').length : null
  const exclusoes    = dadosMode === 'tabela' ? tabelaRows.filter(r => r.acao === 'EXCLUIR').length : null

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepHero}>
        <h2 className={styles.stepQuestion}>Revise e confirme o envio.</h2>
        <p className={styles.stepSub}>Verifique as informações abaixo antes de transmitir à Receita Federal.</p>
      </div>

      <div className={styles.reviewCard}>
        <div className={styles.reviewBanner}>
          <div className={styles.reviewBannerInner}>
            <span className={styles.reviewEventoBig}>{config.evento}</span>
            <div>
              <p className={styles.reviewSentence}>
                Você está prestes a transmitir{' '}
                <strong>{dadosMode === 'tabela' ? `${tabelaRows.length} evento(s)` : 'os dados da planilha'}</strong>{' '}
                para o CNPJ <strong>{config.cnpj || '—'}</strong> no ambiente de{' '}
                <strong style={{ color: ambiente === 'producao' ? '#F59E0B' : 'var(--accent)' }}>
                  {ambiente === 'producao' ? 'Produção' : 'Homologação'}
                </strong>.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.reviewGrid}>
          {[
            ['Evento',        config.evento || '—'],
            ['CNPJ',          config.cnpj   || '—'],
            ['Certificado',   cert?.nome    ?? '—'],
            ['Fonte de dados', dadosMode === 'upload' ? 'Planilha Excel' : 'Inserção direta'],
            ['Total de eventos', dadosMode === 'tabela' ? String(tabelaRows.length) : 'Ver planilha'],
            ['Ambiente',      ambiente === 'producao' ? 'Produção' : 'Homologação'],
          ].map(([k, v]) => (
            <div key={k} className={styles.reviewRow}>
              <span className={styles.reviewKey}>{k}</span>
              <span
                className={styles.reviewVal}
                style={k === 'Ambiente' && ambiente === 'producao' ? { color: '#22c55e' } : {}}
              >
                {v}
              </span>
            </div>
          ))}
        </div>

        {dadosMode === 'tabela' && tabelaRows.length > 0 && (
          <div className={styles.reviewBreakdown}>
            {inclusoes    > 0 && <span className={styles.bdEnviar}><CheckCircle2 size={11} /> {inclusoes} inclusão{inclusoes !== 1 ? 'ões' : ''}</span>}
            {retificacoes > 0 && <span className={styles.bdAlterar}><RotateCcw size={11} /> {retificacoes} retificação{retificacoes !== 1 ? 'ões' : ''}</span>}
            {exclusoes    > 0 && <span className={styles.bdExcluir}><XCircle size={11} /> {exclusoes} exclusão{exclusoes !== 1 ? 'ões' : ''}</span>}
          </div>
        )}

        {ambiente === 'producao' && (
          <div className={styles.prodWarning}>
            <AlertTriangle size={14} />
            <span>Você está no ambiente de <strong>Produção</strong>. O envio será real e irreversível.</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step 4: Verificação Prévia ────────────────────────────────────────────────
const VER_MSGS = [
  'Lendo os dados do envio…',
  'Verificando CPFs e CNPJs…',
  'Checando períodos e datas…',
  'Montando XMLs dos eventos…',
  'Verificando consistência dos dados…',
  'Análise concluída.',
]

function StepVerificacao({ validacaoLoading, validacaoResult, onConfirmarEnvio, onCorrigir }) {
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    if (validacaoLoading) setMsgIdx(0)
  }, [validacaoLoading])

  useEffect(() => {
    if (!validacaoLoading) return
    const timer = setInterval(() => {
      setMsgIdx(i => (i < VER_MSGS.length - 1 ? i + 1 : i))
    }, 850)
    return () => clearInterval(timer)
  }, [validacaoLoading])

  // ── Loading ──
  if (validacaoLoading) {
    return (
      <div className={styles.stepContent}>
        <motion.div className={styles.doneScreen} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className={styles.doneIconWrap} style={{ background: 'rgba(233,115,32,0.12)', color: 'var(--accent)', border: 'none' }}>
            <Loader2 size={44} className={styles.spin} />
          </div>
          <div className={styles.stepHero} style={{ textAlign: 'center', alignItems: 'center' }}>
            <h2 className={styles.stepQuestion}>Analisando seus dados…</h2>
            <p className={styles.stepSub}>Verificando todas as linhas antes de enviar à Receita Federal. Aguarde.</p>
          </div>
          <div className={styles.verMsgList}>
            {VER_MSGS.slice(0, msgIdx + 1).map((msg, i) => (
              <motion.div
                key={i}
                className={styles.verMsgItem}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                style={{ color: i === msgIdx ? 'var(--text-primary)' : 'var(--text-muted)' }}
              >
                {i < msgIdx
                  ? <CheckCircle2 size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  : <Loader2 size={13} className={styles.spin} style={{ flexShrink: 0 }} />
                }
                <span>{msg}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    )
  }

  if (!validacaoResult) return null

  // ── Sucesso ──
  if (validacaoResult.valido) {
    const r = validacaoResult.resumo
    return (
      <div className={styles.stepContent}>
        <motion.div className={styles.doneScreen} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
          <div className={`${styles.doneIconWrap} ${styles.doneIconSuccess}`}>
            <ShieldCheck size={44} />
          </div>
          <div className={styles.stepHero} style={{ textAlign: 'center', alignItems: 'center' }}>
            <h2 className={styles.stepQuestion}>Tudo certo! Dados verificados.</h2>
            <p className={styles.stepSub}>
              Verificamos <strong>{r.total} evento(s)</strong> e <strong>nenhum problema foi encontrado</strong>.
              {' '}Nenhum erro de formato ou inconsistência detectado.
            </p>
          </div>
          {r.total > 0 && (
            <div className={styles.reviewBreakdown}>
              {r.enviar  > 0 && <span className={styles.bdEnviar}><CheckCircle2 size={11} /> {r.enviar} inclusão{r.enviar !== 1 ? 'ões' : ''}</span>}
              {r.alterar > 0 && <span className={styles.bdAlterar}><RotateCcw size={11} /> {r.alterar} retificação{r.alterar !== 1 ? 'ões' : ''}</span>}
              {r.excluir > 0 && <span className={styles.bdExcluir}><XCircle size={11} /> {r.excluir} exclusão{r.excluir !== 1 ? 'ões' : ''}</span>}
            </div>
          )}
          <div className={styles.verSuccessBanner}>
            <ShieldCheck size={14} style={{ flexShrink: 0 }} />
            <span>XMLs montados com sucesso · Nenhum erro de formato ou campo obrigatório encontrado</span>
          </div>
          <div className={styles.verScopeNote}>
            <Info size={13} style={{ flexShrink: 0 }} />
            <span>Esta verificação confirma formato, CPFs, CNPJs, datas e consistência de valores. A aceitação definitiva é feita pela Receita Federal após o envio real.</span>
          </div>
          <motion.div className={styles.doneActions} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <button
              className={styles.nextBtn}
              onClick={onConfirmarEnvio}
              style={{ background: 'linear-gradient(135deg,#E97320,#F58B44)', border: 'none', padding: '0.75rem 1.5rem', fontSize: '0.92rem' }}
            >
              <Send size={14} /> Confirmar e Enviar para a Receita Federal
            </button>
            <button className={styles.prevBtn} onClick={onCorrigir}>
              <ArrowLeft size={14} /> Voltar e revisar
            </button>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  // ── Erros ──
  const erros = validacaoResult.erros ?? []
  return (
    <div className={styles.stepContent}>
      <motion.div className={styles.doneScreen} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
        <div className={`${styles.doneIconWrap} ${styles.doneIconError}`}>
          <AlertTriangle size={44} />
        </div>
        <div className={styles.stepHero} style={{ textAlign: 'center', alignItems: 'center' }}>
          <h2 className={styles.stepQuestion}>
            {erros.length === 1 ? '1 problema encontrado.' : `${erros.length} problemas encontrados.`}
          </h2>
          <p className={styles.stepSub} style={{ color: 'var(--error)' }}>
            Corrija os erros abaixo antes de enviar. A Receita Federal <strong>rejeitaria</strong> este lote com esses dados.
          </p>
        </div>
        <div className={styles.verErroList}>
          <div className={styles.verErroHeader}>
            <span>Origem</span>
            <span>Descrição do problema</span>
          </div>
          {erros.map((e, i) => (
            <motion.div
              key={i}
              className={styles.verErroItem}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <span className={styles.verErroLinha}>
                {e.linha > 0 ? `Linha ${e.linha}` : 'Geral'}
              </span>
              <span className={styles.verErroMsg}>{e.mensagem}</span>
            </motion.div>
          ))}
        </div>
        <motion.div className={styles.doneActions} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <button className={styles.resetBtn} onClick={onCorrigir}>
            <ArrowLeft size={14} /> Corrigir os dados
          </button>
          <button
            className={styles.downloadErrosBtn}
            onClick={() => {
              const now = new Date().toLocaleString('pt-BR')
              const linhas = erros.map(e =>
                `${e.linha > 0 ? `Linha ${String(e.linha).padStart(4, ' ')}` : 'Geral   '} | ${e.mensagem}`
              ).join('\n')
              const txt = `RELATÓRIO DE ERROS — Verificação Prévia\nData: ${now}\nTotal de erros: ${erros.length}\n\n${'─'.repeat(72)}\n${linhas}\n${'─'.repeat(72)}\n`
              const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `erros-verificacao-${new Date().toISOString().slice(0,10)}.txt`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            <Download size={14} /> Baixar relatório de erros
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}

// ── Step 5: Envio ─────────────────────────────────────────────────────────────
const EVENTO_COLORS = { 'R-4010':'#f97316','R-4020':'#a78bfa','R-2010':'#22c55e','R-1000':'#5b8ff9' }

function fmtDhRecepcao(s) {
  if (!s) return null
  try { return new Date(s).toLocaleString('pt-BR') } catch { return s }
}

function EventoRow({ ev, idx }) {
  const hasOcorrencias = ev.ocorrencias?.length > 0
  const isOk = ev.status === 'ACEITO'
  // Eventos com erro ficam expandidos por padrão
  const [open, setOpen] = useState(!isOk && hasOcorrencias)

  return (
    <>
      <motion.tr
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: idx * 0.04 }}
        className={`${styles.resRow} ${isOk ? styles.resRowOk : styles.resRowErr}`}
      >
        <td>
          <span className={styles.eventoTagSm} style={{ background: `${EVENTO_COLORS[ev.tipo] ?? '#8B95A5'}18`, color: EVENTO_COLORS[ev.tipo] ?? '#8B95A5' }}>
            {ev.tipo}
          </span>
        </td>
        <td className={styles.resTdMono} style={{ fontSize: '0.75rem' }}>{ev.id || '—'}</td>
        <td>
          {isOk
            ? <span className={styles.stSuccess}><CheckCircle2 size={11} /> Aceito</span>
            : <span className={styles.stError}><XCircle size={11} /> {ev.status === 'ERRO' ? 'Erro' : 'Rejeitado'}</span>
          }
        </td>
        <td className={styles.resTdMono}>
          {ev.nrRecibo
            ? <code className={styles.recibo}>{ev.nrRecibo}</code>
            : ev.mensagem
              ? <span style={{ color: 'var(--error)', fontSize: '0.78rem' }}>{ev.mensagem}</span>
              : <span style={{ color: 'var(--text-muted)' }}>—</span>
          }
        </td>
        <td>
          {hasOcorrencias && (
            <button
              onClick={() => setOpen(o => !o)}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '2px 6px', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
            >
              {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {ev.ocorrencias.length} ocorrência{ev.ocorrencias.length !== 1 ? 's' : ''}
            </button>
          )}
        </td>
      </motion.tr>
      {open && hasOcorrencias && ev.ocorrencias.map((oc, j) => (
        <tr key={j} style={{ background: 'rgba(239,68,68,0.06)' }}>
          <td colSpan={5} style={{ padding: '0.6rem 1rem 0.6rem 2rem', borderTop: 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {oc.codigo && (
                <span style={{ fontSize: '0.72rem', color: 'var(--error)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Código {oc.codigo}
                </span>
              )}
              {oc.descricao && (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>
                  {oc.descricao}
                </span>
              )}
              {oc.localizacao && (
                <code style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.25)', padding: '2px 8px', borderRadius: 4, display: 'block', wordBreak: 'break-all' }}>
                  {oc.localizacao}
                </code>
              )}
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}

// Formata valor em BRL
function fmtBRL(val) {
  if (!val || val === 0) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Computa totais financeiros a partir das linhas do wizard
function computeTotais(rows, evento) {
  const parse = s => {
    if (!s) return 0
    return parseFloat(String(s).replace(',', '.')) || 0
  }
  let vlrBruto = 0, vlrIrrf = 0, vlrInss = 0, vlrCsrf = 0
  rows.forEach(r => {
    if (evento === 'R-4010') {
      vlrBruto += parse(r.vlrRend)
      vlrIrrf  += parse(r.vlrIrrf)
    } else if (evento === 'R-4020') {
      vlrBruto += parse(r.vlrRend)
      vlrIrrf  += parse(r.vlrIrrf)
      vlrCsrf  += parse(r.vlrRetCsrf)
    } else if (evento === 'R-2010') {
      vlrBruto += parse(r.vlrBrutoNF)
      vlrInss  += parse(r.vlrRetencao)
    }
  })
  return { vlrBruto, vlrIrrf, vlrInss, vlrCsrf }
}

function Step4({
  envioResponse, processando, erroEnvio,
  consultaResult, consultaLoading, consultaTentativa, consultaTimeout,
  onReset, onDashboard, onConsulta, onCorrigir, tabelaRows, evento,
}) {
  const [copied, setCopied] = useState(false)

  function copyProtocolo() {
    const proto = envioResponse?.protocolo
    if (!proto) return
    navigator.clipboard.writeText(proto).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── 1. Transmitindo ────────────────────────────────────────────────────────
  if (processando) {
    return (
      <div className={styles.stepContent}>
        <motion.div className={styles.doneScreen} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className={styles.doneIconWrap} style={{ background: 'rgba(233,115,32,0.12)', color: 'var(--accent)', border: 'none' }}>
            <Loader2 size={44} className={styles.spin} />
          </div>
          <div className={styles.stepHero} style={{ textAlign: 'center', alignItems: 'center' }}>
            <h2 className={styles.stepQuestion}>Transmitindo para a Receita Federal…</h2>
            <p className={styles.stepSub}>Aguarde — assinando XML e enviando ao endpoint REINF.</p>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── 2. Erro de transmissão ────────────────────────────────────────────────
  if (erroEnvio) {
    return (
      <div className={styles.stepContent}>
        <motion.div className={styles.doneScreen} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
          <div className={`${styles.doneIconWrap} ${styles.doneIconError}`}><XCircle size={44} /></div>
          <div className={styles.stepHero} style={{ textAlign: 'center', alignItems: 'center' }}>
            <h2 className={styles.stepQuestion}>Erro ao transmitir.</h2>
            <p className={styles.stepSub} style={{ color: 'var(--error)' }}>{erroEnvio}</p>
          </div>
          <motion.div className={styles.doneActions} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <button className={styles.prevBtn} onClick={onCorrigir}><ArrowLeft size={14} /> Corrigir os dados</button>
            <button className={styles.resetBtn} onClick={onReset}><RotateCcw size={14} /> Tentar novamente</button>
            <button className={styles.dashBtn} onClick={onDashboard}><LayoutDashboard size={14} /> Voltar ao Início</button>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  if (!envioResponse) return null

  // ── 3. Aguardando processamento RF (polling) ───────────────────────────────
  if (consultaLoading) {
    return (
      <div className={styles.stepContent}>
        <motion.div className={styles.doneScreen} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className={styles.consultandoRing}>
            <Loader2 size={36} className={styles.spin} />
          </div>
          <div className={styles.stepHero} style={{ textAlign: 'center', alignItems: 'center' }}>
            <h2 className={styles.stepQuestion}>Aguardando processamento da Receita Federal</h2>
            <p className={styles.stepSub}>Lote recebido com sucesso. Consultando resultado…</p>
          </div>
          <div className={styles.consultandoMeta}>
            <div className={styles.consultandoProtocolo}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Protocolo</span>
              <code style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 700 }}>{envioResponse.protocolo}</code>
            </div>
            <span className={styles.consultandoTentativa}>
              Tentativa {consultaTentativa} de 15 · aguardando resposta da RF…
            </span>
          </div>
          <div className={styles.consultandoLog}>
            {Array.from({ length: consultaTentativa }, (_, i) => (
              <div key={i} className={styles.consultandoLogLine}>
                <span className={styles.consultandoLogNum}>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.consultandoLogMsg}>
                  {i + 1 < consultaTentativa
                    ? '↩ Ainda em processamento — aguardando…'
                    : '⟳ Consultando RF…'}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    )
  }

  // Se temos resultado da consulta, usa ele; se não (timeout ou sem protocolo), usa resposta do envio
  const fromConsulta = !!consultaResult
  const eventosBrutos = fromConsulta
    ? (consultaResult.eventos ?? [])
    : (envioResponse.eventos ?? [])

  // Normaliza os campos: ConsultaResultDto usa eventoId/nrRec/cdResposta; EnvioResponse usa id/nrRecibo/status
  const eventos = fromConsulta
    ? eventosBrutos.map(e => {
        const origEv = (envioResponse?.eventos ?? []).find(o => o.id === e.eventoId)
        return {
          id:          e.eventoId,
          tipo:        origEv?.tipo ?? evento,
          status:      e.cdResposta === '100' || e.cdResposta === '101' || e.cdResposta === '0' ? 'ACEITO' : 'ERRO',
          nrRecibo:    e.nrRec,
          mensagem:    e.dsResposta,
          ocorrencias: (e.ocorrencias ?? []).map(o => ({
            tipo:       o.tipo,
            codigo:     o.codigo,
            descricao:  o.descricao,
            localizacao: o.localizacao,
          })),
        }
      })
    : eventosBrutos

  const aceitos    = eventos.filter(e => e.status === 'ACEITO').length
  const rejeitados = eventos.filter(e => e.status !== 'ACEITO').length
  const totalEvt   = eventos.length

  // Status display — se veio da consulta, usa situacaoDescricao; caso contrário usa envioResponse
  const statusDisplay = fromConsulta
    ? (aceitos === totalEvt && totalEvt > 0 ? 'ACEITO' : rejeitados === totalEvt ? 'REJEITADO' : 'PARCIAL')
    : envioResponse.status
  const isPartial = statusDisplay === 'PARCIAL'
  const isError   = statusDisplay === 'REJEITADO' || statusDisplay === 'ERRO'
  const isSuccess = !isPartial && !isError

  // Timeout: RF não respondeu — mostra o que temos do envio inicial
  const isTimeoutState = consultaTimeout && !consultaResult

  const titleMap = {
    ACEITO:    'Missão cumprida.',
    PARCIAL:   'Lote processado com ocorrências.',
    REJEITADO: 'Transmissão rejeitada.',
    ERRO:      'Erro na transmissão.',
  }
  const title = isTimeoutState
    ? 'Lote enviado — processamento em andamento.'
    : titleMap[statusDisplay] ?? 'Resultado do envio'

  // Totais financeiros calculados a partir das linhas originais
  const totais = computeTotais(tabelaRows ?? [], evento ?? '')
  const temFinanceiro = (totais.vlrBruto + totais.vlrIrrf + totais.vlrInss + totais.vlrCsrf) > 0
  const totalImpostos = totais.vlrIrrf + totais.vlrInss + totais.vlrCsrf

  const statusColor = isSuccess ? 'var(--success)' : isPartial ? '#f59e0b' : 'var(--error)'

  return (
    <div className={styles.stepContent}>
      <motion.div
        className={styles.resultReport}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      >

        {/* ── Hero Status Banner ── */}
        <div className={styles.resultHero} style={{ '--status-color': statusColor }}>
          <div className={styles.resultHeroLeft}>
            <div className={`${styles.resultHeroIcon} ${isSuccess ? styles.heroIconSuccess : isPartial ? styles.heroIconPartial : styles.heroIconError}`}>
              {isSuccess ? <CheckCircle2 size={34} /> : isPartial ? <AlertTriangle size={34} /> : <XCircle size={34} />}
            </div>
            <div className={styles.resultHeroText}>
              <h2 className={styles.resultTitle}>{title}</h2>
              {isTimeoutState ? (
                <p className={styles.resultSub} style={{ color: '#f59e0b' }}>
                  A Receita Federal ainda não retornou o resultado. Use a aba Consulta com o protocolo abaixo para verificar depois.
                </p>
              ) : fromConsulta ? (
                <p className={styles.resultSub} style={{ color: isPartial ? '#f59e0b' : isError ? 'var(--error)' : 'var(--text-muted)' }}>
                  {rejeitados > 0 && aceitos > 0
                    ? `${aceitos} evento(s) aceito(s) · ${rejeitados} com erro(s).`
                    : rejeitados > 0
                      ? `${rejeitados} evento(s) rejeitado(s) pela Receita Federal.`
                      : `${aceitos} evento(s) aceito(s) com sucesso.`}
                </p>
              ) : envioResponse.descResposta ? (
                <p className={styles.resultSub} style={{ color: isPartial ? '#f59e0b' : isError ? 'var(--error)' : 'var(--text-muted)' }}>
                  {envioResponse.descResposta}
                </p>
              ) : null}
            </div>
          </div>
          <div className={styles.resultHeroBadges}>
            {evento && (
              <span
                className={styles.resultEventoBadge}
                style={{ color: EVENTO_COLORS[evento] ?? '#8B95A5', borderColor: `${EVENTO_COLORS[evento] ?? '#8B95A5'}55` }}
              >
                {evento}
              </span>
            )}
            <span
              className={styles.resultStatusBadge}
              style={{ color: statusColor, background: `${statusColor}18`, borderColor: `${statusColor}45` }}
            >
              {statusDisplay}
            </span>
          </div>
        </div>

        {/* ── Two-column grid: Metrics | Metadata ── */}
        <div className={styles.resultMidGrid}>

          {/* Métricas */}
          <div className={styles.resultMetricsPanel}>
            <span className={styles.resultSectionLabel}>Métricas do Lote</span>
            <div className={styles.resultMetricRow}>
              <div className={styles.resultMetric}>
                <span className={styles.resultMetricNum}>{totalEvt}</span>
                <span className={styles.resultMetricLbl}>Evento{totalEvt !== 1 ? 's' : ''}</span>
              </div>
              <div className={styles.resultMetricDivider} />
              <div className={styles.resultMetric}>
                <span className={styles.resultMetricNum} style={{ color: 'var(--success)' }}>{aceitos}</span>
                <span className={styles.resultMetricLbl}>Aceito{aceitos !== 1 ? 's' : ''}</span>
              </div>
              <div className={styles.resultMetricDivider} />
              <div className={styles.resultMetric}>
                <span className={styles.resultMetricNum} style={{ color: rejeitados > 0 ? 'var(--error)' : 'var(--text-muted)' }}>{rejeitados}</span>
                <span className={styles.resultMetricLbl}>Rejeitado{rejeitados !== 1 ? 's' : ''}</span>
              </div>
              <div className={styles.resultMetricDivider} />
              <div className={styles.resultMetric}>
                <span className={styles.resultMetricNum} style={{ color: '#5b8ff9' }}>1</span>
                <span className={styles.resultMetricLbl}>Lote</span>
              </div>
            </div>
          </div>

          {/* Metadados */}
          <div className={styles.resultMetaPanel}>
            <span className={styles.resultSectionLabel}>Dados da Recepção</span>
            <div className={styles.resultMetaList}>
              {envioResponse.protocolo && (
                <div className={styles.resultMetaItem}>
                  <span className={styles.resultMetaKey}>Protocolo</span>
                  <div className={styles.resultMetaValRow}>
                    <code className={styles.resultProtocolo}>{envioResponse.protocolo}</code>
                    <button onClick={copyProtocolo} className={styles.resultCopyBtn} title="Copiar protocolo">
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              )}
              {envioResponse.nrInsc && (
                <div className={styles.resultMetaItem}>
                  <span className={styles.resultMetaKey}>CNPJ Inscrito</span>
                  <code className={styles.resultCode}>{envioResponse.nrInsc}</code>
                </div>
              )}
              {envioResponse.dhRecepcao && (
                <div className={styles.resultMetaItem}>
                  <span className={styles.resultMetaKey}><Clock size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />Data Recepção</span>
                  <span className={styles.resultMetaValText}>{fmtDhRecepcao(envioResponse.dhRecepcao)}</span>
                </div>
              )}
              {envioResponse.versaoAplicativo && (
                <div className={styles.resultMetaItem}>
                  <span className={styles.resultMetaKey}><Server size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />Versão RF</span>
                  <span className={styles.resultMetaValMuted}>{envioResponse.versaoAplicativo}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Resumo Financeiro ── */}
        {temFinanceiro && (
          <motion.div
            className={styles.resultFinSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <span className={styles.resultSectionLabel}>
              <Building2 size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
              Resumo Financeiro do Lote
            </span>
            <div className={styles.resultFinGrid}>
              {totais.vlrBruto > 0 && (
                <div className={styles.resultFinCard}>
                  <span className={styles.resultFinLabel}>Valor Bruto Total</span>
                  <span className={styles.resultFinVal}>{fmtBRL(totais.vlrBruto)}</span>
                  <span className={styles.resultFinSub}>
                    Base de cálculo · {(tabelaRows ?? []).filter(r => r.acao !== 'EXCLUIR').length} registro(s)
                  </span>
                </div>
              )}
              {(totais.vlrIrrf > 0 || totais.vlrInss > 0 || totais.vlrCsrf > 0) && (
                <div className={`${styles.resultFinCard} ${styles.resultFinCardAccent}`}>
                  <span className={styles.resultFinLabel}>Total de Impostos Retidos</span>
                  <span className={`${styles.resultFinVal} ${styles.resultFinValAccent}`}>{fmtBRL(totalImpostos)}</span>
                  <span className={styles.resultFinSub}>
                    {totais.vlrIrrf > 0 && `IRRF: ${fmtBRL(totais.vlrIrrf)}`}
                    {totais.vlrIrrf > 0 && totais.vlrInss > 0 && ' · '}
                    {totais.vlrInss > 0 && `INSS: ${fmtBRL(totais.vlrInss)}`}
                    {(totais.vlrIrrf > 0 || totais.vlrInss > 0) && totais.vlrCsrf > 0 && ' · '}
                    {totais.vlrCsrf > 0 && `CSRF: ${fmtBRL(totais.vlrCsrf)}`}
                  </span>
                </div>
              )}
              {totais.vlrBruto > 0 && totalImpostos > 0 && (
                <div className={styles.resultFinCard}>
                  <span className={styles.resultFinLabel}>Alíquota Efetiva</span>
                  <span className={styles.resultFinVal} style={{ color: '#a78bfa' }}>
                    {((totalImpostos / totais.vlrBruto) * 100).toFixed(2).replace('.', ',')}%
                  </span>
                  <span className={styles.resultFinSub}>
                    {fmtBRL(totalImpostos)} retidos sobre {fmtBRL(totais.vlrBruto)} brutos
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Tabela de eventos ── */}
        {eventos.length > 0 && (
          <div className={styles.resultEventsSection}>
            <span className={styles.resultSectionLabel}>Detalhamento dos Eventos</span>
            <div className={styles.resultsWrap}>
              <table className={styles.resTable}>
                <thead>
                  <tr>
                    <th>Evento</th><th>ID</th><th>Status</th><th>Nr. Recibo / Mensagem</th><th>Ocorrências</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.map((ev, i) => <EventoRow key={i} ev={ev} idx={i} />)}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Ações ── */}
        <motion.div className={styles.resultActions} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          {(isError || isPartial) && (
            <button className={styles.prevBtn} onClick={onCorrigir}><ArrowLeft size={14} /> Corrigir os dados</button>
          )}
          <button className={styles.resetBtn} onClick={onReset}><RotateCcw size={14} /> Novo Envio</button>
          <button className={styles.dashBtn} onClick={onDashboard}><LayoutDashboard size={14} /> Voltar ao Início</button>
          {(isTimeoutState || fromConsulta) && onConsulta && envioResponse?.protocolo && (
            <button
              className={styles.dashBtn}
              onClick={() => onConsulta(envioResponse.protocolo)}
              title="Abrir aba de consulta com este protocolo"
              style={isTimeoutState ? { background: '#f59e0b', color: '#000', borderColor: '#f59e0b' } : {}}
            >
              <Search size={13} /> {isTimeoutState ? 'Consultar Agora' : 'Consultar Protocolo'}
            </button>
          )}
          <a
            href="https://cav.receita.fazenda.gov.br/autenticacao/login"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ecacBtn}
            title="Acompanhar processamento no eCAC"
          >
            <ExternalLink size={13} /> Abrir eCAC
          </a>
        </motion.div>
      </motion.div>
    </div>
  )
}

// ── Main Wizard ──────────────────────────────────────────────────────────────
export default function NovoEnvio({ ambiente, onAmbienteChange, onBack, onConsulta, preFill }) {
  const [step, setStep] = useState(preFill ? 2 : 1)
  const nowMM = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })()
  const [config, setConfig] = useState({
    evento: preFill?.evento ?? '',
    cnpj: '',
    certId: preFill?.certId ?? null,
    perApur: nowMM,
    filiais: false,
    empresaId: null,
  })
  const [dadosMode, setDadosMode]   = useState('tabela')
  const [planilha, setPlanilha]     = useState(null)
  const [tabelaRows, setTabelaRows] = useState(preFill?.rows ?? [])
  const [validationError, setValidationError] = useState(null)
  const [parseError, setParseError] = useState(null)

  const [certificados, setCertificados] = useState([])
  const [loadingCerts, setLoadingCerts] = useState(true)
  const [empresasContrib, setEmpresasContrib] = useState([])

  const [processando, setProcessando]         = useState(false)
  const [envioResponse, setEnvioResponse]     = useState(null)
  const [erroEnvio, setErroEnvio]             = useState(null)
  const [showAmbModal, setShowAmbModal]       = useState(false)

  const [validacaoLoading, setValidacaoLoading] = useState(false)
  const [validacaoResult, setValidacaoResult]   = useState(null)

  // Consulta de R-1000 no Step 1
  const [r1kQuery, setR1kQuery] = useState({ loading: false, result: null, error: null })

  // Polling de consulta após envio
  const [consultaResult,    setConsultaResult]    = useState(null)  // ConsultaResultDto
  const [consultaLoading,   setConsultaLoading]   = useState(false) // polling em andamento
  const [consultaTentativa, setConsultaTentativa] = useState(0)
  const [consultaTimeout,   setConsultaTimeout]   = useState(false)

  useEffect(() => {
    listCertificados()
      .then(setCertificados)
      .catch(() => setCertificados([]))
      .finally(() => setLoadingCerts(false))
    listEmpresas()
      .then(emp => setEmpresasContrib(emp.filter(e => e.ativa !== false && !e.isEmissora)))
      .catch(() => setEmpresasContrib([]))
  }, [])

  useEffect(() => {
    if (preFill) {
      setStep(2)
      setConfig(c => ({
        ...c,
        evento: preFill.evento,
        certId: preFill.certId ?? c.certId,
        cnpj:   preFill.nrInscricao ? maskCnpj(preFill.nrInscricao) : c.cnpj,
      }))
      setTabelaRows(preFill.rows ?? [])
      setDadosMode('tabela')
    }
  }, [preFill])


  function canAdvance() {
    if (step === 1) return !!(config.evento && config.certId)
    if (step === 2) return tabelaRows.length > 0  // bloqueado enquanto parsing em andamento
    if (step === 3) return true
    return false
  }

  function handleNext() {
    // Step 1 → 2: confirmar ambiente antes de prosseguir
    if (step === 1) {
      setShowAmbModal(true)
      return
    }

    if (step === 2 && dadosMode === 'tabela') {
      const columns = EVENT_CONFIGS[config.evento]?.columns ?? []
      const allErrors = tabelaRows.map(r => validateRow(r, columns))
      const rowsWithErrors = allErrors.filter(e => Object.keys(e).length > 0).length
      if (rowsWithErrors > 0) {
        setValidationError(`⚠ ${rowsWithErrors} linha(s) com erros. Corrija antes de continuar.`)
        return
      }
      setValidationError(null)
    }

    if (step === 3) {
      runValidar()
      return
    }
    setStep(s => s + 1)
  }

  function confirmAmbModal() {
    setShowAmbModal(false)
    setStep(2)
  }

  // ── R-1000: Consultar cadastro do contribuinte na RF ──────────────────────
  async function handleR1kConsultar() {
    const cnpj14 = config.cnpj.replace(/\D/g, '')
    if (cnpj14.length !== 14 || !config.certId) return
    setR1kQuery({ loading: true, result: null, error: null })
    try {
      const result = await consultarContribuinte(cnpj14, config.certId, ambiente)
      setR1kQuery({ loading: false, result, error: null })
    } catch (err) {
      setR1kQuery({ loading: false, result: null, error: err.message ?? 'Erro ao consultar.' })
    }
  }

  function handleR1kUsarRecibo(nrRecibo) {
    const cnpj14 = config.cnpj.replace(/\D/g, '')
    setConfig(c => ({ ...c, acao: 'ALTERAR' }))
    setTabelaRows([{ cnpj: cnpj14, acao: 'ALTERAR', nrRecibo }])
    setDadosMode('tabela')
    setShowAmbModal(true)
  }

  // Limpa resultado R-1000 quando cnpj, certId, ambiente ou evento mudam
  useEffect(() => {
    setR1kQuery({ loading: false, result: null, error: null })
  }, [config.cnpj, config.certId, config.evento, ambiente])

  // Quando filiais=false e CNPJ tem 14 dígitos, propaga para todas as linhas da tabela
  useEffect(() => {
    if (config.filiais || !config.evento) return
    const digits = config.cnpj.replace(/\D/g, '')
    if (digits.length !== 14) return
    const fieldKey = getCnpjFieldKey(config.evento)
    setTabelaRows(rows => rows.map(r => ({ ...r, [fieldKey]: config.cnpj })))
  }, [config.cnpj, config.filiais, config.evento])

  // Limpa máscaras de CNPJ/CPF e normaliza perApur para envio/validação
  function cleanRows(rows) {
    return rows.map(row => {
      const clean = {}
      for (const [k, v] of Object.entries(row)) {
        const str = v == null ? '' : String(v)
        if (k.startsWith('cnpj') || k.startsWith('cpf')) {
          clean[k] = str.replace(/\D/g, '')
        } else if (k === 'perApur') {
          clean[k] = normalizePeriod(str) ?? str
        } else {
          clean[k] = str
        }
      }
      return clean
    })
  }

  const runValidar = useCallback(async () => {
    setStep(4)
    setValidacaoLoading(true)
    setValidacaoResult(null)

    try {
      const result = await validar({
        certificateId: config.certId,
        evento: config.evento,
        ambiente,
        rows: cleanRows(tabelaRows),
      })
      setValidacaoResult(result)
    } catch (e) {
      const msg = /fetch|network|failed/i.test(e.message)
        ? 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
        : e.message
      setValidacaoResult({
        valido: false,
        erros: [{ linha: 0, mensagem: msg }],
        resumo: { total: 0, enviar: 0, alterar: 0, excluir: 0, erros: 1 },
      })
    } finally {
      setValidacaoLoading(false)
    }
  }, [config, ambiente, tabelaRows])

  const runEnvio = useCallback(async () => {
    setStep(5)
    setProcessando(true)
    setEnvioResponse(null)
    setErroEnvio(null)
    setConsultaResult(null)
    setConsultaLoading(false)
    setConsultaTentativa(0)
    setConsultaTimeout(false)

    let result
    try {
      result = await enviar({
        certificateId: config.certId,
        evento: config.evento,
        ambiente,
        rows: cleanRows(tabelaRows),
      })
      setEnvioResponse(result)
    } catch (e) {
      setErroEnvio(e.message)
      setProcessando(false)
      return
    }
    setProcessando(false)

    // Só inicia polling quando cdResposta=1 ou 2 (aguardando/em processamento)
    // cdResposta=3 ou 4 = já processado sincronamente — resultado já está em envioResponse
    if (!result?.protocolo) return
    if (result.cdResposta !== '1' && result.cdResposta !== '2') return

    const MAX_TENTATIVAS = 15
    const DELAY_MS = 3000

    setConsultaLoading(true)
    for (let t = 1; t <= MAX_TENTATIVAS; t++) {
      await new Promise(res => setTimeout(res, DELAY_MS))
      setConsultaTentativa(t)
      try {
        const consulta = await consultarLote(result.protocolo, config.certId, ambiente, config.evento, true)
        // situacaoLote: 1=em processamento, 2=inválido, 3=processado
        if (consulta.situacaoLote === 1) continue

        setConsultaResult(consulta)
        setConsultaLoading(false)

        // Salva o lote completo no banco agora que temos o resultado final da RF
        try {
          // Mescla eventos do envio (tem CnpjCpfBenef/tipo) com os da consulta (tem NrRec/status)
          const eventosFinais = (result.eventos ?? []).map((evOrig, idx) => {
            const evConsulta =
              (consulta.eventos ?? []).find(ec => ec.eventoId && ec.eventoId === evOrig.id)
              ?? consulta.eventos?.[idx]    // fallback posicional quando RF não ecoa o Id
            const cd   = evConsulta?.cdResposta ?? ''
            const nrRec = evConsulta?.nrRec ?? ''
            const aceito = cd === '0' || cd === '100' || cd === '101' || nrRec !== ''
            return {
              id:           evOrig.id,
              tipo:         evOrig.tipo,
              status:       aceito ? 'ACEITO' : 'ERRO',
              nrRecibo:     nrRec || null,
              cnpjCpfBenef: evOrig.cnpjCpfBenef ?? null,
              mensagem:     evOrig.mensagem ?? null,
              ocorrencias:  evConsulta?.ocorrencias?.map(o => ({
                tipo: o.tipo, codigo: o.codigo, descricao: o.descricao, localizacao: o.localizacao,
              })) ?? [],
            }
          })

          const anyErr = eventosFinais.some(e => e.status === 'ERRO')
          const allErr = eventosFinais.length > 0 && eventosFinais.every(e => e.status === 'ERRO')
          const statusFinal = consulta.situacaoLote === 2
            ? 'REJEITADO'
            : allErr ? 'ERRO' : anyErr ? 'PARCIAL' : 'ACEITO'

          const perApur = tabelaRows[0]?.perApur ?? null
          // Sempre usa o CNPJ do contribuinte selecionado no Step 1.
          // result.nrInsc vem da RF como ideTransmissor (CNPJ de quem transmitiu),
          // não do contribuinte — usar ele causaria filtro incorreto no Histórico.
          const nrInscricao = (config.cnpj || '').replace(/\D/g, '')

          await finalizarLote({
            protocolo:     result.protocolo,
            tpEnvio:       config.evento,
            nrInscricao,
            ambiente,
            certificadoId: config.certId,
            perApur,
            status:        statusFinal,
            eventos:       eventosFinais,
            rows:          cleanRows(tabelaRows),
          })
        } catch (finErr) {
          console.warn('Não foi possível salvar lote no histórico:', finErr)
        }

        return
      } catch {
        // falha de rede — continua tentando
      }
    }
    // Timeout — RF não respondeu dentro do limite
    setConsultaLoading(false)
    setConsultaTimeout(true)
  }, [config, ambiente, tabelaRows])

  function handleReset() {
    setStep(1)
    setConfig({ evento: '', cnpj: '', certId: null, perApur: nowMM, filiais: false, empresaId: null })
    setDadosMode('tabela')
    setPlanilha(null)
    setTabelaRows([])
    setValidationError(null)
    setParseError(null)
    setEnvioResponse(null)
    setErroEnvio(null)
    setProcessando(false)
    setValidacaoLoading(false)
    setValidacaoResult(null)
    setConsultaResult(null)
    setConsultaLoading(false)
    setConsultaTentativa(0)
    setConsultaTimeout(false)
  }

  // Error count for badge on step 2 (computed only when table has rows)
  const step2ErrCount = (() => {
    if (!tabelaRows.length || !config.evento) return 0
    const cols = EVENT_CONFIGS[config.evento]?.columns ?? []
    return tabelaRows.reduce((sum, row) => sum + Object.keys(validateRow(row, cols)).length, 0)
  })()

  // Quando filiais=false e CNPJ completo, bloqueia coluna CNPJ na tabela
  const lockedCnpjCols = (!config.filiais && config.cnpj.replace(/\D/g,'').length === 14 && config.evento)
    ? [getCnpjFieldKey(config.evento)]
    : []

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.28 } }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
    >
      {/* Header */}
      <div className={styles.pageHeader}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={14} /> Início
        </button>
        <h1 className={styles.pageTitle}>
          Novo Envio EFD-REINF
          {preFill && <span className={styles.retifBadge}><RotateCcw size={11} /> Retificação</span>}
        </h1>
      </div>

      {/* Stepper */}
      <div className={styles.stepper}>
        {STEPS.map((s, i) => {
          const done    = step > s.n
          const current = step === s.n
          const showErrBadge = s.n === 2 && step2ErrCount > 0 && step >= 2
          return (
            <div key={s.n} className={styles.stepItem}>
              <div className={`${styles.stepCircle} ${done ? styles.stepDone : current ? styles.stepCurrent : styles.stepFuture}`}>
                {done ? <Check size={12} /> : s.n}
              </div>
              <span className={`${styles.stepLabel} ${current ? styles.stepLabelCurrent : ''}`}>
                {s.label}
                {showErrBadge && (
                  <span className={styles.stepErrBadge} title={`${step2ErrCount} erro(s) na tabela de dados`}>
                    {step2ErrCount}
                  </span>
                )}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`${styles.stepLine} ${step > s.n ? styles.stepLineDone : ''}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Card */}
      <div className={styles.card}>
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" {...PAGE}>
              <Step1
                config={config}
                setConfig={setConfig}
                certificados={certificados}
                loadingCerts={loadingCerts}
                ambiente={ambiente}
                onAmbienteChange={onAmbienteChange}
                r1kQuery={r1kQuery}
                onR1kConsultar={handleR1kConsultar}
                onR1kUsarRecibo={handleR1kUsarRecibo}
                empresasContrib={empresasContrib}
              />
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="s2" {...PAGE}>
              <Step2
                config={config}
                dadosMode={dadosMode}
                setDadosMode={setDadosMode}
                planilha={planilha}
                setPlanilha={setPlanilha}
                tabelaRows={tabelaRows}
                setTabelaRows={setTabelaRows}
                validationError={validationError}
                cnpjDefault={config.filiais ? '' : (config.cnpj || '')}
                perApurDefault={config.perApur || ''}
                parseError={parseError}
                setParseError={setParseError}
                lockedCnpjCols={lockedCnpjCols}
              />
            </motion.div>
          )}
          {step === 3 && (
            <motion.div key="s3" {...PAGE}>
              <Step3
                config={config}
                dadosMode={dadosMode}
                planilha={planilha}
                tabelaRows={tabelaRows}
                ambiente={ambiente}
                certificados={certificados}
              />
            </motion.div>
          )}
          {step === 4 && (
            <motion.div key="s4" {...PAGE}>
              <StepVerificacao
                validacaoLoading={validacaoLoading}
                validacaoResult={validacaoResult}
                onConfirmarEnvio={runEnvio}
                onCorrigir={() => setStep(2)}
              />
            </motion.div>
          )}
          {step === 5 && (
            <motion.div key="s5" {...PAGE}>
              <Step4
                envioResponse={envioResponse}
                processando={processando}
                erroEnvio={erroEnvio}
                consultaResult={consultaResult}
                consultaLoading={consultaLoading}
                consultaTentativa={consultaTentativa}
                consultaTimeout={consultaTimeout}
                onReset={handleReset}
                onDashboard={onBack}
                onConsulta={onConsulta}
                onCorrigir={() => setStep(2)}
                tabelaRows={tabelaRows}
                evento={config.evento}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer nav */}
        {step < 4 && (
          <div className={styles.footer}>
            {step > 1 ? (
              <button className={styles.prevBtn} onClick={() => { setStep(s => s - 1); setValidationError(null) }}>
                <ArrowLeft size={14} /> Voltar
              </button>
            ) : <span />}
            <button
              className={`${styles.nextBtn} ${!canAdvance() ? styles.nextBtnDisabled : ''}`}
              onClick={handleNext}
              disabled={!canAdvance()}
            >
              {step === 3 ? (
                <><ShieldCheck size={14} /> Verificar Dados</>
              ) : (
                <>Próximo <ArrowRight size={14} /></>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Modal confirmação de ambiente */}
      <AnimatePresence>
        {showAmbModal && (
          <motion.div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(6px)', zIndex: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowAmbModal(false)}
          >
            <motion.div
              style={{
                background: 'var(--bg-card)',
                border: ambiente === 'producao'
                  ? '1.5px solid rgba(34,197,94,0.35)'
                  : '1.5px solid rgba(245,158,11,0.35)',
                borderRadius: 16, padding: '2rem 2rem 1.5rem',
                maxWidth: 420, width: '90%',
                boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
              }}
              initial={{ scale: 0.93, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <AlertTriangle size={22} style={{ color: ambiente === 'producao' ? '#22c55e' : '#F59E0B', flexShrink: 0 }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Confirmar Ambiente
                </h3>
              </div>

              {ambiente === 'producao' ? (
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  Você está em <strong style={{ color: '#22c55e' }}>PRODUÇÃO</strong>. Os dados
                  serão transmitidos à Receita Federal de forma <strong>real e irreversível</strong>.
                  Isso valerá como declaração oficial. Tem certeza?
                </p>
              ) : (
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  Você está em <strong style={{ color: '#F59E0B' }}>HOMOLOGAÇÃO</strong>. Os dados{' '}
                  <strong>não serão enviados</strong> à Receita Federal e não valerão como declaração.
                  É um ambiente de testes. Deseja continuar?
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <button
                  onClick={confirmAmbModal}
                  style={{
                    background: ambiente === 'producao'
                      ? 'linear-gradient(135deg,#16a34a,#22c55e)'
                      : 'linear-gradient(135deg,#D97706,#F59E0B)',
                    border: 'none', borderRadius: 10, padding: '0.7rem 1.25rem',
                    color: '#fff', fontWeight: 700, fontSize: '0.88rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '0.4rem',
                  }}
                >
                  {ambiente === 'producao'
                    ? <><Send size={14} /> Sim, enviar em Produção</>
                    : <><Check size={14} /> Continuar em Homologação</>}
                </button>
                <button
                  onClick={() => { setShowAmbModal(false); onAmbienteChange(ambiente === 'producao' ? 'homologacao' : 'producao') }}
                  style={{
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                    borderRadius: 10, padding: '0.65rem 1.25rem',
                    color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Trocar para {ambiente === 'producao' ? 'Homologação' : 'Produção'}
                </button>
                <button
                  onClick={() => setShowAmbModal(false)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    fontSize: '0.8rem', cursor: 'pointer', padding: '0.3rem',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
