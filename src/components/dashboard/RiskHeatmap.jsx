/* ============================================================
   RiskHeatmap — Grid heatmap of disruption risk by region/route
   ============================================================ */

import { useState } from 'react';
import LoadingSkeleton from '../common/LoadingSkeleton';
import { getRiskHeatmapColor } from '../../services/mapHelpers';
import { getRiskLevel } from '../../utils/formatters';
import { RISK_COLORS } from '../../utils/constants';

const DEMO_DATA = {
  regions: ['Asia Pac', 'Europe', 'Americas', 'Mid East', 'Africa'],
  categories: ['Weather', 'Geo-pol', 'Port', 'Carrier', 'Customs'],
  values: [
    [72, 45, 28, 55, 33],
    [38, 82, 61, 29, 44],
    [55, 37, 90, 41, 67],
    [88, 63, 42, 75, 52],
    [41, 28, 37, 88, 71],
  ],
};

/**
 * @param {object} props
 * @param {object} [props.data] — { regions, categories, values }
 * @param {boolean} [props.loading]
 */
export default function RiskHeatmap({ data = DEMO_DATA, loading = false }) {
  const [tooltip, setTooltip] = useState(null);

  if (loading) {
    return <LoadingSkeleton type="chart" height="280px" />;
  }

  const { regions, categories, values } = data;

  return (
    <div className="chart-card" role="region" aria-label="Risk heatmap">
      {/* Header */}
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">Disruption Risk Heatmap</div>
          <div className="chart-card-subtitle">By region × disruption type</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '2px', background: RISK_COLORS.low, display: 'inline-block' }} />
            Low
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '2px', background: RISK_COLORS.medium, display: 'inline-block' }} />
            Med
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '2px', background: RISK_COLORS.critical, display: 'inline-block' }} />
            High
          </div>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="chart-body" style={{ overflowX: 'auto', position: 'relative' }}>
        <table
          style={{ borderCollapse: 'separate', borderSpacing: '3px', width: '100%' }}
          role="grid"
          aria-label="Risk heatmap grid"
        >
          <thead>
            <tr>
              <th style={{ width: 72, textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 500, paddingBottom: '6px' }}>
                Region ↓ / Type →
              </th>
              {categories.map((cat) => (
                <th
                  key={cat}
                  style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'center', paddingBottom: '6px' }}
                >
                  {cat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regions.map((region, ri) => (
              <tr key={region}>
                <td style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 500, paddingRight: '6px', whiteSpace: 'nowrap' }}>
                  {region}
                </td>
                {values[ri].map((val, ci) => {
                  const color = getRiskHeatmapColor(val);
                  const level = getRiskLevel(val);
                  const isHovered = tooltip?.ri === ri && tooltip?.ci === ci;
                  return (
                    <td key={ci} style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          width: '100%',
                          minWidth: 34,
                          height: 34,
                          background: color,
                          borderRadius: '5px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          fontWeight: 700,
                          color: val > 50 ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.7)',
                          cursor: 'pointer',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                          boxShadow: isHovered ? `0 0 12px ${color}80` : 'none',
                          fontFamily: 'var(--font-mono)',
                          position: 'relative',
                          zIndex: isHovered ? 2 : 1,
                        }}
                        onMouseEnter={() => setTooltip({ ri, ci, val, level, region, cat: categories[ci] })}
                        onMouseLeave={() => setTooltip(null)}
                        role="gridcell"
                        aria-label={`${region} ${categories[ci]}: risk score ${val} (${level})`}
                        tabIndex={0}
                      >
                        {val}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-primary)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: 'var(--shadow-md)',
              zIndex: 10,
            }}
            role="tooltip"
          >
            <strong>{tooltip.region}</strong> · {tooltip.cat}<br />
            Risk Score: <strong style={{ color: getRiskHeatmapColor(tooltip.val) }}>{tooltip.val}</strong>
            {' '}({tooltip.level})
          </div>
        )}
      </div>
    </div>
  );
}
