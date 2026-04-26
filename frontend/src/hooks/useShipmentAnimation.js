import { useEffect, useRef, useState } from 'react'

const ANIMATION_DURATION_MS = 2000

/**
 * Smoothly interpolates shipment marker positions between poll intervals.
 * When isConnected=false (backend offline), freezes at last known positions.
 */
export default function useShipmentAnimation(shipments, isConnected = true) {
  const prevPositionsRef = useRef({})
  const animStartRef = useRef(Date.now())
  const [animatedPositions, setAnimatedPositions] = useState({})
  const rafRef = useRef(null)
  const targetPositionsRef = useRef({})

  // When new shipment data arrives, capture targets
  useEffect(() => {
    const newTargets = {}
    const prev = prevPositionsRef.current

    shipments.forEach((shipment) => {
      const pos = shipment.currentPosition
      if (!pos?.lat || !pos?.lng) return
      newTargets[shipment.id] = { lat: pos.lat, lng: pos.lng }
    })

    // Store previous positions for interpolation
    const oldPositions = { ...animatedPositions }
    for (const id of Object.keys(newTargets)) {
      if (!prev[id]) {
        prev[id] = newTargets[id]
      } else {
        prev[id] = oldPositions[id] || prev[id]
      }
    }

    prevPositionsRef.current = prev
    targetPositionsRef.current = newTargets
    animStartRef.current = Date.now()
  }, [shipments])

  // Animation loop
  useEffect(() => {
    if (!isConnected) {
      // Freeze — don't animate when backend is offline
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    const animate = () => {
      const now = Date.now()
      const elapsed = now - animStartRef.current
      const t = Math.min(1, elapsed / ANIMATION_DURATION_MS)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)

      const prev = prevPositionsRef.current
      const targets = targetPositionsRef.current
      const interpolated = {}

      for (const [id, target] of Object.entries(targets)) {
        const from = prev[id] || target
        interpolated[id] = {
          lat: from.lat + (target.lat - from.lat) * eased,
          lng: from.lng + (target.lng - from.lng) * eased,
        }
      }

      setAnimatedPositions(interpolated)

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [shipments, isConnected])

  // Return shipments with animated positions
  const animatedShipments = shipments.map((shipment) => {
    const anim = animatedPositions[shipment.id]
    if (!anim) return shipment
    return {
      ...shipment,
      currentPosition: { ...shipment.currentPosition, lat: anim.lat, lng: anim.lng },
    }
  })

  return animatedShipments
}
