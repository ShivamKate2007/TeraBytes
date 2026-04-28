import { NavLink } from 'react-router-dom'
import UserSwitcher from '../auth/UserSwitcher'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { path: '/', icon: '📊', label: 'Dashboard' },
  {
    path: '/simulator',
    icon: '💥',
    label: 'What-If Simulator',
    roles: ['admin', 'supply_chain_manager', 'warehouse_manager', 'distributor_manager', 'carrier_partner', 'analyst'],
  },
  { path: '/analytics', icon: '📈', label: 'Analytics' },
  { path: '/contracts', icon: '📜', label: 'Contracts' },
]

export default function Sidebar() {
  const { currentUser } = useAuth()
  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true
    return item.roles.includes(currentUser?.role)
  })

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
        {visibleItems.map((item) => (
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

      <UserSwitcher />

      <div className="sidebar-footer">
        <p className="sidebar-footer-text">
          Solution Challenge 2026
        </p>
      </div>
    </aside>
  )
}
