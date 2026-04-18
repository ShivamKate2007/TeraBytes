export default function ImpactAnalysis({ result = null }) {
  const metrics = result?.cascadeMetrics
  const byCargo = metrics?.impactBreakdown?.byCargo || {}
  const byPriority = metrics?.impactBreakdown?.byPriority || {}
  const plans = metrics?.reroutePlans || []
  const blockedCount = plans.filter((plan) => plan.status === 'blocked_at_disruption_node').length
  const reroutedCount = plans.filter((plan) => plan.status === 'rerouted').length

  return (
    <div className="card">
      <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Cascade Impact</h3>
      {!metrics ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Run a scenario to view chain-level impact metrics.
        </div>
      ) : (
        <div className="cascade-impact">
          <div className="cascade-row">
            <div className="cascade-row-label">📦 Shipments Affected</div>
            <div className="cascade-row-value">{metrics.totalShipmentsAffected ?? 0}</div>
          </div>
          <div className="cascade-row">
            <div className="cascade-row-label">⏱️ Reroute Delay (hrs)</div>
            <div className="cascade-row-value">{metrics.networkDelayHrs ?? 0}</div>
          </div>
          <div className="cascade-row">
            <div className="cascade-row-label">🛣️ Reroute Plans</div>
            <div className="cascade-row-value">{(metrics.reroutePlans || []).length}</div>
          </div>
          <div className="cascade-row">
            <div className="cascade-row-label">🧱 Blocked Shipments</div>
            <div className="cascade-row-value">{blockedCount}</div>
          </div>
          <div className="cascade-row">
            <div className="cascade-row-label">✅ Successfully Rerouted</div>
            <div className="cascade-row-value">{reroutedCount}</div>
          </div>
          <div className="cascade-row">
            <div className="cascade-row-label">📍 Disrupted Node</div>
            <div className="cascade-row-value">{metrics.disruptedNode || '--'}</div>
          </div>
          <div className="cascade-row">
            <div className="cascade-row-label">📦 Cargo Mix</div>
            <div className="cascade-row-value">
              {Object.keys(byCargo).length
                ? Object.entries(byCargo).map(([key, val]) => `${key}:${val}`).join(' | ')
                : '--'}
            </div>
          </div>
          <div className="cascade-row">
            <div className="cascade-row-label">🚦 Priority Mix</div>
            <div className="cascade-row-value">
              {Object.keys(byPriority).length
                ? Object.entries(byPriority).map(([key, val]) => `${key}:${val}`).join(' | ')
                : '--'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
