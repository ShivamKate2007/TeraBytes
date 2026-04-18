import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

const COLORS = ['#10b981', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#ec4899']

export default function RouteRiskChart({ data = [], loading = false }) {
  if (loading) {
    return <div className="skeleton skeleton-card" style={{ height: '100%' }} />
  }

  if (!data.length) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No route risk distribution available.</div>
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="risk"
          nameKey="route"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={2}
          label={({ route }) => route}
          labelLine={false}
        >
          {data.map((item, index) => (
            <Cell key={item.route} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [Number(value).toFixed(1), 'Avg risk']}
          contentStyle={{
            background: '#0f172a',
            border: '1px solid rgba(148,163,184,0.25)',
            borderRadius: 8,
            color: '#e2e8f0',
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
