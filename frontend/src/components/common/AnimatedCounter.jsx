import { useState, useEffect, useRef } from 'react'

export default function AnimatedCounter({ value, duration = 1000, prefix = '', suffix = '' }) {
  const [display, setDisplay] = useState(0)
  const prevValue = useRef(0)

  useEffect(() => {
    if (value === undefined || value === null) return

    const start = prevValue.current
    const end = Number(value)
    const startTime = performance.now()

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress)
      const current = start + (end - start) * eased

      setDisplay(Math.round(current))

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        prevValue.current = end
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration])

  return (
    <span className="animated-counter">
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  )
}
