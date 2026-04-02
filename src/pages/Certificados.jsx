import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheck, Plus, Trash2, AlertTriangle, Upload, KeyRound,
  CheckCircle2, X, Loader2, Eye, EyeOff, Lock, Info,
} from 'lucide-react'
import {
  listCertificados, uploadCertificado, deleteCertificado, getStoredUser,
} from '../api/client'
import styles from './Certificados.module.css'

function getVencimentoInfo(dtValidade) {
  if (!dtValidade) return null
  const expiry = new Date(dtValidade)
  const hoje = new Date()
  const diffMs = expiry - hoje
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (dias < 0)   return { dias, cls: styles.vencExp,  label: `Expirado há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? 's' : ''}` }
  if (dias <= 15) return { dias, cls: styles.vencWarn, label: `Expira em ${dias} dia${dias !== 1 ? 's' : ''}` }
  return { dias, cls: styles.vencOk, label: `Expira em ${dias} dias` }
}

const PAGE = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26 } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.14 } },
}

function applyCNPJMask(v) {
  const d = v.replace(/\D/g,'').slice(0,14)
  if (d.length <= 2)  return d
  if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

export default function Certificados() {
  const currentUser = getStoredUser()
  const isAdmin = currentUser?.isAdmin === true

  const [certs, setCerts]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [nome, setNome]         = useState('')
  const [cnpj, setCnpj]         = useState('')
  const [pfxFile, setPfxFile]   = useState(null)
  const [senha, setSenha]       = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [erro, setErro]         = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    listCertificados().then(setCerts).catch(e => setErro(e.message)).finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    setErro('')
    if (!nome.trim())      { setErro('Informe um nome para o certificado.'); return }
    if (!cnpj.replace(/\D/g,'').match(/^\d{14}$/)) { setErro('CNPJ inválido — 14 dígitos.'); return }
    if (!pfxFile)          { setErro('Selecione o arquivo .pfx.'); return }
    if (senha.length < 4)  { setErro('Senha deve ter pelo menos 4 caracteres.'); return }
    setSaving(true)
    try {
      const cnpjDigits = cnpj.replace(/\D/g,'')
      const novo = await uploadCertificado(nome.trim(), cnpjDigits, senha, pfxFile)
      // Upsert local: substitui cert com mesmo CNPJ se existir, ou adiciona
      setCerts(prev => {
        const idx = prev.findIndex(c => c.cnpjContribuinte === cnpjDigits)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = novo
          return next
        }
        return [...prev, novo]
      })
      setNome(''); setCnpj(''); setPfxFile(null); setSenha('')
      if (inputRef.current) inputRef.current.value = ''
    } catch (e) {
      setErro(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id) {
    if (!window.confirm('Remover este certificado permanentemente?')) return
    try {
      await deleteCertificado(id)
      setCerts(prev => prev.filter(c => c.id !== id))
    } catch (e) {
      setErro(e.message)
    }
  }

  function handleDrop(e) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    const name = f?.name.toLowerCase() ?? ''
    if (f && (name.endsWith('.pfx') || name.endsWith('.p12'))) setPfxFile(f)
    else setErro('Selecione um arquivo .pfx ou .p12 válido.')
  }

  function fmtDate(s) {
    if (!s) return '—'
    return new Date(s).toLocaleDateString('pt-BR')
  }

  const cnpjDigits = cnpj.replace(/\D/g,'')
  const certComMesmoCnpj = certs.find(c => c.cnpjContribuinte === cnpjDigits && cnpjDigits.length === 14)

  return (
    <motion.div className={styles.page} {...PAGE}>
      <div className={styles.header}>
        <h1 className={styles.title}>Certificados Digitais</h1>
        <p className={styles.sub}>
          Faça upload dos certificados .pfx. Se já existir um certificado com o mesmo CNPJ, ele será atualizado automaticamente.
        </p>
      </div>

      {/* Formulário de upload */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <Plus size={14} /> Adicionar / Atualizar Certificado
        </h2>

        <div className={styles.securityNote}>
          <Lock size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
          <div>
            <strong>Seus dados estão protegidos</strong>
            Todos os certificados são armazenados com criptografia AES-256. Nenhuma chave privada é exposta sem proteção.
          </div>
        </div>

        <div className={styles.addForm}>
          <div className={styles.formField}>
            <label className={styles.label}>Nome / Alias</label>
            <input
              className={styles.input}
              placeholder="Ex: Certificado BTC 2025"
              value={nome}
              onChange={e => setNome(e.target.value)}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.label}>CNPJ do Certificado</label>
            <input
              className={styles.input}
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={e => setCnpj(applyCNPJMask(e.target.value))}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.label}>Arquivo .pfx</label>
            <div
              className={`${styles.dropZone} ${dragging ? styles.dropZoneDrag : ''} ${pfxFile ? styles.dropZoneFilled : ''}`}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => !pfxFile && inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pfx,.p12"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files[0]; if (f) setPfxFile(f) }}
              />
              {pfxFile ? (
                <div className={styles.fileInfo}>
                  <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                  <span className={styles.fileName}>{pfxFile.name}</span>
                  <button
                    className={styles.clearBtn}
                    onClick={e => { e.stopPropagation(); setPfxFile(null); if (inputRef.current) inputRef.current.value = '' }}
                    title="Remover arquivo"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className={styles.dropPlaceholder}>
                  <KeyRound size={18} style={{ color: 'var(--text-muted)' }} />
                  <span>Arraste o .pfx ou .p12 aqui ou <span style={{ color: 'var(--accent)' }}>clique</span></span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.formField}>
            <label className={styles.label}>Senha do Certificado</label>
            <div className={styles.senhaWrap}>
              <input
                type={showSenha ? 'text' : 'password'}
                className={`${styles.input} ${styles.senhaInput}`}
                placeholder="••••••••"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <button
                type="button"
                className={styles.senhaToggle}
                onClick={() => setShowSenha(v => !v)}
                tabIndex={-1}
              >
                {showSenha ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>

        {/* Aviso de substituição quando CNPJ já existe */}
        {certComMesmoCnpj && (
          <div className={styles.securityNote} style={{ background: 'rgba(233,115,32,0.08)', borderColor: 'rgba(233,115,32,0.2)', marginTop: '0.5rem' }}>
            <Info size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div>
              <strong>Atualização</strong>
              {' '}Já existe o certificado <strong>"{certComMesmoCnpj.nome}"</strong> com este CNPJ. Ele será atualizado com o novo arquivo.
            </div>
          </div>
        )}

        {erro && (
          <div className={styles.erroMsg}>
            <AlertTriangle size={12} /> {erro}
          </div>
        )}

        <button className={styles.addBtn} onClick={handleAdd} disabled={saving}>
          {saving ? <Loader2 size={14} className={styles.spin} /> : <Upload size={14} />}
          {saving ? 'Salvando...' : certComMesmoCnpj ? 'Atualizar Certificado' : 'Adicionar Certificado'}
        </button>
      </div>

      {/* Lista de certificados */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <ShieldCheck size={14} /> Certificados Cadastrados
        </h2>

        {loading ? (
          <div className={styles.empty}>
            <Loader2 size={18} className={styles.spin} /> Carregando...
          </div>
        ) : certs.length === 0 ? (
          <div className={styles.empty}>
            Nenhum certificado cadastrado ainda. Use o formulário acima para adicionar um.
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome / Alias</th>
                  <th>CNPJ</th>
                  <th>Upload</th>
                  <th>Validade</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {certs.map(cert => {
                  const venc = getVencimentoInfo(cert.dtValidade)
                  return (
                    <tr key={cert.id} className={styles.tr}>
                      <td>
                        <div className={styles.tdName}>
                          <ShieldCheck size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
                          <span>{cert.nome}</span>
                        </div>
                      </td>
                      <td className={styles.tdMono}>{applyCNPJMask(cert.cnpjContribuinte ?? '')}</td>
                      <td className={styles.tdMono}>{fmtDate(cert.dtUpload)}</td>
                      <td>
                        {venc ? (
                          <span className={`${styles.vencBadge} ${venc.cls}`}>{venc.label}</span>
                        ) : (
                          <span className={styles.tdMono}>—</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td>
                          <button
                            className={styles.removeBtn}
                            onClick={() => handleRemove(cert.id)}
                            title="Remover certificado"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  )
}
