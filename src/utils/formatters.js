/* ============================================================
   FORMATTERS — Date, Currency, Risk, Duration helpers
   ============================================================ */

import { RISK_THRESHOLDS, RISK_LEVELS } from './constants';

// ─── Risk Score → Level ───────────────────────────────────────
/**
 * Convert a numeric risk score (0-100) to a risk level string.
 * @param {number} score
 * @returns {'critical'|'high'|'medium'|'low'|'none'}
 */
export function getRiskLevel(score) {
  if (score === null || score === undefined) return RISK_LEVELS.NONE;
  if (score >= RISK_THRESHOLDS.CRITICAL) return RISK_LEVELS.CRITICAL;
  if (score >= RISK_THRESHOLDS.HIGH) return RISK_LEVELS.HIGH;
  if (score >= RISK_THRESHOLDS.MEDIUM) return RISK_LEVELS.MEDIUM;
  return RISK_LEVELS.LOW;
}

// ─── Date & Time ──────────────────────────────────────────────
/**
 * Format a date to a readable string.
 * @param {Date|string|number} date
 * @param {'short'|'medium'|'long'} format
 * @returns {string}
 */
export function formatDate(date, format = 'medium') {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';

  const options = {
    short: { month: 'short', day: 'numeric' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' },
  };

  return d.toLocaleDateString('en-US', options[format] || options.medium);
}

/**
 * Format a datetime to readable string.
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatDateTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date as relative time ("2 hours ago", "in 3 days").
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatRelativeTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';

  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const isPast = diffMs < 0;

  const seconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let unit;
  if (days > 0) unit = `${days}d`;
  else if (hours > 0) unit = `${hours}h`;
  else if (minutes > 0) unit = `${minutes}m`;
  else unit = `${seconds}s`;

  return isPast ? `${unit} ago` : `in ${unit}`;
}

/**
 * Format duration in minutes to "Xh Ym" or "Xd Yh".
 * @param {number} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = Math.floor(minutes % 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ─── Numbers & Currency ───────────────────────────────────────
/**
 * Format a number with locale-aware separators.
 * @param {number} value
 * @param {number} decimals
 * @returns {string}
 */
export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a value as USD currency.
 * @param {number} value
 * @param {boolean} compact
 * @returns {string}
 */
export function formatCurrency(value, compact = false) {
  if (value === null || value === undefined) return '—';
  if (compact) {
    return formatCompact(value, '$');
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format large numbers compactly: 1.2M, 450K, etc.
 * @param {number} value
 * @param {string} prefix
 * @returns {string}
 */
export function formatCompact(value, prefix = '') {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) return `${sign}${prefix}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${prefix}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${prefix}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${prefix}${abs}`;
}

/**
 * Format a number as a percentage.
 * @param {number} value 0-100 or 0-1
 * @param {boolean} isDecimal - true if value is 0-1 range
 * @returns {string}
 */
export function formatPercent(value, isDecimal = false) {
  if (value === null || value === undefined) return '—';
  const pct = isDecimal ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

// ─── Distance & Weight ────────────────────────────────────────
/**
 * Format nautical miles.
 * @param {number} nm
 * @returns {string}
 */
export function formatDistance(nm) {
  if (!nm && nm !== 0) return '—';
  if (nm >= 1000) return `${(nm / 1000).toFixed(1)}K nm`;
  return `${Math.round(nm)} nm`;
}

/**
 * Format weight in metric tons.
 * @param {number} tons
 * @returns {string}
 */
export function formatWeight(tons) {
  if (!tons && tons !== 0) return '—';
  if (tons >= 1000) return `${(tons / 1000).toFixed(1)}K T`;
  return `${tons} T`;
}

// ─── Shipment ID ──────────────────────────────────────────────
/**
 * Format a shipment ID for display.
 * @param {string} id
 * @returns {string}
 */
export function formatShipmentId(id) {
  if (!id) return '—';
  return id.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

// ─── Coordinates ─────────────────────────────────────────────
/**
 * Format lat/lng coordinates.
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
export function formatCoords(lat, lng) {
  if (lat === undefined || lng === undefined) return '—';
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lng).toFixed(2)}°${lngDir}`;
}

// ─── ETA ──────────────────────────────────────────────────────
/**
 * Calculate and format ETA relative to now.
 * @param {Date|string} eta
 * @returns {{ label: string, status: 'on_time'|'at_risk'|'delayed' }}
 */
export function formatETA(eta) {
  if (!eta) return { label: '—', status: 'unknown' };
  const d = new Date(eta);
  if (isNaN(d.getTime())) return { label: '—', status: 'unknown' };

  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  let status = 'on_time';
  let label = '';

  if (diffDays < 0) {
    status = 'delayed';
    label = `${Math.abs(diffDays)}d overdue`;
  } else if (diffDays === 0) {
    status = 'at_risk';
    label = 'Today';
  } else if (diffDays <= 2) {
    status = 'at_risk';
    label = `${diffDays}d`;
  } else {
    status = 'on_time';
    label = formatDate(eta, 'short');
  }

  return { label, status };
}

// ─── Truncate ─────────────────────────────────────────────────
/**
 * Truncate text to a max character count.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function truncate(text, maxLength = 40) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

// ─── Capitalize ───────────────────────────────────────────────
/**
 * Capitalize first letter of a string.
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert snake_case or kebab-case to title case.
 * @param {string} str
 * @returns {string}
 */
export function toTitleCase(str) {
  if (!str) return '';
  return str
    .replace(/[_-]/g, ' ')
    .split(' ')
    .map(word => capitalize(word))
    .join(' ');
}
