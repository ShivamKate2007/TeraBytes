/* ============================================================
   CascadeGraph — Visual cascade impact graph for disruptions
   ============================================================ */

import { useState } from 'react';
import { GitBranch, AlertCircle } from 'lucide-react';
import LoadingSkeleton from '../common/LoadingSkeleton';
import { RISK_COLORS } from '../../utils/constants';
import { getRiskLevel } from '../../utils/formatters';

const DEMO_NODES = [
  { id: 'root', label: 'Shanghai Port Closure', type: 'disruption', riskScore: 95, x: 140, y: 20 },
  { id: 'n1', label: 'Vessel Rerouting', type: 'impact', riskScore: 78, x: 40, y: 100 },
  { id: 'n2', label: 'Capacity Crunch', type: 'impact', riskScore: 82, x: 240, y: 100 },
  { id: 'n3', label: 'Transit Delay +12d', type: 'impact', riskScore: 71, x: 0, y: 185 },
  { id: 'n4', label: 'Port Congestion', type: 'impact', riskScore: 88, x: 100, y: 185 },
  { id: 'n5', label: 'Rate Surge +40%', type: 'impact', riskScore: 65, x: 200, y: 185 },
  { id: 'n6', label: 'Inventory Shortage', type: 'impact', riskScore: 74, x: 280, y: 185 },
];

const DEMO_EDGES = [
  { from: 'root', to: 'n1' },
  { from: 'root', to: 'n2' },
  { from: 'n1', to: 'n3' },
  { from: 'n1', to: 'n4' },
  { from: 'n2', to: 'n5' },
  { from: 'n2', to: 'n6' },
];

function getNodeById(nodes, id) {
  return nodes.find((n) => n.id === id);
}

/**
 * @param {object} props
 * @param {Array} [props.nodes]
 * @param {Array} [props.edges]
 * @param {boolean} [props.loading]
 * @param {string} [props.title]
 */
export default function CascadeGraph({
  nodes = DEMO_NODES,
  edges = DEMO_EDGES,
  loading = false,
  title = 'Cascade Impact Graph',
}) {
  const [selectedNode, setSelectedNode] = useState(null);

  if (loading) {
    return <LoadingSkeleton type="chart" height="280px" />;
  }

  const NODE_W = 110;
  const NODE_H = 38;

  return (
    <div className="chart-card" role="region" aria-label="Cascade impact graph">
      {/* Header */}
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitBranch size={16} color="var(--color-accent-primary)" aria-hidden="true" />
            {title}
          </div>
          <div className="chart-card-subtitle">Downstream disruption propagation</div>
        </div>
      </div>

      {/* Graph SVG */}
      <div className="chart-body" style={{ overflow: 'auto' }}>
        <svg
          viewBox="0 0 390 260"
          style={{ width: '100%', minHeight: '220px', overflow: 'visible' }}
          role="img"
          aria-label={`Cascade graph showing ${nodes.length} nodes and ${edges.length} connections`}
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="rgba(148,163,184,0.4)" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((edge, i) => {
            const from = getNodeById(nodes, edge.from);
            const to = getNodeById(nodes, edge.to);
            if (!from || !to) return null;
            const x1 = from.x + NODE_W / 2;
            const y1 = from.y + NODE_H;
            const x2 = to.x + NODE_W / 2;
            const y2 = to.y;
            const mx = (x1 + x2) / 2;
            return (
              <path
                key={i}
                d={`M${x1},${y1} C${x1},${mx} ${x2},${mx} ${x2},${y2}`}
                fill="none"
                stroke="rgba(148,163,184,0.25)"
                strokeWidth="1.5"
                markerEnd="url(#arrowhead)"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const level = getRiskLevel(node.riskScore);
            const color = RISK_COLORS[level];
            const isSelected = selectedNode === node.id;
            const isRoot = node.type === 'disruption';

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedNode(isSelected ? null : node.id)}
                style={{ cursor: 'pointer' }}
                role="button"
                aria-label={`${node.label}: risk score ${node.riskScore}`}
                aria-pressed={isSelected}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedNode(isSelected ? null : node.id)}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx="6"
                  fill={isRoot ? `${color}25` : `${color}15`}
                  stroke={isSelected ? color : `${color}50`}
                  strokeWidth={isSelected ? 2 : 1.5}
                  style={{ filter: isSelected ? `drop-shadow(0 0 6px ${color}60)` : 'none', transition: 'all 0.2s ease' }}
                />
                <text
                  x={NODE_W / 2}
                  y={14}
                  textAnchor="middle"
                  fill={color}
                  fontSize="9.5"
                  fontWeight={isRoot ? '700' : '500'}
                  fontFamily="var(--font-sans)"
                >
                  {node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label}
                </text>
                <text
                  x={NODE_W / 2}
                  y={28}
                  textAnchor="middle"
                  fill="rgba(148,163,184,0.7)"
                  fontSize="8"
                  fontFamily="var(--font-mono)"
                >
                  Risk: {node.riskScore}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected node detail */}
        {selectedNode && (() => {
          const node = getNodeById(nodes, selectedNode);
          if (!node) return null;
          const level = getRiskLevel(node.riskScore);
          return (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              background: `${RISK_COLORS[level]}12`,
              border: `1px solid ${RISK_COLORS[level]}30`,
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-secondary)',
            }}>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                {node.label}
              </div>
              <div>Risk Score: <strong style={{ color: RISK_COLORS[level] }}>{node.riskScore}/100 ({level})</strong></div>
              <div style={{ marginTop: '2px' }}>Type: {node.type}</div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
