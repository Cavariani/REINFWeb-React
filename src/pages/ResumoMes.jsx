import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  BarChart2, RefreshCw, AlertCircle, TrendingUp, Banknote,
  Building2, Calendar, ChevronDown, Layers, Wrench, Loader2,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { getResumo, listEmpresas } from '../api/client'
import styles from './ResumoMes.module.css'

const BAR_COLORS = ['#E97320', '#3b82f6', '#22c55e', '#a78bfa']

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(val) {
  if (val == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

function thisMonthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return { inicio: `${y}-${m}`, fim: `${y}-${m}` }
}

// Tabela 01 RF — códigos mais comuns de Natureza de Rendimento
const NAT_REND_DESC = {
  '10001': 'Rendimentos do trabalho assalariado',
  '11001': 'Aluguéis e royalties — PF',
  '11002': 'Aluguéis e royalties — PJ',
  '12001': 'Rendimentos de capital — juros',
  '13001': 'Trabalho sem vínculo — PF (serviços)',
  '13002': 'Prestação de serviços PF — geral',
  '13003': 'Prestação de serviços PF — transporte',
  '14001': 'Prêmios e sorteios',
  '15001': 'Rendimentos de aplicações financeiras',
  '15003': 'Juros sobre capital próprio',
  '15004': 'Aluguéis PJ',
  '15005': 'Juros e encargos PJ',
  '21001': 'Serviços prestados por PJ — geral',
  '21002': 'Serviços de limpeza e conservação',
  '21003': 'Serviços de TI e processamento de dados',
  '21004': 'Serviços de contabilidade e auditoria',
  '21005': 'Serviços de assessoria jurídica',
  '21006': 'Serviços médicos e odontológicos',
  '21007': 'Serviços de publicidade',
  '21008': 'Serviços de transporte de cargas',
  '21009': 'Serviços de vigilância e segurança',
  '21010': 'Serviços de construção civil',
  '22001': 'Comissões e corretagens',
  '23001': 'Factoring',
  '24001': 'Planos de saúde — PJ',
  '25001': 'Consórcios — PJ',
  '26001': 'Juros e encargos — empréstimos PJ',
  '27001': 'Seguro de vida e previdência — PJ',
  '28001': 'Rendimentos de fundos de investimento',
  '29001': 'Demais rendimentos PJ',
  '30001': 'Outros — PJ',
}

function natRendLabel(code) {
  return NAT_REND_DESC[code] ?? null
}

// Tabela de Classificação dos Serviços — R-2010
const TP_SERV_DESC = {
  '105000010': 'Construção civil — obras em geral',
  '105000011': 'Construção civil — edificações',
  '105000012': 'Construção civil — obras de infraestrutura',
  '130000010': 'Limpeza, conservação e zeladoria',
  '150000010': 'Vigilância e segurança patrimonial',
  '201000010': 'Tecnologia da informação — desenvolvimento',
  '201000011': 'Tecnologia da informação — suporte e manutenção',
  '213000010': 'Contabilidade e auditoria',
  '214000010': 'Assessoria e consultoria jurídica',
  '215000010': 'Medicina e saúde ocupacional',
  '220000010': 'Publicidade e propaganda',
  '230000010': 'Transporte de cargas',
  '231000010': 'Transporte de passageiros',
  '301000010': 'Serviços de engenharia — projetos e consultoria',
  '999000010': 'Outros serviços não classificados',
}

// ── BreakdownView — sub-page inline (substitui o modal) ──────────────────────

function BreakdownView({ initialInicio, initialFim, onBack }) {
  const [bInicio, setBInicio] = useState(initialInicio)
  const [bFim, setBFim]       = useState(initialFim)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async (ini, fim) => {
    setLoading(true)
    try {
      const res = await getResumo(ini, fim)
      setData(res)
    } catch { /* ignora */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(initialInicio, initialFim) }, [fetchData, initialInicio, initialFim])

  const nat4010    = data?.natRendBreakdown4010 ?? []
  const nat4020    = data?.natRendBreakdown4020 ?? []
  const tpServData = data?.tpServBreakdown ?? []
  const total4010   = nat4010.reduce((s, r) => s + (r.base_ ?? 0), 0)
  const total4020   = nat4020.reduce((s, r) => s + (r.base_ ?? 0), 0)
  const totalTpServ = tpServData.reduce((s, r) => s + (r.vlrBruto ?? 0), 0)

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* ── Cabeçalho com botão Voltar ── */}
      <div className={styles.brkHeader}>
        <button className={styles.brkBackBtn} onClick={onBack}>
          <ChevronLeft size={15} />
          Voltar ao Resumo do Mês
        </button>
        <div className={styles.brkTitleRow}>
          <Layers size={20} className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>Base de Cálculo por Natureza de Rendimento</h1>
            <p className={styles.subtitle}>
              Detalhamento completo — R-4010 (Pessoa Física) · R-4020 (Pessoa Jurídica) · R-2010 (Serviços Tomados)
            </p>
          </div>
        </div>
      </div>

      {/* ── Filtro de período ── */}
      <div className={styles.brkFilterRow}>
        <span className={styles.filterLabel}>Período</span>
        <input
          type="month"
          className={styles.filterInput}
          value={bInicio}
          onChange={e => setBInicio(e.target.value)}
        />
        <span className={styles.brkFilterSep}>até</span>
        <input
          type="month"
          className={styles.filterInput}
          value={bFim}
          onChange={e => setBFim(e.target.value)}
        />
        <button
          className={styles.applyBtn}
          onClick={() => fetchData(bInicio, bFim)}
          disabled={loading}
        >
          {loading ? <Loader2 size={13} className={styles.spinning} /> : 'Aplicar'}
        </button>
      </div>

      {/* ── Chips de totais ── */}
      {data && (
        <div className={styles.brkTotaisRow}>
          <div className={`${styles.brkTotalChip} ${styles.brkChipOrange}`}>
            <span className={styles.brkTotalLabel}>Total Base R-4010 (PF)</span>
            <span className={styles.brkTotalValue}>{fmtBRL(total4010)}</span>
          </div>
          <div className={`${styles.brkTotalChip} ${styles.brkChipBlue}`}>
            <span className={styles.brkTotalLabel}>Total Base R-4020 (PJ)</span>
            <span className={styles.brkTotalValue}>{fmtBRL(total4020)}</span>
          </div>
          <div className={`${styles.brkTotalChip} ${styles.brkChipGreen}`}>
            <span className={styles.brkTotalLabel}>Total Bruto R-2010</span>
            <span className={styles.brkTotalValue}>{fmtBRL(totalTpServ)}</span>
          </div>
        </div>
      )}

      {/* ── R-4010 ── */}
      <div className={styles.section}>
        <div className={`${styles.sectionHeader} ${styles.brkSec4010}`}>
          <TrendingUp size={14} />
          R-4010 — Rendimentos Pagos a Pessoa Física
          <span className={styles.sectionTag4010}>PF</span>
        </div>
        {loading && nat4010.length === 0 ? (
          <p className={styles.natEmpty}>Carregando…</p>
        ) : nat4010.length === 0 ? (
          <p className={styles.natEmpty}>Nenhum evento R-4010 com dados de rendimento neste período.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.natTable}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Natureza do Rendimento</th>
                  <th className={styles.thRight}>Qtd. Eventos</th>
                  <th className={styles.thRight}>Base de Cálculo</th>
                  <th className={styles.thRight}>IRRF Retido</th>
                </tr>
              </thead>
              <tbody>
                {nat4010.map(row => (
                  <tr key={row.natRend}>
                    <td><span className={styles.natCode}>{row.natRend}</span></td>
                    <td>
                      {natRendLabel(row.natRend)
                        ? <span className={styles.natDesc}>{natRendLabel(row.natRend)}</span>
                        : <span className={styles.natDescUnknown}>Código {row.natRend}</span>}
                    </td>
                    <td className={styles.tdRightMuted}>{row.qtdEventos}</td>
                    <td className={`${styles.tdRight} ${styles.brkValOrange}`}>{fmtBRL(row.base_)}</td>
                    <td className={styles.tdRightMuted}>{fmtBRL(row.irrf)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={styles.brkTotalRow}>
                  <td colSpan={3}><strong>Total R-4010</strong></td>
                  <td className={`${styles.tdRight} ${styles.brkValOrange}`}><strong>{fmtBRL(total4010)}</strong></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── R-4020 ── */}
      <div className={styles.section}>
        <div className={`${styles.sectionHeader} ${styles.brkSec4020}`}>
          <TrendingUp size={14} />
          R-4020 — Rendimentos Pagos a Pessoa Jurídica
          <span className={styles.sectionTag4020}>PJ</span>
        </div>
        {loading && nat4020.length === 0 ? (
          <p className={styles.natEmpty}>Carregando…</p>
        ) : nat4020.length === 0 ? (
          <p className={styles.natEmpty}>Nenhum evento R-4020 com dados de rendimento neste período.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.natTable}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Natureza do Rendimento</th>
                  <th className={styles.thRight}>Qtd. Eventos</th>
                  <th className={styles.thRight}>Base de Cálculo</th>
                  <th className={styles.thRight}>IRRF Retido</th>
                </tr>
              </thead>
              <tbody>
                {nat4020.map(row => (
                  <tr key={row.natRend}>
                    <td><span className={`${styles.natCode} ${styles.natCode4020}`}>{row.natRend}</span></td>
                    <td>
                      {natRendLabel(row.natRend)
                        ? <span className={styles.natDesc}>{natRendLabel(row.natRend)}</span>
                        : <span className={styles.natDescUnknown}>Código {row.natRend}</span>}
                    </td>
                    <td className={styles.tdRightMuted}>{row.qtdEventos}</td>
                    <td className={`${styles.tdRight} ${styles.brkValBlue}`}>{fmtBRL(row.base_)}</td>
                    <td className={styles.tdRightMuted}>{fmtBRL(row.irrf)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={styles.brkTotalRow}>
                  <td colSpan={3}><strong>Total R-4020</strong></td>
                  <td className={`${styles.tdRight} ${styles.brkValBlue}`}><strong>{fmtBRL(total4020)}</strong></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── R-2010 ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Wrench size={14} />
          R-2010 — Serviços Tomados
        </div>
        {loading && tpServData.length === 0 ? (
          <p className={styles.natEmpty}>Carregando…</p>
        ) : tpServData.length === 0 ? (
          <p className={styles.natEmpty}>Nenhum evento R-2010 com dados de serviço neste período.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.natTable}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Classificação do Serviço</th>
                  <th className={styles.thRight}>Qtd. Eventos</th>
                  <th className={styles.thRight}>Valor Bruto NF</th>
                  <th className={styles.thRight}>Retenção INSS</th>
                </tr>
              </thead>
              <tbody>
                {tpServData.map(row => (
                  <tr key={row.tpServ}>
                    <td><span className={styles.natCode}>{row.tpServ}</span></td>
                    <td>
                      {TP_SERV_DESC[row.tpServ]
                        ? <span className={styles.natDesc}>{TP_SERV_DESC[row.tpServ]}</span>
                        : <span className={styles.natDescUnknown}>Código {row.tpServ}</span>}
                    </td>
                    <td className={styles.tdRightMuted}>{row.qtdEventos}</td>
                    <td className={`${styles.tdRight} ${styles.brkValGreen}`}>{fmtBRL(row.vlrBruto)}</td>
                    <td className={styles.tdRightMuted}>{fmtBRL(row.vlrRetencao)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={styles.brkTotalRow}>
                  <td colSpan={3}><strong>Total R-2010</strong></td>
                  <td className={`${styles.tdRight} ${styles.brkValGreen}`}><strong>{fmtBRL(totalTpServ)}</strong></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  )
}

const EVENT_LABELS = {
  'R-4010': 'R-4010 Serv. PF',
  'R-4020': 'R-4020 Serv. PJ',
  'R-2010': 'R-2010 Serv./CPRB',
  'R-1000': 'R-1000 Cadastro',
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className={styles.kpiCard} style={accent ? { borderTopColor: accent } : {}}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}</span>
      {sub && <span className={styles.kpiSub}>{sub}</span>}
    </div>
  )
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.chartTooltip}>
      <p className={styles.tooltipLabel}>{EVENT_LABELS[label] ?? label}</p>
      <p className={styles.tooltipRow}>
        <span>Base:</span> <strong>{fmtBRL(payload.find(p => p.dataKey === 'base_')?.value)}</strong>
      </p>
      <p className={styles.tooltipRow}>
        <span>IRRF:</span> <strong>{fmtBRL(payload.find(p => p.dataKey === 'irrf')?.value)}</strong>
      </p>
      <p className={styles.tooltipRow}>
        <span>Qtd lotes:</span> <strong>{payload[0]?.payload?.qtd}</strong>
      </p>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    ACEITO:  { bg: '#0a2e1a', color: '#34d399', label: 'ACEITO' },
    PARCIAL: { bg: '#2a1f00', color: '#fbbf24', label: 'PARCIAL' },
    ERRO:    { bg: '#2e0a0a', color: '#f87171', label: 'ERRO' },
  }
  const s = map[status] ?? { bg: '#1a1a2e', color: '#94a3b8', label: status }
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.color}33`,
      borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700,
      letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ResumoMes() {
  const range = thisMonthRange()
  const [inicio, setInicio]   = useState(range.inicio)
  const [fim, setFim]         = useState(range.fim)
  const [ambienteFiltro, setAmbienteFiltro] = useState('')
  const [empresaFiltro, setEmpresaFiltro]   = useState('')
  const [empresas, setEmpresas]             = useState([])
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [view, setView]       = useState('main') // 'main' | 'breakdown'

  useEffect(() => {
    listEmpresas().then(setEmpresas).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    if (!inicio || !fim) return
    setLoading(true)
    setError(null)
    try {
      const res = await getResumo(inicio, fim, empresaFiltro, ambienteFiltro)
      setData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [inicio, fim, empresaFiltro, ambienteFiltro])

  useEffect(() => { load() }, [load])

  // ── Sub-view: detalhamento por natureza ──
  if (view === 'breakdown') {
    return (
      <BreakdownView
        initialInicio={inicio}
        initialFim={fim}
        onBack={() => setView('main')}
      />
    )
  }

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <BarChart2 size={22} className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>Resumo do Mês</h1>
            <p className={styles.subtitle}>Totais financeiros por período • EFD-REINF</p>
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading} title="Atualizar">
          <RefreshCw size={15} className={loading ? styles.spinning : ''} />
        </button>
      </div>

      {/* ── Filtros ── */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <Calendar size={14} className={styles.filterIcon} />
          <label className={styles.filterLabel}>Início</label>
          <input
            type="month"
            className={styles.filterInput}
            value={inicio}
            onChange={e => setInicio(e.target.value)}
          />
        </div>
        <div className={styles.filterGroup}>
          <Calendar size={14} className={styles.filterIcon} />
          <label className={styles.filterLabel}>Fim</label>
          <input
            type="month"
            className={styles.filterInput}
            value={fim}
            onChange={e => setFim(e.target.value)}
          />
        </div>
        {empresas.length > 0 && (
          <div className={styles.filterGroup}>
            <Building2 size={14} className={styles.filterIcon} />
            <label className={styles.filterLabel}>Empresa</label>
            <div className={styles.selectWrap}>
              <select
                className={styles.filterSelect}
                value={empresaFiltro}
                onChange={e => setEmpresaFiltro(e.target.value)}
              >
                <option value="">Todas</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.cnpj}>{emp.nome}</option>
                ))}
              </select>
              <ChevronDown size={13} className={styles.selectChevron} />
            </div>
          </div>
        )}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Ambiente</label>
          <div className={styles.ambienteBtns}>
            <button
              className={`${styles.ambiBtn} ${ambienteFiltro === '' ? styles.ambiActive : ''}`}
              onClick={() => setAmbienteFiltro('')}
            >Todos</button>
            <button
              className={`${styles.ambiBtn} ${ambienteFiltro === 'producao' ? styles.ambiActive : ''}`}
              onClick={() => setAmbienteFiltro('producao')}
            >Produção</button>
            <button
              className={`${styles.ambiBtn} ${ambienteFiltro === 'homologacao' ? styles.ambiActive : ''}`}
              onClick={() => setAmbienteFiltro('homologacao')}
            >Homologação</button>
          </div>
        </div>
        <button className={styles.applyBtn} onClick={load} disabled={loading}>
          {loading ? 'Carregando…' : 'Aplicar'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Empty / Loading placeholder ── */}
      {!data && !loading && !error && (
        <div className={styles.empty}>
          <BarChart2 size={40} className={styles.emptyIcon} />
          <p>Selecione um período e clique em Aplicar</p>
        </div>
      )}

      {data && (
        <>
          {/* ── Meta strip ── */}
          <div className={styles.metaStrip}>
            <span>
              <strong>{data.totalLotes}</strong> lote{data.totalLotes !== 1 ? 's' : ''} no período
            </span>
            <span className={styles.metaDot}>·</span>
            <span className={styles.metaAceito}><strong>{data.totalAceitos}</strong> aceitos</span>
            {data.totalParciais > 0 && (
              <>
                <span className={styles.metaDot}>·</span>
                <span className={styles.metaParcial}><strong>{data.totalParciais}</strong> parciais</span>
              </>
            )}
          </div>

          {/* ── KPI Cards ── */}
          <div className={styles.kpiGrid}>
            <KpiCard label="Base de Cálculo" value={fmtBRL(data.totalBase)} accent="#E97320" />
            <KpiCard label="IRRF"             value={fmtBRL(data.totalIrrf)}   accent="#3b82f6" />
            <KpiCard label="INSS / CPRB"      value={fmtBRL(data.totalInss)}   accent="#8b5cf6" />
            <KpiCard label="CSLL"             value={fmtBRL(data.totalCsll)}   accent="#10b981" />
            <KpiCard label="PIS"              value={fmtBRL(data.totalPis)}    accent="#f59e0b" />
            <KpiCard label="COFINS"           value={fmtBRL(data.totalCofins)} accent="#ef4444" />
          </div>

          {/* ── Botão CTA — detalhamento por natureza ── */}
          <button className={styles.btnVerDetalhamento} onClick={() => setView('breakdown')}>
            <Layers size={15} />
            <span>
              Clique aqui para ver a Base de Cálculo separada por Natureza de Rendimento e Tipo de Serviço
            </span>
            <ChevronRight size={15} className={styles.btnVerIcon} />
          </button>

          {/* ── Breakdown chart ── */}
          {data.breakdown?.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <TrendingUp size={15} />
                <span>Breakdown por Evento</span>
              </div>
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.breakdown} margin={{ top: 8, right: 24, left: 16, bottom: 4 }}>
                    <XAxis
                      dataKey="tipo"
                      tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                      tickFormatter={v => v}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="qtd" name="Lotes" radius={[4, 4, 0, 0]} maxBarSize={56} fill="#E97320">
                      {data.breakdown.map((_, i) => (
                        <Cell
                          key={i}
                          fill={BAR_COLORS[i % BAR_COLORS.length]}
                          style={{ fill: BAR_COLORS[i % BAR_COLORS.length] }}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className={styles.breakdownList}>
                {data.breakdown.map(row => (
                  <div key={row.tipo} className={styles.breakdownRow}>
                    <span className={styles.brkTipo}>{EVENT_LABELS[row.tipo] ?? row.tipo}</span>
                    <span className={styles.brkQtd}>{row.qtd} lote{row.qtd !== 1 ? 's' : ''}</span>
                    <span className={styles.brkBase}>Base: {fmtBRL(row.base_)}</span>
                    <span className={styles.brkIrrf}>IRRF: {fmtBRL(row.irrf)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Lotes table ── */}
          {data.lotes?.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <Banknote size={15} />
                <span>Lotes do Período</span>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Protocolo</th>
                      <th>CNPJ</th>
                      <th>Evento</th>
                      <th>Ambiente</th>
                      <th>Status</th>
                      <th className={styles.thRight}>Base</th>
                      <th className={styles.thRight}>IRRF</th>
                      <th className={styles.thRight}>INSS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lotes.map(l => (
                      <tr key={l.idEnvio}>
                        <td>{l.dtRecepcao ? new Date(l.dtRecepcao).toLocaleDateString('pt-BR') : '—'}</td>
                        <td className={styles.mono}>{l.protocolo || '—'}</td>
                        <td className={styles.mono}>{l.cnpj || '—'}</td>
                        <td>{l.tpEnvio || '—'}</td>
                        <td>
                          <span className={l.ambiente === 'producao' ? styles.tagProd : styles.tagHom}>
                            {l.ambiente === 'producao' ? 'Prod' : 'Hom'}
                          </span>
                        </td>
                        <td><StatusBadge status={l.status} /></td>
                        <td className={styles.tdRight}>{fmtBRL(l.totalBase)}</td>
                        <td className={styles.tdRight}>{fmtBRL(l.totalIrrf)}</td>
                        <td className={styles.tdRight}>{fmtBRL(l.totalInss)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.lotes?.length === 0 && (
            <div className={styles.empty}>
              <BarChart2 size={32} className={styles.emptyIcon} />
              <p>Nenhum lote aceito/parcial no período selecionado.</p>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
