export default function Header({ title }) {
  return (
    <header className="header">
      <h1 className="header-title">{title}</h1>
      <div className="header-actions">
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
