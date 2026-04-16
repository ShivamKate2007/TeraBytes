/* ============================================================
   PerformanceChart — Carrier / route on-time performance bars
   ============================================================ */

import { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { CHART_COLORS } from '../../utils/constants';

const DEMO_DATA = [
  { label: 'Maersk', current: 91.2, previous: 88.4, trend: 'up' },
  { label: 'MSC', current: 87.6, previous: 89.1, trend: 'down' },
  { label: 'CMA CGM', current: 85.3, previous: 83.7, trend: 'up' },
  { label: 'COSCO', current: 82.9, previous: 82.1, trend: 'up' },
  { label: 'Evergreen', current: 79.4, previous: 81.2, trend: 'down' },
  { label: 'Yang Ming', current: 76.8, previous: 74.5, trend: 'up' },
  { label: 'ONE', current: 73.2, previous: 75.1, trend: 'down' },
  { label: 'HMM', current: 70.5, previous: 68.9, trend: 'up' },
];

/**
 * @param {object} props
 * @param {Array} [props.data]
 * @param {boolean} [props.loading]
 * @param {'carrier'|'route'} [props.mode]
 */
export default function PerformanceChart({ data = DEMO_DATA, loading = false, mode = 'carrier' }) {
  const [hoveredRow, setHoveredRow] = useState(null);

  const getBarColor = (pct) => {
    if (pct >= 88) return CHART_COLORS.success;
    if (pct >= 80) return CHART_COLORS.primary;
    if (pct >= 70) return CHART_COLORS.warning;
    return CHART_COLORS.danger;
  };

  return (
    <div className="chart-card" role="region" aria-label={`${mode === 'carrier' ? 'Carrier' : 'Route'} performance chart`}>
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">
            {mode === 'carrier' ? 'Carrier Performance' : 'Route Performance'}
          </div>
          <div className="chart-card-subtitle">On-time delivery rate</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '4px 10px', background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.2)', borderRadius: '99px',
          fontSize: '11px', color: 'var(--color-risk-low)',
        }}>
          <TrendingUp size={11} aria-hidden="true" />
          Avg 81.2%
        </div>
      </div>

      <div className="chart-body">
        <div className="perf-bar-list" role="list" aria-label="Performance rankings">
          {data.map((item, i) => {
            const color = getBarColor(item.current);
            const isHovered = hoveredRow === i;
            const delta = (item.current - item.previous).toFixed(1);
            const isUp = item.trend === 'up';
            const DeltaIcon = isUp ? TrendingUp : TrendingDown;

            return (
              <div
                key={item.label}
                className="perf-bar-item"
                onMouseEnter={() => setHoveredRow(i)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  cursor: 'default',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-md)',
                  background: isHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
                  transition: 'background 0.15s ease',
                }}
                role="listitem"
                aria-label={`${item.label}: ${item.current}% on-time`}
              >
                <div className="perf-bar-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      width: 18, fontSize: '10px', fontFamily: 'var(--font-mono)',
                      color: 'var(--color-text-muted)', textAlign: 'right', flexShrink: 0,
                    }}>
                      {i + 1}.
                    </span>
                    <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                      {item.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        display: 'flex', alignItems: 'center', gap: '3px',
                        fontSize: '10px',
                        color: isUp ? 'var(--color-risk-low)' : 'var(--color-risk-critical)',
                      }}
                    >
                      <DeltaIcon size={10} aria-hidden="true" />
                      {Math.abs(delta)}pp
                    </span>
                    <span className="perf-bar-pct" style={{ color }}>
                      {item.current.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="perf-bar-track" role="progressbar" aria-valuenow={item.current} aria-valuemin={0} aria-valuemax={100} aria-label={`${item.label} at ${item.current}%`}>
                  <div
                    className="perf-bar-fill"
                    style={{
                      width: `${item.current}%`,
                      background: `linear-gradient(90deg, ${color} 0%, ${color}cc 100%)`,
                    }}
                  />
                  {/* Previous period marker */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${item.previous}%`, width: '2px',
                    background: 'rgba(255,255,255,0.3)',
                  }} aria-hidden="true" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px', padding: '0 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--color-text-muted)' }}>
            <div style={{ width: 12, height: 4, background: 'var(--gradient-primary)', borderRadius: 2 }} />
            Current period
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--color-text-muted)' }}>
            <div style={{ width: 2, height: 10, background: 'rgba(255,255,255,0.3)', borderRadius: 1 }} />
            Previous period
          </div>
        </div>
      </div>
    </div>
  );
}
