/* ============================================================
   WhatIfMap — Simulator map with disruption zone overlay + alt routes
   ============================================================ */

import { useState } from 'react';
import { Maximize2, RotateCcw } from 'lucide-react';
import { RISK_COLORS, MAJOR_PORTS } from '../../utils/constants';
import { getRiskHeatmapColor } from '../../services/mapHelpers';

const ROUTE_COLORS = {
  primary: '#3b82f6',
  alternate1: '#22c55e',
  alternate2: '#8b5cf6',
  disrupted: '#ef4444',
};

/**
 * @param {object} props
 * @param {object|null} [props.disruptionZone] — { lat, lng, radius, label }
 * @param {Array} [props.routes] — list of route objects to draw
 * @param {boolean} [props.loading]
 * @param {boolean} [props.simRunning]
 */
export default function WhatIfMap({ disruptionZone = null, routes = [], loading = false, simRunning = false }) {
  const [activeRoute, setActiveRoute] = useState(null);

  const defaultRoutes = [
    { id: 'primary', label: 'Primary Route (Disrupted)', color: ROUTE_COLORS.disrupted, dashed: true,
      path: [{ x: 150, y: 140 }, { x: 280, y: 110 }, { x: 380, y: 100 }, { x: 520, y: 95 }] },
    { id: 'alt1', label: 'Alternative Route A', color: ROUTE_COLORS.alternate1, dashed: false,
      path: [{ x: 150, y: 140 }, { x: 250, y: 190 }, { x: 380, y: 200 }, { x: 520, y: 95 }] },
    { id: 'alt2', label: 'Alternative Route B', color: ROUTE_COLORS.alternate2, dashed: false,
      path: [{ x: 150, y: 140 }, { x: 200, y: 250 }, { x: 350, y: 270 }, { x: 450, y: 200 }, { x: 520, y: 95 }] },
  ];

  const displayRoutes = routes.length > 0 ? routes : defaultRoutes;

  const pathToD = (path) => {
    const [start, ...rest] = path;
    return `M ${start.x} ${start.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(' ');
  };

  return (
    <div className="map-card" role="region" aria-label="What-if scenario map">
      <div className="map-card-header">
        <div>
          <div className="card-title">Scenario Map</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {simRunning ? '⚡ Running simulation…' : 'Configure scenario and run simulation'}
          </div>
        </div>
        <div className="map-controls">
          <button className="btn btn-secondary btn-sm" aria-label="Reset map view">
            <RotateCcw size={13} />
          </button>
          <button className="btn btn-secondary btn-sm" aria-label="Fullscreen">
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      <div className="map-viewport" style={{ height: '340px', position: 'relative', background: '#0d1422' }}>
        <svg viewBox="0 0 700 340" style={{ width: '100%', height: '100%' }}>
          {/* Ocean */}
          <rect width="700" height="340" fill="#0d1422" />

          {/* Simplified continent blobs */}
          <path d="M 80 60 L 200 45 L 220 120 L 200 200 L 160 210 L 110 180 Z" fill="#141d35" stroke="#1e2d4f" strokeWidth="0.5" />
          <path d="M 310 35 L 400 30 L 420 100 L 380 150 L 310 140 Z" fill="#141d35" stroke="#1e2d4f" strokeWidth="0.5" />
          <path d="M 380 140 L 430 130 L 440 220 L 400 270 L 365 250 Z" fill="#141d35" stroke="#1e2d4f" strokeWidth="0.5" />
          <path d="M 420 30 L 620 20 L 660 100 L 600 170 L 500 180 L 430 150 Z" fill="#141d35" stroke="#1e2d4f" strokeWidth="0.5" />
          <path d="M 560 170 L 640 160 L 660 240 L 620 280 L 560 270 Z" fill="#141d35" stroke="#1e2d4f" strokeWidth="0.5" />

          {/* Disruption zone */}
          {disruptionZone && (
            <circle
              cx={disruptionZone.x || 280}
              cy={disruptionZone.y || 110}
              r={disruptionZone.r || 45}
              fill="rgba(239,68,68,0.12)"
              stroke="rgba(239,68,68,0.5)"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            >
              <animate attributeName="r" values="42;48;42" dur="3s" repeatCount="indefinite" />
            </circle>
          )}

          {/* Default disruption zone */}
          {!disruptionZone && (
            <g>
              <circle cx="280" cy="110" r="42" fill="rgba(239,68,68,0.1)" stroke="rgba(239,68,68,0.4)" strokeWidth="1.5" strokeDasharray="4 2">
                <animate attributeName="r" values="40;46;40" dur="3s" repeatCount="indefinite" />
              </circle>
              <text x="280" y="95" textAnchor="middle" fill="rgba(239,68,68,0.8)" fontSize="9" fontWeight="600">
                Disruption Zone
              </text>
              <text x="280" y="108" textAnchor="middle" fill="rgba(239,68,68,0.6)" fontSize="8">
                Shanghai
              </text>
            </g>
          )}

          {/* Routes */}
          {displayRoutes.map((route) => (
            <path
              key={route.id}
              d={pathToD(route.path)}
              fill="none"
              stroke={route.color}
              strokeWidth={activeRoute === route.id ? 3 : 2}
              strokeOpacity={activeRoute && activeRoute !== route.id ? 0.3 : 0.8}
              strokeDasharray={route.dashed ? '6 3' : '0'}
              style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
              onClick={() => setActiveRoute(activeRoute === route.id ? null : route.id)}
              role="button"
              aria-label={route.label}
            />
          ))}

          {/* Port markers */}
          {[
            { x: 150, y: 140, label: 'Origin', color: '#6366f1' },
            { x: 280, y: 110, label: 'Shanghai', color: ROUTE_COLORS.disrupted },
            { x: 520, y: 95, label: 'Rotterdam', color: '#6366f1' },
          ].map((port) => (
            <g key={port.label}>
              <circle cx={port.x} cy={port.y} r="5" fill={port.color} opacity="0.85" stroke="white" strokeWidth="1" />
              <text x={port.x} y={port.y - 9} textAnchor="middle" fill={port.color} fontSize="8" fontWeight="600">{port.label}</text>
            </g>
          ))}
        </svg>

        {/* Route legend */}
        <div style={{
          position: 'absolute', bottom: '12px', right: '12px',
          background: 'var(--color-bg-glass)', backdropFilter: 'blur(8px)',
          border: '1px solid var(--color-border-glass)', borderRadius: 'var(--radius-md)',
          padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px',
        }}>
          {displayRoutes.map((route) => (
            <div
              key={route.id}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', opacity: activeRoute && activeRoute !== route.id ? 0.4 : 1 }}
              onClick={() => setActiveRoute(activeRoute === route.id ? null : route.id)}
            >
              <div style={{ width: 20, height: 2, background: route.color, borderRadius: 1, borderTop: route.dashed ? '2px dashed ' + route.color : undefined, background: route.dashed ? 'none' : route.color }} />
              <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>{route.label}</span>
            </div>
          ))}
        </div>

        {/* Loading overlay */}
        {simRunning && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(10,14,26,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}>
            <div style={{ textAlign: 'center', color: 'var(--color-text-primary)' }}>
              <div className="spinner lg" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Running simulation…</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
