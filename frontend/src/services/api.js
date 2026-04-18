const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const supplyChainApi = {
  getShipments: async () => {
    try {
      return await fetchJson('/shipments');
    } catch (error) {
      console.error('API Error (getShipments):', error);
      return { shipments: [], count: 0 };
    }
  },

  getShipmentById: async (shipmentId) => {
    try {
      return await fetchJson(`/shipments/${shipmentId}`);
    } catch (error) {
      console.error('API Error (getShipmentById):', error);
      return { error: error.message };
    }
  },

  getGraph: async () => {
    try {
      return await fetchJson('/routes/graph');
    } catch (error) {
      console.error('API Error (getGraph):', error);
      return { nodes: [], edges: [] };
    }
  },

  traceRoute: async (points = []) => {
    try {
      return await fetchJson('/routes/trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
      });
    } catch (error) {
      console.error('API Error (traceRoute):', error);
      return { path: [], pathSource: 'error' };
    }
  },

  getDisruptions: async () => {
    try {
      return await fetchJson('/disruptions');
    } catch (error) {
      console.error('API Error (getDisruptions):', error);
      return { disruptions: [], count: 0 };
    }
  },

  detectDisruptions: async () => {
    try {
      return await fetchJson('/disruptions/detect', { method: 'POST' });
    } catch (error) {
      console.error('API Error (detectDisruptions):', error);
      return { detected: 0, disruptions: [], error: error.message };
    }
  },

  runSimulation: async (payload) => {
    try {
      return await fetchJson('/simulator/what-if', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('API Error (runSimulation):', error);
      return { error: error.message };
    }
  },

  getAnalyticsKpis: async () => {
    try {
      return await fetchJson('/analytics/kpis');
    } catch (error) {
      console.error('API Error (getAnalyticsKpis):', error);
      return {
        active_shipments: 0,
        at_risk: 0,
        avg_risk_score: 0,
        on_time_rate: 0,
        count: 0,
        error: error.message,
      };
    }
  },

  getAnalyticsTrends: async () => {
    try {
      return await fetchJson('/analytics/trends');
    } catch (error) {
      console.error('API Error (getAnalyticsTrends):', error);
      return { trends: [], error: error.message };
    }
  },

  getNewsHeadlines: async (location = 'India logistics', limit = 5) => {
    try {
      const q = new URLSearchParams({ location, limit: String(limit) }).toString();
      return await fetchJson(`/news/headlines?${q}`);
    } catch (error) {
      console.error('API Error (getNewsHeadlines):', error);
      return { headlines: [], count: 0, error: error.message };
    }
  },
};
