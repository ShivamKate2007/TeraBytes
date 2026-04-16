/* ============================================================
   RouteRiskChart — Radar / bar chart for route risk profiles
   ============================================================ */

import { useState } from 'react';
import { RISK_COLORS, CHART_COLORS } from '../../utils/constants';
import { getRiskLevel } from '../../utils/formatters';
import RiskBadge from '../common/RiskBadge';

const DEMO_ROUTES = [
  { id: 'r1', name: 'Asia–Europe (Suez)', scores: { weather: 45, geopol: 88, port: 72, carrier: 35, customs: 42 }, overall: 76 },
  { id: 'r2', name: 'Trans-Pacific', scores: { weather: 55, geopol: 30, port: 61, carrier: 28, customs: 35 }, overall: 52 },
  { id: 'r3', name: 'Asia–Europe (Cape)', scores: { weather: 72, geopol: 18, port: 25, carrier: 30, customs: 20 }, overall: 38 },
  { id: 'r4', name: 'Europe–Americas', scores: { weather: 38, geopol: 22, port: 45, carrier: 32, customs: 40 }, overall: 42 },
  { id: 'r5', name: 'Intra-Asia', scores: { weather: 50, geopol: 42, port: 68, carrier: 40, customs: 55 }, overall: 61 },
];

const DIMENSIONS = [
  { key: 'weather', label: 'Weather' },
  { key: 'geopol', label: 'Geo-Pol' },
  { key: 'port', label: 'Port' },
  { key: 'carrier', label: 'Carrier' },
  { key: 'customs', label: 'Customs' },
];

function RadarChart({ route, size = 180 }) {
  const center = size / 2;
  const radius = size * 0.35;
  const n = DIMENSIONS.length;

  const angleStep = (2 * Math.PI) / n;
  const getPoint = (i, r) => ({
    x: center + r * Math.cos(angleStep * i - Math.PI / 2),
    y: center + r * Math.sin(angleStep * i - Math.PI / 2),
  });

  const level = getRiskLevel(route.overall);
  const color = RISK_COLORS[level];

  const outerPoints = DIMENSIONS.map((_, i) => getPoint(i, radius));
  const dataPoints = DIMENSIONS.map((d, i) => {
    const val = route.scores[d.key] || 0;
    return getPoint(i, (val / 100) * radius);
  });

  const toPolygon = (pts) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {/* Grid circles */}
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon key={r} points={toPolygon(outerPoints.map((_, i) => getPoint(i, r * radius)))} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}

      {/* Axis lines */}
      {outerPoints.map((p, i) => (
        <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      ))}

      {/* Data polygon */}
      <polygon
        points={toPolygon(dataPoints)}
        fill={`${color}25`}
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} />
      ))}

      {/* Labels */}
      {DIMENSIONS.map((d, i) => {
        const p = getPoint(i, radius + 16);
        return (
          <text key={d.key} x={p.x} y={p.y + 3} textAnchor="middle" fill="rgba(148,163,184,0.6)" fontSize="8" fontFamily="var(--font-sans)">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * @param {object} props
 * @param {Array} [props.routes]
 * @param {boolean} [props.loading]
 */
export default function RouteRiskChart({ routes = DEMO_ROUTES, loading = false }) {
  const [selectedRoute, setSelectedRoute] = useState(routes[0]?.id);

  const activeRoute = routes.find((r) => r.id === selectedRoute) || routes[0];

  return (
    <div className="chart-card" role="region" aria-label="Route risk profile chart">
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">Route Risk Profiles</div>
          <div className="chart-card-subtitle">Multi-dimensional risk breakdown</div>
        </div>
      </div>

      <div className="chart-body" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Route list */}
        <div className="route-risk-list" style={{ flex: 1, minWidth: 0 }}>
          {routes.map((route) => {
            const level = getRiskLevel(route.overall);
            const color = RISK_COLORS[level];
            const isActive = selectedRoute === route.id;

            return (
              <div
                key={route.id}
                className="route-risk-item"
                style={{
                  background: isActive ? `${color}10` : 'transparent',
                  borderColor: isActive ? `${color}40` : 'var(--color-border-primary)',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedRoute(route.id)}
                role="button"
                aria-pressed={isActive}
                aria-label={`${route.name}: overall risk ${route.overall}`}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedRoute(route.id)}
              >
                <div className="route-risk-name" style={{ color: isActive ? 'var(--color-text-primary)' : undefined }}>
                  {route.name}
                </div>
                <RiskBadge score={route.overall} size="sm" showDot={false} />
                <span className="route-risk-score" style={{ color }}>{route.overall}</span>
              </div>
            );
          })}
        </div>

        {/* Radar chart for selected route */}
        {activeRoute && (
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <RadarChart route={activeRoute} size={170} />
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
              {activeRoute.name}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
