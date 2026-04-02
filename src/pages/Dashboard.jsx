import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Send, Trash2, CheckCircle2,
  ShieldCheck, ArrowUpRight, ChevronRight,
  AlertTriangle, TrendingUp, TrendingDown, History, Loader2, Building2,
} from 'lucide-react'
import { listLotes, listEmpresas } from '../api/client'
import { TIPO_CORES } from '../data/mockData'
import styles from './Dashboard.module.css'

const PAGE = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.25, 0.1, 0.25, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.14 } },
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function fmtDateLong() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).replace(/^\w/, c => c.toUpperCase())
}

const STATUS_MAP = {
  'ACEITO':      { dot: '#22c55e', cls: styles.stAceito,  label: 'Aceito' },
  'REJEITADO':   { dot: '#ef4444', cls: styles.stRej,     label: 'Rejeitado' },
  'ERRO':        { dot: '#ef4444', cls: styles.stRej,     label: 'Erro' },
  'PENDENTE':    { dot: '#f59e0b', cls: styles.stPend,    label: 'Pendente' },
  'PROCESSANDO': { dot: '#E97320', cls: styles.stProc,    label: 'Processando' },
}

function deriveKpis(lotes) {
  const now = new Date()
  const total    = lotes.length
  const aceitos  = lotes.filter(l => l.status === 'ACEITO').length
  const rejeitados = lotes.filter(l => l.status === 'REJEITADO' || l.status === 'ERRO').length
  const taxa = total > 0 ? Math.round(aceitos / total * 100) : 0

  const thisMonth = lotes.filter(l => {
    const d = new Date(l.dtRecepcao)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const lastMonth = lotes.filter(l => {
    const d = new Date(l.dtRecepcao)
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear()
  }).length
  const delta = thisMonth - lastMonth

  return { total, aceitos, rejeitados, taxa, thisMonth, delta }
}

function deriveChartData(lotes) {
  const months = {}
  for (const l of lotes) {
    const d = new Date(l.dtRecepcao)
    const key = `${d.toLocaleString('pt-BR', { month: 'short' })}/${String(d.getFullYear()).slice(2)}`
    if (!months[key]) months[key] = { mes: key, envios: 0, retificacoes: 0, exclusoes: 0 }
    months[key].envios++
  }
  return Object.values(months).slice(-6)
}

function deriveBreakdown(lotes) {
  const acc = {}
  for (const l of lotes) {
    const t = l.tpEnvio
    if (!acc[t]) acc[t] = { tipo: t, envios: 0, cor: TIPO_CORES[t] ?? '#8B95A5' }
    acc[t].envios++
  }
  return Object.values(acc)
}

function fmtCnpj(v) {
  if (!v) return '—'
  const d = v.replace(/\D/g, '')
  return d.length === 14
    ? `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
    : v
}

function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <span className={styles.ttTitle}>{label}</span>
      {payload.map(p => (
        <div key={p.dataKey} className={styles.ttRow}>
          <span className={styles.ttDot} style={{ background: p.color }} />
          <span className={styles.ttKey}>{p.name}</span>
          <span className={styles.ttVal}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard({ user, onNavigate, initialData }) {
  const [lotes, setLotes]             = useState(initialData?.lotes ?? [])
  const [empresas, setEmpresas]       = useState(initialData?.empresas ?? [])
  const [loading, setLoading]         = useState(!initialData)
  const [erro, setErro]               = useState(null)
  const [filtroEmpresa, setFiltroEmpresa] = useState('') // cnpj (14 dígitos) ou ''

  useEffect(() => {
    if (initialData) return // já veio pré-carregado do login
    Promise.all([
      listLotes(1, 200),
      listEmpresas().catch(() => []),
    ])
      .then(([res, emp]) => {
        setLotes(res.items ?? [])
        setEmpresas(emp)
      })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Filtra por empresa (raiz do CNPJ = 8 primeiros dígitos)
  const lotesFiltered = filtroEmpresa
    ? lotes.filter(l => (l.nrInscricao ?? '').replace(/\D/g,'').startsWith(filtroEmpresa.slice(0,8)))
    : lotes

  const kpis      = deriveKpis(lotesFiltered)
  const chartData = deriveChartData(lotesFiltered)
  const breakdown = deriveBreakdown(lotesFiltered)
  const recent    = lotesFiltered.slice(0, 8)

  return (
    <motion.div className={styles.page} {...PAGE}>

      {/* ── Cabeçalho ────────────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.greeting}>
            {greeting()}, {user?.nome?.split(' ')[0]}<span className={styles.dot}>.</span>
          </h1>
          <p className={styles.greetingSub}>{fmtDateLong()}</p>
        </div>
        <div className={styles.topActions}>
          <button className={styles.btnSecondary} onClick={() => onNavigate('historico')}>
            <History size={13} /> Histórico
          </button>
        </div>
      </div>

      {/* ── Filtro de empresa ────────────────────────────────────────────── */}
      {empresas.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <Building2 size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filtrar por empresa:</span>
          <select
            value={filtroEmpresa}
            onChange={e => setFiltroEmpresa(e.target.value)}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 7, color: 'var(--text)', fontSize: '0.82rem', padding: '0.3rem 0.75rem',
              cursor: 'pointer',
            }}
          >
            <option value="">Todas as empresas</option>
            {empresas.filter(emp => !emp.isEmissora).map(emp => (
              <option key={emp.id} value={emp.cnpj}>{emp.nome}</option>
            ))}
          </select>
          {filtroEmpresa && (
            <button
              onClick={() => setFiltroEmpresa('')}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
            >
              Limpar
            </button>
          )}
        </div>
      )}

      {/* ── CTA strip ────────────────────────────────────────────────────── */}
      <div className={styles.ctaStrip}>
        <div className={styles.ctaLeft}>
          <Send size={20} className={styles.ctaIcon} />
          <div>
            <p className={styles.ctaTitle}>Pronto para transmitir?</p>
            <p className={styles.ctaSub}>Envie seus eventos EFD-REINF para a Receita Federal. Acompanhe o status e gerencie tudo em um só lugar.</p>
          </div>
        </div>
        <button className={styles.ctaBtn} onClick={() => onNavigate('novo-envio')}>
          Novo Envio <ArrowUpRight size={15} />
        </button>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(233,115,32,0.12)' }}>
            <Send size={16} style={{ color: 'var(--accent)' }} />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiNum}>{loading ? '—' : kpis.total}</span>
            <span className={styles.kpiLabel}>Total de Lotes</span>
            {!loading && kpis.delta !== 0 && (
              <span className={kpis.delta > 0 ? styles.trendUp : styles.trendDown}>
                {kpis.delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {Math.abs(kpis.delta)} vs mês anterior
              </span>
            )}
            {(loading || kpis.delta === 0) && <span className={styles.kpiSub}>enviados até hoje</span>}
          </div>
          <div className={styles.kpiBar} style={{ '--c': 'var(--accent)' }} />
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(34,197,94,0.12)' }}>
            <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiNum}>{loading ? '—' : kpis.aceitos}</span>
            <span className={styles.kpiLabel}>Aceitos</span>
            <span className={styles.kpiSub}>pela Receita Federal</span>
          </div>
          <div className={styles.kpiBar} style={{ '--c': 'var(--success)' }} />
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(239,68,68,0.12)' }}>
            <Trash2 size={16} style={{ color: 'var(--error)' }} />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiNum}>{loading ? '—' : kpis.rejeitados}</span>
            <span className={styles.kpiLabel}>Rejeitados / Erro</span>
            <span className={styles.kpiSub}>requerem atenção</span>
          </div>
          <div className={styles.kpiBar} style={{ '--c': 'var(--error)' }} />
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(34,197,94,0.12)' }}>
            <TrendingUp size={16} style={{ color: 'var(--success)' }} />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiNum}>{loading ? '—' : `${kpis.taxa}%`}</span>
            <span className={styles.kpiLabel}>Taxa de Sucesso</span>
            <span className={styles.kpiSub}>{kpis.total} lotes no total</span>
          </div>
          <div className={styles.kpiBar} style={{ '--c': 'var(--success)' }} />
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(91,143,249,0.12)' }}>
            <Building2 size={16} style={{ color: '#5b8ff9' }} />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiNum}>{loading ? '—' : empresas.length}</span>
            <span className={styles.kpiLabel}>Empresas</span>
            <span className={styles.kpiSub}>vinculadas à sua conta</span>
          </div>
          <div className={styles.kpiBar} style={{ '--c': '#5b8ff9' }} />
        </div>
      </div>

      {/* ── Linha principal ───────────────────────────────────────────────── */}
      <div className={styles.mainRow}>

        {/* Gráfico */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Transmissões por Mês</h3>
              <p className={styles.cardSub}>Lotes enviados — últimos envios</p>
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={3} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="envios" name="Envios" fill="#E97320" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.emptyChart}>
              {loading
                ? <Loader2 size={18} className={styles.spin} />
                : <span>Sem dados de envio ainda.</span>
              }
            </div>
          )}
        </div>

        {/* Coluna lateral direita */}
        <div className={styles.sideCol}>

          {/* Breakdown por evento */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Breakdown por Evento</h3>
            <p className={styles.cardSub} style={{ marginBottom: '0.75rem' }}>Total acumulado</p>
            {breakdown.length === 0 ? (
              <p className={styles.cardSub}>{loading ? 'Carregando...' : 'Sem dados.'}</p>
            ) : breakdown.map(b => (
              <div key={b.tipo} className={styles.breakdownRow}>
                <span className={styles.bTipo} style={{ color: b.cor, borderColor: `${b.cor}40` }}>{b.tipo}</span>
                <div className={styles.bStats}>
                  <span className={styles.bStat} title="Lotes"><Send size={9} />{b.envios}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Último envio */}
          {!loading && lotes.length > 0 && (() => {
            const last = lotes[0]
            const st = STATUS_MAP[last.status] ?? STATUS_MAP['PENDENTE']
            return (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Último Envio</h3>
                <p className={styles.cardSub} style={{ marginBottom: '0.75rem' }}>Transmissão mais recente</p>
                <div className={styles.lastEnvioCard}>
                  <span className={styles.tipoBadge} style={{ fontSize: '1.1rem', fontWeight: 900, padding: '4px 12px', color: TIPO_CORES[last.tpEnvio] ?? 'var(--accent)', background: `${TIPO_CORES[last.tpEnvio] ?? 'var(--accent)'}18` }}>{last.tpEnvio}</span>
                  <div className={styles.lastEnvioInfo}>
                    <span className={`${styles.stBadge} ${st.cls}`}>
                      <span className={styles.stDot} style={{ background: st.dot }} />
                      {st.label}
                    </span>
                    {last.protocolo && <span className={styles.lastProtocolo}>{last.protocolo}</span>}
                  </div>
                </div>
              </div>
            )
          })()}

        </div>
      </div>

      {/* ── Últimos lotes ────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h3 className={styles.cardTitle}>Últimos Lotes Transmitidos</h3>
            <p className={styles.cardSub}>Histórico de envios à Receita Federal</p>
          </div>
          <button className={styles.linkBtn} onClick={() => onNavigate('historico')}>
            Ver histórico completo <ChevronRight size={11} />
          </button>
        </div>

        {loading ? (
          <div className={styles.tableLoading}>
            <Loader2 size={20} className={styles.spin} />
            <span>Carregando lotes...</span>
          </div>
        ) : erro ? (
          <div className={styles.tableError}>
            <AlertTriangle size={16} />
            <span>{erro}</span>
          </div>
        ) : recent.length === 0 ? (
          <div className={styles.tableEmpty}>
            <Send size={18} style={{ color: 'var(--text-muted)' }} />
            <span>Nenhum lote enviado ainda.</span>
            <button className={styles.linkBtn} onClick={() => onNavigate('novo-envio')}>Enviar agora</button>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Evento</th>
                  <th>Empresa</th>
                  <th>CNPJ</th>
                  <th>Ambiente</th>
                  <th>Protocolo</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(lot => {
                  const st = STATUS_MAP[lot.status] ?? STATUS_MAP['PENDENTE']
                  const empresa = empresas.find(e => e.cnpj.replace(/\D/g,'').slice(0,8) === (lot.nrInscricao ?? '').replace(/\D/g,'').slice(0,8))
                  return (
                    <tr key={lot.idEnvio} className={styles.tableRow}>
                      <td className={styles.tdMuted}>{fmtDate(lot.dtRecepcao)}</td>
                      <td><span className={styles.tipoBadge} style={{ color: TIPO_CORES[lot.tpEnvio] ?? 'var(--accent)', background: `${TIPO_CORES[lot.tpEnvio] ?? 'var(--accent)'}18` }}>{lot.tpEnvio}</span></td>
                      <td className={styles.tdMuted} style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{empresa?.nome ?? '—'}</td>
                      <td className={styles.tdMono}>{fmtCnpj(lot.nrInscricao)}</td>
                      <td>
                        {lot.ambiente
                          ? <span className={lot.ambiente.toLowerCase() === 'producao' ? styles.ambProd : styles.ambHom}>
                              {lot.ambiente.toLowerCase() === 'producao' ? 'Produção' : 'Homolog.'}
                            </span>
                          : <span className={styles.tdMono}>—</span>}
                      </td>
                      <td className={styles.tdMono}>{lot.protocolo ?? <span style={{color:'var(--text-muted)'}}>—</span>}</td>
                      <td>
                        <span className={`${styles.stBadge} ${st.cls}`}>
                          <span className={styles.stDot} style={{ background: st.dot }} />
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Certificados ─────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Certificados Digitais</h3>
          <button className={styles.linkBtn} onClick={() => onNavigate('certificados')}>
            Gerenciar <ChevronRight size={11} />
          </button>
        </div>
        <div className={styles.certEmpty}>
          <ShieldCheck size={18} style={{ color: 'var(--text-muted)' }} />
          <span>Gerencie seus certificados .pfx na área de Certificados.</span>
          <button className={styles.linkBtn} onClick={() => onNavigate('certificados')}>Ir para Certificados</button>
        </div>
      </div>

    </motion.div>
  )
}
