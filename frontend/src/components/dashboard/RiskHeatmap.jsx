import { useEffect, useMemo, useRef } from 'react'

export default function RiskHeatmap({ map, enabled, nodes = [], shipments = [] }) {
  const heatmapLayerRef = useRef(null)

  const points = useMemo(() => {
    if (!window.google?.maps) return []

    const shipmentPoints = shipments
      .filter((shipment) => shipment.currentPosition?.lat && shipment.currentPosition?.lng)
      .map((shipment) => ({
        location: new window.google.maps.LatLng(
          shipment.currentPosition.lat,
          shipment.currentPosition.lng,
        ),
        weight: Math.max(1, Math.round((Number(shipment.riskScore) || 0) / 10)),
      }))

    const nodePoints = nodes
      .filter((node) => node.lat && node.lng)
      .map((node) => ({
        location: new window.google.maps.LatLng(node.lat, node.lng),
        weight: Math.max(1, Math.round((Number(node.currentLoad) || 20) / 20)),
      }))

    return [...shipmentPoints, ...nodePoints]
  }, [nodes, shipments])

  useEffect(() => {
    if (!window.google?.maps?.visualization) return

    if (!heatmapLayerRef.current) {
      heatmapLayerRef.current = new window.google.maps.visualization.HeatmapLayer({
        radius: 35,
        opacity: 0.6,
        gradient: [
          'rgba(16,185,129,0.2)',
          'rgba(245,158,11,0.5)',
          'rgba(249,115,22,0.7)',
          'rgba(239,68,68,0.85)',
        ],
      })
    }

    const layer = heatmapLayerRef.current
    layer.setData(points)
    layer.setMap(enabled && map ? map : null)

    return () => {
      layer.setMap(null)
    }
  }, [map, enabled, points])

  useEffect(() => {
    return () => {
      if (heatmapLayerRef.current) {
        heatmapLayerRef.current.setMap(null)
        heatmapLayerRef.current = null
      }
    }
  }, [])

  return null
}
