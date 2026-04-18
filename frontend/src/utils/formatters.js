import { RISK_LEVELS } from './constants'

/**
 * Get risk level info from a numeric score
 */
export function getRiskLevel(score) {
  if (score <= 30) return RISK_LEVELS.LOW
  if (score <= 55) return RISK_LEVELS.MODERATE
  if (score <= 75) return RISK_LEVELS.HIGH
  if (score <= 90) return RISK_LEVELS.CRITICAL
  return RISK_LEVELS.EMERGENCY
}

/**
 * Format currency in Indian Rupees
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format distance in km
 */
export function formatDistance(km) {
  return `${km.toLocaleString()} km`
}

/**
 * Format duration in hours
 */
export function formatDuration(hours) {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  return `${hours.toFixed(1)} hrs`
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp) {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

/**
 * Format a date to readable string
 */
export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
