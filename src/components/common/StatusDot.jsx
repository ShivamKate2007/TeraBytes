/* ============================================================
   StatusDot — Colored dot indicator for status values
   ============================================================ */

/**
 * @param {object} props
 * @param {'online'|'offline'|'idle'|'active'|'warning'|'error'|'critical'|'high'|'medium'|'low'} props.status
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {boolean} [props.pulse] — animate with pulse
 * @param {string} [props.label] — visible label next to dot
 * @param {string} [props.className]
 */
export default function StatusDot({ status, size = 'md', pulse = false, label, className = '' }) {
  const sizeMap = { sm: 'sm', md: '', lg: 'lg' };
  const sizeClass = sizeMap[size] ? `status-dot ${sizeMap[size]}` : 'status-dot';
  const pulseClass = pulse ? 'pulse' : '';

  return (
    <span
      className={`flex-center ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
      role="status"
      aria-label={label || status}
    >
      <span className={`${sizeClass} ${status} ${pulseClass}`} aria-hidden="true" />
      {label && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          {label}
        </span>
      )}
    </span>
  );
}
