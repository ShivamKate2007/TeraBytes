import { useEffect, useMemo, useState } from 'react'
import {
  CircleF,
  GoogleMap,
  InfoWindowF,
  MarkerF,
  PolylineF,
  useJsApiLoader,
} from '@react-google-maps/api'
import RiskBadge from '../common/RiskBadge'
import RiskHeatmap from './RiskHeatmap'
import { MAPS_CENTER, MAPS_DARK_STYLE, MAPS_ZOOM } from '../../utils/constants'
import { supplyChainApi } from '../../services/api'

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  minHeight: '420px',
}

const libraries = ['visualization']

function edgeColor(riskFactor) {
  if (riskFactor >= 0.8) return '#ef4444'
  if (riskFactor >= 0.55) return '#f97316'
  if (riskFactor >= 0.35) return '#f59e0b'
  return '#10b981'
}

function nodeColor(type) {
  if (type === 'manufacturer') return '#22c55e'
  if (type === 'warehouse') return '#f59e0b'
  if (type === 'transport_hub') return '#3b82f6'
  if (type === 'distribution_center') return '#f97316'
  return '#ec4899'
}

function markerColorByRisk(score) {
  if (score >= 80) return '#ef4444'
  if (score >= 60) return '#f97316'
  if (score >= 40) return '#f59e0b'
  return '#10b981'
}

function toNum(value) {
  return Number(value) || 0
}

function distanceSq(a, b) {
  const dLat = toNum(a.lat) - toNum(b.lat)
  const dLng = toNum(a.lng) - toNum(b.lng)
  return dLat * dLat + dLng * dLng
}

function getOrderedRouteNodeIds(shipment) {
  const journeyNodeIds = (shipment.journey || [])
    .map((stage) => ({ nodeId: stage.nodeId, status: stage.status }))
    .filter((item) => !!item.nodeId)

  if (journeyNodeIds.length >= 2) {
    const activeIndex = journeyNodeIds.findIndex((item) => item.status === 'active')
    const pendingIndex = journeyNodeIds.findIndex((item) => item.status === 'pending')
    const startIndex = activeIndex >= 0 ? activeIndex : pendingIndex >= 0 ? Math.max(0, pendingIndex - 1) : 0
    return journeyNodeIds.slice(startIndex).map((item) => item.nodeId)
  }

  const route = Array.isArray(shipment.optimizedRoute) && shipment.optimizedRoute.length
    ? shipment.optimizedRoute
    : shipment.originalRoute
  return Array.isArray(route) ? route : []
}

export default function ShipmentMap({
  nodes = [],
  edges = [],
  shipments = [],
  disruptions = [],
  reroutePreview = null,
}) {
  const { isLoaded } = useJsApiLoader({
    id: 'ssc-map',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries,
  })
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [mapInstance, setMapInstance] = useState(null)
  const [hoveredInfo, setHoveredInfo] = useState(null)
  const [tracePaths, setTracePaths] = useState({})

  const nodeById = useMemo(() => {
    return new Map(nodes.map((node) => [node.id, node]))
  }, [nodes])

  useEffect(() => {
    let isActive = true

    const loadTracePaths = async () => {
      if (!shipments.length) {
        setTracePaths({})
        return
      }

      const requests = shipments.map(async (shipment) => {
        if (!shipment.currentPosition?.lat || !shipment.currentPosition?.lng) {
          return [shipment.id, null]
        }

        const routeIds = getOrderedRouteNodeIds(shipment)
        if (!routeIds.length) return [shipment.id, null]

        const routeNodes = routeIds.map((nodeId) => nodeById.get(nodeId)).filter(Boolean)
        if (!routeNodes.length) return [shipment.id, null]

        const points = [
          { lat: shipment.currentPosition.lat, lng: shipment.currentPosition.lng },
          ...routeNodes.map((node) => ({ lat: node.lat, lng: node.lng })),
        ]

        const result = await supplyChainApi.traceRoute(points)
        const path = Array.isArray(result.path) ? result.path : []
        return [shipment.id, path.length > 1 ? path : null]
      })

      const resolved = await Promise.all(requests)
      if (!isActive) return
      const mapped = {}
      resolved.forEach(([shipmentId, path]) => {
        if (path) mapped[shipmentId] = path
      })
      setTracePaths(mapped)
    }

    loadTracePaths()
    return () => {
      isActive = false
    }
  }, [shipments, nodeById])

  const shipmentLines = useMemo(() => {
    if (!shipments.length) return []

    return shipments
      .map((shipment) => {
        const tracedPath = tracePaths[shipment.id]
        if (!tracedPath?.length) return null
        return {
          id: shipment.id,
          path: tracedPath,
          riskFactor: Number(shipment.riskScore || 0) / 100,
        }
      })
      .filter(Boolean)
  }, [shipments, tracePaths])

  const visibleNodeIds = useMemo(() => {
    if (!shipments.length) return new Set()
    const set = new Set()
    shipments.forEach((shipment) => {
      const route = getOrderedRouteNodeIds(shipment)
      if (!Array.isArray(route)) return
      route.forEach((nodeId) => set.add(nodeId))
    })
    return set
  }, [shipments])

  if (!isLoaded) {
    return (
      <div className="dashboard-map-container glass empty-state">
        <span className="empty-state-icon">🗺️</span>
        <span className="empty-state-title">Loading map engine</span>
        <span className="empty-state-text">Connecting to Google Maps and route layers.</span>
      </div>
    )
  }

  return (
    <div className="dashboard-map-container">
      <div className="map-controls">
        <button
          type="button"
          className={`map-control-btn ${showHeatmap ? 'active' : ''}`}
          onClick={() => setShowHeatmap((prev) => !prev)}
        >
          🔥 Risk Heatmap
        </button>
        <div className="map-control-btn active" style={{ cursor: 'default' }}>
          🎯 Selected: {shipments.length}
        </div>
      </div>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={MAPS_CENTER}
        zoom={MAPS_ZOOM}
        onLoad={(map) => setMapInstance(map)}
        onUnmount={() => setMapInstance(null)}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          styles: MAPS_DARK_STYLE,
        }}
      >
        {shipmentLines.map((line) => (
          <PolylineF
            key={line.id}
            path={line.path}
            onMouseOver={(event) => {
              const latLng = event.latLng?.toJSON?.()
              if (!latLng) return
              setHoveredInfo({
                title: `Route for ${line.id}`,
                subtitle: 'Exact traced shipment route',
                position: latLng,
              })
            }}
            onMouseOut={() => setHoveredInfo(null)}
            options={{
              strokeColor: edgeColor(line.riskFactor),
              strokeOpacity: 0.75,
              strokeWeight: 3,
            }}
          />
        ))}

        {nodes
          .filter((node) => (shipments.length ? visibleNodeIds.has(node.id) : true))
          .map((node) => (
          <MarkerF
            key={node.id}
            position={{ lat: node.lat, lng: node.lng }}
            title={`${node.name} (${node.type})`}
            onMouseOver={() =>
              setHoveredInfo({
                title: node.name || node.id,
                subtitle: `Node: ${node.type || 'supply_chain_node'}`,
                position: { lat: node.lat, lng: node.lng },
              })
            }
            onMouseOut={() => setHoveredInfo(null)}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: nodeColor(node.type),
              fillOpacity: 0.95,
              strokeColor: '#0f172a',
              strokeOpacity: 1,
              strokeWeight: 1.5,
            }}
          />
        ))}

        {shipments.map((shipment) => {
          const pos = shipment.currentPosition
          if (!pos?.lat || !pos?.lng) return null
          return (
            <MarkerF
              key={shipment.id}
              position={{ lat: pos.lat, lng: pos.lng }}
              onClick={() => setSelectedShipment(shipment)}
              onMouseOver={() =>
                setHoveredInfo({
                  title: `Shipment ${shipment.id}`,
                  subtitle: `${shipment.cargoType} | ${shipment.currentStage} | Risk ${Math.round(Number(shipment.riskScore) || 0)}`,
                  position: { lat: pos.lat, lng: pos.lng },
                })
              }
              onMouseOut={() => setHoveredInfo(null)}
              title={`${shipment.id} | Risk ${shipment.riskScore}`}
              icon={{
                path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 5,
                fillColor: markerColorByRisk(Number(shipment.riskScore) || 0),
                fillOpacity: 0.95,
                strokeColor: '#0f172a',
                strokeOpacity: 0.85,
                strokeWeight: 1,
              }}
            />
          )
        })}

        {disruptions.map((item) => {
          const lat = item.location?.lat ?? item.lat
          const lng = item.location?.lng ?? item.lng
          if (!lat || !lng) return null
          return (
            <CircleF
              key={item.id || `${lat}-${lng}`}
              center={{ lat, lng }}
              radius={(item.location?.radius || item.radius || 60) * 1000}
              onMouseOver={() =>
                setHoveredInfo({
                  title: `Disruption: ${item.type || 'event'}`,
                  subtitle: `${item.severity || 'high'} severity`,
                  position: { lat, lng },
                })
              }
              onMouseOut={() => setHoveredInfo(null)}
              options={{
                fillColor: '#ef4444',
                fillOpacity: 0.15,
                strokeColor: '#ef4444',
                strokeOpacity: 0.8,
                strokeWeight: 2,
              }}
            />
          )
        })}

        <RiskHeatmap map={mapInstance} enabled={showHeatmap} nodes={nodes} shipments={shipments} />

        {selectedShipment && selectedShipment.currentPosition && (
          <InfoWindowF
            position={{
              lat: selectedShipment.currentPosition.lat,
              lng: selectedShipment.currentPosition.lng,
            }}
            onCloseClick={() => setSelectedShipment(null)}
          >
            <div style={{ minWidth: 220, color: '#111827' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{selectedShipment.id}</div>
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                {selectedShipment.cargoType} | {selectedShipment.currentStage}
              </div>
              <RiskBadge score={Math.round(Number(selectedShipment.riskScore) || 0)} />
            </div>
          </InfoWindowF>
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

        {/* Reroute Preview: Original path (red dashed — real road geometry) */}
        {reroutePreview?.originalCoords?.length > 1 && (
          <PolylineF
            path={reroutePreview.originalCoords.map((c) => ({ lat: c.lat, lng: c.lng }))}
            options={{
              strokeColor: '#ef4444',
              strokeOpacity: 0,
              strokeWeight: 0,
              icons: [{
                icon: {
                  path: 'M 0,-1 0,1',
                  strokeOpacity: 0.85,
                  strokeColor: '#ef4444',
                  strokeWeight: 3,
                  scale: 3,
                },
                offset: '0',
                repeat: '12px',
              }],
            }}
          />
        )}

        {/* Reroute Preview: Suggested bypass path (green solid — real road geometry) */}
        {reroutePreview?.suggestedCoords?.length > 1 && (
          <PolylineF
            path={reroutePreview.suggestedCoords.map((c) => ({ lat: c.lat, lng: c.lng }))}
            options={{
              strokeColor: '#10b981',
              strokeOpacity: 0.9,
              strokeWeight: 5,
              zIndex: 10,
            }}
          />
        )}

        {/* Reroute Preview: Disruption location marker */}
        {reroutePreview?.disruptionLocation?.lat && (
          <CircleF
            center={{
              lat: reroutePreview.disruptionLocation.lat,
              lng: reroutePreview.disruptionLocation.lng,
            }}
            radius={30000}
            options={{
              fillColor: '#f59e0b',
              fillOpacity: 0.25,
              strokeColor: '#f59e0b',
              strokeOpacity: 0.9,
              strokeWeight: 2,
            }}
          />
        )}
      </GoogleMap>

      {/* Reroute preview legend */}
      {reroutePreview && (
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: 16,
            background: 'rgba(15,23,42,0.92)',
            border: '1px solid rgba(59,130,246,0.5)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12,
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: 11 }}>
            📍 Reroute Preview — {reroutePreview.shipmentId}
          </div>
          {reroutePreview.loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              ⏳ Tracing real road paths...
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 16, height: 3,
                  background: 'repeating-linear-gradient(90deg, #ef4444 0 4px, transparent 4px 8px)',
                  display: 'inline-block', borderRadius: 2
                }} />
                <span style={{ color: 'var(--text-secondary)' }}>Original</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 16, height: 3, background: '#10b981', display: 'inline-block', borderRadius: 2 }} />
                <span style={{ color: 'var(--text-secondary)' }}>Suggested</span>
              </span>
            </div>
          )}
        </div>
      )}

      {!shipments.length && !reroutePreview && (
        <div
          style={{
            position: 'absolute',
            left: 16,
            bottom: 16,
            background: 'rgba(15,23,42,0.86)',
            border: '1px solid var(--bg-glass-border)',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 12,
            color: 'var(--text-secondary)',
            zIndex: 2,
          }}
        >
          Select shipments from the table to view them on map.
        </div>
      )}
    </div>
  )
}

