/* ============================================================
   useShipments — Fetch and manage shipment data
   ============================================================ */

import { useState, useEffect, useCallback, useRef } from 'react';
import { shipmentsAPI } from '../services/api';
import { REFRESH_INTERVALS, DEFAULT_PAGE_SIZE } from '../utils/constants';

/**
 * @typedef {Object} UseShipmentsOptions
 * @property {number} [pageSize]
 * @property {string} [sortBy]
 * @property {'asc'|'desc'} [sortOrder]
 * @property {string} [statusFilter]
 * @property {number} [minRisk]
 * @property {boolean} [autoRefresh]
 */

/**
 * Hook for fetching, filtering, and paginating shipments.
 * @param {UseShipmentsOptions} options
 */
export function useShipments(options = {}) {
  const {
    pageSize = DEFAULT_PAGE_SIZE,
    sortBy = 'riskScore',
    sortOrder = 'desc',
    statusFilter = null,
    minRisk = 0,
    autoRefresh = false,
  } = options;

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKPIs] = useState(null);

  const timerRef = useRef(null);

  const fetchShipments = useCallback(async () => {
    try {
      setError(null);
      const params = {
        page,
        pageSize,
        sortBy,
        sortOrder,
        ...(statusFilter && { status: statusFilter }),
        ...(minRisk > 0 && { minRisk }),
      };
      const data = await shipmentsAPI.getAll(params);
      setShipments(data.items ?? data);
      setTotalCount(data.total ?? data.length ?? 0);
    } catch (err) {
      setError(err?.message || err || 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortOrder, statusFilter, minRisk]);

  const fetchKPIs = useCallback(async () => {
    try {
      const data = await shipmentsAPI.getKPIs();
      setKPIs(data);
    } catch {
      // KPIs are non-critical, fail silently
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchShipments();
    fetchKPIs();
  }, [fetchShipments, fetchKPIs]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    timerRef.current = setInterval(() => {
      fetchShipments();
    }, REFRESH_INTERVALS.SHIPMENTS);

    return () => clearInterval(timerRef.current);
  }, [autoRefresh, fetchShipments]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchShipments();
    fetchKPIs();
  }, [fetchShipments, fetchKPIs]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    shipments,
    loading,
    error,
    kpis,
    // Pagination
    page,
    setPage,
    totalPages,
    totalCount,
    pageSize,
    // Actions
    refresh,
  };
}

/**
 * Hook for fetching a single shipment by ID.
 * @param {string} id
 */
export function useShipmentDetail(id) {
  const [shipment, setShipment] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const [detail, tl] = await Promise.all([
          shipmentsAPI.getById(id),
          shipmentsAPI.getTimeline(id),
        ]);
        setShipment(detail);
        setTimeline(tl ?? []);
      } catch (err) {
        setError(err?.message || err || 'Failed to load shipment');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  return { shipment, timeline, loading, error };
}
