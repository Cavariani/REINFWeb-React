import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, Sun, Moon } from 'lucide-react'
import styles from './Login.module.css'
import { login, listEmpresas, listCertificados, listLotes } from '../api/client'

const LOADING_PHRASES = [
  'Autenticando credenciais...',
  'Carregando dados da empresa...',
  'Verificando certificados...',
  'Preparando o ambiente...',
  'Entrando na plataforma...',
]

const TOTAL_STEPS = 4

export default function Login({ onLogin, theme, onToggleTheme }) {
  const [email,    setEmail]    = useState('')
  const [senha,    setSenha]    = useState('')
  const [showPass, setShowPass] = useState(false)
  const [lembrar,  setLembrar]  = useState(true)
  const [phase,    setPhase]    = useState('idle')
  const [error,    setError]    = useState(null)
  const [step,     setStep]     = useState(0)

  const canSubmit = email.trim() && senha.trim()
  const phraseIdx = Math.min(step, LOADING_PHRASES.length - 1)
  const progress  = (step / TOTAL_STEPS) * 100

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || phase !== 'idle') return
    setError(null)
    setPhase('auth')
    try {
      const data = await login(email.trim(), senha)
      const initials = data.nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
      const user = { id: data.id, nome: data.nome, initials, email: data.email, isAdmin: data.isAdmin }

      setPhase('loading')
      setStep(1)
      const empresas = await listEmpresas().catch(() => [])
      setStep(2)
      const certs = await listCertificados().catch(() => [])
      setStep(3)
      const lotesRes = await listLotes(1, 200).catch(() => ({ items: [] }))
      setStep(4)
      await new Promise(r => setTimeout(r, 450))
      onLogin(user, { empresas, certs, lotes: lotesRes.items ?? [] })
    } catch (err) {
      setPhase('idle')
      setStep(0)
      setError(err.message ?? 'Credenciais inválidas.')
    }
  }

  return (
    <AnimatePresence mode="wait">
      {phase === 'loading' ? (

        /* ── Loading screen ── */
        <motion.div
          key="loading"
          className={styles.loadingScreen}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className={styles.loadingCard}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
          >
            <img src="/logo-mlegate.png" alt="MLEGATE" className={styles.loadingLogo} />
            <div className={styles.loadingSpinner} />
            <AnimatePresence mode="wait">
              <motion.p
                key={phraseIdx}
                className={styles.loadingPhrase}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
              >
                {LOADING_PHRASES[phraseIdx]}
              </motion.p>
            </AnimatePresence>
            <div className={styles.progressTrack}>
              <motion.div
                className={styles.progressBar}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
          </motion.div>
        </motion.div>

      ) : (

        /* ── Login split layout ── */
        <motion.div
          key="login"
          className={styles.page}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.99, filter: 'blur(3px)' }}
          transition={{ duration: 0.3 }}
        >

          {/* ── Painel esquerdo — branding ── */}
          <div className={styles.brandPanel}>
            <div className={styles.brandDots} />
            <div className={styles.brandGlow} />

            <div className={styles.brandContent}>
              <div className={styles.brandCenter}>
                <img src="/logo-mlegate.png" alt="MLEGATE" className={styles.brandLogo} />
                <div className={styles.brandDivider} />
                <div className={styles.brandAppName}>
                  Plataforma <span className={styles.brandAccent}>REINF</span>
                </div>
              </div>

              <div className={styles.brandBottom}>
                <span className={styles.brandFooter}>Uso interno · MLEGATE</span>
              </div>
            </div>
          </div>

          {/* ── Painel direito — formulário ── */}
          <div className={styles.formPanel}>
            <button className={styles.themeBtn} onClick={onToggleTheme} title="Alternar tema">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <motion.div
              className={styles.formBox}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <div className={styles.formHeader}>
                <h1 className={styles.formTitle}>Bem-vindo de volta.</h1>
                <p className={styles.formSub}>Insira suas credenciais para continuar.</p>
              </div>

              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.field}>
                  <label className={styles.label}>E-mail corporativo</label>
                  <div className={styles.inputWrap}>
                    <Mail size={15} className={styles.inputIcon} />
                    <input
                      className={styles.input}
                      type="email"
                      placeholder="seu.nome@mlegate.com.br"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Senha de acesso</label>
                  <div className={styles.inputWrap}>
                    <Lock size={15} className={styles.inputIcon} />
                    <input
                      className={styles.input}
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={senha}
                      onChange={e => setSenha(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      onClick={() => setShowPass(v => !v)}
                      tabIndex={-1}
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className={styles.rememberRow}>
                  <input
                    id="lembrar"
                    type="checkbox"
                    className={styles.rememberCheck}
                    checked={lembrar}
                    onChange={e => setLembrar(e.target.checked)}
                  />
                  <label htmlFor="lembrar" className={styles.rememberLabel}>
                    Manter conectado
                  </label>
                </div>

                {error && (
                  <motion.p
                    className={styles.errorMsg}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {error}
                  </motion.p>
                )}

                <motion.button
                  type="submit"
                  className={`${styles.submitBtn} ${!canSubmit ? styles.submitDisabled : ''}`}
                  disabled={!canSubmit || phase !== 'idle'}
                  whileTap={canSubmit ? { scale: 0.98 } : {}}
                >
                  {phase === 'auth' ? (
                    <span className={styles.spinnerRow}>
                      <span className={styles.spinner} />
                      Autenticando...
                    </span>
                  ) : 'Entrar'}
                </motion.button>
              </form>

              <p className={styles.formFooter}>
                Não tem acesso?{' '}
                <a href="mailto:pedro@mlegate.com.br" className={styles.formFooterLink}>
                  Solicite ao administrador
                </a>
              </p>
            </motion.div>
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  )
}
