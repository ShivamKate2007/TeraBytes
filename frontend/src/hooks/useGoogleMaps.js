import { useState, useCallback } from 'react'

/**
 * Hook that manages Google Maps loading and initialization
 * Phase 6 will fully implement this
 */
export default function useGoogleMaps() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [map, setMap] = useState(null)

  const onLoad = useCallback((mapInstance) => {
    setMap(mapInstance)
    setIsLoaded(true)
  }, [])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  return { isLoaded, map, onLoad, onUnmount }
}
