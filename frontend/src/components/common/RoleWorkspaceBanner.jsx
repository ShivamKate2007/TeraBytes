import { getRoleWorkspace } from '../../constants/roleWorkspaces'
import { useAuth } from '../../context/AuthContext'

export default function RoleWorkspaceBanner({ compact = false }) {
  const { currentUser } = useAuth()
  const workspace = getRoleWorkspace(currentUser?.role)
  const orgName = currentUser?.organization?.name || 'Smart Supply Chain'

  return (
    <section className={`role-workspace-banner ${compact ? 'compact' : ''}`}>
      <div>
        <div className="role-workspace-kicker">
          <span>{workspace.badge}</span>
          <span>{orgName}</span>
        </div>
        <h2>{workspace.title}</h2>
        <p>{workspace.subtitle}</p>
      </div>
      {!compact && (
        <div className="role-workspace-panels">
          <div>
            <strong>Scope</strong>
            {workspace.focus.map((item) => <span key={item}>{item}</span>)}
          </div>
          <div>
            <strong>Next best actions</strong>
            {workspace.quickActions.map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
      )}
    </section>
  )
}
