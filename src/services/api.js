/* ============================================================
   API SERVICE — Mock-first layer (no backend required)
   Falls back to mock data instantly when API is unreachable.
   ============================================================ */

import axios from 'axios';
import {
  MOCK_SHIPMENTS,
  MOCK_KPIS,
  MOCK_ALERTS,
  MOCK_DISRUPTIONS,
  MOCK_HEATMAP,
  MOCK_DISRUPTION_TRENDS,
  MOCK_CARRIER_PERFORMANCE,
  MOCK_ROUTE_RISKS,
  getMockShipmentDetail,
  getMockTimeline,
} from '../data/mockApiData';

// ─── Config ────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'; // default: use mock

// Small simulated delay (ms) to feel realistic but still fast
const MOCK_DELAY = 120;

function delay(ms = MOCK_DELAY) {
  return new Promise((res) => setTimeout(res, ms));
}

// ─── Axios Instance (used only when USE_MOCK is false) ─────────
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 4_000, // reduced from 15s → 4s so failures are fast
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
      return Promise.reject(data?.message || `Error ${status}`);
    }
    if (error.request) return Promise.reject('No response from server.');
    return Promise.reject(error.message || 'Unknown error');
  }
);

// ─── Mock-aware fetch helper ───────────────────────────────────
async function mockOr(mockFn, apiFn) {
  if (USE_MOCK) {
    await delay();
    return mockFn();
  }
  try {
    return await apiFn();
  } catch {
    // Gracefully fall back to mock when API isn't reachable
    await delay(50);
    return mockFn();
  }
}

// ─── Pagination helper ─────────────────────────────────────────
function paginate(items, { page = 1, pageSize = 20, sortBy, sortOrder, status, minRisk } = {}) {
  let result = [...items];

  if (status) result = result.filter((s) => s.status === status);
  if (minRisk > 0) result = result.filter((s) => (s.riskScore || 0) >= minRisk);

  if (sortBy) {
    result.sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      return (a[sortBy] > b[sortBy] ? 1 : -1) * dir;
    });
  }

  const total = result.length;
  const start = (page - 1) * pageSize;
  return { items: result.slice(start, start + pageSize), total };
}

// ─── Shipments ─────────────────────────────────────────────────
export const shipmentsAPI = {
  getAll: (params) =>
    mockOr(
      () => paginate(MOCK_SHIPMENTS, params),
      () => api.get('/shipments', { params })
    ),

  getById: (id) =>
    mockOr(
      () => getMockShipmentDetail(id),
      () => api.get(`/shipments/${id}`)
    ),

  getKPIs: () =>
    mockOr(
      () => MOCK_KPIS,
      () => api.get('/shipments/kpis')
    ),

  getAtRisk: () =>
    mockOr(
      () => MOCK_SHIPMENTS.filter((s) => s.riskScore >= 70),
      () => api.get('/shipments/at-risk')
    ),

  updateStatus: (id, status) =>
    mockOr(
      () => ({ id, status, updated: true }),
      () => api.patch(`/shipments/${id}/status`, { status })
    ),

  getTimeline: (id) =>
    mockOr(
      () => getMockTimeline(id),
      () => api.get(`/shipments/${id}/timeline`)
    ),
};

// ─── Disruptions ───────────────────────────────────────────────
export const disruptionsAPI = {
  getAll: (params) =>
    mockOr(
      () => ({ items: MOCK_DISRUPTIONS, total: MOCK_DISRUPTIONS.length }),
      () => api.get('/disruptions', { params })
    ),

  getById: (id) =>
    mockOr(
      () => MOCK_DISRUPTIONS.find((d) => d.id === id) || MOCK_DISRUPTIONS[0],
      () => api.get(`/disruptions/${id}`)
    ),

  getActive: () =>
    mockOr(
      () => MOCK_DISRUPTIONS,
      () => api.get('/disruptions/active')
    ),

  getByRegion: (region) =>
    mockOr(
      () => MOCK_DISRUPTIONS.filter((d) => d.region === region),
      () => api.get(`/disruptions/region/${region}`)
    ),

  getHeatmapData: () =>
    mockOr(
      () => MOCK_HEATMAP,
      () => api.get('/disruptions/heatmap')
    ),

  getCascadeGraph: (disruptionId) =>
    mockOr(
      () => ({
        nodes: [
          { id: 'n1', label: 'Shanghai Port', type: 'port', risk: 0.95 },
          { id: 'n2', label: 'COSCO Fleet', type: 'carrier', risk: 0.7 },
          { id: 'n3', label: 'Long Beach', type: 'port', risk: 0.5 },
          { id: 'n4', label: 'US Rail Hub', type: 'hub', risk: 0.4 },
          { id: 'n5', label: 'Chicago DC', type: 'warehouse', risk: 0.3 },
        ],
        edges: [
          { source: 'n1', target: 'n2', weight: 0.9 },
          { source: 'n2', target: 'n3', weight: 0.7 },
          { source: 'n3', target: 'n4', weight: 0.6 },
          { source: 'n4', target: 'n5', weight: 0.4 },
        ],
      }),
      () => api.get(`/disruptions/${disruptionId}/cascade`)
    ),
};

// ─── Alerts ────────────────────────────────────────────────────
let _liveAlerts = [...MOCK_ALERTS];

export const alertsAPI = {
  getAll: (params) =>
    mockOr(
      () => ({ items: _liveAlerts, total: _liveAlerts.length }),
      () => api.get('/alerts', { params })
    ),

  getUnread: () =>
    mockOr(
      () => _liveAlerts.filter((a) => !a.readAt),
      () => api.get('/alerts/unread')
    ),

  markRead: (id) =>
    mockOr(
      () => {
        _liveAlerts = _liveAlerts.map((a) =>
          a.id === id ? { ...a, readAt: new Date().toISOString() } : a
        );
        return { success: true };
      },
      () => api.patch(`/alerts/${id}/read`)
    ),

  markAllRead: () =>
    mockOr(
      () => {
        _liveAlerts = _liveAlerts.map((a) => ({ ...a, readAt: new Date().toISOString() }));
        return { success: true };
      },
      () => api.patch('/alerts/read-all')
    ),

  dismiss: (id) =>
    mockOr(
      () => {
        _liveAlerts = _liveAlerts.filter((a) => a.id !== id);
        return { success: true };
      },
      () => api.delete(`/alerts/${id}`)
    ),
};

// ─── Analytics ─────────────────────────────────────────────────
export const analyticsAPI = {
  getDisruptionTrends: (params) =>
    mockOr(
      () => MOCK_DISRUPTION_TRENDS,
      () => api.get('/analytics/disruption-trends', { params })
    ),

  getPerformanceMetrics: (params) =>
    mockOr(
      () => ({ onTime: 86.3, avgDelay: 18.4, totalShipments: 1284, atRisk: 47 }),
      () => api.get('/analytics/performance', { params })
    ),

  getRouteRiskScores: () =>
    mockOr(
      () => MOCK_ROUTE_RISKS,
      () => api.get('/analytics/route-risks')
    ),

  getCarrierPerformance: (params) =>
    mockOr(
      () => MOCK_CARRIER_PERFORMANCE,
      () => api.get('/analytics/carriers', { params })
    ),

  getDashboardSummary: () =>
    mockOr(
      () => ({ kpis: MOCK_KPIS, topDisruptions: MOCK_DISRUPTIONS.slice(0, 3) }),
      () => api.get('/analytics/dashboard')
    ),
};

// ─── Simulator ─────────────────────────────────────────────────
export const simulatorAPI = {
  runScenario: (payload) =>
    mockOr(
      () => ({
        scenarioId: `SCN-${Date.now()}`,
        impactScore: Math.round(40 + Math.random() * 50),
        estimatedDelay: Math.round(2 + Math.random() * 14),
        affectedShipments: Math.round(10 + Math.random() * 80),
        reroutes: Math.round(Math.random() * 20),
        costImpact: Math.round(50000 + Math.random() * 500000),
      }),
      () => api.post('/simulator/run', payload)
    ),

  getScenarios: () =>
    mockOr(
      () => [
        { id: 'SCN-001', name: 'Port Strike — Rotterdam', status: 'saved', created: new Date(Date.now() - 86400000).toISOString() },
        { id: 'SCN-002', name: 'Typhoon Season Impact', status: 'saved', created: new Date(Date.now() - 3 * 86400000).toISOString() },
      ],
      () => api.get('/simulator/scenarios')
    ),

  saveScenario: (payload) =>
    mockOr(
      () => ({ id: `SCN-${Date.now()}`, ...payload }),
      () => api.post('/simulator/scenarios', payload)
    ),

  getScenarioById: (id) =>
    mockOr(
      () => ({ id, name: 'Scenario', parameters: {} }),
      () => api.get(`/simulator/scenarios/${id}`)
    ),

  compareRoutes: (payload) =>
    mockOr(
      () => ({ routes: [], recommendation: 'Status quo is optimal given current conditions.' }),
      () => api.post('/simulator/compare-routes', payload)
    ),

  getImpactAnalysis: (scenarioId) =>
    mockOr(
      () => ({ scenarioId, summary: 'Low impact. Recommend monitoring.', riskDelta: -5 }),
      () => api.get(`/simulator/scenarios/${scenarioId}/impact`)
    ),
};

// ─── Map ───────────────────────────────────────────────────────
export const mapAPI = {
  getShipmentPositions: () =>
    mockOr(
      () => MOCK_SHIPMENTS.map(({ id, lat, lng, status, riskScore }) => ({ id, lat, lng, status, riskScore })),
      () => api.get('/map/positions')
    ),

  getRoutePaths: (params) =>
    mockOr(
      () => [],
      () => api.get('/map/routes', { params })
    ),

  getPortStatus: () =>
    mockOr(
      () => [
        { name: 'Shanghai', lat: 31.2, lng: 121.5, status: 'congested', congestion: 0.95 },
        { name: 'Rotterdam', lat: 51.9, lng: 4.5, status: 'disrupted', congestion: 0.75 },
        { name: 'Long Beach', lat: 33.7, lng: -118.3, status: 'congested', congestion: 0.82 },
        { name: 'Singapore', lat: 1.3, lng: 103.8, status: 'normal', congestion: 0.40 },
      ],
      () => api.get('/map/ports')
    ),

  getWeatherOverlay: () =>
    mockOr(
      () => [],
      () => api.get('/map/weather')
    ),
};

export default api;
