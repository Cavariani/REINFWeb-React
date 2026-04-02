import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  SearchCheck, Loader2, ChevronDown, ChevronUp, Copy, Check,
  AlertCircle, CheckCircle2, Clock, XCircle, FileCode2, Send, RotateCcw
} from 'lucide-react'
import { listCertificados, consultarLote } from '../api/client'
import styles from './Consulta.module.css'

// ── XML formatter + syntax highlighter ────────────────────────────────────────

function formatXml(xml) {
  let result = ''
  let indent = 0
  const pad = '  '
  // Normaliza quebras entre tags
  xml.replace(/>\s*</g, '>\n<').split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed) return
    if (trimmed.match(/^<\/[^>]+>/))           indent = Math.max(0, indent - 1)
    else if (trimmed.match(/^<[^?!\/][^>]*[^\/]>/) && !trimmed.includes('</')) indent++
    result += pad.repeat(Math.max(0, indent - (trimmed.startsWith('</') ? 0 : 0))) + trimmed + '\n'
    if (trimmed.match(/^<[^?!\/][^>]*[^\/]>/) && trimmed.includes('</')) { /* inline open+close, no indent change */ }
    else if (trimmed.match(/^<[^?!\/][^>\/]*>$/) && !trimmed.match(/^<\//)) { /* already incremented */ }
  })
  return result.trim()
}

function XmlHighlight({ xml }) {
  const formatted = formatXml(xml)

  // Tokenize: alternating tags and text
  const tokens = []
  const rx = /(<(?:!--[\s\S]*?--|[^>]+)>|[^<]+)/g
  let m
  while ((m = rx.exec(formatted)) !== null) tokens.push(m[0])

  function renderTag(tag, i) {
    // Comment
    if (tag.startsWith('<!--')) {
      return <span key={i} style={{ color: '#6b7280' }}>{tag}</span>
    }
    // XML declaration / processing instruction
    if (tag.startsWith('<?')) {
      return <span key={i} style={{ color: '#94a3b8' }}>{tag}</span>
    }
    // Closing tag
    if (tag.startsWith('</')) {
      const name = tag.slice(2, -1).trim()
      return (
        <span key={i}>
          <span style={{ color: '#475569' }}>{'</'}</span>
          <span style={{ color: '#38bdf8' }}>{name}</span>
          <span style={{ color: '#475569' }}>{'>'}</span>
        </span>
      )
    }
    // Self-closing or opening
    const selfClose = tag.endsWith('/>')
    const inner = tag.slice(1, selfClose ? -2 : -1)
    const spaceIdx = inner.search(/[\s\n]/)
    const tagName = spaceIdx === -1 ? inner : inner.slice(0, spaceIdx)
    const attrsStr = spaceIdx === -1 ? '' : inner.slice(spaceIdx)

    const attrParts = []
    const attrRx = /(\s+)([\w:.-]+)(\s*=\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g
    let last = 0, am
    while ((am = attrRx.exec(attrsStr)) !== null) {
      if (am.index > last) attrParts.push(<span key={`ws${last}`} style={{ color: '#94a3b8' }}>{attrsStr.slice(last, am.index)}</span>)
      attrParts.push(<span key={`ws${am.index}`} style={{ color: '#94a3b8' }}>{am[1]}</span>)
      attrParts.push(<span key={`an${am.index}`} style={{ color: '#a78bfa' }}>{am[2]}</span>)
      attrParts.push(<span key={`eq${am.index}`} style={{ color: '#94a3b8' }}>{am[3]}</span>)
      attrParts.push(<span key={`av${am.index}`} style={{ color: '#86efac' }}>{am[4]}</span>)
      last = am.index + am[0].length
    }
    if (last < attrsStr.length) attrParts.push(<span key={`tail`} style={{ color: '#94a3b8' }}>{attrsStr.slice(last)}</span>)

    return (
      <span key={i}>
        <span style={{ color: '#475569' }}>{'<'}</span>
        <span style={{ color: '#38bdf8' }}>{tagName}</span>
        {attrParts}
        <span style={{ color: '#475569' }}>{selfClose ? '/>' : '>'}</span>
      </span>
    )
  }

  return (
    <pre className={styles.xmlPre}>
      {tokens.map((token, i) =>
        token.startsWith('<')
          ? renderTag(token, i)
          : <span key={i} style={{ color: '#f1f5f9' }}>{token}</span>
      )}
    </pre>
  )
}

// ──────────────────────────────────────────────────────────────────────────────

const PAGE = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26 } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.14 } },
}

const SITUACAO = {
  1: { label: 'Em Processamento', cls: 'pending', icon: Clock },
  2: { label: 'Inválido',         cls: 'error',   icon: XCircle },
  3: { label: 'Processado',       cls: 'success',  icon: CheckCircle2 },
}

const CD_RESPOSTA_LABELS = {
  '100': 'Aceito com Sucesso',
  '101': 'Aceito com Alertas',
  '200': 'Ocorrência de aviso',
  '201': 'Ocorrência de erro',
  '300': 'Erro no processamento',
  '301': 'Erro de autenticação/autorização',
  '401': 'Requisição mal formada',
  '402': 'Certificado inválido',
  '403': 'CNPJ sem autorização',
  '500': 'Erro interno da Receita Federal',
}

function StatusBadge({ situacao }) {
  const info = SITUACAO[situacao]
  if (!info) return null
  const Icon = info.icon
  return (
    <span className={`${styles.badge} ${styles[`badge_${info.cls}`]}`}>
      <Icon size={12} />
      {info.label}
    </span>
  )
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button className={styles.copyBtn} onClick={handleCopy} title="Copiar">
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function EventoCard({ evt, index, tpEnvio, certId, onRetificar }) {
  const [open, setOpen] = useState(index === 0)
  const isSuccess = evt.cdResposta === '100' || evt.cdResposta === '101'
  const isError = Number(evt.cdResposta) >= 200

  return (
    <div className={`${styles.evtCard} ${isError ? styles.evtCardError : isSuccess ? styles.evtCardSuccess : ''}`}>
      <button className={styles.evtHeader} onClick={() => setOpen(o => !o)}>
        <div className={styles.evtHeaderLeft}>
          {isSuccess
            ? <CheckCircle2 size={15} className={styles.iconSuccess} />
            : isError
              ? <XCircle size={15} className={styles.iconError} />
              : <Clock size={15} className={styles.iconPending} />
          }
          <span className={styles.evtId}>{evt.eventoId || `Evento ${index + 1}`}</span>
          {evt.cdResposta && (
            <span className={`${styles.cdTag} ${isError ? styles.cdTagError : isSuccess ? styles.cdTagSuccess : ''}`}>
              {evt.cdResposta} — {CD_RESPOSTA_LABELS[evt.cdResposta] ?? evt.dsResposta ?? 'Sem descrição'}
            </span>
          )}
        </div>
        <div className={styles.evtHeaderRight}>
          {evt.nrRec && <span className={styles.evtRecibo}>Recibo: {evt.nrRec}</span>}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.evtBody}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className={styles.evtGrid}>
              {evt.dtHrRecepcao && (
                <div className={styles.evtField}>
                  <span className={styles.evtFieldLabel}>Data/Hora Recepção</span>
                  <span className={styles.evtFieldValue}>{evt.dtHrRecepcao}</span>
                </div>
              )}
              {evt.nrRec && (
                <div className={styles.evtField}>
                  <span className={styles.evtFieldLabel}>Número de Recibo</span>
                  <div className={styles.evtFieldRow}>
                    <span className={styles.evtFieldValue}>{evt.nrRec}</span>
                    <CopyBtn text={evt.nrRec} />
                  </div>
                </div>
              )}
              {evt.hash && (
                <div className={`${styles.evtField} ${styles.evtFieldFull}`}>
                  <span className={styles.evtFieldLabel}>Hash</span>
                  <div className={styles.evtFieldRow}>
                    <span className={`${styles.evtFieldValue} ${styles.mono}`}>{evt.hash}</span>
                    <CopyBtn text={evt.hash} />
                  </div>
                </div>
              )}
            </div>

            {evt.ocorrencias?.length > 0 && (
              <div className={styles.ocorrencias}>
                <span className={styles.ocorrenciasTitle}>Ocorrências ({evt.ocorrencias.length})</span>
                {evt.ocorrencias.map((oc, i) => (
                  <div key={i} className={`${styles.ocorrencia} ${oc.tipo === 'E' ? styles.ocorrenciaError : styles.ocorrenciaWarn}`}>
                    <span className={styles.ocTipo}>{oc.tipo === 'E' ? 'Erro' : 'Aviso'} {oc.codigo}</span>
                    <span className={styles.ocDesc}>{oc.descricao}</span>
                    {oc.localizacao && <span className={styles.ocLoc}>{oc.localizacao}</span>}
                  </div>
                ))}
              </div>
            )}

            {evt.nrRec && onRetificar && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => onRetificar({ evento: tpEnvio, certId, nrRecibo: evt.nrRec })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.38rem 0.85rem', borderRadius: 7,
                    background: 'rgba(233,115,32,0.12)', border: '1px solid rgba(233,115,32,0.35)',
                    color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  }}
                  title={`Retificar este evento (nrRec: ${evt.nrRec})`}
                >
                  <RotateCcw size={12} /> Retificar este evento
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Consulta({ onNavigate, protocoloInicial = '', onRetificar }) {
  const [certs, setCerts] = useState([])
  const [certId, setCertId] = useState('')
  const [protocolo, setProtocolo] = useState(protocoloInicial)
  const [ambiente, setAmbiente] = useState('homologacao')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState(null)
  const [showXml, setShowXml] = useState(false)

  useEffect(() => {
    listCertificados().then(data => {
      setCerts(data ?? [])
      if (data?.length) setCertId(data[0].id)
    }).catch(() => {})
  }, [])

  async function handleConsultar(e) {
    e.preventDefault()
    if (!protocolo.trim()) return
    if (!certId) { setErro('Selecione um certificado.'); return }
    setLoading(true)
    setErro(null)
    setResultado(null)
    setShowXml(false)
    try {
      const data = await consultarLote(protocolo.trim(), certId, ambiente)
      setResultado(data)
    } catch (ex) {
      setErro(ex.message)
    } finally {
      setLoading(false)
    }
  }

  function handleLimpar() {
    setProtocolo('')
    setResultado(null)
    setErro(null)
    setShowXml(false)
  }

  return (
    <motion.div className={styles.page} {...PAGE}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Consulta de Lotes</h1>
          <p className={styles.sub}>Verifique o resultado de envios pelo protocolo da Receita Federal</p>
        </div>
        <button className={styles.newBtn} onClick={() => onNavigate('novo-envio')}>
          <Send size={13} /> Novo Envio
        </button>
      </div>

      {/* Formulário */}
      <div className={styles.formCard}>
        <form onSubmit={handleConsultar} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Protocolo de Envio</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Ex.: 1.4.3.20250311100000000000001"
              value={protocolo}
              onChange={e => setProtocolo(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Certificado Digital</label>
            <select
              className={styles.select}
              value={certId}
              onChange={e => setCertId(Number(e.target.value))}
              disabled={loading}
            >
              {certs.length === 0
                ? <option value="">Nenhum certificado cadastrado</option>
                : certs.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome} — {c.cnpjContribuinte}
                    </option>
                  ))
              }
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Ambiente</label>
            <div className={styles.ambienteToggle}>
              <button
                type="button"
                className={`${styles.ambBtn} ${ambiente === 'homologacao' ? styles.ambBtnActive : ''}`}
                onClick={() => setAmbiente('homologacao')}
                disabled={loading}
              >
                Homologação
              </button>
              <button
                type="button"
                className={`${styles.ambBtn} ${ambiente === 'producao' ? styles.ambBtnActiveProd : ''}`}
                onClick={() => setAmbiente('producao')}
                disabled={loading}
              >
                Produção
              </button>
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.consultarBtn} disabled={loading || !protocolo.trim() || !certId}>
              {loading
                ? <><Loader2 size={14} className={styles.spin} /> Consultando...</>
                : <><SearchCheck size={14} /> Consultar</>
              }
            </button>
            {(resultado || erro) && (
              <button type="button" className={styles.limparBtn} onClick={handleLimpar}>
                Nova Consulta
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Erro */}
      {erro && (
        <motion.div className={styles.erroCard} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <AlertCircle size={16} />
          <div>
            <strong>Erro na consulta</strong>
            <p>{erro}</p>
          </div>
        </motion.div>
      )}

      {/* Resultado */}
      {resultado && (
        <motion.div className={styles.resultado} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {/* Cabeçalho do resultado */}
          <div className={styles.resultHeader}>
            <div className={styles.resultHeaderLeft}>
              <SearchCheck size={16} className={styles.resultIcon} />
              <div>
                <div className={styles.resultTitle}>Resultado da Consulta</div>
                <div className={styles.resultProtocolo}>
                  <span className={styles.mono}>{resultado.protocolo}</span>
                  <CopyBtn text={resultado.protocolo} />
                </div>
              </div>
            </div>
            <StatusBadge situacao={resultado.situacaoLote} />
          </div>

          {resultado.dtRecepcao && (
            <div className={styles.resultMeta}>
              <span>Recebido em: <strong>{resultado.dtRecepcao}</strong></span>
              {resultado.versaoAplicativo && (
                <span>Aplicativo: <strong>{resultado.versaoAplicativo}</strong></span>
              )}
            </div>
          )}

          {resultado.erroParsing && (
            <div className={styles.erroCard} style={{ marginTop: '1rem' }}>
              <AlertCircle size={16} />
              <div><strong>Aviso:</strong> <span>{resultado.erroParsing}</span></div>
            </div>
          )}

          {/* Eventos */}
          {resultado.eventos?.length > 0 && (
            <div className={styles.eventosSection}>
              <div className={styles.eventosSectionTitle}>
                Eventos ({resultado.eventos.length})
              </div>
              <div className={styles.eventosList}>
                {resultado.eventos.map((evt, i) => (
                  <EventoCard
                    key={evt.eventoId || i}
                    evt={evt}
                    index={i}
                    tpEnvio={resultado.tpEnvio}
                    certId={certId}
                    onRetificar={onRetificar}
                  />
                ))}
              </div>
            </div>
          )}

          {/* XML Bruto */}
          <div className={styles.xmlSection}>
            <button
              className={styles.xmlToggle}
              onClick={() => setShowXml(o => !o)}
            >
              <FileCode2 size={13} />
              {showXml ? 'Ocultar XML de Retorno' : 'Ver XML de Retorno'}
              {showXml ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            <AnimatePresence>
              {showXml && (
                <motion.div
                  className={styles.xmlBox}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className={styles.xmlActions}>
                    <CopyBtn text={resultado.xmlBruto} />
                  </div>
                  <XmlHighlight xml={resultado.xmlBruto} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Estado vazio */}
      {!loading && !resultado && !erro && (
        <motion.div className={styles.empty} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <SearchCheck size={40} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Nenhuma consulta realizada</p>
          <p className={styles.emptySub}>
            Informe o protocolo retornado no envio e selecione o certificado para autenticar junto à Receita Federal.
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}
