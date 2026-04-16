/* ============================================================
   useAlerts — Real-time alert feed management
   ============================================================ */

import { useState, useEffect, useCallback, useRef } from 'react';
import { alertsAPI } from '../services/api';
import { REFRESH_INTERVALS } from '../utils/constants';

/**
 * Hook for managing the live alert feed.
 * Supports polling, mark-as-read, and dismiss actions.
 * @param {{ autoRefresh?: boolean, maxAlerts?: number }} options
 */
export function useAlerts(options = {}) {
  const { autoRefresh = true, maxAlerts = 50 } = options;

  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const timerRef = useRef(null);
  const isFirstLoad = useRef(true);

  const fetchAlerts = useCallback(async () => {
    try {
      if (isFirstLoad.current) setError(null);
      const data = await alertsAPI.getUnread();
      const list = Array.isArray(data) ? data.slice(0, maxAlerts) : [];
      setAlerts(list);
      setUnreadCount(list.filter((a) => !a.readAt).length);
    } catch (err) {
      if (isFirstLoad.current) {
        setError(err?.message || err || 'Failed to load alerts');
      }
    } finally {
      setLoading(false);
      isFirstLoad.current = false;
    }
  }, [maxAlerts]);

  useEffect(() => {
    setLoading(true);
    isFirstLoad.current = true;
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    if (!autoRefresh) return;
    timerRef.current = setInterval(fetchAlerts, REFRESH_INTERVALS.ALERTS);
    return () => clearInterval(timerRef.current);
  }, [autoRefresh, fetchAlerts]);

  // ─── Actions ──────────────────────────────────────────────
  const markRead = useCallback(async (id) => {
    try {
      await alertsAPI.markRead(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, readAt: new Date().toISOString() } : a))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Silent fail
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await alertsAPI.markAllRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // Silent fail
    }
  }, []);

  const dismiss = useCallback(async (id) => {
    try {
      await alertsAPI.dismiss(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Silent fail
    }
  }, []);

  const refresh = useCallback(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Derived: group by severity
  const critical = alerts.filter((a) => a.severity === 'critical');
  const high = alerts.filter((a) => a.severity === 'high');

  return {
    alerts,
    unreadCount,
    loading,
    error,
    critical,
    high,
    // Actions
    markRead,
    markAllRead,
    dismiss,
    refresh,
  };
}
