/* ============================================================
   DisruptionChart — Time series of disruption events
   ============================================================ */

import { useState } from 'react';
import { CHART_COLORS, TIME_PERIODS } from '../../utils/constants';

// Generate demo sparkline data
function generateData(points = 30, base = 40, variance = 25) {
  return Array.from({ length: points }, (_, i) => ({
    x: i,
    y: Math.max(0, Math.min(100, base + (Math.random() - 0.5) * variance * 2 + Math.sin(i / 5) * 10)),
  }));
}

const SERIES = [
  { id: 'weather', label: 'Weather Events', color: CHART_COLORS.accent, data: generateData(30, 35, 20) },
  { id: 'geopolitical', label: 'Geopolitical', color: CHART_COLORS.danger, data: generateData(30, 45, 30) },
  { id: 'port', label: 'Port Disruptions', color: CHART_COLORS.warning, data: generateData(30, 55, 25) },
  { id: 'carrier', label: 'Carrier Issues', color: CHART_COLORS.secondary, data: generateData(30, 30, 15) },
];

function SVGLineChart({ series, width = 500, height = 200 }) {
  const [hovered, setHovered] = useState(null);
  const pad = { t: 16, r: 16, b: 32, l: 36 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const allY = series.flatMap((s) => s.data.map((d) => d.y));
  const maxY = Math.ceil(Math.max(...allY) / 10) * 10;
  const minY = 0;

  const toX = (i, n) => pad.l + (i / (n - 1)) * innerW;
  const toY = (v) => pad.t + innerH - ((v - minY) / (maxY - minY)) * innerH;

  const toPath = (data) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i, data.length).toFixed(1)} ${toY(d.y).toFixed(1)}`).join(' ');

  const toArea = (data, color) => {
    const line = toPath(data);
    const last = data[data.length - 1];
    const first = data[0];
    return (
      `${line} L ${toX(data.length - 1, data.length)} ${toY(minY)} L ${toX(0, data.length)} ${toY(minY)} Z`
    );
  };

  const yTicks = [0, 25, 50, 75, 100];
  const xLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].slice(0, Math.ceil(30 / 2));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', overflow: 'visible' }}
      role="img"
      aria-label="Disruption trend chart"
    >
      <defs>
        {series.map((s) => (
          <linearGradient key={s.id} id={`grad-${s.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
          </linearGradient>
        ))}
      </defs>

      {/* Grid lines */}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line x1={pad.l} y1={toY(tick)} x2={pad.l + innerW} y2={toY(tick)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={pad.l - 5} y={toY(tick) + 4} textAnchor="end" fill="rgba(148,163,184,0.5)" fontSize="9" fontFamily="var(--font-mono)">
            {tick}
          </text>
        </g>
      ))}

      {/* Area + Line */}
      {series.map((s) => (
        <g key={s.id}>
          <path d={toArea(s.data)} fill={`url(#grad-${s.id})`} />
          <path d={toPath(s.data)} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}

      {/* X-axis labels */}
      {xLabels.map((label, i) => (
        <text key={i} x={toX(i * 2, 30)} y={height - 8} textAnchor="middle" fill="rgba(148,163,184,0.4)" fontSize="9" fontFamily="var(--font-mono)">
          {label}
        </text>
      ))}
    </svg>
  );
}

/**
 * @param {object} props
 * @param {Array} [props.series]
 * @param {boolean} [props.loading]
 */
export default function DisruptionChart({ series = SERIES, loading = false }) {
  const [activePeriod, setActivePeriod] = useState('30d');
  const [hiddenSeries, setHiddenSeries] = useState(new Set());

  const toggleSeries = (id) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleSeries = series.filter((s) => !hiddenSeries.has(s.id));

  return (
    <div className="chart-card" role="region" aria-label="Disruption trend chart">
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">Disruption Trends</div>
          <div className="chart-card-subtitle">Frequency by type over time</div>
        </div>
        <div className="chart-period-tabs" role="tablist" aria-label="Time period">
          {TIME_PERIODS.map((p) => (
            <button
              key={p.id}
              className={`chart-period-tab ${activePeriod === p.id ? 'active' : ''}`}
              onClick={() => setActivePeriod(p.id)}
              role="tab"
              aria-selected={activePeriod === p.id}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-body">
        <div className="chart-viewport" style={{ padding: '8px 0' }}>
          <SVGLineChart series={visibleSeries} />
        </div>

        {/* Legend */}
        <div className="chart-legend" role="list" aria-label="Chart series">
          {series.map((s) => {
            const hidden = hiddenSeries.has(s.id);
            return (
              <button
                key={s.id}
                className="chart-legend-item"
                onClick={() => toggleSeries(s.id)}
                style={{
                  opacity: hidden ? 0.4 : 1,
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '2px 4px',
                }}
                role="listitem"
                aria-pressed={!hidden}
                aria-label={`Toggle ${s.label} series`}
              >
                <span className="chart-legend-color" style={{ background: s.color }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
