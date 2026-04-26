import { DISRUPTION_TYPES } from '../../utils/constants'

const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical']

function severityLabel(level) {
  const safe = Math.max(1, Math.min(4, Number(level) || 1))
  return SEVERITY_LEVELS[safe - 1]
}

export default function ScenarioPanel({
  scenario,
  selectedDisruption,
  focusShipmentCount = 0,
  focusShipments = [],
  onClearFocus,
  hasResult = false,
  onChange,
  onRun,
  onReset,
  isRunning = false,
}) {
  const severity = severityLabel(scenario.severityLevel)
  const canRun = Boolean(selectedDisruption?.nodeId) && !isRunning

  return (
    <div className="scenario-panel">
      <div className="scenario-panel-header">
        <h3 className="scenario-panel-title">Configure Scenario</h3>
      </div>

      <div className="scenario-panel-body">
        <div className="scenario-field">
          <label className="scenario-label">Disruption Type</label>
          <div className="scenario-type-grid">
            {DISRUPTION_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                className={`scenario-type-btn ${scenario.type === type.id ? 'selected' : ''}`}
                onClick={() => onChange?.({ type: type.id })}
              >
                <span className="scenario-type-icon">{type.icon}</span>
                <span className="scenario-type-label">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="scenario-field">
          <label className="scenario-label">Severity ({severity})</label>
          <input
            type="range"
            className="scenario-slider"
            min="1"
            max="4"
            value={scenario.severityLevel}
            onChange={(event) => onChange?.({ severityLevel: Number(event.target.value) })}
          />
          <div className="scenario-slider-labels">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
            <span>Critical</span>
          </div>
        </div>

        <div className="scenario-field">
          <label className="scenario-label">Impact Radius ({scenario.radiusKm} km)</label>
          <input
            type="range"
            className="scenario-slider"
            min="10"
            max="200"
            value={scenario.radiusKm}
            onChange={(event) => onChange?.({ radiusKm: Number(event.target.value) })}
          />
          <div className="scenario-slider-labels">
            <span>10 km</span>
            <span>200 km</span>
          </div>
        </div>

        <div className="scenario-field">
          <label className="scenario-label">Estimated Duration ({scenario.durationHours} h)</label>
          <input
            type="range"
            className="scenario-slider"
            min="1"
            max="72"
            value={scenario.durationHours}
            onChange={(event) => onChange?.({ durationHours: Number(event.target.value) })}
          />
          <div className="scenario-slider-labels">
            <span>1 h</span>
            <span>72 h</span>
          </div>
        </div>

        <button type="button" className="btn-simulate" disabled={!canRun} onClick={onRun}>
          {isRunning ? 'Running simulation...' : '🚀 Run Simulation'}
        </button>
        {focusShipmentCount > 0 && (
          <div className="card" style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Focus mode: {focusShipmentCount} shipment{focusShipmentCount > 1 ? 's' : ''} selected from Dashboard.
            </div>
            {focusShipments.length > 0 && (
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                {focusShipments.slice(0, 3).map((shipment) => (
                  <div key={shipment.id} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {shipment.id} • {shipment.currentStage || '--'} • {shipment.status || '--'}
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 8, width: '100%' }}
              onClick={onClearFocus}
            >
              Clear focus
            </button>
          </div>
        )}
        {(selectedDisruption?.nodeId || hasResult) && (
          <button
            type="button"
            className="btn btn-ghost btn-lg"
            style={{ width: '100%' }}
            onClick={onReset}
            disabled={isRunning}
          >
            ↩ Rollback to Optimal
          </button>
        )}

        {!selectedDisruption?.nodeId ? (
          <div className="empty-state" style={{ padding: 'var(--spacing-lg)' }}>
            <span className="empty-state-icon">🎯</span>
            <span className="empty-state-title">Place a disruption first</span>
            <span className="empty-state-text">
              Click on the map to place disruption center and simulate impacted route segments.
            </span>
          </div>
        ) : (
          <div className="card" style={{ padding: '12px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Selected Node</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
              {selectedDisruption.nodeName || selectedDisruption.nodeId}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Lat {selectedDisruption.lat.toFixed(3)}, Lng {selectedDisruption.lng.toFixed(3)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
