import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Plus, X, Users, CheckCircle2, XCircle, RefreshCw, Eye, EyeOff, Trash2, Shield, Search } from 'lucide-react'
import { listClientes, criarCliente, updateCliente, criarClienteAdmin, listClienteUsuarios, deletarCliente } from '../api/client'
import styles from './Clientes.module.css'

function fmtDate(d) {
  return new Date(d).toLocaleDateString('pt-BR')
}

// ── Modal: criar cliente ───────────────────────────────────────────────────────
function ModalCriarCliente({ onClose, onCreated }) {
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nome.trim()) { setError('Nome é obrigatório.'); return }
    setLoading(true)
    setError(null)
    try {
      const c = await criarCliente(nome.trim())
      onCreated(c)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Novo Cliente</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <form className={styles.modalBody} onSubmit={handleSubmit}>
          <label className={styles.fieldLabel}>Nome da empresa cliente</label>
          <input
            className={styles.input}
            placeholder="Ex: Empresa Exemplo"
            value={nome}
            onChange={e => setNome(e.target.value)}
            autoFocus
          />
          {error && <p className={styles.errorText}>{error}</p>}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Criando…' : 'Criar Cliente'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Modal: criar admin de um cliente ──────────────────────────────────────────
function ModalCriarAdmin({ cliente, onClose, onCreated }) {
  const [nome, setNome]   = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nome.trim() || !email.trim() || !senha) { setError('Preencha todos os campos.'); return }
    setLoading(true)
    setError(null)
    try {
      const u = await criarClienteAdmin(cliente.id, nome.trim(), email.trim(), senha)
      onCreated(u)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Criar Administrador</h2>
            <p className={styles.modalSub}>Para o cliente: <strong>{cliente.nome}</strong></p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <form className={styles.modalBody} onSubmit={handleSubmit}>
          <label className={styles.fieldLabel}>Nome</label>
          <input className={styles.input} placeholder="Nome completo" value={nome} onChange={e => setNome(e.target.value)} autoFocus />
          <label className={styles.fieldLabel}>E-mail</label>
          <input className={styles.input} type="email" placeholder="admin@empresa.com" value={email} onChange={e => setEmail(e.target.value)} />
          <label className={styles.fieldLabel}>Senha provisória</label>
          <div className={styles.passwordWrap}>
            <input
              className={styles.input}
              type={showPwd ? 'text' : 'password'}
              placeholder="Mínimo 6 caracteres"
              value={senha}
              onChange={e => setSenha(e.target.value)}
            />
            <button type="button" className={styles.pwdToggle} onClick={() => setShowPwd(v => !v)}>
              {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {error && <p className={styles.errorText}>{error}</p>}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Criando…' : 'Criar Admin'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Modal: confirmar exclusão de cliente ──────────────────────────────────────
function ModalDeletarCliente({ cliente, onClose, onDeleted }) {
  const [confirmacao, setConfirmacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const nomeEsperado = cliente.nome.toUpperCase()
  const confirmado   = confirmacao === nomeEsperado

  async function handleDeletar() {
    if (!confirmado) return
    setLoading(true)
    setError(null)
    try {
      await deletarCliente(cliente.id)
      onDeleted(cliente.id)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Excluir Cliente</h2>
            <p className={styles.modalSub}>Esta ação é irreversível.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.deleteWarning}>
            Para confirmar, digite o nome do cliente em letras maiúsculas:
          </p>
          <p className={styles.deleteNomeEsperado}>{nomeEsperado}</p>
          <input
            className={styles.input}
            placeholder="Digite aqui para confirmar..."
            value={confirmacao}
            onChange={e => setConfirmacao(e.target.value)}
            autoFocus
          />
          {error && <p className={styles.errorText}>{error}</p>}
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button
            className={styles.btnDanger}
            disabled={!confirmado || loading}
            onClick={handleDeletar}
          >
            {loading ? 'Excluindo…' : 'Excluir permanentemente'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Modal: ver usuários de um cliente ─────────────────────────────────────────
function ModalUsuarios({ cliente, onClose }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listClienteUsuarios(cliente.id)
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [cliente.id])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div
        className={`${styles.modal} ${styles.modalWide}`}
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Usuários — {cliente.nome}</h2>
            <p className={styles.modalSub}>{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {loading ? (
            <p className={styles.emptyText}>Carregando…</p>
          ) : users.length === 0 ? (
            <p className={styles.emptyText}>Nenhum usuário cadastrado neste cliente.</p>
          ) : (
            <table className={styles.usersTable}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Desde</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.nome}</td>
                    <td className={styles.mono}>{u.email}</td>
                    <td>
                      <span className={u.isAdmin ? styles.badgeAdmin : styles.badgeUser}>
                        {u.isAdmin ? 'Admin' : 'Usuário'}
                      </span>
                    </td>
                    <td className={styles.muted}>{fmtDate(u.dtCriacao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Clientes() {
  const [clientes, setClientes]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [query, setQuery]             = useState('')
  const [showCriar, setShowCriar]     = useState(false)
  const [adminTarget, setAdminTarget]   = useState(null)   // cliente para criar admin
  const [usersTarget, setUsersTarget]   = useState(null)   // cliente para ver usuários
  const [deleteTarget, setDeleteTarget] = useState(null)   // cliente para excluir
  const [togglingId, setTogglingId]     = useState(null)

  useEffect(() => {
    listClientes()
      .then(setClientes)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleToggleAtivo(cliente) {
    setTogglingId(cliente.id)
    try {
      const updated = await updateCliente(cliente.id, undefined, !cliente.ativa)
      setClientes(prev => prev.map(c => c.id === cliente.id ? updated : c))
    } catch { /* ignora */ } finally {
      setTogglingId(null)
    }
  }

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Globe size={22} className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>Clientes</h1>
            <p className={styles.subtitle}>Gestão de clientes da plataforma • Super Admin</p>
          </div>
        </div>
        <button className={styles.btnPrimary} onClick={() => setShowCriar(true)}>
          <Plus size={14} />
          Novo Cliente
        </button>
      </div>

      {loading ? (
        <div className={styles.empty}><RefreshCw size={28} className={styles.spinning} /></div>
      ) : clientes.length === 0 ? (
        <div className={styles.empty}>
          <Globe size={40} className={styles.emptyIcon} />
          <p>Nenhum cliente cadastrado ainda.</p>
        </div>
      ) : (
        <div className={styles.list}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchBar}
              placeholder="Buscar cliente..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          {[...clientes]
            .sort((a, b) => a.id === 1 ? -1 : b.id === 1 ? 1 : 0)
            .filter(c => c.nome.toLowerCase().includes(query.toLowerCase()))
            .map(c => (
            <div
              key={c.id}
              className={[
                styles.clienteRow,
                c.id === 1 ? styles.clienteRowMlegate : '',
                !c.ativa ? styles.clienteRowInativo : ''
              ].filter(Boolean).join(' ')}
            >
              <div className={styles.clienteInfo}>
                <div className={styles.clienteNomeRow}>
                  <span className={c.id === 1 ? styles.clienteNomeMlegate : styles.clienteNome}>{c.nome}</span>
                  {c.id === 1 && (
                    <span className={styles.badgeMlegate}>
                      <Shield size={10} />
                      SUPER ADMIN
                    </span>
                  )}
                </div>
                <span className={styles.clienteMeta}>
                  Desde {fmtDate(c.dtCriacao)}
                  &nbsp;·&nbsp;
                  <span className={styles.metaUsers}>
                    <Users size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                    {c.totalUsuarios} usuário{c.totalUsuarios !== 1 ? 's' : ''}
                  </span>
                </span>
              </div>

              <span className={c.ativa ? styles.badgeAtivo : styles.badgeInativo}>
                {c.ativa ? 'Ativo' : 'Inativo'}
              </span>

              <div className={styles.clienteActions}>
                <button
                  className={styles.btnIcon}
                  title="Ver usuários"
                  onClick={() => setUsersTarget(c)}
                >
                  <Users size={14} />
                </button>
                <button
                  className={styles.btnIconAccent}
                  title="Criar administrador"
                  onClick={() => setAdminTarget(c)}
                >
                  <Plus size={14} />
                  Admin
                </button>
                <button
                  className={c.ativa ? styles.btnIconDanger : styles.btnIconSuccess}
                  title={c.ativa ? 'Desativar' : 'Reativar'}
                  disabled={togglingId === c.id}
                  onClick={() => handleToggleAtivo(c)}
                >
                  {c.ativa ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                </button>
                <button
                  className={styles.btnIconDelete}
                  title="Excluir cliente"
                  onClick={() => setDeleteTarget(c)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCriar && (
          <ModalCriarCliente
            onClose={() => setShowCriar(false)}
            onCreated={c => { setClientes(prev => [...prev, c]); setShowCriar(false) }}
          />
        )}
        {adminTarget && (
          <ModalCriarAdmin
            cliente={adminTarget}
            onClose={() => setAdminTarget(null)}
            onCreated={() => {
              setClientes(prev => prev.map(c =>
                c.id === adminTarget.id ? { ...c, totalUsuarios: c.totalUsuarios + 1 } : c
              ))
              setAdminTarget(null)
            }}
          />
        )}
        {usersTarget && (
          <ModalUsuarios cliente={usersTarget} onClose={() => setUsersTarget(null)} />
        )}
        {deleteTarget && (
          <ModalDeletarCliente
            cliente={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={id => { setClientes(prev => prev.filter(c => c.id !== id)); setDeleteTarget(null) }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
