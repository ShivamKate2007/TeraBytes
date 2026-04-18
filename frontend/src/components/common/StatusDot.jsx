export default function StatusDot({ status = 'inactive' }) {
  return <span className={`status-dot ${status}`} />
}
