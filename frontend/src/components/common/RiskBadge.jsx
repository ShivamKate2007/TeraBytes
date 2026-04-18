import { getRiskLevel } from '../../utils/formatters'

export default function RiskBadge({ score }) {
  const level = getRiskLevel(score)
  return (
    <span className={`risk-badge ${level.class}`}>
      {score} · {level.label}
    </span>
  )
}
