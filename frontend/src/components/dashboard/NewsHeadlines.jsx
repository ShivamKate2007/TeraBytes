import { useState } from 'react'

export default function NewsHeadlines({ headlines = [], loading = false }) {
  const [dismissed, setDismissed] = useState([])
  const visible = headlines.filter((_, i) => !dismissed.includes(i))

  return (
    <div className="news-feed">
      <div className="news-feed-header">
        <span className="news-feed-title">Regional Logistics News</span>
        {visible.length > 0 && (
          <span style={{
            background: 'var(--accent-primary)',
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
      <div className="news-feed-list">
        {loading && <div style={{ color: 'var(--text-muted)' }}>Fetching headlines...</div>}
        {!loading && !visible.length && (
          <div style={{ color: 'var(--text-muted)' }}>No headlines available right now.</div>
        )}
        {!loading &&
          visible.map((item, index) => {
            const originalIndex = headlines.indexOf(item)
            return (
              <div key={`${item.title}-${index}`} className="news-card">
                <div style={{ color: item.isMock ? 'var(--risk-moderate)' : 'var(--accent-secondary)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  {item.isMock ? 'Demo fallback' : 'Live news'}
                  {item.sourceName ? ` · ${item.sourceName}` : ''}
                </div>
                <div className="news-card-title">{item.title || 'Untitled headline'}</div>
                {item.description && <div className="news-card-text">{item.description}</div>}
                <div style={{ marginTop: 6, textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => setDismissed((prev) => [...prev, originalIndex])}
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
            )
          })}
      </div>
    </div>
  )
}
