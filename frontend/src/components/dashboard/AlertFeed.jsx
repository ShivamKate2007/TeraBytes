import { useState, useRef, useEffect } from 'react'
import { formatRelativeTime } from '../../utils/formatters'

function sourceBadge(alert) {
  if (!alert?.source) return null
  if (alert.source === 'weather_api_live') return 'LIVE WEATHER'
  if (alert.source === 'weather_api_mock') return 'MOCK WEATHER'
  if (alert.source === 'news_api') return 'NEWS API'
  return String(alert.source).toUpperCase()
}

export default function AlertFeed({ alerts = [], loading = false }) {
  const [dismissed, setDismissed] = useState([])
  const visible = alerts.filter((a) => !dismissed.includes(a.id))

  const handleDismiss = (id) => {
    setDismissed((prev) => [...prev, id])
  }

  return (
    <div className="alert-feed">
      <div className="alert-feed-header">
        <span className="alert-feed-title">Live Alert Feed</span>
        {visible.length > 0 && (
          <span style={{
            background: 'var(--risk-critical)',
            color: 'white',
            borderRadius: 'var(--radius-full)',
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 700,
            marginLeft: 'auto',
          }}>
            {visible.length}
          </span>
        )}
      </div>
      <div className="alert-feed-list">
        {loading && <div style={{ color: 'var(--text-muted)' }}>Monitoring disruption signals...</div>}
        {!loading && !visible.length && (
          <div style={{ color: 'var(--risk-low)' }}>No active alerts. Network lanes are stable.</div>
        )}

        {!loading &&
          visible.map((alert) => (
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <div className="alert-card-time">{formatRelativeTime(alert.timestamp)}</div>
                <button
                  type="button"
                  onClick={() => handleDismiss(alert.id)}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
