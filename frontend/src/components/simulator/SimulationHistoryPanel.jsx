function fmtDelta(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
  const v = Number(value)
  if (v === 0) return `0${suffix}`
  return `${v > 0 ? '+' : ''}${v}${suffix}`
}

export default function SimulationHistoryPanel({
  history = [],
  selectedId = null,
  onSelect,
}) {
  const selectedIndex = history.findIndex((item) => item.id === selectedId)
  const selectedRun = selectedIndex >= 0 ? history[selectedIndex] : history[0]
  const previousRun = selectedIndex >= 0 ? history[selectedIndex + 1] : history[1]

  const compare = selectedRun && previousRun
    ? {
        affected: selectedRun.affected - previousRun.affected,
        blocked: selectedRun.blocked - previousRun.blocked,
        delay: Number((selectedRun.delay - previousRun.delay).toFixed(1)),
      }
    : null

  return (
    <div className="card">
      <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Simulation History</h3>
      {!history.length ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          No scenario runs yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`scenario-history-item ${item.id === selectedRun?.id ? 'active' : ''}`}
                onClick={() => onSelect?.(item.id)}
              >
                <div className="scenario-history-top">
                  <span>{item.nodeLabel}</span>
                  <span>{item.timeLabel}</span>
                </div>
                <div className="scenario-history-meta">
                  {item.eventType} • {item.severity}
                  {' '}• affected {item.affected}
                  {' '}• blocked {item.blocked}
                  {' '}• delay {item.delay}h
                </div>
              </button>
            ))}
          </div>

          <div className="scenario-history-compare">
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Compare with previous run
            </div>
            {!compare ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Need at least 2 runs to compare.</div>
            ) : (
              <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                <div>Shipments affected: <strong>{fmtDelta(compare.affected)}</strong></div>
                <div>Blocked shipments: <strong>{fmtDelta(compare.blocked)}</strong></div>
                <div>Delay hours: <strong>{fmtDelta(compare.delay, ' h')}</strong></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
