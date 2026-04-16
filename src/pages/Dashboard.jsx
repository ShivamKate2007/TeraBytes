/* ============================================================
   Dashboard Page — Main overview with KPIs, Map, Table, Alerts
   ============================================================ */

import { useState, useCallback } from 'react';
import { Download, SlidersHorizontal } from 'lucide-react';
import KPICards from '../components/dashboard/KPICards';
import ShipmentMap from '../components/dashboard/ShipmentMap';
import AlertFeed from '../components/dashboard/AlertFeed';
import ShipmentTable from '../components/dashboard/ShipmentTable';
import RiskHeatmap from '../components/dashboard/RiskHeatmap';
import CascadeGraph from '../components/dashboard/CascadeGraph';
import { useShipments } from '../hooks/useShipments';
import { useAlerts } from '../hooks/useAlerts';
import '../styles/dashboard.css';

export default function Dashboard() {
  const [mapSelectedId, setMapSelectedId] = useState(null);

  const {
    shipments,
    loading: shipmentsLoading,
    kpis,
    page,
    setPage,
    totalPages,
    totalCount,
  } = useShipments({ autoRefresh: true });

  const {
    alerts,
    loading: alertsLoading,
    markRead,
    dismiss,
    markAllRead,
  } = useAlerts({ autoRefresh: true });

  const handleShipmentClick = useCallback((shipment) => {
    setMapSelectedId(shipment.id);
  }, []);

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Supply Chain{' '}
            <span className="glow-text">Risk Dashboard</span>
          </h1>
          <p className="page-subtitle">
            Real-time disruption monitoring · {totalCount > 0 ? `${totalCount.toLocaleString()} active shipments` : 'Loading shipments…'}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" aria-label="Filter dashboard">
            <SlidersHorizontal size={13} />
            Filters
          </button>
          <button className="btn btn-secondary btn-sm" aria-label="Export dashboard data">
            <Download size={13} />
            Export
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <section aria-label="Key metrics" style={{ marginBottom: 'var(--space-5)' }}>
        <KPICards kpis={kpis} loading={shipmentsLoading} />
      </section>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Map */}
        <div className="dashboard-map-section">
          <ShipmentMap
            shipments={shipments}
            loading={shipmentsLoading}
            onShipmentClick={handleShipmentClick}
            selectedId={mapSelectedId}
          />
        </div>

        {/* Alert Feed */}
        <div className="dashboard-alert-section">
          <AlertFeed
            alerts={alerts}
            loading={alertsLoading}
            onMarkRead={markRead}
            onDismiss={dismiss}
            onMarkAllRead={markAllRead}
          />
        </div>

        {/* Shipment Table */}
        <div className="dashboard-table-section">
          <ShipmentTable
            shipments={shipments}
            loading={shipmentsLoading}
            totalCount={totalCount}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>

        {/* Risk Heatmap */}
        <div className="dashboard-heatmap-section">
          <RiskHeatmap loading={shipmentsLoading} />
        </div>

        {/* Cascade Graph */}
        <div className="dashboard-cascade-section">
          <CascadeGraph />
        </div>
      </div>
    </>
  );
}
