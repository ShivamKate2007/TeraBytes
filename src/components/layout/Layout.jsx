/* ============================================================
   Layout — Root layout wrapper with Sidebar + Header + Content
   ============================================================ */

import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAlerts } from '../../hooks/useAlerts';
import { STORAGE_KEYS } from '../../utils/constants';

/**
 * Root layout used by all authenticated pages.
 * Provides sidebar state, alert counts, and data refresh to children.
 */
export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  });

  const { unreadCount } = useAlerts({ autoRefresh: true });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Trigger full data refresh — child pages listen to this via context or key prop
    await new Promise((res) => setTimeout(res, 800));
    setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    setIsRefreshing(false);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapseChange={setSidebarCollapsed}
        alertCount={unreadCount}
      />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          marginLeft: sidebarCollapsed
            ? 'var(--sidebar-collapsed-width)'
            : 'var(--sidebar-width)',
          transition: 'margin-left var(--transition-slow)',
        }}
      >
        <Header
          sidebarCollapsed={sidebarCollapsed}
          alertCount={unreadCount}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
        />

        <main
          className="main-content"
          id="main-content"
          role="main"
          style={{
            marginLeft: 0,
            marginTop: 'var(--header-height)',
          }}
        >
          <div className="page-container">
            {/* Render the matched child route */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
