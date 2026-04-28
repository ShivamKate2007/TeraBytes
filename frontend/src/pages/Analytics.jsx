import { useEffect, useMemo, useState } from 'react'
import DisruptionChart from '../components/analytics/DisruptionChart'
import PerformanceChart from '../components/analytics/PerformanceChart'
import RouteRiskChart from '../components/analytics/RouteRiskChart'
import StageDelayChart from '../components/analytics/StageDelayChart'
import RoleWorkspaceBanner from '../components/common/RoleWorkspaceBanner'
import { supplyChainApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

const STAGE_DELAY_WEIGHT = {
  manufacturer: 0.3,
  warehouse: 0.45,
  in_transit: 0.9,
  distribution_center: 0.55,
  retailer: 0.2,
}

function toPriority(item) {
  return String(item?.priority || 'medium').toLowerCase()
}

function routeKey(shipment) {
  const route = shipment.optimizedRoute?.length ? shipment.optimizedRoute : shipment.originalRoute
  if (!Array.isArray(route) || route.length < 2) return 'Unmapped'
  return `${route[0]} → ${route[route.length - 1]}`
}

export default function Analytics() {
  const { currentUser } = useAuth()
  const [shipments, setShipments] = useState([])
  const [kpis, setKpis] = useState(null)
  const [trends, setTrends] = useState([])
  const [trendExplanation, setTrendExplanation] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    const loadAnalytics = async () => {
      try {
        const [shipmentPayload, kpiPayload, trendPayload] = await Promise.all([
          supplyChainApi.getShipments(),
          supplyChainApi.getAnalyticsKpis(),
          supplyChainApi.getAnalyticsTrends(),
        ])

        if (!isActive) return
        setShipments(Array.isArray(shipmentPayload.shipments) ? shipmentPayload.shipments : [])
        setKpis(kpiPayload || null)
        setTrends(Array.isArray(trendPayload.trends) ? trendPayload.trends : [])
        setTrendExplanation(trendPayload.explanation || '')
      } finally {
        if (isActive) setLoading(false)
      }
    }

    loadAnalytics()
    const interval = setInterval(loadAnalytics, 45000)
    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [currentUser?.id])

  const performanceByPriority = useMemo(() => {
    const bucket = {}
    shipments.forEach((shipment) => {
      const priority = toPriority(shipment)
      const risk = Number(shipment.riskScore) || 0
      const onTimeScore = Math.max(0, 100 - risk)
      if (!bucket[priority]) bucket[priority] = { priority, total: 0, count: 0 }
      bucket[priority].total += onTimeScore
      bucket[priority].count += 1
    })
    return Object.values(bucket)
      .map((entry) => ({
        priority: entry.priority,
        onTimeScore: Number((entry.total / Math.max(1, entry.count)).toFixed(1)),
      }))
      .sort((a, b) => a.priority.localeCompare(b.priority))
  }, [shipments])

  const routeRiskDistribution = useMemo(() => {
    const bucket = {}
    shipments.forEach((shipment) => {
      const key = routeKey(shipment)
      const risk = Number(shipment.riskScore) || 0
      if (!bucket[key]) bucket[key] = { route: key, totalRisk: 0, count: 0 }
      bucket[key].totalRisk += risk
      bucket[key].count += 1
    })
    return Object.values(bucket)
      .map((entry) => ({
        route: entry.route,
        risk: Number((entry.totalRisk / Math.max(1, entry.count)).toFixed(1)),
      }))
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 6)
  }, [shipments])

  const stageDelayEstimate = useMemo(() => {
    const bucket = {}
    shipments.forEach((shipment) => {
      const stage = String(shipment.currentStage || 'in_transit')
      const risk = Number(shipment.riskScore) || 0
      const estimatedDelay = (risk / 100) * 24 * (STAGE_DELAY_WEIGHT[stage] ?? 0.5)
      if (!bucket[stage]) bucket[stage] = { stage, total: 0, count: 0 }
      bucket[stage].total += estimatedDelay
      bucket[stage].count += 1
    })
    return Object.values(bucket)
      .map((entry) => ({
        stage: entry.stage,
        delayHours: Number((entry.total / Math.max(1, entry.count)).toFixed(1)),
      }))
      .sort((a, b) => b.delayHours - a.delayHours)
  }, [shipments])

  return (
    <div className="analytics">
      <RoleWorkspaceBanner compact />
      <div className="analytics-header">
        <h2 className="analytics-title">📈 Supply Chain Analytics</h2>
        {kpis && (
          <div className="analytics-kpi-strip">
            <span>Active: <strong>{kpis.active_shipments ?? '--'}</strong></span>
            <span>At Risk: <strong>{kpis.at_risk ?? '--'}</strong></span>
            <span>Avg Risk: <strong>{kpis.avg_risk_score ?? '--'}</strong></span>
            <span>On-time: <strong>{kpis.on_time_rate ?? '--'}%</strong></span>
          </div>
        )}
      </div>

      {kpis?.explanations?.length > 0 && (
        <div className="analytics-insight-card">
          <div>
            <span className="analytics-insight-kicker">Role-scoped intelligence</span>
            <h3>What this analytics view means</h3>
          </div>
          <div className="analytics-insight-grid">
            {kpis.explanations.map((item) => <p key={item}>{item}</p>)}
          </div>
          {kpis.recommendations?.length > 0 && (
            <div className="analytics-recommendations">
              {kpis.recommendations.map((item) => <span key={item}>{item}</span>)}
            </div>
          )}
        </div>
      )}

      <div className="analytics-grid">
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Disruption Trends</h3>
              <p className="chart-card-subtitle">Disruptions detected over time</p>
            </div>
          </div>
          <div className="chart-container">
            <DisruptionChart data={trends} loading={loading} />
          </div>
          <p className="chart-card-subtitle" style={{ marginTop: 10 }}>
            {kpis?.scopeRole ? `For ${String(kpis.scopeRole).replaceAll('_', ' ')}, ` : ''}
            higher spikes indicate recent incident clusters that may need proactive reroute planning.
            {trendExplanation ? ` ${trendExplanation}` : ''}
          </p>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">On-Time Performance</h3>
              <p className="chart-card-subtitle">Estimated on-time score by priority</p>
            </div>
          </div>
          <div className="chart-container">
            <PerformanceChart data={performanceByPriority} loading={loading} />
          </div>
          <p className="chart-card-subtitle" style={{ marginTop: 10 }}>
            Lower score priorities are currently facing more delay exposure and should be monitored first.
          </p>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Risk by Route</h3>
              <p className="chart-card-subtitle">Average risk score per route</p>
            </div>
          </div>
          <div className="chart-container">
            <RouteRiskChart data={routeRiskDistribution} loading={loading} />
          </div>
          <p className="chart-card-subtitle" style={{ marginTop: 10 }}>
            Routes at the top have consistently higher risk and are best candidates for contingency plans.
          </p>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Chain Stage Delays</h3>
              <p className="chart-card-subtitle">Estimated delay by current chain stage</p>
            </div>
          </div>
          <div className="chart-container">
            <StageDelayChart data={stageDelayEstimate} loading={loading} />
          </div>
          <p className="chart-card-subtitle" style={{ marginTop: 10 }}>
            This estimates where delays are accumulating across stages using current shipment risk.
          </p>
        </div>
      </div>
    </div>
  )
}
