import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import KPICards from '../components/dashboard/KPICards'
import ShipmentMap from '../components/dashboard/ShipmentMap'
import ShipmentTable from '../components/dashboard/ShipmentTable'
import AlertFeed from '../components/dashboard/AlertFeed'
import NewsHeadlines from '../components/dashboard/NewsHeadlines'
import RerouteSuggestionPanel from '../components/dashboard/RerouteSuggestionPanel'
import RoleActionPanel from '../components/dashboard/RoleActionPanel'
import RoleWorkspaceBanner from '../components/common/RoleWorkspaceBanner'
import useShipments from '../hooks/useShipments'
import useDisruptions from '../hooks/useDisruptions'
import useAlerts from '../hooks/useAlerts'
import useRerouteSuggestions from '../hooks/useRerouteSuggestions'
import useShipmentAnimation from '../hooks/useShipmentAnimation'
import { supplyChainApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const navigate = useNavigate()
  const { currentUser, hasRole } = useAuth()
  const {
    shipments,
    loading: shipmentsLoading,
    retryCount: shipmentRetryCount,
    isReconnecting: shipmentsReconnecting,
    lastUpdated: shipmentsLastUpdated,
    isConnected,
  } = useShipments()
  const {
    disruptions,
    loading: disruptionsLoading,
    retryCount: disruptionRetryCount,
    isReconnecting: disruptionsReconnecting,
    lastUpdated: disruptionsLastUpdated,
  } = useDisruptions()
  const { alerts } = useAlerts({ shipments, disruptions })
  const {
    suggestions: rerouteSuggestions,
    loading: suggestionsLoading,
    dismiss: dismissSuggestion,
    approve: approveSuggestion,
  } = useRerouteSuggestions()

  // Smooth marker animation
  const animatedShipments = useShipmentAnimation(shipments, isConnected)

  const [graph, setGraph] = useState({ nodes: [], edges: [] })
  const [graphLoading, setGraphLoading] = useState(true)
  const [selectedShipmentIds, setSelectedShipmentIds] = useState(() => {
    try {
      const raw = window.localStorage.getItem('ssc.selectedShipmentIds')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [newsHeadlines, setNewsHeadlines] = useState([])
  const [externalEvents, setExternalEvents] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)

  // Fast-forward state
  const [ffLoading, setFfLoading] = useState(false)
  const [ffToast, setFfToast] = useState(null)

  // Popup state for alerts & news
  const [showAlertPopup, setShowAlertPopup] = useState(false)
  const [showNewsPopup, setShowNewsPopup] = useState(false)

  // Reroute map preview state
  const [reroutePreview, setReroutePreview] = useState(null)

  // Auto-detect disruptions from news on load
  useEffect(() => {
    if (!hasRole('admin', 'supply_chain_manager')) return undefined
    supplyChainApi.detectDisruptions?.().catch(() => {})
    const interval = setInterval(() => {
      supplyChainApi.detectDisruptions?.().catch(() => {})
    }, 120_000) // re-scan every 2 minutes
    return () => clearInterval(interval)
  }, [currentUser?.id, hasRole])

  useEffect(() => {
    let isActive = true
    const loadGraph = async () => {
      setGraphLoading(true)
      const payload = await supplyChainApi.getGraph()
      if (!isActive) return
      setGraph({
        nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
        edges: Array.isArray(payload.edges) ? payload.edges : [],
      })
      setGraphLoading(false)
    }
    loadGraph()
    return () => {
      isActive = false
    }
  }, [currentUser?.id])

  useEffect(() => {
    let isActive = true
    const loadNews = async () => {
      setNewsLoading(true)
      const [payload, eventPayload] = await Promise.all([
        supplyChainApi.getDashboardNewsHeadlines(6),
        supplyChainApi.getDashboardExternalEvents(8),
      ])
      if (!isActive) return
      setNewsHeadlines(Array.isArray(payload.headlines) ? payload.headlines : [])
      setExternalEvents(Array.isArray(eventPayload.events) ? eventPayload.events : [])
      setNewsLoading(false)
    }
    loadNews()
    const interval = setInterval(loadNews, 300000)
    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [currentUser?.id])

  const loading = shipmentsLoading || disruptionsLoading || graphLoading
  const isReconnecting = shipmentsReconnecting || disruptionsReconnecting
  const retryCount = shipmentRetryCount + disruptionRetryCount
  const latestUpdate = Math.max(shipmentsLastUpdated || 0, disruptionsLastUpdated || 0)
  const selectedShipments = animatedShipments.filter((shipment) => selectedShipmentIds.includes(shipment.id))

  useEffect(() => {
    try {
      window.localStorage.setItem('ssc.selectedShipmentIds', JSON.stringify(selectedShipmentIds))
    } catch {
      // ignore storage errors
    }
  }, [selectedShipmentIds])

  const handleSelectShipment = (shipmentId, checked) => {
    setSelectedShipmentIds((prev) => {
      if (checked) {
        if (prev.includes(shipmentId)) return prev
        return [...prev, shipmentId]
      }
      return prev.filter((id) => id !== shipmentId)
    })
  }

  const handleFastForward = async () => {
    setFfLoading(true)
    try {
      const result = await supplyChainApi.fastForward(1)
      if (result.success !== false) {
        setFfToast(`⏩ Advanced ${result.advanced || 0} shipments. ${result.delivered || 0} delivered.`)
        setTimeout(() => setFfToast(null), 4000)
      } else {
        setFfToast(`❌ Fast-forward failed: ${result.error || 'Unknown error'}`)
        setTimeout(() => setFfToast(null), 4000)
      }
    } catch {
      setFfToast('❌ Fast-forward request failed')
      setTimeout(() => setFfToast(null), 4000)
    } finally {
      setFfLoading(false)
    }
  }

  return (
    <div className="dashboard animate-fadeIn">
      <RoleWorkspaceBanner />
      <RoleActionPanel
        shipments={shipments}
        disruptions={disruptions}
        alerts={alerts}
        rerouteSuggestions={rerouteSuggestions}
      />

      {/* Status bar with popup icon buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        {isReconnecting && (
          <div className="card" style={{ padding: '8px 14px', borderColor: 'rgba(245,158,11,0.5)', flex: '0 0 auto' }}>
            <strong style={{ color: 'var(--risk-moderate)' }}>Reconnecting data streams...</strong>
            <span style={{ marginLeft: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
              retry #{retryCount}
            </span>
          </div>
        )}
        {!isReconnecting && latestUpdate > 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Last synced: {new Date(latestUpdate).toLocaleTimeString()}
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Alert bell icon button */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 16, padding: '6px 10px', position: 'relative' }}
              onClick={() => { setShowAlertPopup((p) => !p); setShowNewsPopup(false) }}
              title="Live Alerts"
            >
              🔔
              {alerts.length > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 2,
                  background: 'var(--risk-critical)', color: 'white',
                  borderRadius: '50%', width: 16, height: 16,
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{alerts.length}</span>
              )}
            </button>
            {showAlertPopup && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                width: 360, maxHeight: 420, overflowY: 'auto',
                background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                zIndex: 100, padding: 0,
              }}>
                <AlertFeed alerts={alerts} loading={loading} />
              </div>
            )}
          </div>

          {/* News icon button */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 16, padding: '6px 10px', position: 'relative' }}
              onClick={() => { setShowNewsPopup((p) => !p); setShowAlertPopup(false) }}
              title="Regional News"
            >
              📰
              {newsHeadlines.length > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 2,
                  background: 'var(--accent-primary)', color: 'white',
                  borderRadius: '50%', width: 16, height: 16,
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{newsHeadlines.length}</span>
              )}
            </button>
            {showNewsPopup && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                width: 360, maxHeight: 420, overflowY: 'auto',
                background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                zIndex: 100, padding: 0,
              }}>
                <NewsHeadlines headlines={newsHeadlines} loading={newsLoading} />
              </div>
            )}
          </div>

          {/* Fast Forward Button */}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 13, gap: 6 }}
            onClick={handleFastForward}
            disabled={ffLoading || !hasRole('admin', 'supply_chain_manager')}
            title={hasRole('admin', 'supply_chain_manager') ? 'Fast Forward 1hr' : 'Only Admin or Supply Chain Manager can fast-forward movement'}
          >
            {ffLoading ? '⏳ Advancing...' : '⏩ Fast Forward 1hr'}
          </button>
        </div>
      </div>

      {/* FF Toast */}
      {ffToast && (
        <div
          className="card"
          style={{
            padding: '8px 14px',
            marginBottom: 8,
            borderColor: ffToast.startsWith('❌') ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.5)',
            fontSize: 13,
            color: ffToast.startsWith('❌') ? 'var(--risk-critical)' : 'var(--risk-low)',
          }}
        >
          {ffToast}
        </div>
      )}

      {/* Reroute notification banner */}
      {rerouteSuggestions.length > 0 && (
        <div
          className="card"
          style={{
            padding: '10px 14px',
            marginBottom: 8,
            borderColor: 'rgba(59,130,246,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>🔔</span>
          <span style={{ fontWeight: 600, color: 'var(--accent-primary)', fontSize: 13 }}>
            New Reroute Plan Available
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            — {rerouteSuggestions.length} shipment{rerouteSuggestions.length > 1 ? 's' : ''} affected.
            Review below.
          </span>
        </div>
      )}

      <KPICards shipments={shipments} loading={loading} />

      <div className="dashboard-grid">
        <ShipmentMap
          nodes={graph.nodes}
          edges={graph.edges}
          shipments={selectedShipments}
          disruptions={disruptions}
          reroutePreview={reroutePreview}
        />

        <div className="dashboard-sidebar-panels">
          <RerouteSuggestionPanel
            suggestions={rerouteSuggestions}
            loading={suggestionsLoading}
            onApprove={approveSuggestion}
            onDismiss={dismissSuggestion}
            onPreview={async (suggestion) => {
              if (!suggestion) {
                setReroutePreview(null)
                return
              }
              // Show loading state immediately
              setReroutePreview({
                id: suggestion.id,
                shipmentId: suggestion.shipmentId,
                originalCoords: [],
                suggestedCoords: [],
                disruptionLocation: suggestion.disruptionLocation || null,
                loading: true,
              })
              // Trace real road paths via Google Directions API
              const nodeCoords = suggestion.originalPathCoords || []
              const newCoords = suggestion.suggestedPathCoords || []
              const [originalTrace, suggestedTrace] = await Promise.all([
                nodeCoords.length >= 2
                  ? supplyChainApi.traceRoute(nodeCoords.map((c) => ({ lat: c.lat, lng: c.lng })))
                  : { path: [] },
                newCoords.length >= 2
                  ? supplyChainApi.traceRoute(newCoords.map((c) => ({ lat: c.lat, lng: c.lng })))
                  : { path: [] },
              ])
              setReroutePreview({
                id: suggestion.id,
                shipmentId: suggestion.shipmentId,
                originalCoords: Array.isArray(originalTrace.path) ? originalTrace.path : [],
                suggestedCoords: Array.isArray(suggestedTrace.path) ? suggestedTrace.path : [],
                disruptionLocation: suggestion.disruptionLocation || null,
                loading: false,
              })
            }}
            previewId={reroutePreview?.id || null}
          />
        </div>
      </div>

      <section className="external-event-review card">
        <div className="external-event-review-header">
          <div>
            <span className="external-event-kicker">News Intelligence</span>
            <h3>External Event Review</h3>
            <p>
              Live news candidates stay here for review before they become active disruptions or reroute triggers.
            </p>
          </div>
          <div className="external-event-count">
            <strong>{externalEvents.length}</strong>
            <span>candidates</span>
          </div>
        </div>

        {newsLoading && (
          <div className="external-event-empty">Scanning live news for route-impacting incidents...</div>
        )}

        {!newsLoading && externalEvents.length === 0 && (
          <div className="external-event-empty">No route-impacting news candidates found right now.</div>
        )}

        {!newsLoading && externalEvents.length > 0 && (
          <div className="external-event-grid">
            {externalEvents.slice(0, 4).map((event) => (
              <article
                key={event.id}
                className={`external-event-card ${event.status === 'active_candidate' ? 'is-active-candidate' : ''}`}
              >
                <div className="external-event-card-top">
                  <strong>{String(event.incidentType || 'incident').replaceAll('_', ' ').toUpperCase()}</strong>
                  <span>{Math.round((event.confidence || 0) * 100)}%</span>
                </div>
                <p className="external-event-location">
                  {event.locationName || 'Unknown location'} · {event.affectedCount || 0} shipment(s) affected
                </p>
                <p className="external-event-title">{event.title}</p>
                <div className="external-event-status">
                  {event.status === 'active_candidate' ? 'Ready for review' : 'Needs validation'}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ShipmentTable
        shipments={shipments}
        loading={loading}
        selectedShipmentIds={selectedShipmentIds}
        onToggleSelect={handleSelectShipment}
        onOpenShipment={(id) => navigate(`/shipment/${id}`)}
      />

      {/* Click-away overlay for popups */}
      {(showAlertPopup || showNewsPopup) && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          onClick={() => { setShowAlertPopup(false); setShowNewsPopup(false) }}
        />
      )}
    </div>
  )
}
