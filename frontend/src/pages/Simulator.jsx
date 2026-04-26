import { useEffect, useMemo, useState } from 'react'
import WhatIfMap from '../components/simulator/WhatIfMap'
import ScenarioPanel from '../components/simulator/ScenarioPanel'
import ImpactAnalysis from '../components/simulator/ImpactAnalysis'
import RouteComparison from '../components/simulator/RouteComparison'
import NarrativePanel from '../components/simulator/NarrativePanel'
import SimulationHistoryPanel from '../components/simulator/SimulationHistoryPanel'
import { supplyChainApi } from '../services/api'
import { MAPS_CENTER } from '../utils/constants'

const INITIAL_SCENARIO = {
  type: 'flood',
  severityLevel: 2,
  radiusKm: 80,
  durationHours: 12,
}

const SEVERITY_LABELS = ['low', 'medium', 'high', 'critical']

function getSeverity(level) {
  const safe = Math.max(1, Math.min(4, Number(level) || 1))
  return SEVERITY_LABELS[safe - 1]
}

function findNearestNode(latLng, nodes) {
  if (!nodes.length) return null
  let nearest = null
  let bestDistance = Number.POSITIVE_INFINITY

  nodes.forEach((node) => {
    const dLat = (node.lat || 0) - latLng.lat
    const dLng = (node.lng || 0) - latLng.lng
    const sq = dLat * dLat + dLng * dLng
    if (sq < bestDistance) {
      bestDistance = sq
      nearest = node
    }
  })
  return nearest
}

export default function Simulator() {
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [shipments, setShipments] = useState([])
  const [scenario, setScenario] = useState(INITIAL_SCENARIO)
  const [selectedDisruption, setSelectedDisruption] = useState(null)
  const [simulationResult, setSimulationResult] = useState(null)
  const [simulationHistory, setSimulationHistory] = useState([])
  const [selectedHistoryId, setSelectedHistoryId] = useState(null)
  const [isBootLoading, setIsBootLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [showShipments, setShowShipments] = useState(true)
  const [showOriginalPaths, setShowOriginalPaths] = useState(true)
  const [showOptimizedPaths, setShowOptimizedPaths] = useState(true)
  const [focusShipmentIds, setFocusShipmentIds] = useState(() => {
    try {
      const raw = window.localStorage.getItem('ssc.selectedShipmentIds')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    let isActive = true

    const loadData = async () => {
      try {
        const [graphPayload, shipmentsPayload] = await Promise.all([
          supplyChainApi.getGraph(),
          supplyChainApi.getShipments(),
        ])
        if (!isActive) return
        setNodes(Array.isArray(graphPayload.nodes) ? graphPayload.nodes : [])
        setEdges(Array.isArray(graphPayload.edges) ? graphPayload.edges : [])
        setShipments(Array.isArray(shipmentsPayload.shipments) ? shipmentsPayload.shipments : [])
      } finally {
        if (isActive) setIsBootLoading(false)
      }
    }

    loadData()
    return () => {
      isActive = false
    }
  }, [])

  const affectedNodeLabel = useMemo(() => {
    if (!selectedDisruption?.nodeId) return '--'
    const node = nodes.find((item) => item.id === selectedDisruption.nodeId)
    return node?.name || selectedDisruption.nodeId
  }, [nodes, selectedDisruption])

  const handleMapClick = (latLng) => {
    const nearest = findNearestNode(latLng, nodes)
    if (!nearest) return
    setSelectedDisruption({
      lat: latLng.lat,
      lng: latLng.lng,
      nodeId: nearest.id,
      nodeName: nearest.name,
      radiusKm: scenario.radiusKm,
    })
    setSimulationResult(null)
  }

  const handleScenarioChange = (patch) => {
    setScenario((prev) => ({ ...prev, ...patch }))
    setSelectedDisruption((prev) => {
      if (!prev) return prev
      return { ...prev, radiusKm: patch.radiusKm ?? prev.radiusKm }
    })
  }

  const rollbackToOptimal = () => {
    setScenario(INITIAL_SCENARIO)
    setSelectedDisruption(null)
    setSimulationResult(null)
  }

  const runSimulation = async () => {
    if (!selectedDisruption?.nodeId) return
    setIsRunning(true)
    try {
      const payload = {
        disruptedNodeId: selectedDisruption.nodeId,
        eventType: scenario.type,
        severity: getSeverity(scenario.severityLevel),
        disruptionLat: selectedDisruption.lat,
        disruptionLng: selectedDisruption.lng,
        impactRadiusKm: scenario.radiusKm,
        disruptionDurationHrs: scenario.durationHours,
        focusShipmentIds: focusShipmentIds.length ? focusShipmentIds : undefined,
      }
      const result = await supplyChainApi.runSimulation(payload)
      setSimulationResult(result)
      const plans = result?.cascadeMetrics?.reroutePlans || []
      const blocked = plans.filter((plan) => plan.status === 'blocked_at_disruption_node' || plan.status === 'no_alternative_path').length
      const now = new Date()
      const historyEntry = {
        id: `${now.getTime()}-${payload.disruptedNodeId}`,
        timestamp: now.toISOString(),
        timeLabel: now.toLocaleTimeString(),
        nodeId: payload.disruptedNodeId,
        nodeLabel: selectedDisruption?.nodeName || payload.disruptedNodeId,
        eventType: payload.eventType,
        severity: payload.severity,
        affected: result?.cascadeMetrics?.totalShipmentsAffected || 0,
        blocked,
        delay: result?.cascadeMetrics?.networkDelayHrs || 0,
        result,
      }
      setSimulationHistory((prev) => {
        const next = [historyEntry, ...prev].slice(0, 6)
        return next
      })
      setSelectedHistoryId(historyEntry.id)
    } finally {
      setIsRunning(false)
    }
  }

  const visibleShipments = useMemo(() => {
    if (!focusShipmentIds.length) return shipments
    return shipments.filter((shipment) => focusShipmentIds.includes(shipment.id))
  }, [shipments, focusShipmentIds])

  const focusShipmentDetails = useMemo(() => {
    if (!focusShipmentIds.length) return []
    return shipments
      .filter((shipment) => focusShipmentIds.includes(shipment.id))
      .map((shipment) => ({
        id: shipment.id,
        status: shipment.status,
        currentStage: shipment.currentStage,
      }))
  }, [shipments, focusShipmentIds])

  return (
    <div className="simulator">
      <div className="simulator-header">
        <div>
          <h2 className="simulator-title">🔬 What-If Scenario Simulator</h2>
          <p className="simulator-subtitle">
            Drop a disruption on the map to simulate cascade effects and view optimized rerouting
          </p>
        </div>
      </div>

      <div className="simulator-grid">
        <WhatIfMap
          nodes={nodes}
          edges={edges}
          shipments={visibleShipments}
          selectedDisruption={selectedDisruption}
          simulationResult={simulationResult}
          showShipments={showShipments}
          showOriginalPaths={showOriginalPaths}
          showOptimizedPaths={showOptimizedPaths}
          onToggleShipments={() => setShowShipments((prev) => !prev)}
          onToggleOriginalPaths={() => setShowOriginalPaths((prev) => !prev)}
          onToggleOptimizedPaths={() => setShowOptimizedPaths((prev) => !prev)}
          onMapClick={handleMapClick}
          isLoading={isBootLoading || isRunning}
        />

        <ScenarioPanel
          scenario={scenario}
          selectedDisruption={selectedDisruption}
          focusShipmentCount={focusShipmentIds.length}
          focusShipments={focusShipmentDetails}
          onClearFocus={() => {
            setFocusShipmentIds([])
            try {
              window.localStorage.removeItem('ssc.selectedShipmentIds')
            } catch {
              // ignore storage errors
            }
          }}
          hasResult={Boolean(simulationResult)}
          onChange={handleScenarioChange}
          onRun={runSimulation}
          onReset={rollbackToOptimal}
          isRunning={isRunning}
        />
      </div>

      <div style={{ display: 'grid', gap: 'var(--spacing-md)', gridTemplateColumns: '1.1fr 1fr' }}>
        <ImpactAnalysis result={simulationResult} />
        <RouteComparison result={simulationResult} />
      </div>

      <div className="card" style={{ padding: 'var(--spacing-md)' }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
          Active Scenario Node: {affectedNodeLabel}
        </div>
        <NarrativePanel result={simulationResult} scenario={scenario} selectedDisruption={selectedDisruption} />
      </div>

      <SimulationHistoryPanel
        history={simulationHistory}
        selectedId={selectedHistoryId}
        onSelect={(id) => {
          setSelectedHistoryId(id)
          const selected = simulationHistory.find((item) => item.id === id)
          if (selected?.result) {
            setSimulationResult(selected.result)
            const node = nodes.find((item) => item.id === selected.nodeId)
            setSelectedDisruption((prev) => ({
              ...(prev || {}),
              nodeId: selected.nodeId,
              nodeName: selected.nodeLabel,
              lat: node?.lat ?? prev?.lat ?? MAPS_CENTER.lat,
              lng: node?.lng ?? prev?.lng ?? MAPS_CENTER.lng,
              radiusKm: scenario.radiusKm,
            }))
          }
        }}
      />
      <div className="card" style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
        Simulation is non-destructive: running what-if analysis does not modify live shipment routes.
      </div>
    </div>
  )
}
