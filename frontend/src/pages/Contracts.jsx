import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RoleWorkspaceBanner from '../components/common/RoleWorkspaceBanner'
import { useAuth } from '../context/AuthContext'
import { supplyChainApi } from '../services/api'
import '../styles/contracts.css'

const MANAGE_ROLES = new Set(['admin', 'supply_chain_manager'])
const CARRIER_ACTION_ROLES = new Set(['admin', 'supply_chain_manager', 'carrier_partner'])
const EXECUTE_ROLES = new Set(['admin', 'supply_chain_manager', 'carrier_partner', 'driver'])
const HANDOFF_ROLES = new Set(['admin', 'supply_chain_manager', 'warehouse_manager', 'distributor_manager', 'retailer_receiver', 'driver'])

function formatMoney(value, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

function formatDate(value) {
  if (!value) return '--'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDurationHours(ms) {
  const hours = Math.abs(ms) / (1000 * 60 * 60)
  if (hours < 1) return `${Math.round(hours * 60)}m`
  return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`
}

function cleanNode(value) {
  return String(value || '--').replaceAll('_', ' ')
}

function statusClass(status) {
  if (['accepted', 'assigned_driver', 'in_progress'].includes(status)) return 'active'
  if (['completed'].includes(status)) return 'done'
  if (['rejected', 'cancelled', 'breached'].includes(status)) return 'danger'
  return 'pending'
}

function driverById(drivers, id) {
  return drivers.find((driver) => driver.id === id)
}

function vehicleById(vehicles, id) {
  return vehicles.find((vehicle) => vehicle.id === id)
}

function toDatetimeLocal(value) {
  const date = value ? new Date(value) : new Date(Date.now() + 48 * 60 * 60 * 1000)
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function getAllowedActions(role, contract) {
  const status = contract?.status
  const actions = []

  if (MANAGE_ROLES.has(role) && status === 'draft') {
    actions.push({ action: 'send', label: 'Send' })
  }
  if (CARRIER_ACTION_ROLES.has(role) && status === 'sent') {
    actions.push({ action: 'accept', label: 'Accept' })
    actions.push({ action: 'reject', label: 'Reject', danger: true })
  }
  if (EXECUTE_ROLES.has(role) && ['accepted', 'assigned_driver'].includes(status)) {
    actions.push({ action: 'start', label: 'Start Trip' })
  }
  if (EXECUTE_ROLES.has(role) && status === 'in_progress') {
    actions.push({ action: 'complete', label: 'Complete' })
  }
  if (MANAGE_ROLES.has(role) && !['completed', 'cancelled', 'rejected'].includes(status)) {
    actions.push({ action: 'cancel', label: 'Cancel', danger: true })
  }
  return actions
}

function canAssignDriver(role, contract) {
  return CARRIER_ACTION_ROLES.has(role) && !['completed', 'cancelled', 'rejected'].includes(contract?.status)
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

export default function Contracts() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [contracts, setContracts] = useState([])
  const [drivers, setDrivers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [shipments, setShipments] = useState([])
  const [graphNodes, setGraphNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})
  const [assignLoading, setAssignLoading] = useState({})
  const [assignmentDrafts, setAssignmentDrafts] = useState({})
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [breachLoading, setBreachLoading] = useState(false)
  const [createDraft, setCreateDraft] = useState({
    shipmentId: '',
    carrierOrgId: 'ORG-CARRIER-1',
    driverId: '',
    vehicleId: '',
    originNodeId: '',
    destinationNodeId: '',
    mandatoryStopNodeIds: '',
    slaDeliveryAt: toDatetimeLocal(),
    price: '45000',
    lateDeliveryPerHour: '500',
  })
  const [message, setMessage] = useState(null)

  const loadContracts = async () => {
    setLoading(true)
    const [contractPayload, driverPayload, vehiclePayload, shipmentPayload, graphPayload] = await Promise.all([
      supplyChainApi.getContracts(),
      supplyChainApi.getContractDrivers(),
      supplyChainApi.getContractVehicles(),
      supplyChainApi.getShipments(),
      supplyChainApi.getGraph(),
    ])
    const nextContracts = Array.isArray(contractPayload.contracts) ? contractPayload.contracts : []
    const nextDrivers = Array.isArray(driverPayload.drivers) ? driverPayload.drivers : []
    const nextVehicles = Array.isArray(vehiclePayload.vehicles) ? vehiclePayload.vehicles : []
    const nextShipments = Array.isArray(shipmentPayload.shipments) ? shipmentPayload.shipments : []
    const nextGraphNodes = Array.isArray(graphPayload.nodes) ? graphPayload.nodes : []
    setContracts(nextContracts)
    setDrivers(nextDrivers)
    setVehicles(nextVehicles)
    setShipments(nextShipments)
    setGraphNodes(nextGraphNodes)
    setCreateDraft((prev) => ({
      ...prev,
      shipmentId: prev.shipmentId || nextShipments[0]?.id || '',
      driverId: prev.driverId || nextDrivers[0]?.id || '',
      vehicleId: prev.vehicleId || nextDrivers[0]?.assignedVehicleId || nextVehicles[0]?.id || '',
      originNodeId: prev.originNodeId || nextShipments[0]?.route?.[0] || nextGraphNodes[0]?.id || '',
      destinationNodeId:
        prev.destinationNodeId ||
        nextShipments[0]?.route?.[nextShipments[0]?.route?.length - 1] ||
        nextGraphNodes[0]?.id ||
        '',
    }))
    setLoading(false)
  }

  useEffect(() => {
    loadContracts()
    const onUserChanged = () => loadContracts()
    window.addEventListener('ssc:user-changed', onUserChanged)
    return () => window.removeEventListener('ssc:user-changed', onUserChanged)
  }, [currentUser?.id])

  const metrics = useMemo(() => {
    const active = contracts.filter((item) => ['accepted', 'assigned_driver', 'in_progress'].includes(item.status)).length
    const completed = contracts.filter((item) => item.status === 'completed').length
    const avgDriverRating = drivers.length
      ? (drivers.reduce((sum, driver) => sum + (Number(driver.rating?.overall) || 0), 0) / drivers.length).toFixed(1)
      : '--'
    const availableDrivers = drivers.filter((driver) => driver.status === 'available').length
    return { active, completed, avgDriverRating, availableDrivers }
  }, [contracts, drivers])

  const carrierOptions = useMemo(() => {
    const ids = new Set([
      ...contracts.map((contract) => contract.carrierOrgId).filter(Boolean),
      ...drivers.map((driver) => driver.carrierOrgId).filter(Boolean),
      ...vehicles.map((vehicle) => vehicle.carrierOrgId).filter(Boolean),
      'ORG-CARRIER-1',
    ])
    return [...ids]
  }, [contracts, drivers, vehicles])

  const handleCreateDraftChange = (field, value) => {
    if (field === 'shipmentId') {
      const shipment = shipments.find((item) => item.id === value)
      setCreateDraft((prev) => ({
        ...prev,
        shipmentId: value,
        originNodeId: shipment?.route?.[0] || prev.originNodeId,
        destinationNodeId: shipment?.route?.[shipment?.route?.length - 1] || prev.destinationNodeId,
        mandatoryStopNodeIds: shipment?.route?.slice(1, -1)?.join(', ') || prev.mandatoryStopNodeIds,
      }))
      return
    }

    if (field === 'driverId') {
      const driver = driverById(drivers, value)
      setCreateDraft((prev) => ({
        ...prev,
        driverId: value,
        vehicleId: driver?.assignedVehicleId || prev.vehicleId,
        carrierOrgId: driver?.carrierOrgId || prev.carrierOrgId,
      }))
      return
    }

    setCreateDraft((prev) => ({ ...prev, [field]: value }))
  }

  const handleTransition = async (contractId, action) => {
    const key = `${contractId}:${action}`
    setActionLoading((prev) => ({ ...prev, [key]: true }))
    setMessage(null)
    const contract = contracts.find((item) => item.id === contractId)
    const result = action === 'handoff'
      ? await supplyChainApi.confirmContractHandoff(
          contractId,
          contract?.mandatoryStopNodeIds?.[0] || contract?.destinationNodeId || contract?.originNodeId,
          `Handoff confirmed for ${contractId}.`,
        )
      : await supplyChainApi.transitionContract(contractId, action)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: action === 'handoff' ? `Handoff confirmed for ${contractId}.` : `Contract ${action} completed.` })
      await loadContracts()
    }
    setActionLoading((prev) => ({ ...prev, [key]: false }))
  }

  const getAssignmentDraft = (contract) => {
    const existing = assignmentDrafts[contract.id] || {}
    const selectedDriverId = existing.driverId || contract.driverId || drivers[0]?.id || ''
    const selectedDriver = driverById(drivers, selectedDriverId)
    return {
      driverId: selectedDriverId,
      vehicleId: existing.vehicleId || contract.vehicleId || selectedDriver?.assignedVehicleId || vehicles[0]?.id || '',
    }
  }

  const updateAssignmentDraft = (contractId, patch) => {
    setAssignmentDrafts((prev) => ({
      ...prev,
      [contractId]: {
        ...(prev[contractId] || {}),
        ...patch,
      },
    }))
  }

  const handleAssignDriver = async (contract) => {
    const draft = getAssignmentDraft(contract)
    if (!draft.driverId) {
      setMessage({ type: 'error', text: 'Select a driver before assigning this contract.' })
      return
    }

    setAssignLoading((prev) => ({ ...prev, [contract.id]: true }))
    setMessage(null)
    const result = await supplyChainApi.assignContractDriver(contract.id, draft.driverId, draft.vehicleId || null)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: `Driver assigned for ${contract.id}.` })
      setAssignmentDrafts((prev) => {
        const next = { ...prev }
        delete next[contract.id]
        return next
      })
      await loadContracts()
    }
    setAssignLoading((prev) => ({ ...prev, [contract.id]: false }))
  }

  const handleCreateContract = async (event) => {
    event.preventDefault()
    if (!createDraft.shipmentId || !createDraft.carrierOrgId || !createDraft.originNodeId || !createDraft.destinationNodeId) {
      setMessage({ type: 'error', text: 'Shipment, carrier, origin, and destination are required.' })
      return
    }

    setCreateLoading(true)
    setMessage(null)
    const mandatoryStopNodeIds = createDraft.mandatoryStopNodeIds
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const result = await supplyChainApi.createContract({
      shipmentId: createDraft.shipmentId,
      contractType: 'transport_order',
      carrierOrgId: createDraft.carrierOrgId,
      driverId: createDraft.driverId || null,
      vehicleId: createDraft.vehicleId || null,
      originNodeId: createDraft.originNodeId,
      destinationNodeId: createDraft.destinationNodeId,
      mandatoryStopNodeIds,
      slaDeliveryAt: new Date(createDraft.slaDeliveryAt).toISOString(),
      price: Number(createDraft.price) || 0,
      currency: 'INR',
      penaltyRules: {
        lateDeliveryPerHour: Number(createDraft.lateDeliveryPerHour) || 0,
      },
    })

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: `Contract ${result.contract?.id || ''} created as draft.` })
      setShowCreateForm(false)
      await loadContracts()
    }
    setCreateLoading(false)
  }

  const handleEvaluateBreaches = async () => {
    setBreachLoading(true)
    setMessage(null)
    const result = await supplyChainApi.evaluateContractBreaches()
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: `${result.breached || 0} overdue contract(s) marked as breached.` })
      await loadContracts()
    }
    setBreachLoading(false)
  }

  return (
    <div className="contracts-page animate-fadeIn">
      <RoleWorkspaceBanner compact />

      <section className="contracts-hero">
        <div>
          <span className="contracts-kicker">Phase 9D Contracts</span>
          <h2>Contracts & Transport Responsibility</h2>
          <p>
            Contracts connect shipments to carrier responsibility, mandatory stops, SLA timing,
            assigned drivers, vehicles, and transporter reliability history.
          </p>
        </div>
        <div className="contracts-metrics">
          <div><span>Contracts</span><strong>{contracts.length}</strong></div>
          <div><span>Active</span><strong>{metrics.active}</strong></div>
          <div><span>Available drivers</span><strong>{metrics.availableDrivers}</strong></div>
          <div><span>Avg driver rating</span><strong>{metrics.avgDriverRating}</strong></div>
        </div>
      </section>

      {message && (
        <div className={`contracts-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="contracts-grid">
        <section className="contracts-list card">
          <div className="contracts-section-header">
            <div>
              <h3>Contract List</h3>
              <p>Role-scoped contracts visible to {currentUser?.roleLabel || currentUser?.role}.</p>
            </div>
            {MANAGE_ROLES.has(currentUser?.role) && (
              <div className="contracts-header-actions">
                <button
                  className="contracts-secondary-button"
                  type="button"
                  onClick={handleEvaluateBreaches}
                  disabled={breachLoading}
                >
                  {breachLoading ? 'Checking...' : 'Evaluate SLA breaches'}
                </button>
                <button
                  className="contracts-secondary-button"
                  type="button"
                  onClick={() => setShowCreateForm((value) => !value)}
                >
                  {showCreateForm ? 'Close form' : '+ Create contract'}
                </button>
              </div>
            )}
          </div>

          {showCreateForm && MANAGE_ROLES.has(currentUser?.role) && (
            <form className="contract-create-form" onSubmit={handleCreateContract}>
              <div className="contract-create-title">
                <span>Create transport order</span>
                <strong>Draft first, then send to carrier</strong>
              </div>

              <label>
                Shipment
                <select
                  value={createDraft.shipmentId}
                  onChange={(event) => handleCreateDraftChange('shipmentId', event.target.value)}
                >
                  {shipments.length === 0 && <option value="">No shipments visible</option>}
                  {shipments.map((shipment) => (
                    <option key={shipment.id} value={shipment.id}>
                      {shipment.id} - {shipment.cargo || shipment.cargo_type || 'Cargo'}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Carrier
                <select
                  value={createDraft.carrierOrgId}
                  onChange={(event) => handleCreateDraftChange('carrierOrgId', event.target.value)}
                >
                  {carrierOptions.map((carrierId) => (
                    <option key={carrierId} value={carrierId}>{carrierId}</option>
                  ))}
                </select>
              </label>

              <label>
                Driver
                <select
                  value={createDraft.driverId}
                  onChange={(event) => handleCreateDraftChange('driverId', event.target.value)}
                >
                  <option value="">Assign later</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name} - {String(driver.status || 'unknown').replaceAll('_', ' ')} - {driver.rating?.overall ?? '--'}/5
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Vehicle
                <select
                  value={createDraft.vehicleId}
                  onChange={(event) => handleCreateDraftChange('vehicleId', event.target.value)}
                >
                  <option value="">Assign later</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.plateNumber || vehicle.id} - {String(vehicle.status || 'unknown').replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Origin
                <select
                  value={createDraft.originNodeId}
                  onChange={(event) => handleCreateDraftChange('originNodeId', event.target.value)}
                >
                  {graphNodes.map((node) => (
                    <option key={node.id} value={node.id}>{cleanNode(node.id)}</option>
                  ))}
                </select>
              </label>

              <label>
                Destination
                <select
                  value={createDraft.destinationNodeId}
                  onChange={(event) => handleCreateDraftChange('destinationNodeId', event.target.value)}
                >
                  {graphNodes.map((node) => (
                    <option key={node.id} value={node.id}>{cleanNode(node.id)}</option>
                  ))}
                </select>
              </label>

              <label className="wide">
                Mandatory stops, comma separated
                <input
                  value={createDraft.mandatoryStopNodeIds}
                  onChange={(event) => handleCreateDraftChange('mandatoryStopNodeIds', event.target.value)}
                  placeholder="nagpur_hub, kolkata_dc"
                />
              </label>

              <label>
                SLA delivery
                <input
                  type="datetime-local"
                  value={createDraft.slaDeliveryAt}
                  onChange={(event) => handleCreateDraftChange('slaDeliveryAt', event.target.value)}
                />
              </label>

              <label>
                Contract value
                <input
                  type="number"
                  min="0"
                  value={createDraft.price}
                  onChange={(event) => handleCreateDraftChange('price', event.target.value)}
                />
              </label>

              <label>
                Penalty per hour
                <input
                  type="number"
                  min="0"
                  value={createDraft.lateDeliveryPerHour}
                  onChange={(event) => handleCreateDraftChange('lateDeliveryPerHour', event.target.value)}
                />
              </label>

              <div className="contract-create-actions">
                <button className="contracts-primary-button" type="submit" disabled={createLoading}>
                  {createLoading ? 'Creating...' : 'Create Draft Contract'}
                </button>
              </div>
            </form>
          )}

          {loading && <div className="contracts-empty">Loading contracts...</div>}
          {!loading && contracts.length === 0 && (
            <div className="contracts-empty">No contracts are visible for this role yet.</div>
          )}

          {!loading && contracts.map((contract) => {
            const driver = driverById(drivers, contract.driverId)
            const vehicle = vehicleById(vehicles, contract.vehicleId)
            const actions = getAllowedActions(currentUser?.role, contract)
            if (HANDOFF_ROLES.has(currentUser?.role) && ['in_progress', 'handoff_pending'].includes(contract.status)) {
              actions.push({ action: 'handoff', label: 'Confirm Handoff' })
            }
            const showAssignment = canAssignDriver(currentUser?.role, contract)
            const assignmentDraft = showAssignment ? getAssignmentDraft(contract) : null
            const slaHealth = getSlaHealth(contract)

            return (
              <article
                className="contract-card clickable"
                key={contract.id}
                onClick={() => navigate(`/contracts/${contract.id}`)}
              >
                <div className="contract-card-top">
                  <div>
                    <span className="contract-id">{contract.id}</span>
                    <h4>{contract.shipmentId}</h4>
                  </div>
                  <span className={`contract-status ${statusClass(contract.status)}`}>
                    {String(contract.status || 'draft').replaceAll('_', ' ')}
                  </span>
                </div>

                <div className="contract-route">
                  <span>{cleanNode(contract.originNodeId)}</span>
                  <strong>via {(contract.mandatoryStopNodeIds || []).map(cleanNode).join(', ') || 'direct route'}</strong>
                  <span>{cleanNode(contract.destinationNodeId)}</span>
                </div>

                <div className="contract-facts">
                  <div><span>SLA</span><strong>{formatDate(contract.slaDeliveryAt)}</strong></div>
                  <div className={`contract-sla-chip ${slaHealth.className}`}><span>SLA health</span><strong>{slaHealth.label}</strong></div>
                  <div><span>Value</span><strong>{formatMoney(contract.price, contract.currency)}</strong></div>
                  <div><span>Penalty/hr</span><strong>{formatMoney(contract.penaltyRules?.lateDeliveryPerHour, contract.currency)}</strong></div>
                  <div><span>Carrier</span><strong>{contract.carrierOrgId}</strong></div>
                </div>
                <p className="contract-sla-explanation">{slaHealth.explanation}</p>

                <div className="contract-driver-strip">
                  <div>
                    <span>Driver</span>
                    <strong>{driver?.name || contract.driverId || 'Unassigned'}</strong>
                  </div>
                  <div>
                    <span>Vehicle</span>
                    <strong>{vehicle?.plateNumber || contract.vehicleId || 'Unassigned'}</strong>
                  </div>
                  <div>
                    <span>Reliability</span>
                    <strong>{contract.performanceSnapshot?.driverOverallRating || driver?.rating?.overall || '--'} / 5</strong>
                  </div>
                  <div>
                    <span>No-damage</span>
                    <strong>{driver?.rating?.noDamage ?? '--'}%</strong>
                  </div>
                </div>

                {showAssignment && (
                  <div className="contract-assignment" onClick={(event) => event.stopPropagation()}>
                    <div className="contract-assignment-copy">
                      <span>Dispatch control</span>
                      <strong>Assign or change driver/vehicle</strong>
                    </div>
                    <label>
                      Driver
                      <select
                        value={assignmentDraft.driverId}
                        onChange={(event) => {
                          const nextDriver = driverById(drivers, event.target.value)
                          updateAssignmentDraft(contract.id, {
                            driverId: event.target.value,
                            vehicleId: nextDriver?.assignedVehicleId || assignmentDraft.vehicleId,
                          })
                        }}
                      >
                        {drivers.length === 0 && <option value="">No drivers visible</option>}
                        {drivers.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} - {String(item.status || 'unknown').replaceAll('_', ' ')} - {item.rating?.overall ?? '--'}/5
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Vehicle
                      <select
                        value={assignmentDraft.vehicleId}
                        onChange={(event) => updateAssignmentDraft(contract.id, { vehicleId: event.target.value })}
                      >
                        {vehicles.length === 0 && <option value="">No vehicles visible</option>}
                        {vehicles.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.plateNumber || item.id} - {String(item.status || 'unknown').replaceAll('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="contracts-secondary-button"
                      disabled={Boolean(assignLoading[contract.id]) || !assignmentDraft.driverId}
                      onClick={() => handleAssignDriver(contract)}
                    >
                      {assignLoading[contract.id] ? 'Assigning...' : 'Assign Driver'}
                    </button>
                  </div>
                )}

                <div className="contract-actions">
                  {actions.length === 0 && (
                    <span className="contract-readonly">No direct action for this status/role.</span>
                  )}
                  {actions.map((item) => {
                    const key = `${contract.id}:${item.action}`
                    return (
                      <button
                        key={item.action}
                        type="button"
                        className={item.danger ? 'contracts-danger-button' : 'contracts-primary-button'}
                        disabled={Boolean(actionLoading[key])}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleTransition(contract.id, item.action)
                        }}
                      >
                        {actionLoading[key] ? 'Working...' : item.label}
                      </button>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </section>

        <aside className="drivers-panel card">
          <div className="contracts-section-header">
            <div>
              <h3>Driver & Transporter Reliability</h3>
              <p>Who is assigned, available, and historically reliable.</p>
            </div>
          </div>

          {loading && <div className="contracts-empty">Loading drivers...</div>}
          {!loading && drivers.length === 0 && (
            <div className="contracts-empty">No driver profiles visible for this role.</div>
          )}

          {!loading && drivers.map((driver) => {
            const vehicle = vehicleById(vehicles, driver.assignedVehicleId)
            return (
              <div className="driver-card" key={driver.id}>
                <div className="driver-card-top">
                  <div>
                    <h4>{driver.name}</h4>
                    <span>{vehicle?.plateNumber || driver.assignedVehicleId || 'No vehicle assigned'}</span>
                  </div>
                  <span className={`driver-status ${driver.status}`}>{String(driver.status).replaceAll('_', ' ')}</span>
                </div>

                <div className="driver-score-grid">
                  <div><span>Overall</span><strong>{driver.rating?.overall ?? '--'} / 5</strong></div>
                  <div><span>On-time</span><strong>{driver.rating?.onTime ?? '--'}%</strong></div>
                  <div><span>No damage</span><strong>{driver.rating?.noDamage ?? '--'}%</strong></div>
                  <div><span>Completed</span><strong>{driver.history?.completedTrips ?? 0}</strong></div>
                </div>

                <div className="driver-skills">
                  {(driver.skills || []).map((skill) => <span key={skill}>{skill}</span>)}
                </div>
              </div>
            )
          })}
        </aside>
      </div>
    </div>
  )
}
