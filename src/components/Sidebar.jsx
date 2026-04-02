import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Send, ShieldCheck, History, LogOut, Users, Building2, X, ScanSearch, BarChart2, Sun, Moon, HelpCircle, Globe, FileSpreadsheet, FileDown } from 'lucide-react'
import styles from './Sidebar.module.css'

const NAV_BASE = [
  { id: 'dashboard',    label: 'Início',        icon: LayoutDashboard, group: 'Geral' },
  { id: 'novo-envio',   label: 'Novo Envio',    icon: Send,            group: 'REINF' },
  { id: 'consulta',     label: 'Consulta',      icon: ScanSearch,      group: 'REINF' },
  { id: 'certificados', label: 'Certificados',  icon: ShieldCheck,     group: 'REINF' },
  { id: 'resumo',       label: 'Resumo do Mês', icon: BarChart2,        group: 'REINF' },
  { id: 'historico',    label: 'Histórico',     icon: History,          group: 'REINF' },
  { id: 'informe',      label: 'Informe',       icon: FileSpreadsheet,  group: 'REINF' },
  { id: 'empresas',     label: 'Empresas',      icon: Building2,       group: 'Configurações' },
]

const NAV_ADMIN = [
  { id: 'usuarios', label: 'Usuários', icon: Users, group: 'Configurações' },
]

const NAV_SUPER_ADMIN = [
  { id: 'clientes', label: 'Clientes', icon: Globe, group: 'Plataforma' },
]

function NavItem({ item, active, onClick }) {
  const Icon = item.icon
  const isCta = item.id === 'novo-envio'
  return (
    <button
      className={`${styles.navItem} ${isCta ? styles.navItemCta : ''} ${active && !isCta ? styles.navItemActive : ''} ${active && isCta ? styles.navItemCtaActive : ''}`}
      onClick={() => onClick(item.id)}
    >
      {active && !isCta && (
        <motion.span
          layoutId="sidebarActiveBg"
          className={styles.navBg}
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        />
      )}
      <Icon size={15} className={styles.navIcon} />
      <span className={styles.navLabel}>{item.label}</span>
    </button>
  )
}

export default function Sidebar({ page, onNavigate, user, onLogout, collapsed = false, theme, onToggleTheme }) {
  const NAV = [
    ...NAV_BASE,
    ...(user?.isAdmin ? NAV_ADMIN : []),
    ...(user?.isSuperAdmin ? NAV_SUPER_ADMIN : []),
  ]
  const groups = [...new Set(NAV.map(n => n.group))]

  const [easterEgg, setEasterEgg] = useState(false)
  const clickCount = useRef(0)

  function handleAvatarClick() {
    clickCount.current++
    if (clickCount.current >= 10) {
      clickCount.current = 0
      setEasterEgg(true)
    }
  }

  if (collapsed) {
    return (
      <aside className={`${styles.sidebar} ${styles.sidebarCollapsed}`}>
        <div className={styles.logoAreaCollapsed}>
          <img src="/MdaMLEGATEcollapsed.png" alt="M" className={styles.logoMarkImg} />
        </div>
        <nav className={styles.nav}>
          {NAV.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`${styles.navItemCollapsed} ${page === item.id ? styles.navItemActive : ''}`}
                onClick={() => onNavigate(item.id)}
                title={item.label}
              >
                {page === item.id && (
                  <motion.span layoutId="sidebarActiveBg" className={styles.navBg}
                    transition={{ type: 'spring', stiffness: 420, damping: 36 }} />
                )}
                <Icon size={16} className={styles.navIcon} />
              </button>
            )
          })}
        </nav>
        <div className={styles.spacer} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', paddingBottom: '0.2rem' }}>
          <a
            className={styles.iconBtn}
            href="/guia-usuario.pdf"
            download="Guia MLEGATE REINF.pdf"
            title="Baixar guia do usuário"
          >
            <FileDown size={14} />
          </a>
          <button
            className={`${styles.iconBtn} ${page === 'ajuda' ? styles.iconBtnActive : ''}`}
            onClick={() => onNavigate('ajuda')}
            title="Ajuda"
          >
            <HelpCircle size={14} />
          </button>
        </div>
        <div className={styles.userRowCollapsed}>
          <div className={styles.avatar} onClick={handleAvatarClick} title={user?.nome ?? 'Usuário'} style={{ cursor: 'pointer' }}>
            {user?.initials ?? 'U'}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '0.4rem' }}>
          <button
            className={styles.iconBtn}
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
        <EasterEggModal open={easterEgg} onClose={() => setEasterEgg(false)} />
      </aside>
    )
  }

  return (
    <aside className={styles.sidebar}>
      {/* Logo MLEGATE */}
      <div className={styles.logoArea}>
        <div className={styles.logoImgWrap}>
          <img src="/logo-mlegate.png" alt="MLEGATE" className={styles.logoImg} />
        </div>
      </div>
      <div className={styles.logoSubStrip}>
        Plataforma REINF
        <span className={styles.versionBadge}>v0.0.1</span>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {groups.map(group => (
          <div key={group} className={styles.navGroup}>
            <span className={styles.groupLabel}>{group}</span>
            {NAV.filter(n => n.group === group).map(item => (
              <NavItem key={item.id} item={item} active={page === item.id} onClick={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.spacer} />

      {/* Documentação */}
      <a
        className={styles.docsBtn}
        href="/guia-usuario.pdf"
        download="Guia MLEGATE REINF.pdf"
        title="Baixar guia de uso"
      >
        <FileDown size={14} />
        <span>Guia do Usuário</span>
      </a>

      {/* Ajuda */}
      <button
        className={`${styles.helpBtn} ${page === 'ajuda' ? styles.helpBtnActive : ''}`}
        onClick={() => onNavigate('ajuda')}
      >
        <HelpCircle size={14} />
        <span>Ajuda</span>
      </button>

      {/* User */}
      <div className={styles.userRow}>
        <div
          className={styles.avatar}
          onClick={handleAvatarClick}
          style={{ cursor: 'pointer' }}
          title="Clique 10x..."
        >
          {user?.initials ?? 'U'}
        </div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user?.nome ?? 'Usuário'}</span>
          <span className={styles.userRole}>{user?.isSuperAdmin ? 'Super Admin' : user?.isAdmin ? 'Administrador' : 'Usuário'}</span>
        </div>
        <div className={styles.userActions}>
          <button
            className={styles.iconBtn}
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          <button className={styles.iconBtn} title="Sair" onClick={onLogout}><LogOut size={13} /></button>
        </div>
      </div>

      <EasterEggModal open={easterEgg} onClose={() => setEasterEgg(false)} />
    </aside>
  )
}

function EasterEggModal({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)', zIndex: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
              borderRadius: 20, padding: '2.5rem 2.5rem 2rem',
              textAlign: 'center', maxWidth: 340, width: '90%',
              boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
            }}
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👋</div>
            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Feito por Pedro Cavariani.
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Desenvolvedor full-stack & entusiasta de sistemas fiscais.
            </p>
            <a
              href="https://pedrorc.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.55rem 1.2rem', borderRadius: 9, border: 'none',
                background: 'linear-gradient(135deg,#E97320,#F58B44)',
                color: 'white', fontSize: '0.85rem', fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Visitar pedrorc.com
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
