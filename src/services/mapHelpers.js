/* ============================================================
   MAP HELPERS — Google Maps utility functions
   ============================================================ */

import { RISK_COLORS, MAJOR_PORTS } from '../utils/constants';
import { getRiskLevel } from '../utils/formatters';

// ─── Marker Styles ────────────────────────────────────────────
/**
 * Get marker options for a shipment based on its risk score.
 * @param {object} shipment
 * @returns {google.maps.MarkerOptions}
 */
export function getShipmentMarkerOptions(shipment) {
  const level = getRiskLevel(shipment.riskScore);
  const color = RISK_COLORS[level];

  return {
    icon: {
      path: window.google?.maps?.SymbolPath?.CIRCLE,
      fillColor: color,
      fillOpacity: 0.9,
      strokeColor: '#ffffff',
      strokeWeight: 1.5,
      scale: 8,
    },
    title: `${shipment.id} — Risk: ${shipment.riskScore}`,
    zIndex: shipment.riskScore,
  };
}

/**
 * Get port marker options.
 * @param {object} port
 * @returns {google.maps.MarkerOptions}
 */
export function getPortMarkerOptions(port) {
  return {
    icon: {
      path: window.google?.maps?.SymbolPath?.CIRCLE,
      fillColor: '#6366f1',
      fillOpacity: 0.8,
      strokeColor: '#a5b4fc',
      strokeWeight: 1.5,
      scale: 6,
    },
    title: `${port.name} (${port.id})`,
    zIndex: 10,
  };
}

// ─── Polyline / Route ─────────────────────────────────────────
/**
 * Build polyline options for a trade route.
 * @param {number} riskScore
 * @param {boolean} animated
 * @returns {google.maps.PolylineOptions}
 */
export function getRoutePolylineOptions(riskScore = 0, animated = false) {
  const level = getRiskLevel(riskScore);
  const color = RISK_COLORS[level];

  return {
    strokeColor: color,
    strokeOpacity: animated ? 0 : 0.7,
    strokeWeight: 2.5,
    icons: animated
      ? [
          {
            icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: 0.8,
              scale: 3,
            },
            offset: '0',
            repeat: '20px',
          },
        ]
      : [],
  };
}

/**
 * Generate an arc path between two lat/lng points (great circle approximation).
 * @param {{ lat: number, lng: number }} from
 * @param {{ lat: number, lng: number }} to
 * @param {number} numPoints
 * @returns {Array<{ lat: number, lng: number }>}
 */
export function generateArcPath(from, to, numPoints = 50) {
  const path = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lat = from.lat + t * (to.lat - from.lat);
    let lng = from.lng + t * (to.lng - from.lng);

    // Slight arc via quadratic bezier
    const midLat = (from.lat + to.lat) / 2 + Math.abs(to.lng - from.lng) * 0.1;
    const arcLat = (1 - t) * (1 - t) * from.lat + 2 * (1 - t) * t * midLat + t * t * to.lat;

    path.push({ lat: arcLat, lng });
  }
  return path;
}

// ─── Bounds & Viewport ────────────────────────────────────────
/**
 * Compute a bounding box that fits all given lat/lng positions.
 * @param {Array<{ lat: number, lng: number }>} positions
 * @returns {{ north: number, south: number, east: number, west: number }|null}
 */
export function computeBounds(positions) {
  if (!positions || positions.length === 0) return null;

  let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity;

  positions.forEach(({ lat, lng }) => {
    if (lat > north) north = lat;
    if (lat < south) south = lat;
    if (lng > east) east = lng;
    if (lng < west) west = lng;
  });

  // Add padding
  const latPad = (north - south) * 0.1;
  const lngPad = (east - west) * 0.1;

  return {
    north: north + latPad,
    south: south - latPad,
    east: east + lngPad,
    west: west - lngPad,
  };
}

// ─── Distance Calculation ─────────────────────────────────────
/**
 * Calculate distance between two points using Haversine formula.
 * Returns distance in nautical miles.
 * @param {{ lat: number, lng: number }} p1
 * @param {{ lat: number, lng: number }} p2
 * @returns {number}
 */
export function calculateDistance(p1, p2) {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// ─── Color Interpolation ──────────────────────────────────────
/**
 * Interpolate between two hex colors.
 * @param {string} color1
 * @param {string} color2
 * @param {number} t 0..1
 * @returns {string}
 */
export function interpolateColor(color1, color2, t) {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + t * (r2 - r1));
  const g = Math.round(g1 + t * (g2 - g1));
  const b = Math.round(b1 + t * (b2 - b1));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Get a heatmap color for a risk score (0–100).
 * Green → Yellow → Red
 * @param {number} score
 * @returns {string}
 */
export function getRiskHeatmapColor(score) {
  const clamped = Math.min(100, Math.max(0, score));
  if (clamped < 50) {
    return interpolateColor('#22c55e', '#eab308', clamped / 50);
  }
  return interpolateColor('#eab308', '#ef4444', (clamped - 50) / 50);
}

// ─── Port Lookup ──────────────────────────────────────────────
/**
 * Find a port by its code.
 * @param {string} code
 * @returns {object|undefined}
 */
export function getPortByCode(code) {
  return MAJOR_PORTS.find((p) => p.id === code?.toUpperCase());
}

/**
 * Get the midpoint between two lat/lng positions.
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 * @returns {{ lat: number, lng: number }}
 */
export function getMidpoint(a, b) {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

// ─── Map Style (Dark) ─────────────────────────────────────────
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0d1422' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0e1a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a2440' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'landscape', stylers: [{ color: '#0f1629' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0e1a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1a2440' }] },
];
