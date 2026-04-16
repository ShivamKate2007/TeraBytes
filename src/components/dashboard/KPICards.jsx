/* ============================================================
   KPICards — Top-level KPI metrics row on the Dashboard
   ============================================================ */

import { TrendingUp, TrendingDown, Ship, AlertTriangle, Clock, CheckCircle, Activity } from 'lucide-react';
import AnimatedCounter from '../common/AnimatedCounter';
import LoadingSkeleton from '../common/LoadingSkeleton';
import { formatPercent } from '../../utils/formatters';

const DEFAULT_KPIS = [
  {
    id: 'total_shipments',
    label: 'Active Shipments',
    value: 1284,
    delta: 3.2,
    deltaDir: 'up',
    format: 'number',
    icon: Ship,
    iconBg: 'rgba(59, 130, 246, 0.15)',
    iconColor: '#3b82f6',
  },
  {
    id: 'at_risk',
    label: 'At Risk',
    value: 47,
    delta: 12.5,
    deltaDir: 'up',
    format: 'number',
    icon: AlertTriangle,
    iconBg: 'rgba(239, 68, 68, 0.15)',
    iconColor: '#ef4444',
    riskClass: 'risk-critical',
  },
  {
    id: 'avg_delay',
    label: 'Avg Delay (hrs)',
    value: 18.4,
    delta: 5.8,
    deltaDir: 'down',
    format: 'decimal',
    icon: Clock,
    iconBg: 'rgba(249, 115, 22, 0.15)',
    iconColor: '#f97316',
  },
  {
    id: 'on_time',
    label: 'On-Time Rate',
    value: 86.3,
    delta: 1.2,
    deltaDir: 'up',
    format: 'percent',
    icon: CheckCircle,
    iconBg: 'rgba(34, 197, 94, 0.15)',
    iconColor: '#22c55e',
  },
  {
    id: 'disruptions',
    label: 'Disruptions',
    value: 12,
    delta: 2,
    deltaDir: 'down',
    format: 'number',
    icon: Activity,
    iconBg: 'rgba(139, 92, 246, 0.15)',
    iconColor: '#8b5cf6',
  },
];

/**
 * @param {object} props
 * @param {Array} [props.kpis]
 * @param {boolean} [props.loading]
 */
export default function KPICards({ kpis: kpisProp = null, loading = false }) {
  const kpis = Array.isArray(kpisProp) ? kpisProp : DEFAULT_KPIS;
  if (loading) {
    return (
      <div className="kpi-cards-grid">
        {Array.from({ length: 5 }).map((_, i) => (
          <LoadingSkeleton key={i} type="kpi" />
        ))}
      </div>
    );
  }

  return (
    <div className="kpi-cards-grid" role="region" aria-label="Key Performance Indicators">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        const isUp = kpi.deltaDir === 'up';
        const DeltaIcon = isUp ? TrendingUp : TrendingDown;

        // For on-time rate, higher is better; for at_risk and avg_delay, lower is better
        const positiveMetrics = ['on_time'];
        const isGood = positiveMetrics.includes(kpi.id) ? isUp : !isUp;
        const deltaClass = isGood ? 'down' : 'up'; // 'down' = green, 'up' = red in context

        const formatValue = () => {
          if (kpi.format === 'percent') return null; // handled by AnimatedCounter suffix
          if (kpi.format === 'decimal') return null;
          return null;
        };

        return (
          <article
            key={kpi.id}
            className={`kpi-card ${kpi.riskClass || ''}`}
            aria-label={`${kpi.label}: ${kpi.value}`}
          >
            <div className="kpi-card-header">
              <span className="kpi-card-label">{kpi.label}</span>
              {Icon && (
                <div
                  className="kpi-card-icon"
                  style={{ background: kpi.iconBg }}
                  aria-hidden="true"
                >
                  <Icon size={15} color={kpi.iconColor} />
                </div>
              )}
            </div>

            <div className="kpi-card-value" aria-live="polite">
              <AnimatedCounter
                value={kpi.value}
                duration={1200}
                decimals={kpi.format === 'decimal' ? 1 : 0}
                suffix={kpi.format === 'percent' ? '%' : ''}
              />
            </div>

            <div className={`kpi-card-delta ${deltaClass}`} aria-label={`Change: ${kpi.delta} ${isUp ? 'increase' : 'decrease'}`}>
              <DeltaIcon size={12} aria-hidden="true" />
              <span>{Math.abs(kpi.delta)}{kpi.format === 'percent' ? 'pp' : ''} vs last week</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
