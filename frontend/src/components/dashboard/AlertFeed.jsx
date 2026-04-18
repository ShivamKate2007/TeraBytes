import { formatRelativeTime } from '../../utils/formatters'

function sourceBadge(alert) {
  if (!alert?.source) return null
  if (alert.source === 'weather_api_live') return 'LIVE WEATHER'
  if (alert.source === 'weather_api_mock') return 'MOCK WEATHER'
  if (alert.source === 'news_api') return 'NEWS API'
  return String(alert.source).toUpperCase()
}

export default function AlertFeed({ alerts = [], loading = false }) {
  return (
    <div className="alert-feed">
      <div className="alert-feed-header">
        <span className="alert-feed-title">Live Alert Feed</span>
      </div>
      <div className="alert-feed-list">
        {loading && <div style={{ color: 'var(--text-muted)' }}>Monitoring disruption signals...</div>}
        {!loading && !alerts.length && (
          <div style={{ color: 'var(--risk-low)' }}>No active alerts. Network lanes are stable.</div>
        )}

        {!loading &&
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`alert-card severity-${alert.severity || 'high'}`}
            >
              {sourceBadge(alert) && (
                <div
                  style={{
                    fontSize: 11,
                    color: alert.isMock ? 'var(--risk-moderate)' : 'var(--risk-low)',
                    marginBottom: 6,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                  }}
                >
                  {sourceBadge(alert)}
                </div>
              )}
              <div className="alert-card-title">{alert.title}</div>
              <div className="alert-card-text">{alert.message}</div>
              <div className="alert-card-time">{formatRelativeTime(alert.timestamp)}</div>
            </div>
          ))}
      </div>
    </div>
  )
}
