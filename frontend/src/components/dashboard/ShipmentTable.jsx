import { useMemo, useState } from 'react'
import RiskBadge from '../common/RiskBadge'
import { CHAIN_STAGES } from '../../utils/constants'

function normalizeValue(value) {
  if (value === null || value === undefined) return ''
  return String(value).toLowerCase()
}

export default function ShipmentTable({
  shipments = [],
  loading = false,
  selectedShipmentIds = [],
  onToggleSelect,
  onOpenShipment,
}) {
  const [query, setQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  const [sortBy, setSortBy] = useState('riskScore')
  const [sortDir, setSortDir] = useState('desc')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    const riskFiltered = shipments.filter((item) => {
      const risk = Number(item.riskScore) || 0
      if (riskFilter === 'high') return risk >= 70
      if (riskFilter === 'moderate') return risk >= 40 && risk < 70
      if (riskFilter === 'low') return risk < 40
      return true
    })

    const searched = riskFiltered.filter((item) => {
      if (!q) return true
      return (
        normalizeValue(item.id).includes(q) ||
        normalizeValue(item.cargoType).includes(q) ||
        normalizeValue(item.currentStage).includes(q) ||
        normalizeValue(item.status).includes(q)
      )
    })

    const sorted = [...searched].sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]
      if (typeof aVal === 'number' || typeof bVal === 'number') {
        const first = Number(aVal) || 0
        const second = Number(bVal) || 0
        return sortDir === 'asc' ? first - second : second - first
      }
      const first = normalizeValue(aVal)
      const second = normalizeValue(bVal)
      return sortDir === 'asc' ? first.localeCompare(second) : second.localeCompare(first)
    })

    return sorted
  }, [shipments, query, riskFilter, sortBy, sortDir])

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortBy(key)
    setSortDir('desc')
  }

  return (
    <div className="shipment-table-container">
      <div className="shipment-table-header">
        <div className="shipment-table-title">Active Shipment Lanes</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ID / cargo / stage"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-glass-border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              padding: '8px 10px',
              fontSize: 12,
              minWidth: 200,
            }}
          />
          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value)}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-glass-border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              padding: '8px 10px',
              fontSize: 12,
            }}
          >
            <option value="all">All risk</option>
            <option value="high">High</option>
            <option value="moderate">Moderate</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <table className="shipment-table">
        <thead>
          <tr>
            <th>Selected</th>
            <th onClick={() => handleSort('id')}>ID</th>
            <th onClick={() => handleSort('cargoType')}>Cargo</th>
            <th>Journey</th>
            <th onClick={() => handleSort('currentStage')}>Stage</th>
            <th onClick={() => handleSort('riskScore')}>Risk</th>
            <th onClick={() => handleSort('status')}>Status</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={7} style={{ color: 'var(--text-muted)' }}>
                Loading shipment grid...
              </td>
            </tr>
          )}

          {!loading && !filtered.length && (
            <tr>
              <td colSpan={7} style={{ color: 'var(--text-muted)' }}>
                No shipments match the current filters.
              </td>
            </tr>
          )}

          {!loading &&
            filtered.map((shipment) => (
              <tr key={shipment.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedShipmentIds.includes(shipment.id)}
                    onChange={(event) => onToggleSelect?.(shipment.id, event.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </td>
                <td className="text-mono">
                  <button
                    type="button"
                    onClick={() => onOpenShipment?.(shipment.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      padding: 0,
                      font: 'inherit',
                      textDecoration: 'underline',
                      textUnderlineOffset: '3px',
                    }}
                  >
                    {shipment.id}
                  </button>
                </td>
                <td>{shipment.cargoType}</td>
                <td>
                  <div className="journey-progress">
                    {CHAIN_STAGES.map((stage, index) => {
                      const active = shipment.currentStage === stage.key
                      const completed =
                        shipment.journey?.find((item) => item.stage === stage.key)?.status === 'completed'
                      return (
                        <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <span
                            className={`journey-stage ${active ? 'active' : ''} ${completed ? 'completed' : ''}`}
                            title={stage.label}
                          >
                            {stage.icon}
                          </span>
                          {index !== CHAIN_STAGES.length - 1 && (
                            <span className={`journey-connector ${completed ? 'completed' : ''}`} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </td>
                <td>{shipment.currentStage}</td>
                <td>
                  <RiskBadge score={Math.round(Number(shipment.riskScore) || 0)} />
                </td>
                <td>{shipment.status}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
