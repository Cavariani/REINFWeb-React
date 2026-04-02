import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Plus, Trash2, AlertTriangle, X, Loader2,
  UserPlus, ChevronDown, Check, ShieldCheck, Search, CheckCircle2,
} from 'lucide-react'
import {
  listEmpresas, criarEmpresa, deletarEmpresa,
  associarUsuarioEmpresa, desassociarUsuarioEmpresa,
  listUsuarios, setCertificadoEmpresa, listCertificados,
} from '../api/client'
import styles from './Empresas.module.css'

const PAGE = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26 } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.14 } },
}

function fmtCnpj(v) {
  if (!v) return '—'
  const d = v.replace(/\D/g, '')
  return d.length === 14
    ? `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
    : v
}

// Dropdown de adicionar usuário — usa position:fixed para escapar de overflow:clip do card
function AddUserDropdown({ empresa, usuarios, onAssociar }) {
  const [open, setOpen]       = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, alignRight: false })
  const [busca, setBusca]     = useState('')
  const btnRef    = useRef(null)
  const dropRef   = useRef(null)
  const searchRef = useRef(null)

  const disponiveis = usuarios.filter(u => !empresa.usuarioIds.includes(u.id))
  const filtrados = busca.trim()
    ? disponiveis.filter(u =>
        u.nome.toLowerCase().includes(busca.toLowerCase()) ||
        u.email.toLowerCase().includes(busca.toLowerCase())
      )
    : disponiveis

  useEffect(() => {
    if (!open) return
    setTimeout(() => searchRef.current?.focus(), 50)
    function handler(e) {
      if (
        dropRef.current && !dropRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) { setOpen(false); setBusca('') }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceRight = window.innerWidth - rect.left
      const alignRight = spaceRight < 260
      setDropPos({
        top: rect.bottom + 6,
        left: alignRight ? rect.right - 260 : rect.left,
      })
    }
    if (open) setBusca('')
    setOpen(v => !v)
  }

  return (
    <div className={styles.addUserWrap}>
      <button
        ref={btnRef}
        className={styles.addUserBtn}
        onClick={handleToggle}
        disabled={disponiveis.length === 0}
        title={disponiveis.length === 0 ? 'Todos os usuários já vinculados' : 'Vincular usuário'}
      >
        <UserPlus size={12} />
        <ChevronDown size={10} />
      </button>
      {open && disponiveis.length > 0 && (
        <div
          ref={dropRef}
          className={styles.addUserDropdown}
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
        >
          {/* Campo de busca */}
          <div className={styles.dropdownSearch}>
            <Search size={12} className={styles.dropdownSearchIcon} />
            <input
              ref={searchRef}
              className={styles.dropdownSearchInput}
              placeholder="Buscar usuário..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            {busca && (
              <button className={styles.dropdownSearchClear} onClick={() => setBusca('')}>
                <X size={10} />
              </button>
            )}
          </div>

          {/* Lista */}
          <div className={styles.dropdownList}>
            {filtrados.length === 0 ? (
              <div className={styles.dropdownEmpty}>Nenhum usuário encontrado</div>
            ) : filtrados.map(u => (
              <button
                key={u.id}
                className={styles.dropdownItem}
                onClick={() => { onAssociar(empresa.id, u.id); setOpen(false); setBusca('') }}
              >
                <div className={styles.dropdownAvatar}>{(u.nome?.[0] ?? 'U').toUpperCase()}</div>
                <div className={styles.dropdownInfo}>
                  <div className={styles.dropdownName}>{u.nome}</div>
                  <div className={styles.dropdownEmail}>{u.email}</div>
                </div>
                <Check size={12} className={styles.dropdownCheck} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Empresas({ user }) {
  const isAdmin = user?.isAdmin ?? false

  const [empresas,   setEmpresas]   = useState([])
  const [usuarios,   setUsuarios]   = useState([])
  const [certs,      setCerts]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [erro,       setErro]       = useState('')
  const [showModal,  setShowModal]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [nome,       setNome]       = useState('')
  const [cnpj,       setCnpj]       = useState('')
  const [modalErro,  setModalErro]  = useState('')
  const [savingCert,   setSavingCert]   = useState(null)
  const [pendingCerts, setPendingCerts] = useState({}) // { [empresaId]: string }
  const [toast,        setToast]        = useState(null)
  const [busca,        setBusca]        = useState('')

  useEffect(() => {
    const promises = [listEmpresas(), listUsuarios(), listCertificados()]

    Promise.all(promises)
      .then(([emp, usr, cs]) => { setEmpresas(emp); setUsuarios(usr); setCerts(cs) })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false))
  }, [isAdmin])

  const lista = empresas.filter(e => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return (
      e.nome.toLowerCase().includes(q) ||
      (e.cnpj ?? '').replace(/\D/g,'').includes(q.replace(/\D/g,'')) ||
      fmtCnpj(e.cnpj).includes(q)
    )
  })

  async function handleCriar() {
    setModalErro('')
    if (!nome.trim()) { setModalErro('Informe o nome da empresa.'); return }
    const cnpjClean = cnpj.replace(/\D/g, '')
    if (cnpjClean.length !== 14) { setModalErro('CNPJ deve ter 14 dígitos.'); return }
    setSaving(true)
    try {
      const nova = await criarEmpresa(nome.trim(), cnpjClean)
      setEmpresas(prev => [...prev, nova].sort((a, b) => a.nome.localeCompare(b.nome)))
      setShowModal(false)
      setNome(''); setCnpj('')
    } catch (e) {
      setModalErro(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletar(id, nomEmp) {
    if (!window.confirm(`Excluir a empresa "${nomEmp}" permanentemente?`)) return
    try {
      await deletarEmpresa(id)
      setEmpresas(prev => prev.filter(e => e.id !== id))
    } catch (e) { setErro(e.message) }
  }

  async function handleAssociar(empresaId, usuarioId) {
    try {
      const updated = await associarUsuarioEmpresa(empresaId, usuarioId)
      setEmpresas(prev => prev.map(e => e.id === empresaId ? { ...e, ...updated } : e))
    } catch (e) { setErro(e.message) }
  }

  async function handleDesassociar(empresaId, usuarioId) {
    try {
      await desassociarUsuarioEmpresa(empresaId, usuarioId)
      setEmpresas(prev => prev.map(e =>
        e.id === empresaId
          ? { ...e, usuarioIds: e.usuarioIds.filter(id => id !== usuarioId) }
          : e
      ))
    } catch (e) { setErro(e.message) }
  }

  async function handleSetCertificado(empresaId, certIdStr, nomeEmpresa) {
    const certId = certIdStr ? Number(certIdStr) : null
    setSavingCert(empresaId)
    try {
      await setCertificadoEmpresa(empresaId, certId)
      const cert = certId ? certs.find(c => c.id === certId) : null
      setEmpresas(prev => prev.map(e =>
        e.id === empresaId
          ? { ...e, certificadoId: cert?.id ?? null, certificadoNome: cert?.nome ?? null, certificadoCnpj: cert?.cnpjContribuinte ?? null, certificadoDtValidade: cert?.dtValidade ?? null }
          : e
      ))
      setPendingCerts(p => { const n = { ...p }; delete n[empresaId]; return n })
      if (cert) {
        setToast({ msg: `Certificado "${cert.nome}" atribuído a "${nomeEmpresa}" com sucesso.` })
        setTimeout(() => setToast(null), 3500)
      }
    } catch (e) { setErro(e.message) }
    finally { setSavingCert(null) }
  }

  function fmtValidadeCert(dtValidade) {
    if (!dtValidade) return null
    const dias = Math.ceil((new Date(dtValidade) - new Date()) / (1000 * 60 * 60 * 24))
    if (dias < 0)   return { label: `Expirado há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? 's' : ''}`, cls: 'exp' }
    if (dias <= 30) return { label: `Expira em ${dias} dia${dias !== 1 ? 's' : ''}`,                        cls: 'warn' }
    return              { label: `Válido — ${dias} dias`,                                                   cls: 'ok' }
  }

  function closeModal() {
    setShowModal(false); setNome(''); setCnpj(''); setModalErro('')
  }

  function getUsuario(id) { return usuarios.find(u => u.id === id) }

  return (
    <motion.div className={styles.page} {...PAGE}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Empresas</h1>
          <p className={styles.sub}>Contribuintes cadastrados — vincule o certificado digital e os responsáveis de cada empresa.</p>
        </div>
        {isAdmin && (
          <button className={styles.addBtn} onClick={() => setShowModal(true)}>
            <Plus size={14} />
            Novo Contribuinte
          </button>
        )}
      </div>

      {/* ── Busca ── */}
      <div className={styles.toolBar}>
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por nome ou CNPJ..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          {busca && (
            <button className={styles.searchClear} onClick={() => setBusca('')}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className={styles.erroMsg}>
          <AlertTriangle size={12} /> {erro}
        </div>
      )}

      {/* ── Lista ── */}
      {loading ? (
        <div className={styles.loadingRow}>
          <Loader2 size={18} className={styles.spin} /> Carregando empresas...
        </div>
      ) : lista.length === 0 ? (
        <div className={styles.emptyState}>
          <Building2 size={28} className={styles.emptyIcon} />
          {busca ? (
            <>
              <p>Nenhuma empresa encontrada para "<strong>{busca}</strong>".</p>
              <button className={styles.clearSearchBtn} onClick={() => setBusca('')}>
                <X size={12} /> Limpar busca
              </button>
            </>
          ) : (
            <>
              <p>Nenhum contribuinte cadastrado.</p>
              {isAdmin && <p className={styles.emptySub}>Clique em "Novo Contribuinte" para começar.</p>}
            </>
          )}
        </div>
      ) : (
        <div className={styles.listWrap}>
          {/* Cabeçalho da lista */}
          <div className={styles.listHeader}>
            <span className={styles.colEmpresa}>Empresa</span>
            <span className={styles.colEmissora}>Certificado Digital</span>
            <span className={styles.colUsuarios}>Responsáveis</span>
            <span className={styles.colAcoes} />
          </div>

          <AnimatePresence initial={false}>
            {lista.map((emp, i) => (
              <motion.div
                key={emp.id}
                className={`${styles.listRow} ${styles.rowContribuinte}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, delay: i * 0.02 }}
              >
                {/* Coluna Empresa */}
                <div className={styles.colEmpresa}>
                  <div className={`${styles.empresaIcon} ${styles.iconContribuinte}`}>
                    <Building2 size={15} />
                  </div>
                  <div className={styles.empresaInfo}>
                    <span className={styles.empresaNome}>{emp.nome}</span>
                    <span className={styles.empresaCnpj}>{fmtCnpj(emp.cnpj)}</span>
                  </div>
                </div>

                {/* Coluna Certificado Digital */}
                <div className={styles.colEmissora}>
                  {(() => {
                    const pendingVal = pendingCerts[emp.id]
                    const currentVal = String(emp.certificadoId ?? '')
                    const displayVal = pendingVal !== undefined ? pendingVal : currentVal
                    const hasPending = pendingVal !== undefined && pendingVal !== currentVal
                    const validadeCert = fmtValidadeCert(
                      pendingVal !== undefined
                        ? (pendingVal ? certs.find(c => c.id === Number(pendingVal))?.dtValidade : null)
                        : emp.certificadoDtValidade ?? certs.find(c => c.id === emp.certificadoId)?.dtValidade
                    )
                    return (
                      <div className={styles.certColInner}>
                        {/* Linha 1: select + botão confirm */}
                        <div className={styles.certSelectRow}>
                          <div className={styles.emissoraSelectWrap}>
                            <select
                              className={styles.emissoraSelect}
                              value={displayVal}
                              onChange={e => setPendingCerts(p => ({ ...p, [emp.id]: e.target.value }))}
                              disabled={savingCert === emp.id}
                            >
                              <option value="">— Nenhum —</option>
                              {certs.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.nome} — {fmtCnpj(c.cnpjContribuinte)}
                                </option>
                              ))}
                            </select>
                            {savingCert === emp.id
                              ? <Loader2 size={12} className={styles.spin} />
                              : <ChevronDown size={12} className={styles.selectChevron} />
                            }
                          </div>
                          {hasPending && (
                            <button
                              className={styles.certConfirmBtn}
                              onClick={() => handleSetCertificado(emp.id, pendingVal, emp.nome)}
                              disabled={savingCert === emp.id}
                              title="Confirmar atribuição"
                            >
                              <Check size={13} />
                            </button>
                          )}
                        </div>
                        {/* Linha 2: badge de validade */}
                        {validadeCert && (
                          <span className={`${styles.certValidBadge} ${styles[`certValid_${validadeCert.cls}`]}`}>
                            {validadeCert.label}
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* Coluna Responsáveis */}
                <div className={styles.colUsuarios}>
                  <div className={styles.usuariosInline}>
                    {emp.usuarioIds.length === 0
                      ? <span className={styles.noUsers}>Nenhum</span>
                      : emp.usuarioIds.map(uid => {
                          const u = getUsuario(uid)
                          if (!u) return null
                          return (
                            <div key={uid} className={styles.chip}>
                              <div className={styles.chipAvatar}>{(u.nome?.[0] ?? 'U').toUpperCase()}</div>
                              <span className={styles.chipName}>{u.nome.split(' ')[0]}</span>
                              {isAdmin && (
                              <button
                                className={styles.chipRemove}
                                onClick={() => handleDesassociar(emp.id, uid)}
                                title={`Desvincular ${u.nome}`}
                              >
                                <X size={9} />
                              </button>
                            )}
                            </div>
                          )
                        })
                    }
                    {isAdmin && (
                      <AddUserDropdown
                        empresa={emp}
                        usuarios={usuarios}
                        onAssociar={handleAssociar}
                      />
                    )}
                  </div>
                </div>

                {/* Coluna Ações */}
                <div className={styles.colAcoes}>
                  {isAdmin && (
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDeletar(emp.id, emp.nome)}
                    title="Excluir empresa"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Modal criar empresa ── */}
      {showModal && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <Building2 size={14} /> Novo Contribuinte
              </h2>
              <button className={styles.closeBtn} onClick={closeModal}><X size={16} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formField}>
                <label className={styles.label}>Nome</label>
                <input
                  className={styles.input}
                  placeholder="Ex: BTC, Empresa Cliente..."
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.label}>CNPJ</label>
                <input
                  className={styles.input}
                  placeholder="00.000.000/0001-00"
                  value={cnpj}
                  onChange={e => setCnpj(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCriar()}
                />
              </div>
              {modalErro && (
                <div className={styles.erroMsg}>
                  <AlertTriangle size={12} /> {modalErro}
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={closeModal}>Cancelar</button>
              <button className={styles.saveBtn} onClick={handleCriar} disabled={saving}>
                {saving ? <Loader2 size={14} className={styles.spin} /> : <Plus size={14} />}
                {saving ? 'Criando...' : 'Criar Contribuinte'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={styles.toast}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{    opacity: 0, y: 8,  scale: 0.97 }}
            transition={{ duration: 0.22 }}
          >
            <CheckCircle2 size={15} className={styles.toastIcon} />
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
