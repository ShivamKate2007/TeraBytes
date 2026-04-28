import { useAuth } from '../../context/AuthContext'

export default function Header({ title }) {
  const { currentUser } = useAuth()

  return (
    <header className="header">
      <h1 className="header-title">{title}</h1>
      <div className="header-actions">
        {currentUser && (
          <div className="header-user-chip">
            <span>{currentUser.roleLabel || currentUser.role}</span>
            <strong>{currentUser.name}</strong>
          </div>
        )}
        <div className="header-badge" title="Notifications">
          🔔
          <span className="header-badge-count">3</span>
        </div>
        <div className="header-badge" title="Settings">
          ⚙️
        </div>
      </div>
    </header>
  )
}
