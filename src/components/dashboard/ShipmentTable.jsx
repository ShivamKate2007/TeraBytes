/* ============================================================
   ShipmentTable — Paginated, filterable shipments data table
   ============================================================ */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink, Filter } from 'lucide-react';
import RiskBadge from '../common/RiskBadge';
import StatusDot from '../common/StatusDot';
import LoadingSkeleton from '../common/LoadingSkeleton';
import { formatDate, formatETA, truncate } from '../../utils/formatters';
import { SHIPMENT_STATUS_LABELS } from '../../utils/constants';

const DEMO_SHIPMENTS = Array.from({ length: 10 }, (_, i) => ({
  id: `SHP-${String(1000 + i).padStart(5, '0')}`,
  vessel: ['Ever Given', 'MSC Oscar', 'CMA CGM Antoine', 'COSCO Shipping', 'Maersk Elba'][i % 5],
  origin: ['Shanghai', 'Singapore', 'Rotterdam', 'Los Angeles', 'Dubai'][i % 5],
  destination: ['Rotterdam', 'New York', 'Singapore', 'Tokyo', 'Mumbai'][i % 5],
  carrier: ['COSCO', 'MSC', 'CMA CGM', 'Maersk', 'Evergreen'][i % 5],
  status: ['in_transit', 'at_port', 'delayed', 'at_risk', 'in_transit'][i % 5],
  riskScore: [85, 42, 67, 91, 23, 54, 78, 31, 62, 88][i],
  eta: new Date(Date.now() + (i + 1) * 86400000 * 3).toISOString(),
  cargo: ['Electronics', 'Machinery', 'Chemicals', 'Textiles', 'Pharmaceuticals'][i % 5],
}));

function SortIcon({ field, sortBy, sortOrder }) {
  if (sortBy !== field) return <ChevronsUpDown size={12} opacity={0.3} />;
  return sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
}

const FILTERS = ['All', 'At Risk', 'Delayed', 'In Transit', 'At Port'];

/**
 * @param {object} props
 * @param {Array} [props.shipments]
 * @param {boolean} [props.loading]
 * @param {number} [props.totalCount]
 * @param {number} [props.page]
 * @param {number} [props.totalPages]
 * @param {function} [props.onPageChange]
 * @param {function} [props.onSort]
 */
export default function ShipmentTable({
  shipments = DEMO_SHIPMENTS,
  loading = false,
  totalCount,
  page = 1,
  totalPages = 1,
  onPageChange,
  onSort,
}) {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState('riskScore');
  const [sortOrder, setSortOrder] = useState('desc');
  const [activeFilter, setActiveFilter] = useState('All');

  const handleSort = (field) => {
    const newOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(field);
    setSortOrder(newOrder);
    onSort?.(field, newOrder);
  };

  const columns = [
    { key: 'id', label: 'ID', sortable: true, width: '110px' },
    { key: 'vessel', label: 'Vessel', sortable: true },
    { key: 'origin', label: 'Origin', sortable: false },
    { key: 'destination', label: 'Destination', sortable: false },
    { key: 'carrier', label: 'Carrier', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'riskScore', label: 'Risk', sortable: true, width: '90px' },
    { key: 'eta', label: 'ETA', sortable: true, width: '100px' },
    { key: 'actions', label: '', sortable: false, width: '40px' },
  ];

  if (loading) return <LoadingSkeleton type="table" rows={8} cols={6} />;

  return (
    <div className="shipment-table-card" role="region" aria-label="Shipment table">
      {/* Header */}
      <div className="table-card-header">
        <div>
          <div className="table-card-title">Active Shipments</div>
          {totalCount !== undefined && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {totalCount.toLocaleString()} total
            </div>
          )}
        </div>
        <div className="table-filters" role="tablist" aria-label="Filter shipments">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`table-filter-btn ${activeFilter === f ? 'active' : ''}`}
              onClick={() => setActiveFilter(f)}
              role="tab"
              aria-selected={activeFilter === f}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" aria-label="Shipments">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={col.sortable && sortBy === col.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                  scope="col"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {col.label}
                    {col.sortable && <SortIcon field={col.key} sortBy={sortBy} sortOrder={sortOrder} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shipments.map((ship) => {
              const eta = formatETA(ship.eta);
              const statusLabel = SHIPMENT_STATUS_LABELS[ship.status] || ship.status;
              const statusDotMap = {
                in_transit: 'active',
                at_port: 'idle',
                delayed: 'warning',
                delivered: 'online',
                at_risk: 'critical',
                cancelled: 'offline',
              };

              return (
                <tr
                  key={ship.id}
                  onClick={() => navigate(`/shipments/${ship.id}`)}
                  role="row"
                  aria-label={`Shipment ${ship.id}`}
                >
                  <td>
                    <span className="shipment-id">{ship.id}</span>
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {truncate(ship.vessel, 20)}
                  </td>
                  <td>{ship.origin}</td>
                  <td>{ship.destination}</td>
                  <td>{ship.carrier}</td>
                  <td>
                    <StatusDot status={statusDotMap[ship.status] || 'idle'} label={statusLabel} />
                  </td>
                  <td>
                    <RiskBadge score={ship.riskScore} showScore />
                  </td>
                  <td>
                    <span style={{ color: eta.status === 'delayed' ? 'var(--color-risk-critical)' : eta.status === 'at_risk' ? 'var(--color-risk-medium)' : 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                      {eta.label}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-ghost btn-icon"
                      onClick={(e) => { e.stopPropagation(); navigate(`/shipments/${ship.id}`); }}
                      aria-label={`View details for shipment ${ship.id}`}
                    >
                      <ExternalLink size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="table-pagination" role="navigation" aria-label="Table pagination">
          <span>Page {page} of {totalPages}</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              aria-label="Previous page"
            >
              Prev
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
