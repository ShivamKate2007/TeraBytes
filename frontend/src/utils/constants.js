// Risk level thresholds
export const RISK_LEVELS = {
  LOW: { min: 0, max: 30, label: 'Low', color: '#10b981', class: 'low' },
  MODERATE: { min: 31, max: 55, label: 'Moderate', color: '#f59e0b', class: 'moderate' },
  HIGH: { min: 56, max: 75, label: 'High', color: '#f97316', class: 'high' },
  CRITICAL: { min: 76, max: 90, label: 'Critical', color: '#ef4444', class: 'critical' },
  EMERGENCY: { min: 91, max: 100, label: 'Emergency', color: '#dc2626', class: 'critical' },
}

// Supply chain stages
export const CHAIN_STAGES = [
  { key: 'manufacturer', icon: '🏭', label: 'Manufacturer' },
  { key: 'warehouse', icon: '🏬', label: 'Warehouse' },
  { key: 'in_transit', icon: '🚛', label: 'In Transit' },
  { key: 'distribution_center', icon: '📦', label: 'Distributor' },
  { key: 'retailer', icon: '🏪', label: 'Retailer' },
]

// Disruption types for simulator
export const DISRUPTION_TYPES = [
  { id: 'flood', icon: '🌊', label: 'Flood' },
  { id: 'strike', icon: '🪧', label: 'Strike' },
  { id: 'accident', icon: '🚗', label: 'Accident' },
  { id: 'construction', icon: '🚧', label: 'Construction' },
  { id: 'storm', icon: '⛈️', label: 'Storm' },
  { id: 'port_closure', icon: '🚢', label: 'Port Closure' },
]

// Node type icons
export const NODE_ICONS = {
  manufacturer: '🏭',
  warehouse: '🏬',
  transport_hub: '🚛',
  distribution_center: '📦',
  retailer: '🏪',
}

// API base URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Google Maps config
export const MAPS_CENTER = { lat: 20.5937, lng: 78.9629 } // Center of India
export const MAPS_ZOOM = 5

// Map dark theme style
export const MAPS_DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1a3d' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a5568' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
]
