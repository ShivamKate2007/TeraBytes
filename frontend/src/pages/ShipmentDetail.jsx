import { useEffect, useMemo, useState } from 'react'
import { CircleF, GoogleMap, InfoWindowF, MarkerF, PolylineF, useJsApiLoader } from '@react-google-maps/api'
import { Link, useParams } from 'react-router-dom'
import RiskBadge from '../components/common/RiskBadge'
import LoadingSkeleton from '../components/common/LoadingSkeleton'
import { supplyChainApi } from '../services/api'
import { CHAIN_STAGES, MAPS_DARK_STYLE } from '../utils/constants'

const containerStyle = { width: '100%', height: '260px', borderRadius: '14px' }
const mapLibraries = ['visualization']

function getOrderedRouteNodeIds(shipment) {
  const journey = Array.isArray(shipment?.journey) ? shipment.journey : []
  const journeyNodeIds = journey
    .map((stage) => ({ nodeId: stage.nodeId, status: stage.status }))
    .filter((item) => !!item.nodeId)

  if (journeyNodeIds.length >= 2) {
    const activeIndex = journeyNodeIds.findIndex((item) => item.status === 'active')
    const pendingIndex = journeyNodeIds.findIndex((item) => item.status === 'pending')
    const startIndex = activeIndex >= 0 ? activeIndex : pendingIndex >= 0 ? Math.max(0, pendingIndex - 1) : 0
    return journeyNodeIds.slice(startIndex).map((item) => item.nodeId)
  }

  const route = Array.isArray(shipment?.optimizedRoute) && shipment.optimizedRoute.length
    ? shipment.optimizedRoute
    : shipment?.originalRoute
  return Array.isArray(route) ? route : []
}

function normalizeTimelineStatus(stageData, stageKey, currentStageKey) {
  if (stageData?.status === 'completed') return 'completed'
  if (stageData?.status === 'active') return 'active'
  if (currentStageKey === stageKey) return 'active'
  if (stageData?.status === 'pending') return 'pending'
  return 'pending'
}

function formatLatLng(position) {
  if (!position?.lat || !position?.lng) return '--'
  return `${Number(position.lat).toFixed(3)}, ${Number(position.lng).toFixed(3)}`
}

export default function ShipmentDetail() {
  const { id } = useParams()
  const { isLoaded } = useJsApiLoader({
    id: 'ssc-map',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: mapLibraries,
  })

  const [shipment, setShipment] = useState(null)
  const [nodes, setNodes] = useState([])
  const [tracePath, setTracePath] = useState([])
  const [hoveredInfo, setHoveredInfo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isActive = true
    const loadData = async () => {
      try {
        const [shipmentPayload, graphPayload] = await Promise.all([
          supplyChainApi.getShipmentById(id),
          supplyChainApi.getGraph(),
        ])
        if (!isActive) return
        setShipment(shipmentPayload.shipment || null)
        setNodes(Array.isArray(graphPayload.nodes) ? graphPayload.nodes : [])
      } finally {
        if (isActive) setLoading(false)
      }
    }
    loadData()
    return () => {
      isActive = false
    }
  }, [id])

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const routeNodeIds = useMemo(() => (shipment ? getOrderedRouteNodeIds(shipment) : []), [shipment])
  const routeNodes = useMemo(() => {
    return routeNodeIds
      .map((nodeId) => nodeById.get(nodeId))
      .filter(Boolean)
  }, [routeNodeIds, nodeById])

  const routePoints = useMemo(() => {
    return routeNodes.map((node) => ({ lat: node.lat, lng: node.lng }))
  }, [routeNodes])

  useEffect(() => {
    let isActive = true
    const loadTracePath = async () => {
      if (!shipment?.currentPosition || !routePoints.length) {
        if (isActive) setTracePath(routePoints)
        return
      }

      const points = [
        { lat: shipment.currentPosition.lat, lng: shipment.currentPosition.lng },
        ...routePoints,
      ]
      const payload = await supplyChainApi.traceRoute(points)
      if (!isActive) return
      const path = Array.isArray(payload.path) && payload.path.length > 1 ? payload.path : points
      setTracePath(path)
    }

    loadTracePath()
    return () => {
      isActive = false
    }
  }, [shipment, routePoints])

  if (loading) {
    return (
      <div className="shipment-detail">
        <LoadingSkeleton type="card" height="80px" />
        <LoadingSkeleton type="card" height="180px" />
        <LoadingSkeleton type="card" height="320px" />
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="shipment-detail">
        <Link to="/">← Back to Dashboard</Link>
        <div className="empty-state card">
          <span className="empty-state-title">Shipment not found</span>
          <span className="empty-state-text">No record found for {id}.</span>
        </div>
      </div>
    )
  }

  const liveRisk = shipment.liveRisk || {}
  const risk = Math.round(Number(liveRisk.riskScore ?? shipment.riskScore) || 0)

  const stageDescriptor = (stageKey, stageData) => {
    if (stageKey === 'manufacturer') return shipment.manufacturer || stageData?.nodeName || stageData?.nodeId || '--'
    if (stageKey === 'warehouse') return stageData?.nodeName || stageData?.nodeId || 'Warehouse location pending'
    if (stageKey === 'in_transit') return shipment.currentStage === 'in_transit'
      ? `Current location: ${formatLatLng(shipment.currentPosition)}`
      : stageData?.currentLeg || 'Not in transit'
    if (stageKey === 'distribution_center') return stageData?.nodeName || stageData?.nodeId || 'Distributor pending'
    if (stageKey === 'retailer') return shipment.endCustomer || stageData?.nodeName || stageData?.nodeId || '--'
    return stageData?.nodeName || stageData?.nodeId || '--'
  }

  return (
    <div className="shipment-detail">
      <div className="shipment-detail-header">
        <div>
          <Link to="/" style={{ fontSize: '0.85rem', marginBottom: '8px', display: 'block' }}>
            ← Back to Dashboard
          </Link>
          <span className="shipment-detail-id">{shipment.id}</span>
        </div>
        <RiskBadge score={risk} />
      </div>

      <div className="journey-timeline">
        <div className="journey-timeline-line"></div>
        {CHAIN_STAGES.map((stage) => {
          const stageData = shipment.journey?.find((item) => item.stage === stage.key)
          const status = normalizeTimelineStatus(stageData, stage.key, shipment.currentStage)
          return (
            <div key={stage.key} className={`journey-timeline-step ${status}`}>
              <div className="journey-timeline-icon">{stage.icon}</div>
              <span className="journey-timeline-label">{stage.label}</span>
              <span className="journey-timeline-time" style={{ opacity: 0.9 }}>
                {stageDescriptor(stage.key, stageData)}
              </span>
              <span className="journey-timeline-time">
                {stageData?.arrivedAt ? new Date(stageData.arrivedAt).toLocaleString() : stageData?.eta ? `ETA ${new Date(stageData.eta).toLocaleString()}` : '--'}
              </span>
            </div>
          )
        })}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 1fr) minmax(380px, 1.2fr)',
          gap: 'var(--spacing-md)',
        }}
      >
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
            Risk Breakdown
          </h3>
          <div style={{ display: 'grid', gap: 10, fontSize: 14 }}>
            <div>Current Stage: <strong>{shipment.currentStage}</strong></div>
            <div>Status: <strong>{shipment.status}</strong></div>
            <div>Live Risk Score: <strong>{risk}</strong></div>
            <div>Base Rule Score: <strong>{liveRisk.baseScore ?? '--'}</strong></div>
            <div>LSTM Multiplier: <strong>{liveRisk.lstmMultiplier ?? shipment.lstmPrediction ?? '--'}</strong></div>
            <div>Priority: <strong>{shipment.priority}</strong></div>
            <div>Cargo: <strong>{shipment.cargoType}</strong></div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
            Route Map
          </h3>
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={shipment.currentPosition || tracePath[0] || { lat: 20.5937, lng: 78.9629 }}
              zoom={5}
              options={{ disableDefaultUI: true, zoomControl: true, styles: MAPS_DARK_STYLE }}
            >
              {tracePath.length > 1 && (
                <PolylineF
                  path={tracePath}
                  onMouseOver={(event) => {
                    const latLng = event.latLng?.toJSON?.()
                    if (!latLng) return
                    setHoveredInfo({
                      title: 'Route Segment',
                      subtitle: 'Exact traced shipment route',
                      position: latLng,
                    })
                  }}
                  onMouseOut={() => setHoveredInfo(null)}
                  options={{
                    strokeColor: '#3b82f6',
                    strokeOpacity: 0.9,
                    strokeWeight: 4,
                  }}
                />
              )}
              {routeNodes.map((node, idx) => (
                <CircleF
                  key={`${node.id}-${idx}`}
                  center={{ lat: node.lat, lng: node.lng }}
                  radius={35000}
                  onMouseOver={() =>
                    setHoveredInfo({
                      title: node.name || node.id,
                      subtitle: `Node: ${node.type || 'supply_chain_node'}`,
                      position: { lat: node.lat, lng: node.lng },
                    })
                  }
                  onMouseOut={() => setHoveredInfo(null)}
                  options={{
                    fillColor: idx === routeNodes.length - 1 ? '#22c55e' : '#f59e0b',
                    fillOpacity: 0.6,
                    strokeOpacity: 0,
                  }}
                />
              ))}
              {shipment.currentPosition && (
                <MarkerF
                  position={shipment.currentPosition}
                  onMouseOver={() =>
                    setHoveredInfo({
                      title: `Shipment ${shipment.id}`,
                      subtitle: `${shipment.cargoType} | ${shipment.currentStage}`,
                      position: shipment.currentPosition,
                    })
                  }
                  onMouseOut={() => setHoveredInfo(null)}
                  icon={{
                    path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: 6,
                    fillColor: '#ef4444',
                    fillOpacity: 0.95,
                    strokeColor: '#0f172a',
                    strokeWeight: 1,
                  }}
                />
              )}
              {hoveredInfo?.position && (
                <InfoWindowF
                  position={hoveredInfo.position}
                  onCloseClick={() => setHoveredInfo(null)}
                >
                  <div style={{ minWidth: 220, color: '#111827' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{hoveredInfo.title}</div>
                    <div style={{ fontSize: 12 }}>{hoveredInfo.subtitle}</div>
                  </div>
                </InfoWindowF>
              )}
            </GoogleMap>
          ) : (
            <LoadingSkeleton type="card" height="260px" />
          )}
        </div>
      </div>
    </div>
  )
}
