/* ============================================================
   ShipmentDetail Page — Single shipment deep-dive view
   ============================================================ */

import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MapPin, Calendar, Ship, AlertTriangle, Clock, CheckCircle, ExternalLink } from 'lucide-react';
import RiskBadge from '../components/common/RiskBadge';
import StatusDot from '../components/common/StatusDot';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import AnimatedCounter from '../components/common/AnimatedCounter';
import { useShipmentDetail } from '../hooks/useShipments';
import { formatDate, formatDateTime, formatRelativeTime, formatETA, formatDuration, formatCurrency } from '../utils/formatters';
import { SHIPMENT_STATUS_LABELS } from '../utils/constants';

const TIMELINE_ICONS = {
  created: CheckCircle,
  departed: Ship,
  in_transit: MapPin,
  port_arrived: Package,
  customs: AlertTriangle,
  delayed: Clock,
  delivered: CheckCircle,
};

// Demo data used when no real API is connected
const DEMO_SHIPMENT = {
  id: 'SHP-01004',
  vessel: 'COSCO Shipping Universe',
  carrier: 'COSCO',
  origin: { name: 'Shanghai', code: 'CNSHA', country: 'CN', lat: 31.23, lng: 121.47 },
  destination: { name: 'Rotterdam', code: 'NLRTM', country: 'NL', lat: 51.92, lng: 4.48 },
  status: 'at_risk',
  riskScore: 91,
  cargo: 'Electronics',
  containers: 142,
  weight: 1840,
  value: 12_400_000,
  departedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  eta: new Date(Date.now() + 4 * 86400000).toISOString(),
  currentLat: 14.5,
  currentLng: 68.3,
  currentPort: 'Arabian Sea',
  riskFactors: [
    { type: 'Geopolitical', description: 'Red Sea conflict zone diversion', severity: 'critical', score: 92 },
    { type: 'Weather', description: 'Tropical storm risk en route', severity: 'medium', score: 55 },
    { type: 'Port Congestion', description: 'Rotterdam dwell time elevated', severity: 'high', score: 71 },
  ],
};

const DEMO_TIMELINE = [
  { id: 't1', event: 'created', label: 'Booking Confirmed', location: 'Shanghai', timestamp: new Date(Date.now() - 12 * 86400000).toISOString(), status: 'done' },
  { id: 't2', event: 'departed', label: 'Vessel Departed', location: 'Port of Shanghai', timestamp: new Date(Date.now() - 8 * 86400000).toISOString(), status: 'done' },
  { id: 't3', event: 'in_transit', label: 'Passing Singapore Strait', location: 'Singapore', timestamp: new Date(Date.now() - 5 * 86400000).toISOString(), status: 'done' },
  { id: 't4', event: 'delayed', label: 'Route Change — Red Sea Bypass', location: 'Arabian Sea', timestamp: new Date(Date.now() - 2 * 86400000).toISOString(), status: 'alert' },
  { id: 't5', event: 'port_arrived', label: 'Expected Rotterdam Arrival', location: 'Rotterdam', timestamp: new Date(Date.now() + 4 * 86400000).toISOString(), status: 'pending' },
  { id: 't6', event: 'delivered', label: 'Final Delivery', location: 'Amsterdam DC', timestamp: new Date(Date.now() + 6 * 86400000).toISOString(), status: 'pending' },
];

export default function ShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Try to load from API, fall back to demo data
  const { shipment: apiShipment, timeline: apiTimeline, loading, error } = useShipmentDetail(id);
  const shipment = apiShipment || DEMO_SHIPMENT;
  const timeline = (apiTimeline?.length > 0 ? apiTimeline : DEMO_TIMELINE);

  const eta = formatETA(shipment.eta);
  const statusLabel = SHIPMENT_STATUS_LABELS[shipment.status] || shipment.status;
  const statusDotMap = { in_transit: 'active', at_port: 'idle', delayed: 'warning', delivered: 'online', at_risk: 'critical', cancelled: 'offline' };

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ color: 'var(--color-text-primary)', marginBottom: '8px' }}>Shipment Not Found</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button>
      </div>
    );
  }

  return (
    <>
      {/* Back button */}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => navigate(-1)}
        style={{ marginBottom: 'var(--space-4)' }}
        aria-label="Go back"
      >
        <ArrowLeft size={14} />
        Back
      </button>

      {loading ? (
        <LoadingSkeleton type="card" height="400px" />
      ) : (
        <>
          {/* Page Header */}
          <div className="page-header" style={{ alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <h1 className="page-title" style={{ fontSize: 'var(--text-2xl)' }}>
                  {shipment.id}
                </h1>
                <RiskBadge score={shipment.riskScore} showScore />
                <StatusDot status={statusDotMap[shipment.status] || 'idle'} label={statusLabel} />
              </div>
              <p className="page-subtitle">
                {shipment.vessel} · {shipment.origin.name} → {shipment.destination.name}
              </p>
            </div>
            <div className="page-actions">
              <button className="btn btn-secondary btn-sm" aria-label="View on map">
                <MapPin size={13} />
                Track on Map
              </button>
              <button className="btn btn-primary btn-sm" aria-label="Run scenario for this shipment">
                <ExternalLink size={13} />
                Run Scenario
              </button>
            </div>
          </div>

          {/* Main content grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 320px', gap: 'var(--space-5)' }}>
            {/* Shipment info */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Shipment Details</div>
              </div>
              <div className="card-body">
                {[
                  { icon: Ship, label: 'Vessel', value: shipment.vessel },
                  { icon: Package, label: 'Carrier', value: shipment.carrier },
                  { icon: MapPin, label: 'Origin', value: `${shipment.origin.name} (${shipment.origin.code})` },
                  { icon: MapPin, label: 'Destination', value: `${shipment.destination.name} (${shipment.destination.code})` },
                  { icon: Package, label: 'Cargo', value: shipment.cargo },
                  { icon: Package, label: 'Containers', value: `${shipment.containers} TEU` },
                  { icon: Calendar, label: 'Departed', value: formatDateTime(shipment.departedAt) },
                  { icon: Clock, label: 'ETA', value: eta.label },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-primary)', fontSize: 'var(--text-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)' }}>
                      <Icon size={13} aria-hidden="true" />
                      {label}
                    </div>
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk factors */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Risk Factors</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Overall:</span>
                  <RiskBadge score={shipment.riskScore} showScore />
                </div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {shipment.riskFactors?.map((factor, i) => (
                  <div key={i} style={{
                    padding: '12px', borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)' }}>
                        {factor.type}
                      </span>
                      <RiskBadge score={factor.score} size="sm" showScore />
                    </div>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0. }}>
                      {factor.description}
                    </p>
                    <div style={{ marginTop: '8px', height: 4, background: 'var(--color-bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${factor.score}%`, borderRadius: 2, background: factor.severity === 'critical' ? 'var(--color-risk-critical)' : factor.severity === 'high' ? 'var(--color-risk-high)' : 'var(--color-risk-medium)', transition: 'width 1s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Journey Timeline</div>
              </div>
              <div className="card-body">
                <div style={{ position: 'relative', paddingLeft: '20px' }}>
                  {/* Vertical line */}
                  <div style={{ position: 'absolute', left: '6px', top: '8px', bottom: '8px', width: '2px', background: 'var(--color-border-primary)' }} />

                  {timeline.map((event, i) => {
                    const isPast = event.status === 'done';
                    const isAlert = event.status === 'alert';
                    const dotColor = isAlert ? 'var(--color-risk-high)' : isPast ? 'var(--color-risk-low)' : 'var(--color-border-primary)';

                    return (
                      <div key={event.id} style={{ position: 'relative', marginBottom: '20px', paddingLeft: '12px' }}>
                        {/* Dot */}
                        <div style={{ position: 'absolute', left: '-14px', top: '3px', width: '10px', height: '10px', borderRadius: '50%', background: dotColor, border: '2px solid var(--color-bg-primary)', zIndex: 1 }} />
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: isPast || isAlert ? 'var(--color-text-primary)' : 'var(--color-text-muted)', marginBottom: '2px' }}>
                          {event.label}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                          {event.location} · {formatRelativeTime(event.timestamp)}
                        </div>
                        {isAlert && (
                          <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--color-risk-high)' }}>
                            ⚠ Disruption event
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Financial summary */}
          <div className="card" style={{ marginTop: 'var(--space-5)' }}>
            <div className="card-header">
              <div className="card-title">Financial Summary</div>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
                {[
                  { label: 'Cargo Value', value: formatCurrency(shipment.value) },
                  { label: 'Containers', value: `${shipment.containers} TEU` },
                  { label: 'Weight', value: `${shipment.weight?.toLocaleString()} T` },
                  { label: 'Transit Left', value: formatDuration((new Date(shipment.eta) - new Date()) / 60000) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ textAlign: 'center', padding: '16px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-primary)' }}>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                      {value}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
