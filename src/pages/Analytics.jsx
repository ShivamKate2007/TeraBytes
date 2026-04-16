/* ============================================================
   Analytics Page — Disruption trends, carrier performance, routes
   ============================================================ */

import { useState } from 'react';
import { Download, RefreshCw, Calendar } from 'lucide-react';
import DisruptionChart from '../components/analytics/DisruptionChart';
import PerformanceChart from '../components/analytics/PerformanceChart';
import RouteRiskChart from '../components/analytics/RouteRiskChart';
import AnimatedCounter from '../components/common/AnimatedCounter';
import '../styles/analytics.css';

const SUMMARY_STATS = [
  { label: 'Total Disruptions', value: 284, suffix: '', delta: '+12', positive: false, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  { label: 'Avg Resolution', value: 4.2, suffix: 'd', delta: '-0.3d', positive: true, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  { label: 'Routes Analyzed', value: 147, suffix: '', delta: '+23', positive: true, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  { label: 'Cost Avoided', value: 12.4, suffix: 'M', prefix: '$', delta: 'this quarter', positive: true, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
];

export default function Analytics() {
  const [dateRange, setDateRange] = useState('30d');

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Supply Chain{' '}
            <span className="glow-text">Analytics</span>
          </h1>
          <p className="page-subtitle">
            Historical disruption trends, carrier benchmarks, and route risk intelligence
          </p>
        </div>
        <div className="page-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-md)', padding: '6px 12px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            <Calendar size={13} />
            Last 30 days
          </div>
          <button className="btn btn-secondary btn-sm" aria-label="Export analytics">
            <Download size={13} />
            Export
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <section className="analytics-stats-row" aria-label="Analytics summary statistics" style={{ marginBottom: 'var(--space-5)' }}>
        {SUMMARY_STATS.map((stat) => (
          <article
            key={stat.label}
            className="analytics-stat-card"
            aria-label={`${stat.label}: ${stat.value}${stat.suffix}`}
          >
            <div className="analytics-stat-icon" style={{ background: stat.bg }}>
              <span style={{ fontSize: 'var(--text-xl)', color: stat.color }}>
                {/* Simple icon via unicode */}
                {stat.label.includes('Disruptions') ? '⚡' :
                 stat.label.includes('Resolution') ? '⏱' :
                 stat.label.includes('Routes') ? '🗺' : '💰'}
              </span>
            </div>
            <div>
              <div className="analytics-stat-value" style={{ color: stat.color }}>
                {stat.prefix && <span>{stat.prefix}</span>}
                <AnimatedCounter value={stat.value} decimals={Number.isInteger(stat.value) ? 0 : 1} duration={1000} />
                {stat.suffix}
              </div>
              <div className="analytics-stat-label">{stat.label}</div>
              <div style={{ fontSize: '10px', color: stat.positive ? 'var(--color-risk-low)' : 'var(--color-risk-critical)', marginTop: '3px' }}>
                {stat.delta}
              </div>
            </div>
          </article>
        ))}
      </section>

      {/* Main analytics content */}
      <div className="analytics-layout">
        {/* Top row: Disruption chart + Route risk */}
        <div className="analytics-top-row">
          <DisruptionChart />
          <RouteRiskChart />
        </div>

        {/* Mid row: Performance charts */}
        <div className="analytics-mid-row">
          <PerformanceChart mode="carrier" />
          <PerformanceChart mode="route" />
          {/* Placeholder for a future 3rd chart */}
          <div className="chart-card" aria-label="Additional analytics coming soon">
            <div className="chart-card-header">
              <div>
                <div className="chart-card-title">Cost per TEU Trend</div>
                <div className="chart-card-subtitle">Freight rate index vs risk correlation</div>
              </div>
            </div>
            <div className="chart-body">
              <div style={{
                height: '220px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)',
                flexDirection: 'column', gap: '8px',
              }}>
                <span style={{ fontSize: '32px' }}>📊</span>
                <span>Connect freight rate API</span>
                <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>Add VITE_FREIGHT_API_KEY to .env</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
