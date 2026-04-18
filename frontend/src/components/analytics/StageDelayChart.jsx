import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export default function StageDelayChart({ data = [], loading = false }) {
  if (loading) {
    return <div className="skeleton skeleton-card" style={{ height: '100%' }} />
  }

  if (!data.length) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No stage delay data available.</div>
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="delayFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.7} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
        <XAxis dataKey="stage" stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={12} />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(1)} h`, 'Estimated delay']}
          contentStyle={{
            background: '#0f172a',
            border: '1px solid rgba(148,163,184,0.25)',
            borderRadius: 8,
            color: '#e2e8f0',
          }}
        />
        <Area
          type="monotone"
          dataKey="delayHours"
          stroke="#fb923c"
          fill="url(#delayFill)"
          strokeWidth={3}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
