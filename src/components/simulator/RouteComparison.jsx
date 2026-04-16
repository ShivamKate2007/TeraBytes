/* ============================================================
   RouteComparison — Side-by-side comparison of route options
   ============================================================ */

import { CheckCircle, Clock, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';
import RiskBadge from '../common/RiskBadge';
import { formatCurrency, formatDuration } from '../../utils/formatters';

const DEMO_ROUTES = [
  {
    id: 'primary',
    name: 'Primary Route',
    via: 'Suez Canal',
    transit: 18 * 24,
    cost: 4800,
    riskScore: 85,
    reliability: 72,
    co2: 245,
    recommended: false,
  },
  {
    id: 'alt1',
    name: 'Alternative A',
    via: 'Cape of Good Hope',
    transit: 32 * 24,
    cost: 6200,
    riskScore: 24,
    reliability: 94,
    co2: 312,
    recommended: true,
  },
  {
    id: 'alt2',
    name: 'Alternative B',
    via: 'Polar Route',
    transit: 22 * 24,
    cost: 5500,
    riskScore: 41,
    reliability: 87,
    co2: 198,
    recommended: false,
  },
];

const metrics = [
  { key: 'transit', label: 'Transit Time', icon: Clock, format: (v) => formatDuration(v) },
  { key: 'cost', label: 'Est. Cost', icon: DollarSign, format: (v) => formatCurrency(v) },
  { key: 'riskScore', label: 'Risk Score', icon: AlertTriangle, format: (v) => null },
  { key: 'reliability', label: 'Reliability', icon: TrendingUp, format: (v) => `${v}%` },
  { key: 'co2', label: 'CO₂ Emissions', icon: null, format: (v) => `${v} T` },
];

/**
 * @param {object} props
 * @param {Array} [props.routes]
 * @param {string} [props.selectedRouteId]
 * @param {function} [props.onSelectRoute]
 */
export default function RouteComparison({ routes = DEMO_ROUTES, selectedRouteId, onSelectRoute }) {
  return (
    <div className="route-comparison-card" role="region" aria-label="Route comparison">
      <div className="card-header">
        <div className="card-title">Route Comparison</div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          {routes.length} options
        </span>
      </div>

      <div className="route-comparison-grid">
        {routes.map((route) => {
          const isSelected = selectedRouteId === route.id;

          return (
            <div
              key={route.id}
              className={`route-option ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectRoute?.(route.id)}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelectRoute?.(route.id)}
              aria-label={`${route.name} via ${route.via}`}
            >
              {/* Route header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div className="route-option-name">{route.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    via {route.via}
                  </div>
                </div>
                {route.recommended && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '3px',
                    background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: '99px', padding: '2px 7px',
                    fontSize: '9px', fontWeight: 700, color: '#22c55e',
                    flexShrink: 0,
                  }}>
                    <CheckCircle size={9} />
                    Recommended
                  </span>
                )}
              </div>

              {/* Metrics */}
              {metrics.map(({ key, label, icon: Icon, format }) => (
                <div key={key} className="route-metric">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {Icon && <Icon size={10} style={{ opacity: 0.5 }} />}
                    {label}
                  </span>
                  {key === 'riskScore' ? (
                    <RiskBadge score={route[key]} size="sm" showScore />
                  ) : (
                    <span className="route-metric-val">{format(route[key])}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
