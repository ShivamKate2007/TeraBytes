import { useEffect, useRef, useState } from 'react'
import { supplyChainApi } from '../services/api'

const POLL_INTERVAL_MS = 90_000

export default function useRerouteSuggestions() {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(() => {
    try {
      const raw = window.localStorage.getItem('ssc.dismissedSuggestions')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const dismissedRef = useRef(dismissed)
  dismissedRef.current = dismissed

  useEffect(() => {
    let isActive = true
    let timeoutId = null

    const fetchSuggestions = async () => {
      try {
        const payload = await supplyChainApi.getRerouteSuggestions()
        if (!isActive) return
        const all = Array.isArray(payload.suggestions) ? payload.suggestions : []
        const filtered = all.filter((s) => !dismissedRef.current.includes(s.id))
        setSuggestions(filtered)
      } catch (err) {
        console.error('useRerouteSuggestions error:', err)
      } finally {
        if (isActive) setLoading(false)
      }

      if (isActive) {
        timeoutId = setTimeout(fetchSuggestions, POLL_INTERVAL_MS)
      }
    }

    fetchSuggestions()

    return () => {
      isActive = false
      clearTimeout(timeoutId)
    }
  }, [])

  const dismiss = (suggestionId) => {
    setDismissed((prev) => {
      const next = [...prev, suggestionId]
      try {
        window.localStorage.setItem('ssc.dismissedSuggestions', JSON.stringify(next))
      } catch { /* ignore */ }
      return next
    })
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
  }

  const approve = async (suggestion) => {
    const result = await supplyChainApi.applyReroute(
      suggestion.shipmentId,
      suggestion.suggestedPath,
      suggestion.disruptionId
    )
    if (result.applied) {
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id))
    }
    return result
  }

  const refetch = async () => {
    setLoading(true)
    try {
      const payload = await supplyChainApi.getRerouteSuggestions()
      const all = Array.isArray(payload.suggestions) ? payload.suggestions : []
      const filtered = all.filter((s) => !dismissedRef.current.includes(s.id))
      setSuggestions(filtered)
    } finally {
      setLoading(false)
    }
  }

  return { suggestions, loading, dismiss, approve, refetch }
}
