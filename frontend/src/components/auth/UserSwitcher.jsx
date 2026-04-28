import { useAuth } from '../../context/AuthContext'

export default function UserSwitcher() {
  const { currentUser, logout, loading } = useAuth()

  if (loading) {
    return <div className="user-switcher skeleton-text medium" />
  }

  if (!currentUser) {
    return (
      <div className="user-switcher">
        <span className="user-switcher-label">No user loaded</span>
      </div>
    )
  }

  return (
    <div className="user-switcher">
      <div className="user-switcher-meta">
        <span className="user-switcher-label">Signed in</span>
        <strong>{currentUser.roleLabel || currentUser.role}</strong>
        <span>{currentUser.name}</span>
      </div>
      <button type="button" onClick={logout}>Sign out</button>
    </div>
  )
}
