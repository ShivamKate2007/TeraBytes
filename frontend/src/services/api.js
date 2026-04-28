const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const DEV_USER_STORAGE_KEY = 'ssc.currentUserId';
const DEFAULT_DEV_USER_ID = 'USR-ADMIN-001';
const NEWS_FALLBACK_REGIONS = ['India', 'Mumbai', 'Delhi', 'Kolkata', 'Pune', 'Bengaluru', 'Chennai'];

function dedupeByIdentity(items, keySelector) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keySelector(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

async function fetchJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('X-User-Id')) {
    headers.set('X-User-Id', localStorage.getItem(DEV_USER_STORAGE_KEY) || DEFAULT_DEV_USER_ID);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const supplyChainApi = {
  getDevUsers: async () => {
    try {
      return await fetchJson('/auth/dev-users');
    } catch (error) {
      console.error('API Error (getDevUsers):', error);
      return { users: [], organizations: [], error: error.message };
    }
  },

  getCurrentUser: async () => {
    try {
      return await fetchJson('/auth/me');
    } catch (error) {
      console.error('API Error (getCurrentUser):', error);
      return { user: null, error: error.message };
    }
  },

  login: async (credentials) => {
    try {
      return await fetchJson('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
    } catch (error) {
      console.error('API Error (login):', error);
      return { authenticated: false, user: null, error: error.message };
    }
  },

  getShipments: async () => {
    try {
      return await fetchJson('/shipments');
    } catch (error) {
      console.error('API Error (getShipments):', error);
      return { shipments: [], count: 0, error: error.message };
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
      return { disruptions: [], count: 0, error: error.message };
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

  getDashboardNewsHeadlines: async (limit = 6) => {
    const primary = await supplyChainApi.getNewsHeadlines('India logistics', limit);
    if ((primary.headlines || []).length >= Math.min(3, limit)) {
      return primary;
    }

    const fallbackResults = await Promise.allSettled(
      NEWS_FALLBACK_REGIONS.map((region) => supplyChainApi.getNewsHeadlines(region, 3))
    );
    const headlines = dedupeByIdentity(
      [
        ...(primary.headlines || []),
        ...fallbackResults.flatMap((result) => (
          result.status === 'fulfilled' && Array.isArray(result.value.headlines)
            ? result.value.headlines
            : []
        )),
      ],
      (item) => item.url || `${item.title}-${item.publishedAt}`
    ).slice(0, limit);

    return {
      headlines,
      count: headlines.length,
      source: primary.source || 'news_api_live',
      query: 'dashboard regional fallback',
      isMock: headlines.some((item) => item.isMock),
      error: primary.error || null,
    };
  },

  getExternalEvents: async (location = 'India logistics', limit = 10) => {
    try {
      const q = new URLSearchParams({ location, limit: String(limit) }).toString();
      return await fetchJson(`/news/external-events?${q}`);
    } catch (error) {
      console.error('API Error (getExternalEvents):', error);
      return { events: [], count: 0, error: error.message };
    }
  },

  getDashboardExternalEvents: async (limit = 8) => {
    const primary = await supplyChainApi.getExternalEvents('India logistics', limit);
    if ((primary.events || []).length >= Math.min(2, limit)) {
      return primary;
    }

    const fallbackResults = await Promise.allSettled(
      NEWS_FALLBACK_REGIONS.map((region) => supplyChainApi.getExternalEvents(region, 3))
    );
    const events = dedupeByIdentity(
      [
        ...(primary.events || []),
        ...fallbackResults.flatMap((result) => (
          result.status === 'fulfilled' && Array.isArray(result.value.events)
            ? result.value.events
            : []
        )),
      ],
      (item) => item.url || item.id || `${item.title}-${item.locationName}`
    ).slice(0, limit);

    return {
      events,
      count: events.length,
      source: primary.source || 'news_api_live',
      query: 'dashboard regional fallback',
      isMock: events.some((item) => item.isMock),
      error: primary.error || null,
    };
  },

  fastForward: async (hours = 1) => {
    try {
      return await fetchJson('/shipments/fast-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      });
    } catch (error) {
      console.error('API Error (fastForward):', error);
      return { success: false, error: error.message };
    }
  },

  getRerouteSuggestions: async () => {
    try {
      return await fetchJson('/disruptions/reroute-suggestions');
    } catch (error) {
      console.error('API Error (getRerouteSuggestions):', error);
      return { suggestions: [], count: 0, error: error.message };
    }
  },

  applyReroute: async (shipmentId, newRoute, disruptionId = null) => {
    try {
      return await fetchJson(`/shipments/${shipmentId}/apply-reroute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRoute, disruptionId }),
      });
    } catch (error) {
      console.error('API Error (applyReroute):', error);
      return { applied: false, error: error.message };
    }
  },

  getContracts: async () => {
    try {
      return await fetchJson('/contracts');
    } catch (error) {
      console.error('API Error (getContracts):', error);
      return { contracts: [], count: 0, error: error.message };
    }
  },

  createContract: async (payload) => {
    try {
      return await fetchJson('/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('API Error (createContract):', error);
      return { contract: null, error: error.message };
    }
  },

  getContractById: async (contractId) => {
    try {
      return await fetchJson(`/contracts/${contractId}`);
    } catch (error) {
      console.error('API Error (getContractById):', error);
      return { contract: null, error: error.message };
    }
  },

  getContractDrivers: async () => {
    try {
      return await fetchJson('/contracts/drivers');
    } catch (error) {
      console.error('API Error (getContractDrivers):', error);
      return { drivers: [], count: 0, error: error.message };
    }
  },

  getContractVehicles: async () => {
    try {
      return await fetchJson('/contracts/vehicles');
    } catch (error) {
      console.error('API Error (getContractVehicles):', error);
      return { vehicles: [], count: 0, error: error.message };
    }
  },

  transitionContract: async (contractId, action) => {
    try {
      return await fetchJson(`/contracts/${contractId}/${action}`, { method: 'POST' });
    } catch (error) {
      console.error(`API Error (transitionContract:${action}):`, error);
      return { contract: null, error: error.message };
    }
  },

  evaluateContractBreaches: async () => {
    try {
      return await fetchJson('/contracts/evaluate-breaches', { method: 'POST' });
    } catch (error) {
      console.error('API Error (evaluateContractBreaches):', error);
      return { breached: 0, contractIds: [], error: error.message };
    }
  },

  confirmContractHandoff: async (contractId, nodeId, message = null) => {
    try {
      return await fetchJson(`/contracts/${contractId}/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, message }),
      });
    } catch (error) {
      console.error('API Error (confirmContractHandoff):', error);
      return { contract: null, error: error.message };
    }
  },

  assignContractDriver: async (contractId, driverId, vehicleId = null) => {
    try {
      return await fetchJson(`/contracts/${contractId}/assign-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, vehicleId }),
      });
    } catch (error) {
      console.error('API Error (assignContractDriver):', error);
      return { contract: null, error: error.message };
    }
  },
};
