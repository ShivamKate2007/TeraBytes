import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function toShortDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function DisruptionChart({ data = [], loading = false }) {
  if (loading) {
    return <div className="skeleton skeleton-card" style={{ height: '100%' }} />
  }

  if (!data.length) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No disruption trend data available.</div>
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
        <XAxis
          dataKey="date"
          tickFormatter={toShortDate}
          stroke="#94a3b8"
          fontSize={12}
        />
        <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
        <Tooltip
          labelFormatter={toShortDate}
          contentStyle={{
            background: '#0f172a',
            border: '1px solid rgba(148,163,184,0.25)',
            borderRadius: 8,
            color: '#e2e8f0',
          }}
        />
        <Line
          type="monotone"
          dataKey="disruptions"
          stroke="#f97316"
          strokeWidth={3}
          dot={{ r: 4, fill: '#fb923c' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
