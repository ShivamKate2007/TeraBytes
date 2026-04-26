import { useEffect, useRef, useState } from 'react'
import { supplyChainApi } from '../services/api'

const POLL_INTERVAL_MS = 15000
const MAX_BACKOFF_MS = 60000

export default function useShipments() {
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isConnected, setIsConnected] = useState(true)
  const lastGoodShipmentsRef = useRef([])

  useEffect(() => {
    let isActive = true
    let timeoutId = null

    const scheduleNext = (delayMs) => {
      if (!isActive) return
      timeoutId = setTimeout(fetchShipments, delayMs)
    }

    const fetchShipments = async () => {
      try {
        const payload = await supplyChainApi.getShipments()
        if (!isActive) return
        if (payload.error) {
          throw new Error(payload.error)
        }
        setShipments(Array.isArray(payload.shipments) ? payload.shipments : [])
        lastGoodShipmentsRef.current = Array.isArray(payload.shipments) ? payload.shipments : []
        setError(null)
        setRetryCount(0)
        setIsReconnecting(false)
        setIsConnected(true)
        setLastUpdated(Date.now())
        scheduleNext(POLL_INTERVAL_MS)
      } catch (err) {
        if (!isActive) return
        setError(err)
        setIsConnected(false)
        // Keep showing last known data instead of resetting dashboard to misleading zeros
        setShipments(lastGoodShipmentsRef.current)
        setRetryCount((prev) => {
          const next = prev + 1
          const delay = Math.min(POLL_INTERVAL_MS * (2 ** prev), MAX_BACKOFF_MS)
          setIsReconnecting(true)
          scheduleNext(delay)
          return next
        })
      } finally {
        if (isActive) setLoading(false)
      }
    }

    fetchShipments()

    return () => {
      isActive = false
      clearTimeout(timeoutId)
    }
  }, [])

  return { shipments, loading, error, retryCount, isReconnecting, lastUpdated, isConnected }
}
