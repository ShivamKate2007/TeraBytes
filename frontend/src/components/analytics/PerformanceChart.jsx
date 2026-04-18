import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export default function PerformanceChart({ data = [], loading = false }) {
  if (loading) {
    return <div className="skeleton skeleton-card" style={{ height: '100%' }} />
  }

  if (!data.length) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No performance data available.</div>
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
        <XAxis dataKey="priority" stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
        <Tooltip
          formatter={(value) => [`${value}%`, 'On-time score']}
          contentStyle={{
            background: '#0f172a',
            border: '1px solid rgba(148,163,184,0.25)',
            borderRadius: 8,
            color: '#e2e8f0',
          }}
        />
        <Bar dataKey="onTimeScore" fill="#22c55e" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
