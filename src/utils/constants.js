/* ============================================================
   RISK THRESHOLDS, COLORS, AND APP-WIDE CONSTANTS
   ============================================================ */

// ─── Risk Score Thresholds ────────────────────────────────────
export const RISK_THRESHOLDS = {
  CRITICAL: 80,   // >= 80 → critical
  HIGH: 60,       // >= 60 → high
  MEDIUM: 40,     // >= 40 → medium
  LOW: 0,         // >= 0  → low
};

// ─── Risk Level Labels ────────────────────────────────────────
export const RISK_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  NONE: 'none',
};

// ─── Risk Colors (CSS-compatible) ────────────────────────────
export const RISK_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  none: '#6b7280',
};

export const RISK_BG_COLORS = {
  critical: 'rgba(239, 68, 68, 0.12)',
  high: 'rgba(249, 115, 22, 0.12)',
  medium: 'rgba(234, 179, 8, 0.12)',
  low: 'rgba(34, 197, 94, 0.12)',
  none: 'rgba(107, 114, 128, 0.12)',
};

export const RISK_BORDER_COLORS = {
  critical: 'rgba(239, 68, 68, 0.3)',
  high: 'rgba(249, 115, 22, 0.3)',
  medium: 'rgba(234, 179, 8, 0.3)',
  low: 'rgba(34, 197, 94, 0.3)',
  none: 'rgba(107, 114, 128, 0.3)',
};

// ─── Shipment Status ─────────────────────────────────────────
export const SHIPMENT_STATUS = {
  IN_TRANSIT: 'in_transit',
  AT_PORT: 'at_port',
  DELAYED: 'delayed',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  AT_RISK: 'at_risk',
};

export const SHIPMENT_STATUS_LABELS = {
  in_transit: 'In Transit',
  at_port: 'At Port',
  delayed: 'Delayed',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  at_risk: 'At Risk',
};

export const SHIPMENT_STATUS_COLORS = {
  in_transit: '#3b82f6',
  at_port: '#6366f1',
  delayed: '#f97316',
  delivered: '#22c55e',
  cancelled: '#6b7280',
  at_risk: '#ef4444',
};

// ─── Alert Types ──────────────────────────────────────────────
export const ALERT_TYPES = {
  PORT_CONGESTION: 'port_congestion',
  WEATHER: 'weather',
  GEOPOLITICAL: 'geopolitical',
  CUSTOMS: 'customs',
  CARRIER: 'carrier',
  ROUTE_CHANGE: 'route_change',
  DELAY: 'delay',
};

export const ALERT_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info',
};

// ─── Disruption Types for Simulator ──────────────────────────
export const DISRUPTION_TYPES = [
  { id: 'port_closure', label: 'Port Closure', icon: 'Anchor' },
  { id: 'weather_event', label: 'Severe Weather', icon: 'CloudLightning' },
  { id: 'geopolitical', label: 'Geopolitical Crisis', icon: 'Globe' },
  { id: 'customs_delay', label: 'Customs Delay', icon: 'FileWarning' },
  { id: 'carrier_failure', label: 'Carrier Failure', icon: 'Ship' },
  { id: 'labor_strike', label: 'Labor Strike', icon: 'Users' },
  { id: 'capacity_crunch', label: 'Capacity Crunch', icon: 'Package' },
];

// ─── Major Ports / Trade Routes ───────────────────────────────
export const MAJOR_PORTS = [
  { id: 'CNSHA', name: 'Shanghai', country: 'CN', lat: 31.2304, lng: 121.4737 },
  { id: 'SGSIN', name: 'Singapore', country: 'SG', lat: 1.3521, lng: 103.8198 },
  { id: 'NLRTM', name: 'Rotterdam', country: 'NL', lat: 51.9244, lng: 4.4777 },
  { id: 'USLA', name: 'Los Angeles', country: 'US', lat: 33.7701, lng: -118.1937 },
  { id: 'AEDXB', name: 'Dubai', country: 'AE', lat: 25.2632, lng: 55.3128 },
  { id: 'JPOSA', name: 'Osaka', country: 'JP', lat: 34.6937, lng: 135.5023 },
  { id: 'DEHAM', name: 'Hamburg', country: 'DE', lat: 53.5753, lng: 10.0153 },
  { id: 'USNYK', name: 'New York', country: 'US', lat: 40.6643, lng: -74.0054 },
  { id: 'INMAA', name: 'Mumbai', country: 'IN', lat: 18.9220, lng: 72.8347 },
  { id: 'BRSSZ', name: 'Santos', country: 'BR', lat: -23.9536, lng: -46.3339 },
];

// ─── Chart Colors ─────────────────────────────────────────────
export const CHART_COLORS = {
  primary: '#3b82f6',
  secondary: '#6366f1',
  accent: '#06b6d4',
  success: '#22c55e',
  warning: '#eab308',
  danger: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  series: [
    '#3b82f6',
    '#8b5cf6',
    '#06b6d4',
    '#22c55e',
    '#eab308',
    '#ef4444',
    '#ec4899',
    '#f97316',
  ],
};

// ─── Time Periods ─────────────────────────────────────────────
export const TIME_PERIODS = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: '12m', label: '12M' },
];

// ─── Map defaults ─────────────────────────────────────────────
export const MAP_DEFAULTS = {
  center: { lat: 20, lng: 0 },
  zoom: 2,
  minZoom: 1,
  maxZoom: 16,
  style: 'dark',
};

// ─── Pagination ───────────────────────────────────────────────
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

// ─── Refresh Intervals (ms) ───────────────────────────────────
export const REFRESH_INTERVALS = {
  ALERTS: 30_000,        // 30 seconds
  SHIPMENTS: 60_000,     // 1 minute
  KPI: 120_000,          // 2 minutes
  MAP: 60_000,           // 1 minute
  DISRUPTIONS: 300_000,  // 5 minutes
};

// ─── API ──────────────────────────────────────────────────────
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// ─── Firebase Collections ─────────────────────────────────────
export const FIREBASE_COLLECTIONS = {
  SHIPMENTS: 'shipments',
  ALERTS: 'alerts',
  DISRUPTIONS: 'disruptions',
  USERS: 'users',
  SIMULATIONS: 'simulations',
};

// ─── Local Storage Keys ───────────────────────────────────────
export const STORAGE_KEYS = {
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
  THEME: 'theme',
  FILTERS: 'dashboard_filters',
};
