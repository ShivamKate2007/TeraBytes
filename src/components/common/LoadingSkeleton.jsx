/* ============================================================
   LoadingSkeleton — Shimmer placeholders for loading states
   ============================================================ */

/**
 * @param {object} props
 * @param {'text'|'card'|'circle'|'table'|'kpi'|'chart'} [props.type]
 * @param {number} [props.lines] — for 'text' type, number of text lines
 * @param {number} [props.rows] — for 'table' type, number of rows
 * @param {number} [props.cols] — for 'table' type, number of columns
 * @param {string} [props.width]
 * @param {string} [props.height]
 * @param {string} [props.className]
 */
export default function LoadingSkeleton({
  type = 'text',
  lines = 3,
  rows = 5,
  cols = 4,
  width,
  height,
  className = '',
}) {
  const style = {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };

  if (type === 'text') {
    const widths = ['100%', '75%', '85%', '60%', '90%', '70%'];
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="skeleton skeleton-text"
            style={{ width: widths[i % widths.length] }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className={`skeleton-card ${className}`} style={style} aria-hidden="true">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div className="skeleton skeleton-circle" style={{ width: 40, height: 40 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="skeleton skeleton-text" style={{ width: '60%' }} />
            <div className="skeleton skeleton-text" style={{ width: '40%' }} />
          </div>
        </div>
        <LoadingSkeleton type="text" lines={3} />
      </div>
    );
  }

  if (type === 'kpi') {
    return (
      <div className={`skeleton-card ${className}`} style={style} aria-hidden="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div className="skeleton skeleton-text" style={{ width: '50%' }} />
          <div className="skeleton skeleton-circle" style={{ width: 32, height: 32 }} />
        </div>
        <div className="skeleton skeleton-text" style={{ width: '70%', height: 32, borderRadius: '6px' }} />
        <div className="skeleton skeleton-text" style={{ width: '40%', marginTop: '8px' }} />
      </div>
    );
  }

  if (type === 'circle') {
    return (
      <div
        className={`skeleton skeleton-circle ${className}`}
        style={{ width: width || 48, height: height || 48, ...style }}
        aria-hidden="true"
      />
    );
  }

  if (type === 'chart') {
    return (
      <div className={`skeleton-card ${className}`} style={style} aria-hidden="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="skeleton skeleton-text" style={{ width: '160px' }} />
            <div className="skeleton skeleton-text" style={{ width: '100px' }} />
          </div>
          <div className="skeleton skeleton-text" style={{ width: '80px', height: 28, borderRadius: '20px' }} />
        </div>
        <div className="skeleton" style={{ width: '100%', height: height || '240px', borderRadius: '10px' }} />
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={`skeleton-card ${className}`} style={style} aria-hidden="true">
        {/* Header */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="skeleton skeleton-text" style={{ flex: 1 }} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            style={{
              display: 'flex',
              gap: '16px',
              padding: '12px 0',
              borderTop: '1px solid var(--color-border-primary)',
            }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="skeleton skeleton-text" style={{ flex: 1, width: c === 0 ? '30%' : '70%' }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Fallback: plain skeleton block
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width: width || '100%', height: height || '16px', ...style }}
      aria-hidden="true"
    />
  );
}
