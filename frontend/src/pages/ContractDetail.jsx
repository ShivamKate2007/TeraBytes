import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import RoleWorkspaceBanner from '../components/common/RoleWorkspaceBanner'
import { supplyChainApi } from '../services/api'
import '../styles/contracts.css'

function cleanNode(value) {
  return String(value || '--').replaceAll('_', ' ')
}

function formatDate(value) {
  if (!value) return '--'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDurationHours(ms) {
  const hours = Math.abs(ms) / (1000 * 60 * 60)
  if (hours < 1) return `${Math.round(hours * 60)}m`
  return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`
}

function formatMoney(value, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

function getSlaHealth(contract) {
  if (!contract?.slaDeliveryAt) {
    return { label: 'No SLA', className: 'pending', explanation: 'No delivery SLA is attached to this contract yet.' }
  }
  if (contract.status === 'completed') {
    return { label: 'Completed', className: 'done', explanation: 'Contract execution is complete.' }
  }
  if (['cancelled', 'rejected'].includes(contract.status)) {
    return { label: 'Closed', className: 'danger', explanation: 'This contract is no longer active.' }
  }
  const diff = new Date(contract.slaDeliveryAt).getTime() - Date.now()
  if (diff < 0) {
    const penalty = Number(contract.penaltyRules?.lateDeliveryPerHour) || 0
    return {
      label: `Overdue ${formatDurationHours(diff)}`,
      className: 'danger',
      explanation: `SLA has passed. Estimated penalty exposure is ${formatMoney(Math.ceil(Math.abs(diff) / 3600000) * penalty, contract.currency)} if enforced.`,
    }
  }
  if (diff <= 6 * 60 * 60 * 1000) {
    return {
      label: `Due ${formatDurationHours(diff)}`,
      className: 'warning',
      explanation: 'SLA window is tight. Dispatch should monitor ETA drift and handoff readiness.',
    }
  }
  return {
    label: `Due ${formatDurationHours(diff)}`,
    className: 'done',
    explanation: 'SLA is currently healthy based on the planned delivery deadline.',
  }
}

function statusClass(status) {
  if (['accepted', 'assigned_driver', 'in_progress'].includes(status)) return 'active'
  if (status === 'completed') return 'done'
  if (['rejected', 'cancelled', 'breached'].includes(status)) return 'danger'
  return 'pending'
}

function findById(items, id) {
  return items.find((item) => item.id === id)
}

export default function ContractDetail() {
  const { id } = useParams()
  const [contract, setContract] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      const [contractPayload, driverPayload, vehiclePayload] = await Promise.all([
        supplyChainApi.getContractById(id),
        supplyChainApi.getContractDrivers(),
        supplyChainApi.getContractVehicles(),
      ])
      if (!active) return
      if (contractPayload.error || !contractPayload.contract) {
        setError(contractPayload.error || 'Contract not found')
        setContract(null)
      } else {
        setContract(contractPayload.contract)
      }
      setDrivers(Array.isArray(driverPayload.drivers) ? driverPayload.drivers : [])
      setVehicles(Array.isArray(vehiclePayload.vehicles) ? vehiclePayload.vehicles : [])
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [id])

  const driver = useMemo(() => findById(drivers, contract?.driverId), [contract?.driverId, drivers])
  const vehicle = useMemo(() => findById(vehicles, contract?.vehicleId), [contract?.vehicleId, vehicles])
  const events = useMemo(() => [...(contract?.events || [])].reverse(), [contract?.events])
  const slaHealth = useMemo(() => getSlaHealth(contract), [contract])

  if (loading) {
    return <div className="card contracts-empty">Loading contract detail...</div>
  }

  if (error || !contract) {
    return (
      <div className="card access-denied-card">
        <h2>Contract unavailable</h2>
        <p>{error || 'This contract is outside your current role scope.'}</p>
        <Link to="/contracts" className="contracts-link-button">Back to contracts</Link>
      </div>
    )
  }

  return (
    <div className="contracts-page animate-fadeIn">
      <RoleWorkspaceBanner compact />

      <div className="contract-detail-header">
        <div>
          <Link to="/contracts" className="contracts-back-link">← Back to Contracts</Link>
          <h2>{contract.id}</h2>
          <p>Shipment responsibility contract for <strong>{contract.shipmentId}</strong></p>
        </div>
        <span className={`contract-status ${statusClass(contract.status)}`}>
          {String(contract.status || 'draft').replaceAll('_', ' ')}
        </span>
      </div>

      <section className="contract-detail-grid">
        <div className="card contract-detail-card wide">
          <h3>Operational Route Responsibility</h3>
          <div className="contract-route large">
            <span>{cleanNode(contract.originNodeId)}</span>
            <strong>mandatory: {(contract.mandatoryStopNodeIds || []).map(cleanNode).join(', ') || 'none'}</strong>
            <span>{cleanNode(contract.destinationNodeId)}</span>
          </div>
          <p className="contract-detail-note">
            Mandatory stops are not optional shortcuts. If cargo must be unloaded, sorted, inspected, or handed off
            at a node, the simulator and contract workflow should preserve that stop.
          </p>
        </div>

        <div className="card contract-detail-card">
          <h3>SLA & Commercial Terms</h3>
          <div className="contract-detail-facts">
            <div><span>SLA delivery</span><strong>{formatDate(contract.slaDeliveryAt)}</strong></div>
            <div className={`contract-sla-chip ${slaHealth.className}`}><span>SLA health</span><strong>{slaHealth.label}</strong></div>
            <div><span>Contract value</span><strong>{formatMoney(contract.price, contract.currency)}</strong></div>
            <div><span>Late penalty/hr</span><strong>{formatMoney(contract.penaltyRules?.lateDeliveryPerHour, contract.currency)}</strong></div>
            <div><span>Carrier org</span><strong>{contract.carrierOrgId}</strong></div>
          </div>
          <p className="contract-sla-explanation detail">{slaHealth.explanation}</p>
        </div>

        <div className="card contract-detail-card">
          <h3>Assigned Driver & Vehicle</h3>
          <div className="contract-driver-profile">
            <div>
              <span>Driver</span>
              <strong>{driver?.name || contract.driverId || 'Unassigned'}</strong>
            </div>
            <div>
              <span>Vehicle</span>
              <strong>{vehicle?.plateNumber || contract.vehicleId || 'Unassigned'}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{driver?.status?.replaceAll('_', ' ') || '--'}</strong>
            </div>
            <div>
              <span>Vehicle type</span>
              <strong>{vehicle?.vehicleType || '--'}</strong>
            </div>
          </div>
        </div>

        <div className="card contract-detail-card">
          <h3>Transporter Reliability</h3>
          <div className="driver-score-grid detail">
            <div><span>Overall</span><strong>{driver?.rating?.overall ?? contract.performanceSnapshot?.driverOverallRating ?? '--'} / 5</strong></div>
            <div><span>On-time</span><strong>{driver?.rating?.onTime ?? contract.performanceSnapshot?.driverOnTime ?? '--'}%</strong></div>
            <div><span>No damage</span><strong>{driver?.rating?.noDamage ?? contract.performanceSnapshot?.driverNoDamage ?? '--'}%</strong></div>
            <div><span>Route compliance</span><strong>{driver?.rating?.routeCompliance ?? '--'}%</strong></div>
            <div><span>Completed trips</span><strong>{driver?.history?.completedTrips ?? contract.performanceSnapshot?.previousTrips ?? '--'}</strong></div>
            <div><span>Damage incidents</span><strong>{driver?.history?.damageIncidents ?? '--'}</strong></div>
          </div>
        </div>

        <div className="card contract-detail-card wide">
          <h3>Contract Event Timeline</h3>
          {events.length === 0 && <p className="contracts-empty">No events recorded yet.</p>}
          <div className="contract-event-timeline">
            {events.map((event, index) => (
              <div className="contract-event" key={`${event.type}-${event.createdAt}-${index}`}>
                <span className="contract-event-dot" />
                <div>
                  <strong>{String(event.type).replaceAll('_', ' ')}</strong>
                  <p>{event.message}</p>
                  <span>{formatDate(event.createdAt)} · {event.actorUserId || 'system'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
