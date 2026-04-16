/* ============================================================
   Header — Top navigation bar with search, alerts, and user
   ============================================================ */

import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Search, RefreshCw, ChevronRight, User, Settings } from 'lucide-react';
import StatusDot from '../common/StatusDot';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/analytics': 'Analytics',
  '/simulator': 'Simulator',
  '/shipments': 'Shipments',
  '/alerts': 'Alerts',
  '/settings': 'Settings',
};

/**
 * @param {object} props
 * @param {boolean} [props.sidebarCollapsed]
 * @param {number} [props.alertCount]
 * @param {function} [props.onRefresh]
 * @param {boolean} [props.isRefreshing]
 * @param {string} [props.lastUpdated]
 */
export default function Header({
  sidebarCollapsed = false,
  alertCount = 0,
  onRefresh,
  isRefreshing = false,
  lastUpdated,
}) {
  const location = useLocation();
  const [searchValue, setSearchValue] = useState('');

  const currentPage = PAGE_TITLES[location.pathname] || 'Page';
  const headerClass = `header ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`;

  return (
    <header className={headerClass} role="banner">
      {/* Left: Breadcrumb */}
      <div className="header-left">
        <nav className="header-breadcrumb" aria-label="Breadcrumb">
          <span>ChainWatch</span>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="current-page">{currentPage}</span>
        </nav>

        {/* Search */}
        <div className="header-search" role="search">
          <Search size={14} color="var(--color-text-muted)" aria-hidden="true" />
          <input
            id="global-search"
            type="search"
            placeholder="Search shipments, ports, alerts…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            aria-label="Search shipments, ports, and alerts"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="header-right">
        {/* System status */}
        <div className="header-status-pill" aria-label="System status: Live">
          <StatusDot status="online" pulse size="sm" aria-hidden="true" />
          <span>Live</span>
          {lastUpdated && (
            <span style={{ opacity: 0.6 }}>· {lastUpdated}</span>
          )}
        </div>

        {/* Refresh */}
        <button
          className="header-icon-btn"
          onClick={onRefresh}
          aria-label="Refresh data"
          title="Refresh"
          disabled={isRefreshing}
        >
          <RefreshCw
            size={15}
            aria-hidden="true"
            style={{
              animation: isRefreshing ? 'spin 0.7s linear infinite' : 'none',
            }}
          />
        </button>

        {/* Alerts bell */}
        <button
          className="header-icon-btn"
          aria-label={`Alerts — ${alertCount} unread`}
          title="Alerts"
        >
          <Bell size={15} aria-hidden="true" />
          {alertCount > 0 && (
            <span className="badge" aria-hidden="true">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>

        {/* User */}
        <button
          className="header-icon-btn"
          aria-label="User settings"
          title="Account"
        >
          <User size={15} aria-hidden="true" />
        </button>

        {/* Avatar */}
        <div className="header-avatar" role="img" aria-label="User avatar: Admin">
          AD
        </div>
      </div>
    </header>
  );
}
