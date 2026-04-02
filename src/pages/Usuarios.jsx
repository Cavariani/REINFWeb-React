import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, Plus, Trash2, AlertTriangle, UserPlus, X, Loader2, ShieldCheck, User, KeyRound } from 'lucide-react'
import { listUsuarios, criarUsuario, deletarUsuario, alterarSenhaUsuario, atualizarUsuario, getStoredUser } from '../api/client'
import styles from './Usuarios.module.css'

const PAGE = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26 } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.14 } },
}

function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR')
}

export default function Usuarios() {
  const [users, setUsers]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [erro, setErro]             = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [nome, setNome]             = useState('')
  const [email, setEmail]           = useState('')
  const [senha, setSenha]           = useState('')
  const [isAdmin, setIsAdmin]       = useState(false)
  const [modalErro, setModalErro]   = useState('')

  // Modal editar usuário
  const [editModal, setEditModal]       = useState(null)  // usuário alvo
  const [editNome, setEditNome]         = useState('')
  const [editEmail, setEditEmail]       = useState('')
  const [novaSenha, setNovaSenha]       = useState('')
  const [confSenha, setConfSenha]       = useState('')
  const [editErro, setEditErro]         = useState('')
  const [editOk, setEditOk]             = useState(false)
  const [savingEdit, setSavingEdit]     = useState(false)

  const currentUser = getStoredUser()

  useEffect(() => {
    listUsuarios()
      .then(data => {
        const sorted = [...data.filter(u => u.isAdmin), ...data.filter(u => !u.isAdmin)]
        setUsers(sorted)
      })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleCriar() {
    setModalErro('')
    if (!nome.trim())  { setModalErro('Informe o nome.'); return }
    if (!email.trim()) { setModalErro('Informe o e-mail.'); return }
    if (senha.length < 6) { setModalErro('Senha deve ter pelo menos 6 caracteres.'); return }
    setSaving(true)
    try {
      const novo = await criarUsuario(nome.trim(), email.trim(), senha, isAdmin)
      setUsers(prev => [...prev, novo])
      setShowModal(false)
      setNome(''); setEmail(''); setSenha(''); setIsAdmin(false)
    } catch (e) {
      setModalErro(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletar(id) {
    if (!window.confirm('Excluir este usuário permanentemente?')) return
    try {
      await deletarUsuario(id)
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch (e) {
      setErro(e.message)
    }
  }

  async function handleSalvarEdicao() {
    setEditErro('')
    if (!editNome.trim())  { setEditErro('Informe o nome.'); return }
    if (!editEmail.trim()) { setEditErro('Informe o e-mail.'); return }
    if (novaSenha && novaSenha.length < 6) { setEditErro('A nova senha deve ter pelo menos 6 caracteres.'); return }
    if (novaSenha && novaSenha !== confSenha) { setEditErro('As senhas não coincidem.'); return }
    setSavingEdit(true)
    try {
      const atualizado = await atualizarUsuario(editModal.id, editNome.trim(), editEmail.trim())
      if (novaSenha) await alterarSenhaUsuario(editModal.id, novaSenha)
      setUsers(prev => prev.map(u => u.id === editModal.id ? { ...u, ...atualizado } : u))
      setEditOk(true)
      setTimeout(() => { closeEditModal() }, 1200)
    } catch (e) {
      setEditErro(e.message)
    } finally {
      setSavingEdit(false)
    }
  }

  function handleCloseModal() {
    setShowModal(false)
    setNome(''); setEmail(''); setSenha(''); setIsAdmin(false); setModalErro('')
  }

  function openEditModal(u) {
    setEditModal(u); setEditNome(u.nome); setEditEmail(u.email)
    setNovaSenha(''); setConfSenha(''); setEditErro(''); setEditOk(false)
  }

  function closeEditModal() {
    setEditModal(null); setEditNome(''); setEditEmail('')
    setNovaSenha(''); setConfSenha(''); setEditErro(''); setEditOk(false)
  }

  return (
    <motion.div className={styles.page} {...PAGE}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Gerenciamento de Usuários</h1>
          <p className={styles.sub}>Visualize, adicione e remova usuários do sistema.</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>
          <UserPlus size={14} /> Novo Usuário
        </button>
      </div>

      {erro && (
        <div className={styles.erroMsg}>
          <AlertTriangle size={12} /> {erro}
        </div>
      )}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <Users size={14} /> Usuários Registrados
        </h2>

        {loading ? (
          <div className={styles.empty}>
            <Loader2 size={18} className={styles.spin} /> Carregando...
          </div>
        ) : users.length === 0 ? (
          <div className={styles.empty}>Nenhum usuário cadastrado.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Criado em</th>
                  <th>Perfil</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => {
                  const prevUser = users[idx - 1]
                  const showSep = idx > 0 && !u.isAdmin && prevUser?.isAdmin
                  return (<>
                  {showSep && (
                    <tr key={`sep-${idx}`}>
                      <td colSpan={5} style={{ padding: '0.25rem 0.75rem', background: 'transparent' }}>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.4rem' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Usuários</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {idx === 0 && u.isAdmin && (
                    <tr key="sep-admin">
                      <td colSpan={5} style={{ padding: '0.25rem 0.75rem 0.1rem', background: 'transparent' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Administradores</span>
                      </td>
                    </tr>
                  )}
                  <tr key={u.id} className={styles.tr}>
                    <td>
                      <div className={styles.tdName}>
                        <div className={styles.avatarSm}>{(u.nome?.[0] ?? 'U').toUpperCase()}</div>
                        <span>{u.nome}</span>
                        {u.id === currentUser?.id && <span className={styles.youBadge}>você</span>}
                      </div>
                    </td>
                    <td className={styles.tdMuted}>{u.email}</td>
                    <td className={styles.tdMuted}>{fmtDate(u.dtCriacao)}</td>
                    <td>
                      {u.isAdmin ? (
                        <span className={styles.adminBadge}>
                          <ShieldCheck size={11} /> Admin
                        </span>
                      ) : (
                        <span className={styles.userBadge}>
                          <User size={11} /> Usuário
                        </span>
                      )}
                    </td>
                    <td>
                      <div className={styles.tdActions}>
                        <button
                          className={styles.keyBtn}
                          onClick={() => openEditModal(u)}
                          title="Editar usuário"
                        >
                          <KeyRound size={13} />
                        </button>
                        <button
                          className={styles.removeBtn}
                          onClick={() => handleDeletar(u.id)}
                          title="Excluir usuário"
                          disabled={u.id === currentUser?.id}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  </>)
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal novo usuário */}
      {showModal && (
        <div className={styles.overlay} onClick={handleCloseModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}><Plus size={14} /> Novo Usuário</h2>
              <button className={styles.closeBtn} onClick={handleCloseModal}><X size={16} /></button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formField}>
                <label className={styles.label}>Nome</label>
                <input
                  className={styles.input}
                  placeholder="Nome completo"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.label}>E-mail</label>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="usuario@empresa.com.br"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.label}>Senha</label>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCriar()}
                />
              </div>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={e => setIsAdmin(e.target.checked)}
                  className={styles.checkbox}
                />
                <span>Administrador</span>
              </label>

              {modalErro && (
                <div className={styles.erroMsg}>
                  <AlertTriangle size={12} /> {modalErro}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={handleCloseModal}>Cancelar</button>
              <button className={styles.saveBtn} onClick={handleCriar} disabled={saving}>
                {saving ? <Loader2 size={14} className={styles.spin} /> : <UserPlus size={14} />}
                {saving ? 'Criando...' : 'Criar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar usuário */}
      {editModal && (
        <div className={styles.overlay} onClick={closeEditModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}><KeyRound size={14} /> Editar Usuário</h2>
              <button className={styles.closeBtn} onClick={closeEditModal}><X size={16} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formField}>
                <label className={styles.label}>Nome</label>
                <input
                  className={styles.input}
                  placeholder="Nome completo"
                  value={editNome}
                  onChange={e => setEditNome(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.label}>E-mail</label>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="email@empresa.com"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                />
              </div>
              <p className={styles.senhaTarget}>Nova senha (deixe em branco para não alterar)</p>
              <div className={styles.formField}>
                <label className={styles.label}>Nova Senha</label>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.label}>Confirmar Nova Senha</label>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confSenha}
                  onChange={e => setConfSenha(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSalvarEdicao()}
                />
              </div>
              {editErro && (
                <div className={styles.erroMsg}>
                  <AlertTriangle size={12} /> {editErro}
                </div>
              )}
              {editOk && (
                <div className={styles.okMsg}>Usuário atualizado com sucesso!</div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={closeEditModal}>Cancelar</button>
              <button className={styles.saveBtn} onClick={handleSalvarEdicao} disabled={savingEdit || editOk}>
                {savingEdit ? <Loader2 size={14} className={styles.spin} /> : <KeyRound size={14} />}
                {savingEdit ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
