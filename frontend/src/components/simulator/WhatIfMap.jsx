import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  CircleF,
  GoogleMap,
  InfoWindowF,
  MarkerF,
  PolylineF,
  useJsApiLoader,
} from '@react-google-maps/api'
import { MAPS_CENTER, MAPS_DARK_STYLE, MAPS_ZOOM } from '../../utils/constants'
import { supplyChainApi } from '../../services/api'

const containerStyle = { width: '100%', height: '100%' }
const libraries = ['visualization']

function pathFromNodeIds(nodeById, nodeIds = []) {
  return nodeIds
    .map((nodeId) => nodeById.get(nodeId))
    .filter(Boolean)
    .map((node) => ({ lat: node.lat, lng: node.lng }))
}

function pathsDifferent(a = [], b = []) {
  return (a || []).join('>') !== (b || []).join('>')
}

function isDisplayableOptimizedStatus(status) {
  return ['rerouted', 'road_rerouted', 'recovery_reroute', 'rerouted_alt_destination'].includes(status)
}

export default function WhatIfMap({
  nodes = [],
  shipments = [],
  selectedDisruption = null,
  simulationResult = null,
  showShipments = true,
  showOriginalPaths = true,
  showOptimizedPaths = true,
  onToggleShipments,
  onToggleOriginalPaths,
  onToggleOptimizedPaths,
  onMapClick,
  isLoading = false,
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'ssc-map',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries,
  })

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const [hoveredInfo, setHoveredInfo] = useState(null)
  const [tracedReroutes, setTracedReroutes] = useState([])

  const rerouteLines = useMemo(() => {
    const plans = simulationResult?.cascadeMetrics?.reroutePlans || []
    return plans
      .map((plan) => ({
        shipmentId: plan.shipmentId,
        status: plan.status,
        addedDelayHrs: Number(plan.addedDelayHrs || 0),
        oldNodePath: plan.oldPath || [],
        newNodePath: plan.newPath || [],
        oldTracePath: Array.isArray(plan.oldTracePath) ? plan.oldTracePath : [],
        newTracePath: Array.isArray(plan.newTracePath) ? plan.newTracePath : [],
        oldPath: pathFromNodeIds(nodeById, plan.oldPath || []),
        newPath: pathFromNodeIds(nodeById, plan.newPath || []),
      }))
      .filter((entry) => entry.oldPath.length > 1 || entry.newPath.length > 1)
      .filter((entry) => {
        const changed = pathsDifferent(entry.oldPath, entry.newPath)
        return changed || entry.status === 'rerouted' || entry.addedDelayHrs > 0
      })
  }, [simulationResult, nodeById])

  useEffect(() => {
    let isActive = true
    const loadTracedPaths = async () => {
      if (!rerouteLines.length) {
        if (isActive) setTracedReroutes([])
        return
      }

      const resolved = await Promise.all(
        rerouteLines.map(async (line) => {
          const oldTraceRes =
            line.oldTracePath.length > 1
              ? { path: line.oldTracePath }
              : line.oldPath.length > 1
              ? await supplyChainApi.traceRoute(line.oldPath)
              : { path: [] }
          const newTraceRes =
            line.newTracePath.length > 1
              ? { path: line.newTracePath }
              : isDisplayableOptimizedStatus(line.status) && line.newPath.length > 1
              ? await supplyChainApi.traceRoute(line.newPath)
              : { path: [] }
          return {
            ...line,
            oldTracePath: Array.isArray(oldTraceRes.path) && oldTraceRes.path.length > 1 ? oldTraceRes.path : line.oldPath,
            newTracePath: isDisplayableOptimizedStatus(line.status)
              ? (Array.isArray(newTraceRes.path) && newTraceRes.path.length > 1 ? newTraceRes.path : line.newPath)
              : [],
          }
        }),
      )
      if (!isActive) return
      setTracedReroutes(resolved)
    }

    loadTracedPaths()
    return () => {
      isActive = false
    }
  }, [rerouteLines])

  if (loadError) {
    return (
      <div className="simulator-map-container">
        <div className="empty-state" style={{ height: '100%' }}>
          <span className="empty-state-icon">⚠️</span>
          <span className="empty-state-title">Map failed to load</span>
          <span className="empty-state-text">Check Google Maps key and refresh once.</span>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="simulator-map-container">
        <div className="empty-state" style={{ height: '100%' }}>
          <span className="empty-state-icon">🗺️</span>
          <span className="empty-state-title">Loading simulation map</span>
        </div>
      </div>
    )
  }

  return (
    <div className="simulator-map-container">
      <div className="simulator-map-overlay">
        <div className="simulator-mode-badge">🎯 Click map to place disruption</div>
        <button
          type="button"
          className={`simulator-legend-chip ${showShipments ? 'active' : ''}`}
          onClick={onToggleShipments}
        >
          ● Shipments
        </button>
        <button
          type="button"
          className={`simulator-legend-chip ${showOriginalPaths ? 'active' : ''}`}
          onClick={onToggleOriginalPaths}
        >
          ━ Original
        </button>
        <button
          type="button"
          className={`simulator-legend-chip ${showOptimizedPaths ? 'active' : ''}`}
          onClick={onToggleOptimizedPaths}
        >
          ━ Optimized
        </button>
      </div>

      {isLoading && (
        <div className="simulation-loading">
          <div className="simulation-loading-spinner" />
          <div className="simulation-loading-text">Analyzing cascade impact...</div>
        </div>
      )}

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={MAPS_CENTER}
        zoom={MAPS_ZOOM}
        onClick={(event) => {
          const latLng = event.latLng?.toJSON?.()
          if (!latLng) return
          onMapClick?.(latLng)
        }}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          styles: MAPS_DARK_STYLE,
        }}
      >
        {nodes.map((node) => (
          <CircleF
            key={node.id}
            center={{ lat: node.lat, lng: node.lng }}
            radius={30000}
            options={{
              clickable: false,
              fillColor: '#3b82f6',
              fillOpacity: 0.28,
              strokeColor: '#60a5fa',
              strokeOpacity: 0.8,
              strokeWeight: 1.5,
            }}
          />
        ))}

        {showShipments && shipments
          .filter((shipment) => shipment.currentPosition?.lat && shipment.currentPosition?.lng)
          .slice(0, 20)
          .map((shipment) => (
            <CircleF
              key={shipment.id}
              center={shipment.currentPosition}
              radius={9000}
              options={{
                clickable: false,
                fillColor: '#22d3ee',
                fillOpacity: 0.65,
                strokeColor: '#06b6d4',
                strokeOpacity: 0.85,
                strokeWeight: 1,
              }}
            />
          ))}

        {selectedDisruption && (
          <>
            <CircleF
              center={{ lat: selectedDisruption.lat, lng: selectedDisruption.lng }}
              radius={(selectedDisruption.radiusKm || 80) * 1000}
              options={{
                fillColor: '#ef4444',
                fillOpacity: 0.16,
                strokeColor: '#ef4444',
                strokeOpacity: 0.9,
                strokeWeight: 2,
              }}
            />
            <MarkerF
              position={{ lat: selectedDisruption.lat, lng: selectedDisruption.lng }}
              title={`Disruption candidate at ${selectedDisruption.nodeName || selectedDisruption.nodeId}`}
              options={{ zIndex: 999 }}
            />
          </>
        )}

        {(tracedReroutes.length ? tracedReroutes : rerouteLines).map((line) => (
          <Fragment key={line.shipmentId}>
            {showOriginalPaths && (line.oldTracePath || line.oldPath).length > 1 && (
              <PolylineF
                path={line.oldTracePath || line.oldPath}
                onMouseOver={(event) => {
                  const latLng = event.latLng?.toJSON?.()
                  if (!latLng) return
                  setHoveredInfo({
                    position: latLng,
                    title: `Original route • ${line.shipmentId}`,
                    subtitle: 'Impacted pre-disruption path',
                  })
                }}
                onMouseOut={() => setHoveredInfo(null)}
                options={{
                  strokeColor: '#ef4444',
                  strokeOpacity: 0.55,
                  strokeWeight: 3,
                }}
              />
            )}
            {showOptimizedPaths && (line.newTracePath || line.newPath).length > 1 && (
              <PolylineF
                path={line.newTracePath || line.newPath}
                onMouseOver={(event) => {
                  const latLng = event.latLng?.toJSON?.()
                  if (!latLng) return
                  setHoveredInfo({
                    position: latLng,
                    title: `Optimized route • ${line.shipmentId}`,
                    subtitle: 'Rerouted path from same shipment origin context',
                  })
                }}
                onMouseOut={() => setHoveredInfo(null)}
                options={{
                  strokeColor: '#10b981',
                  strokeOpacity: 0.9,
                  strokeWeight: 4,
                }}
              />
            )}
          </Fragment>
        ))}

        {hoveredInfo?.position && (
          <InfoWindowF position={hoveredInfo.position} onCloseClick={() => setHoveredInfo(null)}>
            <div style={{ minWidth: 220, color: '#111827' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{hoveredInfo.title}</div>
              <div style={{ fontSize: 12 }}>{hoveredInfo.subtitle}</div>
            </div>
          </InfoWindowF>
        )}

      </GoogleMap>
    </div>
  )
}
