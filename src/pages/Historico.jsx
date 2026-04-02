import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  History, Eye, Send, ChevronDown, X, CheckCircle2,
  XCircle, Loader2, AlertTriangle, FileDown, CheckSquare,
  Square, Filter, Calendar, RotateCcw, RefreshCw,
} from 'lucide-react'
import { listLotes, listEmpresas, getStoredUser, exportarLotes, consultarLote, getLote } from '../api/client'
import { TIPO_CORES } from '../data/mockData'
import styles from './Historico.module.css'

const PAGE = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26 } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.14 } },
}

const STATUS_MAP = {
  'ACEITO':      { cls: styles.stAceito,  dot: '#22c55e', label: 'Aceito' },
  'REJEITADO':   { cls: styles.stRej,     dot: '#ef4444', label: 'Rejeitado' },
  'ERRO':        { cls: styles.stRej,     dot: '#ef4444', label: 'Erro' },
  'PENDENTE':    { cls: styles.stParcial, dot: '#f59e0b', label: 'Pendente' },
  'PROCESSANDO': { cls: styles.stParcial, dot: '#E97320', label: 'Processando' },
  'PARCIAL':     { cls: styles.stParcial, dot: '#f59e0b', label: 'Parcial' },
}

function fmtCnpj(v) {
  if (!v) return '—'
  const d = v.replace(/\D/g, '')
  return d.length === 14
    ? `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
    : v
}

function fmtCpf(v) {
  if (!v) return '—'
  const d = v.replace(/\D/g, '')
  return d.length === 11
    ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
    : fmtCnpj(v)
}

function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

function onlyDigits(v) { return (v ?? '').replace(/\D/g, '') }

const PAGE_SIZE = 50

export default function Historico({ onNavigate, onRetificar }) {
  const [lotes, setLotes]       = useState([])
  const [empresas, setEmpresas] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading]   = useState(true)
  const [erro, setErro]         = useState(null)
  const [detalhe, setDetalhe]   = useState(null)
  const [exporting, setExporting]       = useState(false)
  const [refreshing, setRefreshing]     = useState(false)
  const [consultando, setConsultando]   = useState(false)
  const [consultaErro, setConsultaErro] = useState(null)

  // ── Filters ──────────────────────────────────────────────────────────────
  const [filtroAmbiente, setFiltroAmbiente] = useState('')
  const [filtroEvento,   setFiltroEvento]   = useState('')
  const [filtroEmpresa,  setFiltroEmpresa]  = useState('')
  const [filtroStatus,   setFiltroStatus]   = useState('')
  const [filtroCnpjContrib, setFiltroCnpjContrib] = useState('')
  const [filtroCnpjBenef,   setFiltroCnpjBenef]   = useState('')
  const [filtroDataDe,  setFiltroDataDe]  = useState('')
  const [filtroDataAte, setFiltroDataAte] = useState('')
  const [showAdvanced, setShowAdvanced]   = useState(false)

  // ── Selection mode ────────────────────────────────────────────────────────
  const [selectMode, setSelectMode]   = useState(false)
  const [selected,   setSelected]     = useState(new Set())

  // ── Event-level selection (inside modal) ──────────────────────────────────
  const [selectedEventIds, setSelectedEventIds] = useState(new Set())

  useEffect(() => {
    setConsultaErro(null)
    if (!detalhe?.eventosJson) { setSelectedEventIds(new Set()); return }
    try {
      const evs = JSON.parse(detalhe.eventosJson)
      // Auto-select all events that have a receipt number (can be retified)
      setSelectedEventIds(new Set(evs.filter(e => e.nrRecibo).map(e => e.id)))
    } catch { setSelectedEventIds(new Set()) }
  }, [detalhe])

  const currentUser = getStoredUser()

  async function handleConsultarRF() {
    if (!detalhe?.protocolo || !detalhe?.certificadoId) return
    setConsultando(true)
    setConsultaErro(null)
    try {
      await consultarLote(detalhe.protocolo, detalhe.certificadoId, detalhe.ambiente, detalhe.tpEnvio ?? '')
      const loteAtualizado = await getLote(detalhe.idEnvio)
      setDetalhe(loteAtualizado)
      setLotes(prev => prev.map(l => l.idEnvio === loteAtualizado.idEnvio ? loteAtualizado : l))
    } catch (e) {
      setConsultaErro(e.message)
    } finally {
      setConsultando(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try { await exportarLotes() } catch (e) { setErro(e.message) }
    finally { setExporting(false) }
  }

  function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setErro(null)
    Promise.all([
      listLotes(1, 500),
      listEmpresas().catch(() => []),
    ])
      .then(([res, emp]) => {
        setLotes(res.items ?? [])
        setEmpresas(emp)
      })
      .catch(e => setErro(e.message))
      .finally(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => { loadData() }, [])

  // ── Filtered lotes ────────────────────────────────────────────────────────
  const filtered = useMemo(() => lotes.filter(l => {
    if (filtroAmbiente && l.ambiente?.toLowerCase() !== filtroAmbiente) return false
    if (filtroEvento   && l.tpEnvio !== filtroEvento) return false
    if (filtroEmpresa  && !onlyDigits(l.nrInscricao).startsWith(onlyDigits(filtroEmpresa).slice(0,8))) return false
    if (filtroStatus   && l.status !== filtroStatus) return false

    if (filtroCnpjContrib) {
      const digits = onlyDigits(filtroCnpjContrib)
      if (!onlyDigits(l.nrInscricao).startsWith(digits)) return false
    }

    // CNPJ beneficiário: filtra dentro do EventosJson se disponível
    if (filtroCnpjBenef && l.eventosJson) {
      try {
        const ev = JSON.parse(l.eventosJson)
        const digits = onlyDigits(filtroCnpjBenef)
        const found = ev.some(e => onlyDigits(e.cnpjBenef ?? e.cpfBenef ?? '').startsWith(digits))
        if (!found) return false
      } catch { return false }
    }

    if (filtroDataDe) {
      const de = new Date(filtroDataDe)
      if (new Date(l.dtRecepcao) < de) return false
    }
    if (filtroDataAte) {
      const ate = new Date(filtroDataAte)
      ate.setHours(23, 59, 59, 999)
      if (new Date(l.dtRecepcao) > ate) return false
    }

    return true
  }), [lotes, filtroAmbiente, filtroEvento, filtroEmpresa, filtroStatus,
       filtroCnpjContrib, filtroCnpjBenef, filtroDataDe, filtroDataAte])

  // Reset página ao mudar filtros
  useEffect(() => { setCurrentPage(1) },
    [filtroAmbiente, filtroEvento, filtroEmpresa, filtroStatus,
     filtroCnpjContrib, filtroCnpjBenef, filtroDataDe, filtroDataAte])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // ── Selection helpers ─────────────────────────────────────────────────────
  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(filtered.map(l => l.idEnvio)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function toggleSelectMode() {
    setSelectMode(v => !v)
    setSelected(new Set())
  }

  function clearFilters() {
    setFiltroAmbiente('')
    setFiltroEvento('')
    setFiltroEmpresa('')
    setFiltroStatus('')
    setFiltroCnpjContrib('')
    setFiltroCnpjBenef('')
    setFiltroDataDe('')
    setFiltroDataAte('')
  }

  const hasAdvancedFilter = filtroCnpjContrib || filtroCnpjBenef || filtroDataDe || filtroDataAte || filtroStatus

  return (
    <motion.div className={styles.page} {...PAGE}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Histórico de Envios</h1>
          <p className={styles.sub}>Consulte todos os lotes transmitidos à Receita Federal.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`${styles.selectToggleBtn} ${selectMode ? styles.selectToggleBtnActive : ''}`}
            onClick={toggleSelectMode}
            title={selectMode ? 'Desativar seleção' : 'Selecionar entradas'}
          >
            {selectMode ? <CheckSquare size={13} /> : <Square size={13} />}
            {selectMode ? `${selected.size} selecionado${selected.size !== 1 ? 's' : ''}` : 'Selecionar'}
          </button>
          <button className={styles.exportXlsBtn} onClick={() => loadData(true)} disabled={refreshing} title="Atualizar lista">
            <RefreshCw size={13} className={refreshing ? styles.spin : ''} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button className={styles.exportXlsBtn} onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 size={13} className={styles.spin} /> : <FileDown size={13} />}
            {exporting ? 'Exportando...' : 'Exportar ZIP'}
          </button>
          <button className={styles.newBtn} onClick={() => onNavigate('novo-envio')}>
            <Send size={13} /> Novo Envio
          </button>
        </div>
      </div>

      {/* ── Selection toolbar (visível quando selectMode) ── */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            className={styles.selectionBar}
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}
          >
            <span className={styles.selectionCount}>
              <CheckSquare size={14} />
              <strong>{selected.size}</strong> de {filtered.length} selecionado{selected.size !== 1 ? 's' : ''}
            </span>
            <div className={styles.selectionActions}>
              <button className={styles.selBtn} onClick={selectAll}>
                <CheckSquare size={12} /> Selecionar todas
              </button>
              <button className={styles.selBtn} onClick={clearSelection} disabled={selected.size === 0}>
                <X size={12} /> Limpar seleção
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filters ── */}
      <div className={styles.filtersWrap}>
        {/* Linha 1: filtros rápidos */}
        <div className={styles.filters}>
          {/* Ambiente toggle */}
          <div className={styles.ambToggle}>
            {[
              { val: 'producao',    label: 'Produção' },
              { val: 'homologacao', label: 'Homologação' },
              { val: '',            label: 'Todos' },
            ].map(opt => (
              <button
                key={opt.val}
                className={`${styles.ambToggleBtn} ${filtroAmbiente === opt.val ? styles.ambToggleBtnActive : ''}`}
                onClick={() => setFiltroAmbiente(opt.val)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className={styles.filterSelect}>
            <select value={filtroEvento} onChange={e => setFiltroEvento(e.target.value)} className={styles.select}>
              <option value="">Todos os eventos</option>
              {['R-4010','R-4020','R-2010','R-1000'].map(ev => (
                <option key={ev} value={ev}>{ev}</option>
              ))}
            </select>
            <ChevronDown size={12} className={styles.selectChevron} />
          </div>

          {empresas.length > 0 && (
            <div className={styles.filterSelect}>
              <select value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)} className={styles.select}>
                <option value="">Todas as empresas</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.cnpj}>{e.nome}</option>
                ))}
              </select>
              <ChevronDown size={12} className={styles.selectChevron} />
            </div>
          )}

          <button
            className={`${styles.advancedToggle} ${(showAdvanced || hasAdvancedFilter) ? styles.advancedToggleActive : ''}`}
            onClick={() => setShowAdvanced(v => !v)}
          >
            <Filter size={12} />
            Filtros avançados
            {hasAdvancedFilter && <span className={styles.filterDot} />}
          </button>

          {(filtroEvento || filtroEmpresa || filtroStatus || hasAdvancedFilter) && (
            <button className={styles.clearFiltersBtn} onClick={clearFilters} title="Limpar filtros">
              <X size={12} /> Limpar
            </button>
          )}
        </div>

        {/* Linha 2: filtros avançados (expansível) */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              className={styles.advancedFilters}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className={styles.advRow}>
                <div className={styles.advField}>
                  <label className={styles.advLabel}>CNPJ Contribuinte</label>
                  <input
                    className={styles.filterInput}
                    placeholder="00.000.000/0001-00"
                    value={filtroCnpjContrib}
                    onChange={e => setFiltroCnpjContrib(e.target.value)}
                  />
                </div>

                <div className={styles.advField}>
                  <label className={styles.advLabel}>CNPJ Beneficiário</label>
                  <input
                    className={styles.filterInput}
                    placeholder="00.000.000/0001-00 ou CPF"
                    value={filtroCnpjBenef}
                    onChange={e => setFiltroCnpjBenef(e.target.value)}
                  />
                </div>

                <div className={styles.advField}>
                  <label className={styles.advLabel}><Calendar size={11} /> Data Envio — De</label>
                  <input
                    type="date"
                    className={styles.filterInput}
                    value={filtroDataDe}
                    onChange={e => setFiltroDataDe(e.target.value)}
                  />
                </div>

                <div className={styles.advField}>
                  <label className={styles.advLabel}><Calendar size={11} /> Data Envio — Até</label>
                  <input
                    type="date"
                    className={styles.filterInput}
                    value={filtroDataAte}
                    onChange={e => setFiltroDataAte(e.target.value)}
                  />
                </div>

                <div className={styles.advField}>
                  <label className={styles.advLabel}>Status</label>
                  <div className={styles.filterSelect} style={{ position: 'relative' }}>
                    <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className={styles.select}>
                      <option value="">Todos os status</option>
                      <option value="ACEITO">Aceito</option>
                      <option value="PARCIAL">Parcial</option>
                      <option value="REJEITADO">Rejeitado</option>
                      <option value="ERRO">Erro</option>
                      <option value="PENDENTE">Pendente</option>
                    </select>
                    <ChevronDown size={12} className={styles.selectChevron} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Count strip ── */}
      {!loading && !erro && lotes.length > 0 && (
        <div className={styles.countStrip}>
          <span>
            Exibindo <strong>{Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(currentPage * PAGE_SIZE, filtered.length)}</strong> de <strong>{filtered.length}</strong> registro{filtered.length !== 1 ? 's' : ''}
            {filtered.length < lotes.length && <> (filtrado de {lotes.length})</>}
          </span>
        </div>
      )}

      {/* ── List ── */}
      <div className={styles.card}>
        {loading ? (
          <div className={styles.empty}>
            <Loader2 size={24} className={styles.spin} />
            <p>Carregando lotes...</p>
          </div>
        ) : erro ? (
          <div className={styles.empty}>
            <AlertTriangle size={24} style={{ color: 'var(--error)' }} />
            <p style={{ color: 'var(--error)' }}>{erro}</p>
          </div>
        ) : lotes.length === 0 ? (
          <div className={styles.empty}>
            <History size={36} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            <p>Nenhum envio registrado ainda.</p>
            <button className={styles.ctaBtn} onClick={() => onNavigate('novo-envio')}>
              <Send size={13} /> Fazer primeiro envio
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <p>Nenhum resultado para os filtros selecionados.</p>
            <button className={styles.clearFiltersBtn} onClick={clearFilters}>
              <X size={12} /> Limpar filtros
            </button>
          </div>
        ) : (
          <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {selectMode && <th style={{ width: 36 }}></th>}
                  <th>Data / Hora</th>
                  <th>Evento</th>
                  <th>Empresa</th>
                  <th>Período</th>
                  <th>CNPJ Contribuinte</th>
                  <th>Ambiente</th>
                  <th>Protocolo</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(lote => {
                  const st = STATUS_MAP[lote.status] ?? STATUS_MAP['PENDENTE']
                  const isSelected = selected.has(lote.idEnvio)
                  const empresaLote = empresas.find(e => onlyDigits(e.cnpj).slice(0,8) === onlyDigits(lote.nrInscricao ?? '').slice(0,8))
                  return (
                    <tr
                      key={lote.idEnvio}
                      className={`${styles.tr} ${isSelected ? styles.trSelected : ''}`}
                      onClick={selectMode ? () => toggleSelect(lote.idEnvio) : undefined}
                      style={selectMode ? { cursor: 'pointer' } : {}}
                    >
                      {selectMode && (
                        <td>
                          <div className={styles.checkbox}>
                            {isSelected
                              ? <CheckSquare size={16} className={styles.cbChecked} />
                              : <Square size={16} className={styles.cbUnchecked} />}
                          </div>
                        </td>
                      )}
                      <td className={styles.tdMuted}>{fmtDate(lote.dtRecepcao)}</td>
                      <td><span className={styles.eventoBadge} style={{ color: TIPO_CORES[lote.tpEnvio] ?? 'var(--accent)', background: `${TIPO_CORES[lote.tpEnvio] ?? 'var(--accent)'}18` }}>{lote.tpEnvio}</span></td>
                      <td className={styles.tdMuted} style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{empresaLote?.nome ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td className={styles.tdMono}>{lote.perApur ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td className={styles.tdMono}>{fmtCnpj(lote.nrInscricao)}</td>
                      <td>
                        {lote.ambiente
                          ? <span className={lote.ambiente.toLowerCase() === 'producao' ? styles.ambProd : styles.ambHom}>
                              {lote.ambiente.toLowerCase() === 'producao' ? 'Produção' : 'Homologação'}
                            </span>
                          : <span className={styles.tdMono}>—</span>}
                      </td>
                      <td className={styles.tdMono}>{lote.protocolo ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${st.cls}`}>
                          <span className={styles.stDot} style={{ background: st.dot }} />
                          {st.label}
                        </span>
                      </td>
                      <td>
                        <button
                          className={styles.actionBtn}
                          onClick={e => { e.stopPropagation(); setDetalhe(lote) }}
                          title="Ver detalhes"
                        >
                          <Eye size={13} /> Detalhes
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Paginação ── */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ← Anterior
              </button>
              <span className={styles.pageInfo}>
                Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
              </span>
              <button
                className={styles.pageBtn}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Próxima →
              </button>
            </div>
          )}
          </>
        )}
      </div>

      {/* ── Detail modal ── */}
      <AnimatePresence>
        {detalhe && (() => {
          const st       = STATUS_MAP[detalhe.status] ?? STATUS_MAP['PENDENTE']
          const empresa  = empresas.find(e => onlyDigits(e.cnpj).slice(0,8) === onlyDigits(detalhe.nrInscricao ?? '').slice(0,8))
          const mesAno   = detalhe.dtRecepcao
            ? new Date(detalhe.dtRecepcao).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
            : '—'
          const isProd   = detalhe.ambiente?.toLowerCase() === 'producao'

          return (
            <motion.div
              className={styles.overlay}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDetalhe(null)}
            >
              <motion.div
                className={styles.modal}
                initial={{ scale: 0.97, opacity: 0, y: 10 }}
                animate={{ scale: 1,    opacity: 1, y: 0  }}
                exit={{ scale: 0.97,    opacity: 0, y: 10 }}
                transition={{ duration: 0.18 }}
                onClick={e => e.stopPropagation()}
              >
                <div className={styles.modalHero}>
                  <div className={styles.heroLeft}>
                    <span className={styles.heroEvento} style={{ color: TIPO_CORES[detalhe.tpEnvio] ?? 'var(--accent)' }}>{detalhe.tpEnvio}</span>
                    <div className={styles.heroMeta}>
                      <span className={styles.heroEmpresa}>
                        {empresa?.nome ?? fmtCnpj(detalhe.nrInscricao)}
                      </span>
                      <span className={styles.heroDot}>·</span>
                      <span className={styles.heroMes}>{mesAno}</span>
                      <span className={styles.heroDot}>·</span>
                      <span className={isProd ? styles.heroProd : styles.heroHom}>
                        {isProd ? 'Produção' : 'Homologação'}
                      </span>
                    </div>
                    <div className={styles.heroRemetente}>
                      Enviado por <strong>{detalhe.usuarioNome ?? '—'}</strong>
                    </div>
                  </div>
                  <div className={styles.heroRight}>
                    <span className={`${styles.statusBadgeLg} ${st.cls}`}>
                      <span className={styles.stDot} style={{ background: st.dot }} />
                      {st.label}
                    </span>
                    <button className={styles.closeBtn} onClick={() => setDetalhe(null)}>
                      <X size={15} />
                    </button>
                  </div>
                </div>

                <div className={styles.modalBody}>
                  {/* ── Coluna esquerda: info ── */}
                  <div className={styles.modalLeft}>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoCell}>
                        <span className={styles.infoKey}>CNPJ Contribuinte</span>
                        <span className={styles.infoValMono}>{fmtCnpj(detalhe.nrInscricao)}</span>
                      </div>
                      <div className={styles.infoCell}>
                        <span className={styles.infoKey}>Protocolo de Envio</span>
                        <span className={styles.infoValMono}>{detalhe.protocolo ?? '—'}</span>
                      </div>
                      <div className={styles.infoCell}>
                        <span className={styles.infoKey}>Data de Recepção</span>
                        <span className={styles.infoVal}>{fmtDate(detalhe.dtRecepcao)}</span>
                      </div>
                      <div className={styles.infoCell}>
                        <span className={styles.infoKey}>Tipo de Evento</span>
                        <span className={styles.infoVal}>
                          <span className={styles.eventoBadge} style={{ color: TIPO_CORES[detalhe.tpEnvio] ?? 'var(--accent)', background: `${TIPO_CORES[detalhe.tpEnvio] ?? 'var(--accent)'}18` }}>{detalhe.tpEnvio}</span>
                        </span>
                      </div>
                      <div className={styles.infoCell}>
                        <span className={styles.infoKey}>Período de Apuração</span>
                        <span className={styles.infoValMono}>{detalhe.perApur ?? '—'}</span>
                      </div>
                      <div className={styles.infoCell}>
                        <span className={styles.infoKey}>ID do Lote</span>
                        <span className={styles.infoValMono}>#{String(detalhe.idEnvio)}</span>
                      </div>
                      <div className={styles.infoCell}>
                        <span className={styles.infoKey}>Empresa</span>
                        <span className={styles.infoVal}>{empresa?.nome ?? '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Coluna direita: eventos do lote ── */}
                  <div className={styles.modalRight}>
                    {(() => {
                      if (!detalhe.eventosJson) return <div className={styles.noEventos}>Sem eventos registrados neste lote.</div>
                      let evs
                      try { evs = JSON.parse(detalhe.eventosJson) } catch { return <div className={styles.noEventos}>Sem eventos registrados neste lote.</div> }
                      if (!evs?.length) return <div className={styles.noEventos}>Sem eventos registrados neste lote.</div>

                      const allSelectable = evs.filter(e => e.nrRecibo)

                      return (
                        <div className={styles.eventosSection}>
                          <div className={styles.eventosSectionHead}>
                            <span className={styles.eventosSectionTitle}>
                              Eventos neste lote
                              <span className={styles.eventosSectionCount}>{evs.length}</span>
                            </span>
                            {onRetificar && allSelectable.length > 0 && (
                              <div className={styles.eventosSelectLinks}>
                                <button
                                  className={styles.eventosSelLink}
                                  onClick={() => setSelectedEventIds(new Set(allSelectable.map(e => e.id)))}
                                >
                                  Todos
                                </button>
                                <span className={styles.eventosSelSep}>·</span>
                                <button
                                  className={styles.eventosSelLink}
                                  onClick={() => setSelectedEventIds(new Set())}
                                >
                                  Nenhum
                                </button>
                              </div>
                            )}
                          </div>

                          <div className={styles.eventosList}>
                            {evs.map((ev, i) => {
                              const evSt      = STATUS_MAP[ev.status] ?? STATUS_MAP['PENDENTE']
                              const canSelect = !!ev.nrRecibo && !!onRetificar
                              const isSel     = selectedEventIds.has(ev.id)

                              return (
                                <div
                                  key={ev.id ?? i}
                                  className={`${styles.eventoRow} ${isSel ? styles.eventoRowSel : ''} ${!canSelect ? styles.eventoRowDim : ''}`}
                                  onClick={canSelect ? () => setSelectedEventIds(prev => {
                                    const next = new Set(prev)
                                    next.has(ev.id) ? next.delete(ev.id) : next.add(ev.id)
                                    return next
                                  }) : undefined}
                                  style={canSelect ? { cursor: 'pointer' } : {}}
                                >
                                  <span className={styles.eventoIdx}>{i + 1}</span>
                                  <span className={`${styles.statusBadge} ${evSt.cls}`} style={{ fontSize: '0.65rem' }}>
                                    <span className={styles.stDot} style={{ background: evSt.dot }} />
                                    {evSt.label}
                                  </span>
                                  {ev.cnpjCpfBenef && (
                                    <span className={styles.eventoBenef} title="CPF/CNPJ do beneficiário">
                                      {ev.tipo === 'R-4010' ? fmtCpf(ev.cnpjCpfBenef) : fmtCnpj(ev.cnpjCpfBenef)}
                                    </span>
                                  )}
                                  <span className={styles.eventoRecibo}>
                                    {ev.nrRecibo
                                      ? <code className={styles.eventoReciboCode}>{ev.nrRecibo}</code>
                                      : <span className={styles.eventoReciboNone}>sem recibo</span>
                                    }
                                  </span>
                                  {canSelect && (
                                    <span className={styles.eventoCheck}>
                                      {isSel
                                        ? <CheckSquare size={14} className={styles.cbChecked} />
                                        : <Square size={14} className={styles.cbUnchecked} />
                                      }
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {onRetificar && allSelectable.length > 0 && (
                            <p className={styles.eventosHint}>
                              Selecione os eventos que deseja retificar — o número do recibo será preenchido automaticamente.
                            </p>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button className={styles.exportBtn} onClick={() => setDetalhe(null)}>
                    Fechar
                  </button>
                  {detalhe.protocolo && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                      <button
                        className={styles.consultarBtn}
                        onClick={handleConsultarRF}
                        disabled={consultando}
                        title="Consultar situação deste lote na Receita Federal e atualizar recibos"
                      >
                        {consultando
                          ? <><Loader2 size={13} className={styles.spin} /> Consultando...</>
                          : <><RefreshCw size={13} /> Consultar RF</>
                        }
                      </button>
                      {consultaErro && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--error)', maxWidth: 220 }}>{consultaErro}</span>
                      )}
                    </div>
                  )}
                  {onRetificar && (() => {
                    let evs = []
                    try { if (detalhe.eventosJson) evs = JSON.parse(detalhe.eventosJson) } catch { evs = [] }

                    const hasEvData = evs.length > 0
                    const selEvs    = evs.filter(e => selectedEventIds.has(e.id))
                    const disabled  = hasEvData && selEvs.length === 0

                    function handleRetif() {
                      const rows = hasEvData
                        ? selEvs.map(ev => ({
                            ...(ev.rowData ?? {}),
                            acao: 'ALTERAR',
                            nrRecibo: ev.nrRecibo ?? '',
                          }))
                        : [{ acao: 'ALTERAR', nrRecibo: '' }]
                      onRetificar({ evento: detalhe.tpEnvio, ambiente: detalhe.ambiente, nrInscricao: detalhe.nrInscricao, rows })
                      setDetalhe(null)
                    }

                    return (
                      <button
                        className={styles.retifBtn}
                        onClick={handleRetif}
                        disabled={disabled}
                        title={disabled ? 'Selecione ao menos um evento para retificar' : ''}
                      >
                        <RotateCcw size={13} />
                        {hasEvData
                          ? selEvs.length > 0
                            ? `Retificar ${selEvs.length} evento${selEvs.length !== 1 ? 's' : ''}`
                            : 'Selecione eventos'
                          : 'Retificar / Alterar'
                        }
                      </button>
                    )
                  })()}
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </motion.div>
  )
}
