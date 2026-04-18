import { useEffect, useState } from 'react'

function severityFromRisk(score) {
  if (score >= 90) return 'critical'
  if (score >= 75) return 'high'
  if (score >= 55) return 'moderate'
  return 'low'
}

export default function useAlerts({ shipments = [], disruptions = [] } = {}) {
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    const shipmentAlerts = shipments
      .filter((shipment) => Number(shipment.riskScore) >= 65 || shipment.isCritical)
      .map((shipment) => ({
        id: `shipment-${shipment.id}`,
        severity: severityFromRisk(Number(shipment.riskScore) || 0),
        title: `Shipment ${shipment.id} at risk`,
        message: `${shipment.cargoType} shipment risk at ${Math.round(Number(shipment.riskScore) || 0)}/100 near ${shipment.currentStage}.`,
        timestamp: new Date().toISOString(),
      }))

    const disruptionAlerts = disruptions.map((disruption) => ({
      id: `disruption-${disruption.id || disruption.nodeId || Math.random().toString(36).slice(2)}`,
      severity: disruption.severity || 'high',
      title: `${(disruption.type || 'Disruption').toUpperCase()} detected`,
      message: disruption.description || 'Potential network disruption detected in the route graph.',
      timestamp: disruption.timestamp || new Date().toISOString(),
      source: disruption.source || null,
      isMock: Boolean(disruption.weatherMeta?.isMock),
    }))

    const allAlerts = [...disruptionAlerts, ...shipmentAlerts]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12)

    setAlerts(allAlerts)
  }, [shipments, disruptions])

  return { alerts, loading: false, error: null }
}
