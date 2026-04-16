/* ============================================================
   useDisruptions — Fetch and manage supply chain disruptions
   ============================================================ */

import { useState, useEffect, useCallback, useRef } from 'react';
import { disruptionsAPI } from '../services/api';
import { REFRESH_INTERVALS } from '../utils/constants';

/**
 * Hook to fetch active disruptions and heatmap overlay data.
 * @param {{ autoRefresh?: boolean, region?: string }} options
 */
export function useDisruptions(options = {}) {
  const { autoRefresh = false, region = null } = options;

  const [disruptions, setDisruptions] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const timerRef = useRef(null);

  const fetchDisruptions = useCallback(async () => {
    try {
      setError(null);
      const [list, heatmap] = await Promise.allSettled([
        region ? disruptionsAPI.getByRegion(region) : disruptionsAPI.getActive(),
        disruptionsAPI.getHeatmapData(),
      ]);

      if (list.status === 'fulfilled') setDisruptions(list.value ?? []);
      if (heatmap.status === 'fulfilled') setHeatmapData(heatmap.value ?? []);

      if (list.status === 'rejected') throw new Error(list.reason);
    } catch (err) {
      setError(err?.message || err || 'Failed to load disruptions');
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => {
    setLoading(true);
    fetchDisruptions();
  }, [fetchDisruptions]);

  useEffect(() => {
    if (!autoRefresh) return;
    timerRef.current = setInterval(fetchDisruptions, REFRESH_INTERVALS.DISRUPTIONS);
    return () => clearInterval(timerRef.current);
  }, [autoRefresh, fetchDisruptions]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchDisruptions();
  }, [fetchDisruptions]);

  // Derived: group disruptions by severity
  const bySeverity = disruptions.reduce((acc, d) => {
    const level = d.severity || 'low';
    acc[level] = (acc[level] || []).concat(d);
    return acc;
  }, {});

  return {
    disruptions,
    heatmapData,
    bySeverity,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook to fetch the cascade impact graph for a specific disruption.
 * @param {string|null} disruptionId
 */
export function useCascadeGraph(disruptionId) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!disruptionId) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const fetch = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await disruptionsAPI.getCascadeGraph(disruptionId);
        setNodes(data.nodes ?? []);
        setEdges(data.edges ?? []);
      } catch (err) {
        setError(err?.message || err || 'Failed to load cascade graph');
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [disruptionId]);

  return { nodes, edges, loading, error };
}
