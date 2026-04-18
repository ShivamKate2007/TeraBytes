function summarizePath(path) {
  if (!Array.isArray(path) || !path.length) return '--'
  if (path.length <= 3) return path.join(' → ')
  return `${path[0]} → … → ${path[path.length - 1]}`
}

function pathChanged(plan) {
  const oldPath = Array.isArray(plan?.oldPath) ? plan.oldPath.join('>') : ''
  const newPath = Array.isArray(plan?.newPath) ? plan.newPath.join('>') : ''
  return oldPath !== newPath
}

function isBlockedPlan(plan) {
  return plan?.status === 'blocked_at_disruption_node' || plan?.status === 'no_alternative_path'
}

function destinationChanged(plan) {
  const oldDest = plan?.oldDestinationNode || (Array.isArray(plan?.oldPath) ? plan.oldPath[plan.oldPath.length - 1] : null)
  const newDest = plan?.newDestinationNode || (Array.isArray(plan?.newPath) ? plan.newPath[plan.newPath.length - 1] : null)
  if (!oldDest || !newDest) return false
  return oldDest !== newDest
}

function blockedLabel(plan) {
  if (plan?.status === 'blocked_at_disruption_node') return 'BLOCKED AT DISRUPTION NODE'
  if (plan?.status === 'no_alternative_path') return 'NO ALTERNATIVE ROUTE'
  return 'BLOCKED'
}

export default function RouteComparison({ result = null }) {
  const plans = result?.cascadeMetrics?.reroutePlans || []
  const actionable = plans
    .filter((plan) => !isBlockedPlan(plan))
    .filter((plan) => plan?.status === 'recovery_reroute' || pathChanged(plan) || Number(plan?.addedDelayHrs || 0) > 0)
  const displayPlans = (actionable.length ? actionable : plans).slice(0, 3)

  return (
    <div className="card">
      <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Route Comparison</h3>
      {!displayPlans.length ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          No reroute plans generated yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {displayPlans.map((plan) => (
            <div key={plan.shipmentId} className="route-comparison">
              <div className="route-card original">
                <div className="route-card-label">Original • {plan.shipmentId}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {plan.shipmentStatus || '--'} • {plan.currentStage || '--'}
                </div>
                <div className="route-metric path-row">
                  <span className="route-metric-label">Path:</span>
                  <span className="route-metric-value path-value">{summarizePath(plan.oldPath)}</span>
                </div>
                <div className="route-metric">
                  <span className="route-metric-label">Destination</span>
                  <span className="route-metric-value">{plan?.oldDestinationNode || '--'}</span>
                </div>
              </div>
              <div className="route-card optimized">
                <div className="route-card-label">Optimized • {plan.shipmentId}</div>
                {plan?.status === 'recovery_reroute' && (
                  <div style={{ fontSize: 11, color: 'var(--accent-primary)', marginBottom: 6 }}>
                    Recovery reroute from {plan?.recoveryFromNode || 'safe node'}
                  </div>
                )}
                {destinationChanged(plan) && (
                  <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 6 }}>
                    Destination changed in simulation output
                  </div>
                )}
                <div className="route-metric path-row">
                  <span className="route-metric-label">Path:</span>
                  <span className="route-metric-value path-value">
                    {isBlockedPlan(plan) ? blockedLabel(plan) : summarizePath(plan.newPath)}
                  </span>
                </div>
                <div className="route-metric">
                  <span className="route-metric-label">Destination</span>
                  <span className="route-metric-value">
                    {isBlockedPlan(plan) ? 'N/A' : plan?.newDestinationNode || '--'}
                  </span>
                </div>
                <div className="route-metric">
                  <span className="route-metric-label">Added Delay</span>
                  <span className="route-metric-value">
                    {isBlockedPlan(plan) ? 'N/A' : `${plan.addedDelayHrs ?? 0} h`}
                  </span>
                </div>
                <div className="route-metric">
                  <span className="route-metric-label">Time (old/new)</span>
                  <span className="route-metric-value">
                    {isBlockedPlan(plan)
                      ? 'N/A'
                      : `${(plan.oldTimeHrs ?? '--')} / ${(plan.newTimeHrs ?? '--')} h`}
                  </span>
                </div>
                <div className="route-metric">
                  <span className="route-metric-label">Risk (old/new)</span>
                  <span className="route-metric-value">
                    {isBlockedPlan(plan)
                      ? `${(plan.oldRiskScore ?? '--')} / ${(plan.newRiskScore ?? 100)}`
                      : `${(plan.oldRiskScore ?? '--')} / ${(plan.newRiskScore ?? '--')}`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
