import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import NovoEnvio from './pages/NovoEnvio'
import Certificados from './pages/Certificados'
import Historico from './pages/Historico'
import Usuarios from './pages/Usuarios'
import Empresas from './pages/Empresas'
import Consulta from './pages/Consulta'
import ResumoMes from './pages/ResumoMes'
import Ajuda from './pages/Ajuda'
import Clientes from './pages/Clientes'
import InformeRendimentos from './pages/InformeRendimentos'
import { getStoredUser, logout } from './api/client'
import './index.css'
import './App.css'

export default function App() {
  const [user, setUser]     = useState(() => getStoredUser())
  const [page, setPage]     = useState('dashboard')
  const [ambiente, setAmbiente] = useState('homologacao')
  const [novoEnvioPreFill, setNovoEnvioPreFill] = useState(null)
  const [consultaProtocoloInicial, setConsultaProtocoloInicial] = useState('')
  const [theme, setTheme]   = useState(() => localStorage.getItem('reinf-theme') ?? 'light')
  const [preloadedData, setPreloadedData] = useState(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('reinf-theme', theme)
  }, [theme])

  const handleToggleTheme = useCallback(() => {
    const html = document.documentElement
    html.classList.add('theme-transition')
    setTheme(t => t === 'light' ? 'dark' : 'light')
    setTimeout(() => html.classList.remove('theme-transition'), 350)
  }, [])

  useEffect(() => {
    function handleForcedLogout() { setUser(null) }
    window.addEventListener('reinf:logout', handleForcedLogout)
    return () => window.removeEventListener('reinf:logout', handleForcedLogout)
  }, [])

  function handleLogin(u, data) {
    setPreloadedData(data ?? null)
    setUser(u)
    setPage('dashboard')
  }

  function handleLogout() {
    logout()
    setUser(null)
    setPreloadedData(null)
  }

  function navigate(p) {
    if (p !== 'novo-envio') setNovoEnvioPreFill(null)
    setPage(p)
  }

  function handleRetificar(preFill) {
    setNovoEnvioPreFill(preFill)
    setPage('novo-envio')
  }

  function handleAbrirConsulta(protocolo) {
    setConsultaProtocoloInicial(protocolo ?? '')
    setPage('consulta')
  }

  function handleRetificarDeConsulta({ evento, certId, nrRecibo }) {
    const preFill = {
      evento: evento ?? '',
      certId: certId ? Number(certId) : null,
      rows: [{ acao: 'ALTERAR', nrRecibo: nrRecibo ?? '' }],
    }
    setNovoEnvioPreFill(preFill)
    setPage('novo-envio')
  }

  if (!user) {
    return <Login onLogin={handleLogin} theme={theme} onToggleTheme={handleToggleTheme} />
  }

  return (
    <Layout page={page} onNavigate={navigate} user={user} onLogout={handleLogout} fullWidth={page === 'novo-envio'} theme={theme} onToggleTheme={handleToggleTheme}>
      <AnimatePresence mode="wait">
        {page === 'dashboard' && (
          <Dashboard
            key="dashboard"
            user={user}
            onNavigate={navigate}
            ambiente={ambiente}
            initialData={preloadedData}
          />
        )}
        {page === 'novo-envio' && (
          <NovoEnvio
            key="novo-envio"
            ambiente={ambiente}
            onAmbienteChange={setAmbiente}
            onBack={() => navigate('dashboard')}
            onConsulta={handleAbrirConsulta}
            preFill={novoEnvioPreFill}
          />
        )}
        {page === 'certificados' && (
          <Certificados key="certificados" />
        )}
        {page === 'historico' && (
          <Historico
            key="historico"
            onRetificar={handleRetificar}
            onNavigate={navigate}
          />
        )}
        {page === 'consulta' && (
          <Consulta key="consulta" onNavigate={navigate} protocoloInicial={consultaProtocoloInicial} onRetificar={handleRetificarDeConsulta} />
        )}
        {page === 'resumo' && (
          <ResumoMes key="resumo" />
        )}
        {page === 'usuarios' && user?.isAdmin && (
          <Usuarios key="usuarios" />
        )}
        {page === 'empresas' && (
          <Empresas key="empresas" user={user} />
        )}
        {page === 'ajuda' && (
          <Ajuda key="ajuda" />
        )}
        {page === 'clientes' && user?.isSuperAdmin && (
          <Clientes key="clientes" />
        )}
        {page === 'informe' && (
          <InformeRendimentos key="informe" />
        )}
      </AnimatePresence>
    </Layout>
  )
}
