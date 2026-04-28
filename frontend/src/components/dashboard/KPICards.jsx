import AnimatedCounter from '../common/AnimatedCounter'

const HIGH_RISK_MIN_SCORE = 56

function computeMetrics(shipments) {
  if (!shipments.length) {
    return { active: 0, atRisk: 0, avgRisk: 0, onTimeRate: 0 }
  }

  const active = shipments.length
  const atRisk = shipments.filter((item) => Number(item.riskScore) >= HIGH_RISK_MIN_SCORE || item.isCritical).length
  const avgRisk = shipments.reduce((sum, item) => sum + (Number(item.riskScore) || 0), 0) / active
  const onTimeRate = Math.max(0, 100 - (atRisk / active) * 100)

  return {
    active,
    atRisk,
    avgRisk: Number(avgRisk.toFixed(1)),
    onTimeRate: Number(onTimeRate.toFixed(1)),
  }
}

export default function KPICards({ shipments = [], loading = false }) {
  const metrics = computeMetrics(shipments)

  const cards = [
    {
      key: 'active',
      label: 'Active Shipments',
      icon: '📦',
      value: metrics.active,
      suffix: '',
      trend: 'Live network movement',
      trendClass: 'positive',
    },
    {
      key: 'risk',
      label: 'At Risk',
      icon: '⚠️',
      value: metrics.atRisk,
      suffix: '',
      trend: metrics.atRisk > 0 ? 'Intervention recommended' : 'No critical lanes',
      trendClass: metrics.atRisk > 0 ? 'negative' : 'positive',
    },
    {
      key: 'avg',
      label: 'Average Risk',
      icon: '📊',
      value: metrics.avgRisk,
      suffix: '',
      trend: metrics.avgRisk > 55 ? 'Network stress elevated' : 'Network stable',
      trendClass: metrics.avgRisk > 55 ? 'negative' : 'positive',
    },
    {
      key: 'otd',
      label: 'On-Time Rate',
      icon: '✅',
      value: metrics.onTimeRate,
      suffix: '%',
      trend: metrics.onTimeRate >= 85 ? 'Above baseline target' : 'Below reliability target',
      trendClass: metrics.onTimeRate >= 85 ? 'positive' : 'negative',
    },
  ]

  return (
    <div className="kpi-row">
      {cards.map((card) => (
        <div key={card.key} className="kpi-card glass">
          <div className="kpi-card-header">
            <span className="kpi-card-label">{card.label}</span>
            <span className="kpi-card-icon">{card.icon}</span>
          </div>
          <div className="kpi-card-value">
            {loading ? '...' : <AnimatedCounter value={card.value} suffix={card.suffix} />}
          </div>
          <div className={`kpi-card-trend ${card.trendClass}`}>{card.trend}</div>
        </div>
      ))}
    </div>
  )
}
