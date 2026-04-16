/* ============================================================
   AnimatedCounter — Smoothly animates a number to a target value
   ============================================================ */

import { useEffect, useRef, useState } from 'react';

/**
 * @param {object} props
 * @param {number} props.value — target value to count to
 * @param {number} [props.duration] — animation duration in ms
 * @param {number} [props.decimals] — decimal places
 * @param {string} [props.prefix] — prefix like '$', '+'
 * @param {string} [props.suffix] — suffix like '%', 'K'
 * @param {function} [props.formatter] — custom format function
 * @param {string} [props.className]
 */
export default function AnimatedCounter({
  value,
  duration = 1200,
  decimals = 0,
  prefix = '',
  suffix = '',
  formatter,
  className = '',
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef(null);
  const startValueRef = useRef(0);
  const rafRef = useRef(null);
  const prevValueRef = useRef(0);

  useEffect(() => {
    if (value === undefined || value === null) return;

    startValueRef.current = prevValueRef.current;
    startTimeRef.current = null;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValueRef.current + eased * (value - startValueRef.current);

      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
        prevValueRef.current = value;
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const formatted = formatter
    ? formatter(displayValue)
    : `${prefix}${displayValue.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${suffix}`;

  return (
    <span className={`animated-counter ${className}`} aria-live="polite" aria-atomic="true">
      {formatted}
    </span>
  );
}
