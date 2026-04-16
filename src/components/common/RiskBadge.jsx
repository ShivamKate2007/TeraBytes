/* ============================================================
   RiskBadge — Visual indicator for risk severity levels
   ============================================================ */

import { RISK_LEVELS } from '../../utils/constants';
import { getRiskLevel } from '../../utils/formatters';

/**
 * @param {object} props
 * @param {'critical'|'high'|'medium'|'low'|'none'} [props.level]
 * @param {number} [props.score] — if level not provided, derived from score
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {boolean} [props.showDot]
 * @param {boolean} [props.showScore]
 * @param {string} [props.className]
 */
export default function RiskBadge({
  level,
  score,
  size = 'md',
  showDot = true,
  showScore = false,
  className = '',
}) {
  const resolvedLevel = level ?? (score !== undefined ? getRiskLevel(score) : RISK_LEVELS.NONE);

  const labels = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    none: 'None',
  };

  const sizeClass = {
    sm: 'risk-badge risk-badge--sm',
    md: 'risk-badge',
    lg: 'risk-badge risk-badge--lg',
  }[size] || 'risk-badge';

  return (
    <span className={`${sizeClass} ${resolvedLevel} ${className}`} role="status" aria-label={`Risk level: ${labels[resolvedLevel]}`}>
      {showDot && <span className={`status-dot ${resolvedLevel}`} aria-hidden="true" />}
      <span>{labels[resolvedLevel]}</span>
      {showScore && score !== undefined && (
        <span style={{ opacity: 0.7, marginLeft: '2px' }}>({score})</span>
      )}
    </span>
  );
}
