import { getRoleWorkspace } from '../../constants/roleWorkspaces'
import { useAuth } from '../../context/AuthContext'

const DELIVERED_STATUSES = new Set(['delivered', 'completed', 'closed'])
const HIGH_RISK_MIN_SCORE = 56

function asNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalize(value) {
  return String(value || '').toLowerCase()
}

function routeOf(shipment) {
  const route =
    shipment?.optimizedRoute?.length ? shipment.optimizedRoute :
    shipment?.originalRoute?.length ? shipment.originalRoute :
    shipment?.route?.length ? shipment.route :
    []
  return Array.isArray(route) ? route : []
}

function currentNodeOf(shipment) {
  return (
    shipment?.simState?.fromNode ||
    shipment?.currentNode ||
    shipment?.currentNodeId ||
    shipment?.nodeId ||
    shipment?.currentStage ||
    'unknown'
  )
}

function nextNodeOf(shipment) {
  const route = routeOf(shipment)
  const currentNode = currentNodeOf(shipment)
  const currentIndex = route.findIndex((node) => normalize(node) === normalize(currentNode))
  if (shipment?.simState?.toNode) return shipment.simState.toNode
  if (currentIndex >= 0 && currentIndex < route.length - 1) return route[currentIndex + 1]
  return route[route.length - 1] || 'pending assignment'
}

function statusOf(shipment) {
  return normalize(shipment?.status || shipment?.currentStatus || shipment?.currentStage)
}

function isActive(shipment) {
  return !DELIVERED_STATUSES.has(statusOf(shipment))
}

function isAtRisk(shipment) {
  return asNumber(shipment?.riskScore) >= HIGH_RISK_MIN_SCORE || Boolean(shipment?.isCritical)
}

function averageRisk(shipments) {
  if (!shipments.length) return 0
  const total = shipments.reduce((sum, shipment) => sum + asNumber(shipment?.riskScore), 0)
  return Number((total / shipments.length).toFixed(1))
}

function routeLabel(shipment) {
  const route = routeOf(shipment)
  if (!route.length) return 'Route pending'
  if (route.length === 1) return route[0]
  return `${route[0]} -> ${route[route.length - 1]}`
}

function formatNode(node) {
  return String(node || 'unknown').replaceAll('_', ' ')
}

function buildWorkspaceStats({ role, shipments, disruptions, alerts, rerouteSuggestions }) {
  const workspace = getRoleWorkspace(role)
  const activeShipments = shipments.filter(isActive)
  const atRiskShipments = shipments.filter(isAtRisk)
  const avgRisk = averageRisk(shipments)
  const firstActive = activeShipments[0] || shipments[0]
  const suggestionCount = rerouteSuggestions.length
  const applyReadyReroutes = rerouteSuggestions.filter((item) => item?.recommendation === 'reroute').length
  const reviewOnlySuggestions = Math.max(0, suggestionCount - applyReadyReroutes)
  const alertCount = alerts.length || disruptions.length

  const base = {
    title: workspace.title,
    summary: workspace.subtitle,
    primaryLabel: 'Scoped shipments',
    primaryValue: shipments.length,
    secondaryLabel: 'Active movement',
    secondaryValue: activeShipments.length,
    riskLabel: 'At-risk lanes',
    riskValue: atRiskShipments.length,
    actionLabel: 'Recommended focus',
    actionValue: workspace.quickActions[0],
    details: [
      { label: 'Average risk', value: avgRisk },
      { label: 'Live alerts', value: alertCount },
      { label: 'Apply-ready reroutes', value: applyReadyReroutes },
    ],
  }

  if (role === 'admin') {
    return {
      ...base,
      primaryLabel: 'Governed shipments',
      secondaryLabel: 'Reroute review queue',
      secondaryValue: suggestionCount,
      riskLabel: 'System alerts',
      riskValue: alertCount,
      actionValue: suggestionCount ? 'Review reroute panel below' : 'Audit role access and data freshness',
      details: [
        { label: 'Apply-ready reroutes', value: applyReadyReroutes },
        { label: 'Review-only notices', value: reviewOnlySuggestions },
        { label: 'High-risk shipments', value: atRiskShipments.length },
      ],
    }
  }

  if (role === 'supply_chain_manager') {
    return {
      ...base,
      primaryLabel: 'Network shipments',
      secondaryLabel: 'Reroute review queue',
      secondaryValue: suggestionCount,
      riskLabel: 'High-risk lanes',
      riskValue: atRiskShipments.length,
      actionValue: suggestionCount ? 'Review reroute panel below' : atRiskShipments.length ? 'Prioritize high-risk lanes' : 'Monitor ETA drift',
      details: [
        { label: 'Apply-ready reroutes', value: applyReadyReroutes },
        { label: 'Review-only notices', value: reviewOnlySuggestions },
        { label: 'High-risk threshold', value: `${HIGH_RISK_MIN_SCORE}+` },
      ],
    }
  }

  if (role === 'warehouse_manager') {
    const inbound = shipments.filter((shipment) => normalize(nextNodeOf(shipment)).includes('wh') || normalize(nextNodeOf(shipment)).includes('warehouse'))
    const departures = activeShipments.filter((shipment) => normalize(currentNodeOf(shipment)).includes('wh') || normalize(currentNodeOf(shipment)).includes('warehouse'))
    return {
      ...base,
      primaryLabel: 'Facility shipments',
      primaryValue: shipments.length,
      secondaryLabel: 'Inbound loads',
      secondaryValue: inbound.length,
      riskLabel: 'Departure queue',
      riskValue: departures.length,
      actionValue: inbound.length ? 'Prepare receiving bay and handoff crew' : 'Watch local incidents and dwell risk',
      details: [
        { label: 'Local alerts', value: alertCount },
        { label: 'Avg facility risk', value: avgRisk },
        { label: 'Recommend-only reroutes', value: suggestionCount },
      ],
    }
  }

  if (role === 'distributor_manager') {
    const dcLoads = shipments.filter((shipment) => normalize(routeLabel(shipment)).includes('dc') || normalize(currentNodeOf(shipment)).includes('dc'))
    return {
      ...base,
      primaryLabel: 'DC related loads',
      primaryValue: dcLoads.length || shipments.length,
      secondaryLabel: 'Dispatch active',
      secondaryValue: activeShipments.length,
      riskLabel: 'Retail handoff risk',
      riskValue: atRiskShipments.length,
      actionValue: suggestionCount ? 'Review reroute impact before dispatch' : 'Confirm outbound readiness',
    }
  }

  if (role === 'retailer_receiver') {
    return {
      ...base,
      primaryLabel: 'Incoming deliveries',
      primaryValue: shipments.length,
      secondaryLabel: 'Still in transit',
      secondaryValue: activeShipments.length,
      riskLabel: 'Receiving risks',
      riskValue: atRiskShipments.length,
      actionValue: firstActive ? `Prepare for ${firstActive.id}` : 'Confirm received goods',
      details: [
        { label: 'Next inbound stop', value: formatNode(nextNodeOf(firstActive)) },
        { label: 'Alerts on route', value: alertCount },
        { label: 'Avg delivery risk', value: avgRisk },
      ],
    }
  }

  if (role === 'driver') {
    return {
      ...base,
      primaryLabel: 'Assigned trips',
      primaryValue: activeShipments.length || shipments.length,
      secondaryLabel: 'Next stop',
      secondaryValue: formatNode(nextNodeOf(firstActive)),
      riskLabel: 'Route alerts',
      riskValue: alertCount,
      actionValue: firstActive ? `Follow route for ${firstActive.id}` : 'No active trip assigned',
      details: [
        { label: 'Current leg', value: routeLabel(firstActive) },
        { label: 'Risk score', value: asNumber(firstActive?.riskScore) },
        { label: 'Status', value: firstActive?.status || 'pending' },
      ],
    }
  }

  if (role === 'carrier_partner') {
    const vehicleCount = new Set(shipments.map((shipment) => shipment?.vehicleId || shipment?.driverId).filter(Boolean)).size
    return {
      ...base,
      primaryLabel: 'Fleet loads',
      primaryValue: shipments.length,
      secondaryLabel: 'Vehicles/drivers',
      secondaryValue: vehicleCount || activeShipments.length,
      riskLabel: 'Fleet route alerts',
      riskValue: alertCount,
      actionValue: suggestionCount ? 'Request manager approval for reroutes' : 'Keep active trips moving',
    }
  }

  if (role === 'analyst') {
    return {
      ...base,
      primaryLabel: 'Read-only shipments',
      primaryValue: shipments.length,
      secondaryLabel: 'Routes observed',
      secondaryValue: new Set(shipments.map(routeLabel)).size,
      riskLabel: 'Avg risk',
      riskValue: avgRisk,
      actionValue: 'Interpret trends and report anomalies',
    }
  }

  return base
}

export default function RoleActionPanel({
  shipments = [],
  disruptions = [],
  alerts = [],
  rerouteSuggestions = [],
}) {
  const { currentUser } = useAuth()
  const stats = buildWorkspaceStats({
    role: currentUser?.role,
    shipments,
    disruptions,
    alerts,
    rerouteSuggestions,
  })

  return (
    <section className="role-action-panel">
      <div className="role-action-main">
        <span className="role-action-eyebrow">Role-aware operations</span>
        <h3>{stats.actionValue}</h3>
        <p>
          {currentUser?.name || 'User'} is viewing a scoped workspace. Data below is filtered by role,
          assigned nodes, assigned shipments, and organization access.
        </p>
      </div>

      <div className="role-action-metric">
        <span>{stats.primaryLabel}</span>
        <strong>{stats.primaryValue}</strong>
      </div>
      <div className="role-action-metric">
        <span>{stats.secondaryLabel}</span>
        <strong>{stats.secondaryValue}</strong>
      </div>
      <div className="role-action-metric danger">
        <span>{stats.riskLabel}</span>
        <strong>{stats.riskValue}</strong>
      </div>

      <div className="role-action-details">
        {stats.details.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value ?? '--'}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}
