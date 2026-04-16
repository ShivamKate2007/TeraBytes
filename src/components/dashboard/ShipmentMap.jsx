/* ============================================================
   ShipmentMap — Interactive world map showing shipment positions
   ============================================================ */

import { useRef, useEffect, useState } from 'react';
import { Layers, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import LoadingSkeleton from '../common/LoadingSkeleton';
import RiskBadge from '../common/RiskBadge';
import { getRiskHeatmapColor, DARK_MAP_STYLE } from '../../services/mapHelpers';
import { RISK_COLORS, MAJOR_PORTS } from '../../utils/constants';
import { getRiskLevel } from '../../utils/formatters';

// Fallback SVG map (used when Google Maps API key is not configured)
function SVGWorldMap({ shipments = [] }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0d1422', overflow: 'hidden' }}>
      {/* Ocean base */}
      <svg viewBox="0 0 1000 500" style={{ width: '100%', height: '100%', opacity: 0.7 }}>
        {/* Simplified world continents */}
        <rect width="1000" height="500" fill="#0d1422" />
        {/* North America */}
        <path d="M 120 80 L 280 60 L 310 120 L 290 200 L 240 260 L 180 280 L 140 240 L 100 180 Z" fill="#1a2440" stroke="#2a3560" strokeWidth="0.5" />
        {/* South America */}
        <path d="M 200 280 L 280 270 L 300 360 L 260 440 L 220 460 L 190 420 L 175 360 Z" fill="#1a2440" stroke="#2a3560" strokeWidth="0.5" />
        {/* Europe */}
        <path d="M 440 60 L 540 50 L 560 110 L 520 150 L 460 160 L 430 120 Z" fill="#1a2440" stroke="#2a3560" strokeWidth="0.5" />
        {/* Africa */}
        <path d="M 450 160 L 560 150 L 580 280 L 540 400 L 490 420 L 440 380 L 420 280 Z" fill="#1a2440" stroke="#2a3560" strokeWidth="0.5" />
        {/* Asia */}
        <path d="M 550 50 L 820 40 L 870 120 L 840 200 L 760 220 L 640 200 L 570 170 L 540 120 Z" fill="#1a2440" stroke="#2a3560" strokeWidth="0.5" />
        {/* South/Southeast Asia */}
        <path d="M 640 200 L 760 200 L 800 270 L 760 310 L 700 300 L 640 260 Z" fill="#1a2440" stroke="#2a3560" strokeWidth="0.5" />
        {/* Australia */}
        <path d="M 780 310 L 900 300 L 920 380 L 880 420 L 820 430 L 770 400 Z" fill="#1a2440" stroke="#2a3560" strokeWidth="0.5" />

        {/* Route lines */}
        {[
          { x1: 180, y1: 240, x2: 460, y2: 100, risk: 85 },
          { x1: 460, y1: 100, x2: 690, y2: 210, risk: 45 },
          { x1: 240, y1: 100, x2: 690, y2: 210, risk: 30 },
          { x1: 690, y1: 210, x2: 810, y2: 350, risk: 20 },
          { x1: 460, y1: 100, x2: 490, y2: 300, risk: 65 },
        ].map((route, i) => (
          <line
            key={i}
            x1={route.x1} y1={route.y1} x2={route.x2} y2={route.y2}
            stroke={getRiskHeatmapColor(route.risk)}
            strokeWidth="1.5"
            strokeOpacity="0.6"
            strokeDasharray="4 2"
          />
        ))}

        {/* Port markers */}
        {MAJOR_PORTS.map((port) => {
          const x = ((port.lng + 180) / 360) * 1000;
          const y = ((90 - port.lat) / 180) * 500;
          return (
            <g key={port.id}>
              <circle cx={x} cy={y} r={5} fill="#6366f1" opacity="0.7" stroke="#a5b4fc" strokeWidth="1" />
              <circle cx={x} cy={y} r={2} fill="white" opacity="0.9" />
            </g>
          );
        })}

        {/* Shipment dots */}
        {shipments.slice(0, 30).map((ship, i) => {
          if (!ship.lat || !ship.lng) return null;
          const x = ((ship.lng + 180) / 360) * 1000;
          const y = ((90 - ship.lat) / 180) * 500;
          const level = getRiskLevel(ship.riskScore);
          const color = RISK_COLORS[level];
          return (
            <circle key={ship.id || i} cx={x} cy={y} r={4} fill={color} opacity="0.85" stroke="white" strokeWidth="0.8" />
          );
        })}
      </svg>

      {/* Legend */}
      <div className="map-legend">
        {[
          { label: 'Critical', color: RISK_COLORS.critical },
          { label: 'High', color: RISK_COLORS.high },
          { label: 'Medium', color: RISK_COLORS.medium },
          { label: 'Low', color: RISK_COLORS.low },
          { label: 'Port', color: '#6366f1' },
        ].map(({ label, color }) => (
          <div key={label} className="legend-item">
            <span className="legend-dot" style={{ background: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * @param {object} props
 * @param {Array} [props.shipments]
 * @param {boolean} [props.loading]
 * @param {function} [props.onShipmentClick]
 * @param {string} [props.selectedId]
 */
export default function ShipmentMap({ shipments = [], loading = false, onShipmentClick, selectedId }) {
  const [activeLayer, setActiveLayer] = useState('shipments');

  const layers = [
    { id: 'shipments', label: 'Shipments' },
    { id: 'heatmap', label: 'Risk Heat' },
    { id: 'routes', label: 'Routes' },
  ];

  if (loading) {
    return <LoadingSkeleton type="chart" height="420px" />;
  }

  return (
    <div className="map-card" role="region" aria-label="Global shipment map">
      {/* Header */}
      <div className="map-card-header">
        <div>
          <div className="card-title">Global Shipment Map</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {shipments.length > 0 ? `${shipments.length} active shipments` : 'Live vessel positions'}
          </div>
        </div>

        <div className="map-controls">
          {/* Layer tabs */}
          <div style={{ display: 'flex', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', padding: '2px', gap: '2px' }}>
            {layers.map(layer => (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                className={`chart-period-tab ${activeLayer === layer.id ? 'active' : ''}`}
                aria-pressed={activeLayer === layer.id}
              >
                {layer.label}
              </button>
            ))}
          </div>

          <button className="btn btn-secondary btn-sm" aria-label="Fullscreen map">
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Map viewport */}
      <div className="map-viewport" aria-label="World map with shipment positions">
        <SVGWorldMap shipments={shipments} />
      </div>
    </div>
  );
}
