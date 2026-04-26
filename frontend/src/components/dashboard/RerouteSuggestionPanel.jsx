import { useState } from 'react'

const RECOMMENDATION_CONFIG = {
  reroute: { icon: '🔄', label: 'Reroute Available', color: 'var(--risk-low)', borderColor: 'rgba(16,185,129,0.3)' },
  wait_for_reopen: { icon: '⏳', label: 'Must Wait', color: 'var(--risk-moderate)', borderColor: 'rgba(245,158,11,0.3)' },
  continue_as_planned: { icon: '✅', label: 'No Action Needed', color: 'var(--accent-primary)', borderColor: 'rgba(59,130,246,0.3)' },
}

function formatHours(h) {
  if (!h && h !== 0) return '—'
  if (h < 1) return `${Math.round(h * 60)}min`
  return `${h.toFixed(1)}h`
}

function getRecommendationConfig(suggestion) {
  const rec = suggestion.recommendation || 'wait_for_reopen'
  return RECOMMENDATION_CONFIG[rec] || RECOMMENDATION_CONFIG.wait_for_reopen
}

export default function RerouteSuggestionPanel({
  suggestions = [],
  onApprove,
  onDismiss,
  onPreview,
  previewId,
  loading,
}) {
  const [approving, setApproving] = useState({})
  const [expanded, setExpanded] = useState(null)

  if (!suggestions.length && !loading) return null

  const handleApprove = async (suggestion) => {
    setApproving((prev) => ({ ...prev, [suggestion.id]: true }))
    try {
      await onApprove?.(suggestion)
    } finally {
      setApproving((prev) => ({ ...prev, [suggestion.id]: false }))
    }
  }

  const handleExpand = (suggestion) => {
    const isExpanding = expanded !== suggestion.id
    setExpanded(isExpanding ? suggestion.id : null)
    if (isExpanding && suggestion.recommendation === 'reroute') {
      onPreview?.(suggestion)
    } else {
      onPreview?.(null)
    }
  }

  return (
    <div className="card" style={{ padding: 'var(--spacing-md)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>🔔</span>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Reroute Suggestions</span>
        <span
          style={{
            marginLeft: 'auto',
            background: 'var(--risk-critical)',
            color: 'white',
            borderRadius: 'var(--radius-full)',
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {suggestions.length}
        </span>
      </div>

      {loading && !suggestions.length && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzing disruptions...</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
        {suggestions.map((suggestion) => {
          const config = getRecommendationConfig(suggestion)
          const isReroute = suggestion.recommendation === 'reroute'
          const isContinue = suggestion.recommendation === 'continue_as_planned'
          const isWait = suggestion.recommendation === 'wait_for_reopen'
          const isExpanded = expanded === suggestion.id
          const isPreviewing = previewId === suggestion.id

          return (
            <div
              key={suggestion.id}
              style={{
                background: isPreviewing ? 'rgba(59,130,246,0.08)' : 'var(--bg-elevated)',
                border: `1px solid ${isPreviewing ? 'rgba(59,130,246,0.5)' : config.borderColor}`,
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onClick={() => handleExpand(suggestion)}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{config.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>
                  {suggestion.shipmentId}
                </span>
                {isPreviewing && (
                  <span style={{ fontSize: 10, color: 'var(--accent-primary)', fontWeight: 600 }}>
                    📍 ON MAP
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 600, color: config.color, textTransform: 'uppercase' }}>
                  {config.label}
                </span>
              </div>

              {/* Disruption info */}
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                {suggestion.disruptionType?.replace(/_/g, ' ').toUpperCase()} —{' '}
                {suggestion.disruptionDescription?.slice(0, 80) || 'Disruption detected'}
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div style={{ marginTop: 10 }}>

                  {/* ── CONTINUE AS PLANNED explanation ── */}
                  {isContinue && (
                    <div style={{
                      background: 'rgba(59,130,246,0.08)',
                      border: '1px solid rgba(59,130,246,0.2)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 10px',
                      marginBottom: 10,
                      fontSize: 11,
                    }}>
                      <div style={{ fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 4 }}>
                        ✅ No reroute needed
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        Shipment reaches the disruption zone in{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {formatHours(suggestion.etaToDisruptionHrs)}
                        </strong>
                        , but the disruption will clear in{' '}
                        <strong style={{ color: 'var(--risk-low)' }}>
                          {formatHours(suggestion.disruptionDurationHrs)}
                        </strong>
                        . The road will be open before the shipment arrives.
                      </div>
                    </div>
                  )}

                  {/* ── WAIT FOR REOPEN explanation ── */}
                  {isWait && (
                    <div style={{
                      background: 'rgba(245,158,11,0.08)',
                      border: '1px solid rgba(245,158,11,0.2)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 10px',
                      marginBottom: 10,
                      fontSize: 11,
                    }}>
                      <div style={{ fontWeight: 700, color: 'var(--risk-moderate)', marginBottom: 4 }}>
                        ⏳ Must wait for facility to reopen
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        {suggestion.mandatoryNodeBlocked ? (
                          <>
                            <strong style={{ color: 'var(--text-primary)' }}>
                              {suggestion.mandatoryNodeBlocked.replace(/_/g, ' ')}
                            </strong>{' '}
                            is a mandatory stop (cargo must be unloaded/sorted). It cannot be skipped.
                            Estimated delay: <strong>{formatHours(suggestion.addedDelayHrs)}</strong>.
                          </>
                        ) : (
                          <>
                            Rerouting would take longer than waiting for the disruption to clear.
                            Estimated delay: <strong>{formatHours(suggestion.addedDelayHrs)}</strong>.
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Map preview hint for reroutes ── */}
                  {isReroute && isPreviewing && (
                    <div style={{
                      fontSize: 11, color: 'var(--accent-primary)', marginBottom: 8,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <span>📍</span> Reroute path shown on map
                      <span style={{ color: 'var(--risk-critical)' }}>— (red = original</span>,{' '}
                      <span style={{ color: 'var(--risk-low)' }}>green = suggested)</span>
                    </div>
                  )}

                  {/* Time comparison (only for reroute and wait) */}
                  {!isContinue && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 8, marginBottom: 10,
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Original</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>
                          {formatHours(suggestion.originalEtaHrs)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {isReroute ? 'Reroute' : 'With Delay'}
                        </div>
                        <div style={{
                          fontSize: 16, fontWeight: 700,
                          color: isReroute ? 'var(--risk-low)' : 'var(--risk-moderate)',
                        }}>
                          {isReroute
                            ? formatHours(suggestion.rerouteEtaHrs)
                            : formatHours(suggestion.waitEtaHrs)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {isReroute ? 'Savings' : 'Delay'}
                        </div>
                        <div style={{
                          fontSize: 16, fontWeight: 700,
                          color: isReroute && suggestion.timeSavedVsWait > 0
                            ? 'var(--risk-low)' : 'var(--risk-moderate)',
                        }}>
                          {isReroute
                            ? (suggestion.timeSavedVsWait > 0 ? formatHours(suggestion.timeSavedVsWait) : '—')
                            : `+${formatHours(suggestion.addedDelayHrs)}`}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Route comparison (only for actual reroutes) */}
                  {isReroute && suggestion.suggestedPath?.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      <div>
                        <span style={{ color: 'var(--risk-critical)' }}>Old:</span>{' '}
                        {(suggestion.originalPath || []).join(' → ')}
                      </div>
                      <div>
                        <span style={{ color: 'var(--risk-low)' }}>New:</span>{' '}
                        {suggestion.suggestedPath.join(' → ')}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {isReroute && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                        disabled={approving[suggestion.id]}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleApprove(suggestion)
                        }}
                      >
                        {approving[suggestion.id] ? 'Applying...' : '✓ Approve & Apply'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ flex: isReroute ? 0 : 1, fontSize: 12, padding: '6px 10px' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDismiss?.(suggestion.id)
                        if (isPreviewing) onPreview?.(null)
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
