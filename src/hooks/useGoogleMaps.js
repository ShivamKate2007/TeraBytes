/* ============================================================
   useGoogleMaps — Google Maps API loader hook
   ============================================================ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MAP_DEFAULTS, DARK_MAP_STYLE } from '../services/mapHelpers';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const SCRIPT_ID = 'google-maps-script';

// Shared load promise to avoid loading the script multiple times
let loadPromise = null;

/**
 * Load the Google Maps JS API script exactly once.
 * @returns {Promise<void>}
 */
function loadGoogleMapsScript() {
  if (window.google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=visualization,geometry,marker`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Hook that loads Google Maps API and initializes a map in a given container ref.
 * @param {React.RefObject} containerRef
 * @param {object} [mapOptions] — Override default map options
 * @returns {{ map: google.maps.Map|null, mapsLoaded: boolean, error: string|null }}
 */
export function useGoogleMaps(containerRef, mapOptions = {}) {
  const [map, setMap] = useState(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await loadGoogleMapsScript();
        if (cancelled) return;

        setMapsLoaded(true);

        if (!containerRef.current) return;
        if (mapRef.current) return; // already initialized

        const defaultOptions = {
          center: MAP_DEFAULTS.center,
          zoom: MAP_DEFAULTS.zoom,
          minZoom: MAP_DEFAULTS.minZoom,
          maxZoom: MAP_DEFAULTS.maxZoom,
          styles: DARK_MAP_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
          backgroundColor: '#0d1422',
          ...mapOptions,
        };

        const googleMap = new window.google.maps.Map(containerRef.current, defaultOptions);
        mapRef.current = googleMap;
        setMap(googleMap);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to initialize Google Maps');
        }
      }
    };

    init();
    return () => { cancelled = true; };
  }, [containerRef]); // intentionally not including mapOptions to avoid re-init

  /**
   * Pan & zoom the map to a specific position.
   * @param {{ lat: number, lng: number }} center
   * @param {number} [zoom]
   */
  const panTo = useCallback((center, zoom) => {
    if (!mapRef.current) return;
    mapRef.current.panTo(center);
    if (zoom) mapRef.current.setZoom(zoom);
  }, []);

  /**
   * Fit the map viewport to bounds.
   * @param {google.maps.LatLngBoundsLiteral} bounds
   */
  const fitBounds = useCallback((bounds) => {
    if (!mapRef.current || !window.google) return;
    const latLngBounds = new window.google.maps.LatLngBounds(
      { lat: bounds.south, lng: bounds.west },
      { lat: bounds.north, lng: bounds.east }
    );
    mapRef.current.fitBounds(latLngBounds);
  }, []);

  return {
    map,
    mapsLoaded,
    error,
    panTo,
    fitBounds,
  };
}

/**
 * Hook to add/remove markers on a Google Map reactively.
 * @param {google.maps.Map|null} map
 * @param {Array<{ id, lat, lng, options?: object, onClick?: function }>} markerData
 * @returns {{ markers: google.maps.Marker[] }}
 */
export function useMapMarkers(map, markerData = []) {
  const markersRef = useRef([]);

  useEffect(() => {
    if (!map || !window.google) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Add new markers
    const newMarkers = markerData.map((item) => {
      const marker = new window.google.maps.Marker({
        position: { lat: item.lat, lng: item.lng },
        map,
        ...(item.options || {}),
      });

      if (item.onClick) {
        marker.addListener('click', () => item.onClick(item));
      }

      return marker;
    });

    markersRef.current = newMarkers;

    return () => {
      newMarkers.forEach((m) => m.setMap(null));
    };
  }, [map, markerData]);

  return { markers: markersRef.current };
}
