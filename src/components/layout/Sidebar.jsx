/* ============================================================
   Sidebar — Navigation sidebar with collapsible state
   ============================================================ */

import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Ship, BarChart3, Package, Settings,
  Bell, Zap, ChevronLeft, ChevronRight, AlertTriangle,
  Globe, TrendingUp
} from 'lucide-react';
import { STORAGE_KEYS } from '../../utils/constants';
import StatusDot from '../common/StatusDot';

const NAV_ITEMS = [
  {
    section: 'MONITOR',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    section: 'TOOLS',
    items: [
      { to: '/simulator', label: 'Simulator', icon: Zap },
      { to: '/shipments', label: 'Shipments', icon: Ship, badgeKey: 'atRisk' },
    ],
  },
  {
    section: 'SYSTEM',
    items: [
      { to: '/alerts', label: 'Alerts', icon: Bell, badgeKey: 'alerts' },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

/**
 * @param {object} props
 * @param {number} [props.alertCount]
 * @param {number} [props.atRiskCount]
 * @param {boolean} [props.collapsed]
 * @param {function} [props.onCollapseChange]
 */
export default function Sidebar({ alertCount = 0, atRiskCount = 0, collapsed: externalCollapsed, onCollapseChange }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (externalCollapsed !== undefined) return externalCollapsed;
    return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
  });

  const location = useLocation();

  useEffect(() => {
    if (externalCollapsed !== undefined) setCollapsed(externalCollapsed);
  }, [externalCollapsed]);

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(next));
    onCollapseChange?.(next);
  };

  const badges = { alerts: alertCount, atRisk: atRiskCount };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} role="navigation" aria-label="Main navigation">
      {/* Logo */}
      <NavLink to="/" className="sidebar-logo" aria-label="Go to dashboard">
        <div className="sidebar-logo-icon" aria-hidden="true">
          <Globe size={18} color="white" />
        </div>
        {!collapsed && (
          <div className="sidebar-logo-text">
            <span className="brand-name">ChainWatch</span>
            <span className="brand-sub">Risk Intelligence</span>
          </div>
        )}
      </NavLink>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ section, items }) => (
          <div key={section}>
            {!collapsed && (
              <div className="nav-section-label">{section}</div>
            )}
            {items.map(({ to, label, icon: Icon, exact, badgeKey }) => {
              const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);
              const badge = badgeKey ? badges[badgeKey] : 0;

              return (
                <NavLink
                  key={to}
                  to={to}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  title={collapsed ? label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={18} className="nav-item-icon" aria-hidden="true" />
                  {!collapsed && (
                    <>
                      <span className="nav-item-label">{label}</span>
                      {badge > 0 && (
                        <span className="nav-item-badge" aria-label={`${badge} items`}>{badge > 99 ? '99+' : badge}</span>
                      )}
                    </>
                  )}
                  {collapsed && badge > 0 && (
                    <span
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--color-risk-critical)',
                      }}
                      aria-hidden="true"
                    />
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '0 4px' }}>
            <StatusDot status="online" pulse size="sm" />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Live data connected
            </span>
          </div>
        )}
        <button
          className="sidebar-collapse-btn"
          onClick={handleToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight size={16} /> : (
            <>
              <ChevronLeft size={16} />
              <span style={{ fontSize: 'var(--text-xs)' }}>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
