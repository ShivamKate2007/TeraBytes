/* ============================================================
   ImpactAnalysis — Projected financial and operational impact
   ============================================================ */

import { TrendingUp, TrendingDown, DollarSign, Package, Clock, AlertTriangle } from 'lucide-react';
import AnimatedCounter from '../common/AnimatedCounter';
import { formatCurrency, formatPercent } from '../../utils/formatters';

const DEMO_IMPACT = {
  revenueAtRisk: 4_200_000,
  shipmentsAffected: 127,
  avgDelayDays: 14.3,
  extraCost: 820_000,
  riskReduction: 62,
  co2Saving: 340,
};

/**
 * @param {object} props
 * @param {object} [props.impact]
 * @param {boolean} [props.hasResults]
 */
export default function ImpactAnalysis({ impact = DEMO_IMPACT, hasResults = true }) {
  const metrics = [
    {
      label: 'Revenue at Risk',
      value: impact.revenueAtRisk,
      format: (v) => `$${(v / 1_000_000).toFixed(1)}M`,
      suffix: '',
      sentiment: 'negative',
      icon: DollarSign,
      description: 'Shipments in disrupted zone',
    },
    {
      label: 'Shipments Affected',
      value: impact.shipmentsAffected,
      format: null,
      suffix: '',
      sentiment: 'negative',
      icon: Package,
      description: 'Require rerouting',
    },
    {
      label: 'Avg Delay',
      value: impact.avgDelayDays,
      format: null,
      suffix: 'd',
      decimals: 1,
      sentiment: 'negative',
      icon: Clock,
      description: 'Additional transit time',
    },
    {
      label: 'Extra Cost',
      value: impact.extraCost,
      format: (v) => `$${(v / 1000).toFixed(0)}K`,
      suffix: '',
      sentiment: 'negative',
      icon: TrendingUp,
      description: 'Alternate route surcharge',
    },
    {
      label: 'Risk Reduction',
      value: impact.riskReduction,
      format: null,
      suffix: '%',
      sentiment: 'positive',
      icon: AlertTriangle,
      description: 'With recommended route',
    },
    {
      label: 'CO₂ Saving',
      value: impact.co2Saving,
      format: null,
      suffix: 'T',
      sentiment: 'positive',
      icon: TrendingDown,
      description: 'vs. primary route',
    },
  ];

  return (
    <div className="impact-analysis-card" role="region" aria-label="Impact analysis">
      <div className="card-header">
        <div className="card-title">Impact Analysis</div>
        {!hasResults && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Run simulation to see results
          </span>
        )}
      </div>

      <div
        className="impact-metrics-grid"
        style={{
          opacity: hasResults ? 1 : 0.4,
          filter: hasResults ? 'none' : 'blur(2px)',
          transition: 'all 0.4s ease',
        }}
      >
        {metrics.map((m) => {
          const Icon = m.icon;
          const sentimentColor = m.sentiment === 'positive'
            ? 'var(--color-risk-low)'
            : 'var(--color-risk-critical)';

          return (
            <div
              key={m.label}
              className={`impact-metric ${m.sentiment}`}
              style={{ textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '6px',
                  background: m.sentiment === 'positive' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={13} color={sentimentColor} aria-hidden="true" />
                </div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  {m.label}
                </span>
              </div>

              <div className="impact-metric-value" style={{ color: sentimentColor, fontSize: 'var(--text-xl)' }}>
                {m.format ? (
                  <span>{m.format(m.value)}</span>
                ) : (
                  <AnimatedCounter
                    value={m.value}
                    decimals={m.decimals || 0}
                    suffix={m.suffix}
                    duration={1000}
                  />
                )}
              </div>

              <div className="impact-metric-label">{m.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
