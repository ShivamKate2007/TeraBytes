import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/', icon: '📊', label: 'Dashboard' },
  { path: '/simulator', icon: '💥', label: 'What-If Simulator' },
  { path: '/analytics', icon: '📈', label: 'Analytics' },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🚛</div>
        <div className="sidebar-logo-text">
          Smart Supply Chain
          <span>Resilient Logistics</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
            end={item.path === '/'}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p className="sidebar-footer-text">
          Solution Challenge 2026
        </p>
      </div>
    </aside>
  )
}
