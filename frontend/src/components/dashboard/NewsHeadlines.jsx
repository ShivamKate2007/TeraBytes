export default function NewsHeadlines({ headlines = [], loading = false }) {
  return (
    <div className="news-feed">
      <div className="news-feed-header">
        <span className="news-feed-title">Regional Logistics News</span>
      </div>
      <div className="news-feed-list">
        {loading && <div style={{ color: 'var(--text-muted)' }}>Fetching headlines...</div>}
        {!loading && !headlines.length && (
          <div style={{ color: 'var(--text-muted)' }}>No headlines available right now.</div>
        )}
        {!loading &&
          headlines.map((item, index) => (
            <div key={`${item.title}-${index}`} className="news-card">
              <div className="news-card-title">{item.title || 'Untitled headline'}</div>
              {item.description && <div className="news-card-text">{item.description}</div>}
            </div>
          ))}
      </div>
    </div>
  )
}
