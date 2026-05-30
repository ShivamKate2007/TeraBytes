import { useMemo } from 'react'
import { CircleF } from '@react-google-maps/api'

function riskColor(weight) {
  if (weight >= 8) return '#ef4444'
  if (weight >= 6) return '#f97316'
  if (weight >= 4) return '#f59e0b'
  return '#10b981'
}

function riskRadius(weight) {
  return Math.max(22000, Math.min(70000, 14000 + weight * 6500))
}

export default function RiskHeatmap({ enabled, nodes = [], shipments = [] }) {
  const points = useMemo(() => {
    const shipmentPoints = shipments
      .filter((shipment) => shipment.currentPosition?.lat && shipment.currentPosition?.lng)
      .map((shipment) => {
        const score = Number(shipment.riskScore) || 0
        return {
          id: `shipment-${shipment.id}`,
          center: {
            lat: Number(shipment.currentPosition.lat),
            lng: Number(shipment.currentPosition.lng),
          },
          weight: Math.max(1, Math.round(score / 10)),
        }
      })

    const nodePoints = nodes
      .filter((node) => node.lat && node.lng)
      .map((node) => ({
        id: `node-${node.id}`,
        center: {
          lat: Number(node.lat),
          lng: Number(node.lng),
        },
        weight: Math.max(1, Math.round((Number(node.currentLoad) || 20) / 20)),
      }))

    return [...shipmentPoints, ...nodePoints]
  }, [nodes, shipments])

  if (!enabled) return null

  return (
    <>
      {points.map((point) => {
        const color = riskColor(point.weight)
        return (
          <CircleF
            key={point.id}
            center={point.center}
            radius={riskRadius(point.weight)}
            options={{
              clickable: false,
              fillColor: color,
              fillOpacity: 0.16,
              strokeColor: color,
              strokeOpacity: 0.28,
              strokeWeight: 1,
              zIndex: 0,
            }}
          />
        )
      })}
    </>
  )
}
