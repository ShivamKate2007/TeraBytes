export const ROLE_WORKSPACES = {
  admin: {
    title: 'System Admin Command',
    subtitle: 'Full-control workspace for users, shipments, disruptions, contracts, and network health.',
    badge: 'Full access',
    focus: ['All shipments', 'User governance', 'Apply reroutes', 'System incidents'],
    quickActions: ['Review active alerts', 'Approve reroutes', 'Audit role access'],
  },
  supply_chain_manager: {
    title: 'Supply Chain Manager Control Room',
    subtitle: 'Network-wide operational view for shipment performance, risk, and reroute approvals.',
    badge: 'Operations lead',
    focus: ['All active shipments', 'KPI reliability', 'Reroute approvals', 'Disruption response'],
    quickActions: ['Prioritize high-risk lanes', 'Run what-if scenario', 'Review ETA drift'],
  },
  warehouse_manager: {
    title: 'Warehouse Manager Workspace',
    subtitle: 'Focused on shipments connected to your assigned warehouse and local handoff reliability.',
    badge: 'Facility scope',
    focus: ['Arrivals', 'Departures', 'Dwell risk', 'Local incidents'],
    quickActions: ['Check inbound ETAs', 'Report local incident', 'Recommend reroute'],
  },
  distributor_manager: {
    title: 'Distribution Center Workspace',
    subtitle: 'Tracks DC-bound shipments, fulfillment handoffs, and downstream delivery impact.',
    badge: 'DC scope',
    focus: ['DC throughput', 'Dispatch readiness', 'Fulfillment risk', 'Retail handoffs'],
    quickActions: ['Review pending arrivals', 'Confirm dispatch load', 'Flag DC delay'],
  },
  retailer_receiver: {
    title: 'Retail Receiving Desk',
    subtitle: 'Incoming delivery visibility for retailer-side ETA, disruption impact, and receipt confirmation.',
    badge: 'Incoming only',
    focus: ['Incoming shipments', 'Delivery ETA', 'Receipt readiness', 'Local delivery issues'],
    quickActions: ['Track inbound load', 'Report receiving issue', 'Confirm delivery'],
  },
  driver: {
    title: 'Driver Trip Console',
    subtitle: 'Assigned route view with shipment status, alerts, and reroute instructions only.',
    badge: 'Assigned trips',
    focus: ['Assigned shipment', 'Current route', 'Route alerts', 'Trip instructions'],
    quickActions: ['Check next stop', 'Report road issue', 'View reroute instruction'],
  },
  carrier_partner: {
    title: 'Carrier Partner Fleet Desk',
    subtitle: 'Fleet-focused view for carrier-assigned shipments, drivers, route risk, and contracts.',
    badge: 'Fleet scope',
    focus: ['Fleet shipments', 'Driver execution', 'Carrier contracts', 'Fleet alerts'],
    quickActions: ['Review fleet risk', 'Assign driver later', 'Request reroute approval'],
  },
  analyst: {
    title: 'Analyst Read-Only Workspace',
    subtitle: 'Network intelligence workspace for reports, trends, and risk interpretation without write actions.',
    badge: 'Read-only',
    focus: ['Network analytics', 'Disruption patterns', 'Route risk', 'Performance reports'],
    quickActions: ['Inspect KPIs', 'Compare route risk', 'Export insights later'],
  },
}

export function getRoleWorkspace(role) {
  return ROLE_WORKSPACES[role] || ROLE_WORKSPACES.analyst
}
