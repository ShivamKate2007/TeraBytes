import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import KPICards from '../components/dashboard/KPICards'
import ShipmentMap from '../components/dashboard/ShipmentMap'
import ShipmentTable from '../components/dashboard/ShipmentTable'
import AlertFeed from '../components/dashboard/AlertFeed'
import NewsHeadlines from '../components/dashboard/NewsHeadlines'
import useShipments from '../hooks/useShipments'
import useDisruptions from '../hooks/useDisruptions'
import useAlerts from '../hooks/useAlerts'
import { supplyChainApi } from '../services/api'

export default function Dashboard() {
  const navigate = useNavigate()
  const {
    shipments,
    loading: shipmentsLoading,
    retryCount: shipmentRetryCount,
    isReconnecting: shipmentsReconnecting,
    lastUpdated: shipmentsLastUpdated,
  } = useShipments()
  const {
    disruptions,
    loading: disruptionsLoading,
    retryCount: disruptionRetryCount,
    isReconnecting: disruptionsReconnecting,
    lastUpdated: disruptionsLastUpdated,
  } = useDisruptions()
  const { alerts } = useAlerts({ shipments, disruptions })

  const [graph, setGraph] = useState({ nodes: [], edges: [] })
  const [graphLoading, setGraphLoading] = useState(true)
  const [selectedShipmentIds, setSelectedShipmentIds] = useState([])
  const [newsHeadlines, setNewsHeadlines] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)

  useEffect(() => {
    let isActive = true
    const loadGraph = async () => {
      const payload = await supplyChainApi.getGraph()
      if (!isActive) return
      setGraph({
        nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
        edges: Array.isArray(payload.edges) ? payload.edges : [],
      })
      setGraphLoading(false)
    }
    loadGraph()
    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    let isActive = true
    const loadNews = async () => {
      const payload = await supplyChainApi.getNewsHeadlines('India logistics', 4)
      if (!isActive) return
      setNewsHeadlines(Array.isArray(payload.headlines) ? payload.headlines : [])
      setNewsLoading(false)
    }
    loadNews()
    const interval = setInterval(loadNews, 60000)
    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [])

  const loading = shipmentsLoading || disruptionsLoading || graphLoading
  const isReconnecting = shipmentsReconnecting || disruptionsReconnecting
  const retryCount = shipmentRetryCount + disruptionRetryCount
  const latestUpdate = Math.max(shipmentsLastUpdated || 0, disruptionsLastUpdated || 0)
  const selectedShipments = shipments.filter((shipment) => selectedShipmentIds.includes(shipment.id))

  const handleSelectShipment = (shipmentId, checked) => {
    setSelectedShipmentIds((prev) => {
      if (checked) {
        if (prev.includes(shipmentId)) return prev
        return [...prev, shipmentId]
      }
      return prev.filter((id) => id !== shipmentId)
    })
  }

  return (
    <div className="dashboard animate-fadeIn">
      {isReconnecting && (
        <div className="card" style={{ padding: '10px 14px', borderColor: 'rgba(245,158,11,0.5)' }}>
          <strong style={{ color: 'var(--risk-moderate)' }}>Reconnecting data streams...</strong>
          <span style={{ marginLeft: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
            retry #{retryCount}
          </span>
        </div>
      )}
      {!isReconnecting && latestUpdate > 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          Last synced: {new Date(latestUpdate).toLocaleTimeString()}
        </div>
      )}
      <KPICards shipments={shipments} loading={loading} />

      <div className="dashboard-grid">
        <ShipmentMap
          nodes={graph.nodes}
          edges={graph.edges}
          shipments={selectedShipments}
          disruptions={disruptions}
        />

        <div className="dashboard-sidebar-panels">
          <AlertFeed alerts={alerts} loading={loading} />
          <NewsHeadlines headlines={newsHeadlines} loading={newsLoading} />
        </div>
      </div>

      <ShipmentTable
        shipments={shipments}
        loading={loading}
        selectedShipmentIds={selectedShipmentIds}
        onToggleSelect={handleSelectShipment}
        onOpenShipment={(id) => navigate(`/shipment/${id}`)}
      />
    </div>
  )
}
