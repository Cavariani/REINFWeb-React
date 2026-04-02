import Sidebar from './Sidebar'
import styles from './Layout.module.css'

export default function Layout({ children, page, onNavigate, user, onLogout, fullWidth = false, theme, onToggleTheme }) {
  return (
    <div className={styles.shell}>
      <Sidebar
        page={page}
        onNavigate={onNavigate}
        user={user}
        onLogout={onLogout}
        collapsed={fullWidth}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
      <main className={`${styles.content} ${fullWidth ? styles.contentFull : ''}`}>
        {children}
      </main>
    </div>
  )
}
