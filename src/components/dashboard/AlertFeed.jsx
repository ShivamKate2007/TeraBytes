/* ============================================================
   AlertFeed — Live alert stream with severity-based styling
   ============================================================ */

import { AlertTriangle, CloudLightning, Anchor, FileWarning, Bell, X, CheckCheck } from 'lucide-react';
import LoadingSkeleton from '../common/LoadingSkeleton';
import { formatRelativeTime } from '../../utils/formatters';

const ICON_MAP = {
  port_congestion: Anchor,
  weather: CloudLightning,
  weather_event: CloudLightning,
  geopolitical: AlertTriangle,
  customs: FileWarning,
  customs_delay: FileWarning,
  default: Bell,
};

// Demo alerts for when no real data is provided
const DEMO_ALERTS = [
  { id: '1', severity: 'critical', type: 'port_congestion', title: 'Shanghai Port Congestion', description: 'Vessel backlog: 42 ships waiting. Avg wait time increased to 8.3 days.', timestamp: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: '2', severity: 'high', type: 'weather_event', title: 'Typhoon Warning — East China Sea', description: 'Category 3 typhoon approaching. 12 vessels rerouting.', timestamp: new Date(Date.now() - 18 * 60000).toISOString() },
  { id: '3', severity: 'high', type: 'geopolitical', title: 'Red Sea Transit Suspended', description: 'Carrier consortium pausing Red Sea transits. Via Cape of Good Hope adding 12 days.', timestamp: new Date(Date.now() - 45 * 60000).toISOString() },
  { id: '4', severity: 'medium', type: 'customs_delay', title: 'Rotterdam Customs Strike', description: 'Partial work stoppage affecting 20% of gate operations.', timestamp: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: '5', severity: 'medium', type: 'default', title: 'Carrier Alliance Capacity Cut', description: 'MSC reducing Asia–Europe capacity by 18% for Q2.', timestamp: new Date(Date.now() - 4 * 3600000).toISOString() },
  { id: '6', severity: 'critical', type: 'port_congestion', title: 'Long Beach Dwell Time Spike', description: 'Container dwell time up 340% due to rail disruption.', timestamp: new Date(Date.now() - 6 * 3600000).toISOString() },
];

/**
 * @param {object} props
 * @param {Array} [props.alerts]
 * @param {boolean} [props.loading]
 * @param {function} [props.onMarkRead]
 * @param {function} [props.onDismiss]
 * @param {function} [props.onMarkAllRead]
 */
export default function AlertFeed({
  alerts = DEMO_ALERTS,
  loading = false,
  onMarkRead,
  onDismiss,
  onMarkAllRead,
}) {
  const unread = alerts.filter((a) => !a.readAt).length;

  if (loading) {
    return (
      <div className="alert-feed-card">
        <div className="alert-feed-header">
          <span className="alert-feed-title">
            <span className="alert-live-dot" />
            Live Alerts
          </span>
        </div>
        <div className="alert-feed-list">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ padding: '8px' }}>
              <LoadingSkeleton type="text" lines={2} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="alert-feed-card" role="region" aria-label="Live Alerts">
      {/* Header */}
      <div className="alert-feed-header">
        <div className="alert-feed-title">
          <span className="alert-live-dot" aria-hidden="true" />
          Live Alerts
          {unread > 0 && (
            <span
              style={{
                marginLeft: '6px',
                background: 'var(--color-risk-critical)',
                color: 'white',
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '99px',
              }}
              aria-label={`${unread} unread`}
            >
              {unread}
            </span>
          )}
        </div>

        {onMarkAllRead && unread > 0 && (
          <button
            onClick={onMarkAllRead}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: 'var(--text-xs)', color: 'var(--color-accent-primary)',
              background: 'none', border: 'none', cursor: 'pointer',
            }}
            aria-label="Mark all alerts as read"
          >
            <CheckCheck size={13} />
            All read
          </button>
        )}
      </div>

      {/* Alert list */}
      <div className="alert-feed-list" role="list" aria-live="polite" aria-label="Alert feed">
        {alerts.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            No active alerts
          </div>
        ) : (
          alerts.map((alert) => {
            const IconComponent = ICON_MAP[alert.type] || ICON_MAP.default;
            const severityIconColors = {
              critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#3b82f6',
            };
            const iconColor = severityIconColors[alert.severity] || '#6b7280';
            const iconBg = `${iconColor}1a`;

            return (
              <div
                key={alert.id}
                className={`alert-item ${alert.severity || ''} ${alert.readAt ? 'read' : ''}`}
                role="listitem"
                onClick={() => onMarkRead?.(alert.id)}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onMarkRead?.(alert.id)}
                aria-label={`${alert.severity} alert: ${alert.title}`}
              >
                <div
                  className="alert-item-icon"
                  style={{ background: iconBg }}
                  aria-hidden="true"
                >
                  <IconComponent size={14} color={iconColor} />
                </div>

                <div className="alert-item-content">
                  <div className="alert-item-title" style={{ opacity: alert.readAt ? 0.6 : 1 }}>
                    {alert.title}
                  </div>
                  <div className="alert-item-desc">{alert.description}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                  <span className="alert-item-time">
                    {formatRelativeTime(alert.timestamp)}
                  </span>
                  {onDismiss && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDismiss(alert.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '2px' }}
                      aria-label={`Dismiss alert: ${alert.title}`}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
