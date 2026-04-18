function titleCase(text) {
  return String(text || '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function NarrativePanel({ result = null, scenario = null, selectedDisruption = null }) {
  const text = result?.executiveSummary
  const metrics = result?.cascadeMetrics
  const plans = metrics?.reroutePlans || []
  const blocked = plans.filter((plan) => plan.status === 'blocked_at_disruption_node').length
  const rerouted = plans.filter((plan) => plan.status === 'rerouted').length

  return (
    <div className="narrative-panel">
      <div className="narrative-header">🧠 Executive Narrative</div>
      <div className="narrative-text">
        {text || 'Run a scenario to generate an executive summary of expected cascading impact and actions.'}
      </div>
      {metrics && (
        <div style={{ marginTop: 12, display: 'grid', gap: 8, fontSize: 13 }}>
          <div><strong>What happened:</strong> {titleCase(scenario?.type)} scenario at {selectedDisruption?.nodeName || metrics.disruptedNode} impacted {metrics.totalShipmentsAffected} shipments.</div>
          <div><strong>Operational impact:</strong> {rerouted} rerouted, {blocked} blocked, {metrics.networkDelayHrs}h estimated reroute delay.</div>
          <div><strong>Recommended action (2/6/24h):</strong> 2h monitor blocked nodes, 6h prioritize high-value reroutes, 24h rebalance downstream distribution inventory.</div>
        </div>
      )}
      {result?.error && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--risk-high)' }}>
          Backend note: {result.error}
        </div>
      )}
    </div>
  )
}
