import { useEffect, useState } from 'react'
import { supplyChainApi } from '../services/api'

const POLL_INTERVAL_MS = 30000
const MAX_BACKOFF_MS = 90000

export default function useDisruptions() {
  const [disruptions, setDisruptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isConnected, setIsConnected] = useState(true)

  useEffect(() => {
    let isActive = true
    let timeoutId = null
    let userChangeHandler = null

    const scheduleNext = (delayMs) => {
      if (!isActive) return
      timeoutId = setTimeout(fetchDisruptions, delayMs)
    }

    const fetchDisruptions = async () => {
      try {
        const payload = await supplyChainApi.getDisruptions()
        if (!isActive) return
        if (payload.error) {
          throw new Error(payload.error)
        }
        setDisruptions(Array.isArray(payload.disruptions) ? payload.disruptions : [])
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

    userChangeHandler = () => {
      clearTimeout(timeoutId)
      setLoading(true)
      fetchDisruptions()
    }
    window.addEventListener('ssc:user-changed', userChangeHandler)

    fetchDisruptions()

    return () => {
      isActive = false
      clearTimeout(timeoutId)
      if (userChangeHandler) window.removeEventListener('ssc:user-changed', userChangeHandler)
    }
  }, [])

  return { disruptions, loading, error, retryCount, isReconnecting, lastUpdated, isConnected }
}
