/* ============================================================
   Mock API Data — Instant local data, no backend required
   ============================================================ */

// ─── Shipments ────────────────────────────────────────────────
export const MOCK_SHIPMENTS = [
  { id: 'SHP-001', origin: 'Shanghai', destination: 'Los Angeles', carrier: 'COSCO', status: 'at_risk', riskScore: 92, eta: new Date(Date.now() + 2 * 86400000).toISOString(), vessel: 'COSCO Shipping Universe', lat: 30.5, lng: -140.2, route: 'Trans-Pacific' },
  { id: 'SHP-002', origin: 'Rotterdam', destination: 'New York', carrier: 'Maersk', status: 'delayed', riskScore: 78, eta: new Date(Date.now() + 5 * 86400000).toISOString(), vessel: 'Maersk Elba', lat: 45.2, lng: -35.8, route: 'Atlantic' },
  { id: 'SHP-003', origin: 'Singapore', destination: 'Hamburg', carrier: 'MSC', status: 'on_time', riskScore: 21, eta: new Date(Date.now() + 8 * 86400000).toISOString(), vessel: 'MSC Gülsün', lat: 5.1, lng: 75.4, route: 'Asia-Europe' },
  { id: 'SHP-004', origin: 'Busan', destination: 'Seattle', carrier: 'HMM', status: 'on_time', riskScore: 15, eta: new Date(Date.now() + 3 * 86400000).toISOString(), vessel: 'HMM Algeciras', lat: 42.8, lng: 170.5, route: 'Trans-Pacific' },
  { id: 'SHP-005', origin: 'Felixstowe', destination: 'Jebel Ali', carrier: 'CMA CGM', status: 'at_risk', riskScore: 85, eta: new Date(Date.now() + 10 * 86400000).toISOString(), vessel: 'CMA CGM Antoine', lat: 14.3, lng: 45.0, route: 'Europe-Middle East' },
  { id: 'SHP-006', origin: 'Yokohama', destination: 'Long Beach', carrier: 'ONE', status: 'delayed', riskScore: 67, eta: new Date(Date.now() + 4 * 86400000).toISOString(), vessel: 'ONE Minoan', lat: 38.2, lng: -155.7, route: 'Trans-Pacific' },
  { id: 'SHP-007', origin: 'Antwerp', destination: 'Santos', carrier: 'Hapag-Lloyd', status: 'on_time', riskScore: 30, eta: new Date(Date.now() + 14 * 86400000).toISOString(), vessel: 'Berlin Express', lat: 10.5, lng: -28.2, route: 'Atlantic' },
  { id: 'SHP-008', origin: 'Mumbai', destination: 'Rotterdam', carrier: 'Evergreen', status: 'at_risk', riskScore: 88, eta: new Date(Date.now() + 7 * 86400000).toISOString(), vessel: 'Evergreen Ever Ace', lat: 18.0, lng: 58.5, route: 'Indian Ocean' },
  { id: 'SHP-009', origin: 'Guangzhou', destination: 'Felixstowe', carrier: 'COSCO', status: 'on_time', riskScore: 25, eta: new Date(Date.now() + 20 * 86400000).toISOString(), vessel: 'COSCO Development', lat: 8.4, lng: 98.3, route: 'Asia-Europe' },
  { id: 'SHP-010', origin: 'Baltimore', destination: 'Le Havre', carrier: 'MSC', status: 'delayed', riskScore: 55, eta: new Date(Date.now() + 6 * 86400000).toISOString(), vessel: 'MSC Loreto', lat: 44.0, lng: -42.1, route: 'Atlantic' },
  { id: 'SHP-011', origin: 'Port Klang', destination: 'Durban', carrier: 'Maersk', status: 'on_time', riskScore: 18, eta: new Date(Date.now() + 9 * 86400000).toISOString(), vessel: 'Maersk Kinloss', lat: -8.6, lng: 75.2, route: 'Indian Ocean' },
  { id: 'SHP-012', origin: 'Tianjin', destination: 'Vancouver', carrier: 'CMA CGM', status: 'at_risk', riskScore: 71, eta: new Date(Date.now() + 11 * 86400000).toISOString(), vessel: 'CMA CGM Trocadero', lat: 50.3, lng: 168.8, route: 'Trans-Pacific' },
];

export const MOCK_KPIS = {
  total_shipments: { value: 1284, delta: 3.2, deltaDir: 'up' },
  at_risk: { value: 47, delta: 12.5, deltaDir: 'up' },
  avg_delay: { value: 18.4, delta: 5.8, deltaDir: 'down' },
  on_time: { value: 86.3, delta: 1.2, deltaDir: 'up' },
  disruptions: { value: 12, delta: 2, deltaDir: 'down' },
};

// ─── Alerts ────────────────────────────────────────────────────
export const MOCK_ALERTS = [
  { id: 'ALT-001', severity: 'critical', type: 'port_congestion', title: 'Shanghai Port Congestion', description: 'Vessel backlog: 42 ships waiting. Avg wait time increased to 8.3 days.', timestamp: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: 'ALT-002', severity: 'high', type: 'weather_event', title: 'Typhoon Warning — East China Sea', description: 'Category 3 typhoon approaching. 12 vessels rerouting via longer paths.', timestamp: new Date(Date.now() - 18 * 60000).toISOString() },
  { id: 'ALT-003', severity: 'high', type: 'geopolitical', title: 'Red Sea Transit Suspended', description: 'Carrier consortium pausing Red Sea transits. Cape of Good Hope adds 12 days.', timestamp: new Date(Date.now() - 45 * 60000).toISOString() },
  { id: 'ALT-004', severity: 'medium', type: 'customs_delay', title: 'Rotterdam Customs Strike', description: 'Partial work stoppage affecting 20% of gate operations.', timestamp: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 'ALT-005', severity: 'medium', type: 'default', title: 'Carrier Alliance Capacity Cut', description: 'MSC reducing Asia–Europe capacity by 18% for Q2 2025.', timestamp: new Date(Date.now() - 4 * 3600000).toISOString() },
  { id: 'ALT-006', severity: 'critical', type: 'port_congestion', title: 'Long Beach Dwell Time Spike', description: 'Container dwell time up 340% due to rail disruption. Action required.', timestamp: new Date(Date.now() - 6 * 3600000).toISOString() },
  { id: 'ALT-007', severity: 'low', type: 'weather', title: 'North Atlantic Swells — Watch', description: 'Wave heights 8–10m forecast. Monitor vessels on Atlantic routes.', timestamp: new Date(Date.now() - 12 * 3600000).toISOString() },
];

// ─── Disruptions ───────────────────────────────────────────────
export const MOCK_DISRUPTIONS = [
  { id: 'DIS-001', type: 'port_congestion', severity: 'critical', region: 'Asia-Pacific', location: 'Shanghai', title: 'Shanghai Port Congestion', affectedShipments: 142, estimatedDelay: 8.3 },
  { id: 'DIS-002', type: 'geopolitical', severity: 'high', region: 'Middle East', location: 'Red Sea', title: 'Red Sea Security Alert', affectedShipments: 87, estimatedDelay: 12 },
  { id: 'DIS-003', type: 'weather', severity: 'high', region: 'Asia-Pacific', location: 'East China Sea', title: 'Typhoon Season Disruption', affectedShipments: 56, estimatedDelay: 3 },
  { id: 'DIS-004', type: 'labor_strike', severity: 'medium', region: 'Europe', location: 'Rotterdam', title: 'Rotterdam Customs Strike', affectedShipments: 23, estimatedDelay: 2 },
  { id: 'DIS-005', type: 'infrastructure', severity: 'medium', region: 'North America', location: 'Long Beach', title: 'Rail Network Failure', affectedShipments: 31, estimatedDelay: 4 },
];

export const MOCK_HEATMAP = [
  { lat: 31.2, lng: 121.5, weight: 0.95 }, // Shanghai
  { lat: 51.9, lng: 4.5, weight: 0.75 },   // Rotterdam
  { lat: 33.7, lng: -118.3, weight: 0.82 }, // Long Beach
  { lat: 1.3, lng: 103.8, weight: 0.55 },  // Singapore
  { lat: 35.4, lng: 139.6, weight: 0.48 }, // Tokyo Bay
  { lat: 22.3, lng: 114.2, weight: 0.62 }, // Hong Kong
  { lat: 40.5, lng: -74.0, weight: 0.41 }, // New York
];

// ─── Analytics ─────────────────────────────────────────────────
export const MOCK_DISRUPTION_TRENDS = [
  { month: 'Oct', disruptions: 8, delay: 14.2, onTime: 89 },
  { month: 'Nov', disruptions: 11, delay: 16.8, onTime: 87 },
  { month: 'Dec', disruptions: 15, delay: 21.3, onTime: 83 },
  { month: 'Jan', disruptions: 13, delay: 19.5, onTime: 85 },
  { month: 'Feb', disruptions: 10, delay: 17.1, onTime: 87 },
  { month: 'Mar', disruptions: 12, delay: 18.4, onTime: 86 },
];

export const MOCK_CARRIER_PERFORMANCE = [
  { carrier: 'Maersk', onTime: 91.2, avgDelay: 12.4, reliability: 4.5 },
  { carrier: 'MSC', onTime: 88.7, avgDelay: 15.2, reliability: 4.2 },
  { carrier: 'CMA CGM', onTime: 86.3, avgDelay: 17.8, reliability: 4.0 },
  { carrier: 'COSCO', onTime: 83.1, avgDelay: 20.1, reliability: 3.8 },
  { carrier: 'Hapag-Lloyd', onTime: 89.5, avgDelay: 13.8, reliability: 4.3 },
  { carrier: 'ONE', onTime: 85.9, avgDelay: 18.3, reliability: 3.9 },
];

export const MOCK_ROUTE_RISKS = [
  { route: 'Trans-Pacific', risk: 72, shipments: 342, avgDelay: 21 },
  { route: 'Asia-Europe', risk: 85, shipments: 287, avgDelay: 18 },
  { route: 'Atlantic', risk: 38, shipments: 198, avgDelay: 8 },
  { route: 'Indian Ocean', risk: 55, shipments: 156, avgDelay: 14 },
  { route: 'Europe-Middle East', risk: 91, shipments: 89, avgDelay: 28 },
];

// ─── Shipment detail / timeline ─────────────────────────────────
export function getMockShipmentDetail(id) {
  const base = MOCK_SHIPMENTS.find((s) => s.id === id) || MOCK_SHIPMENTS[0];
  return {
    ...base,
    weight: '28,400 kg',
    volume: '62 TEU',
    commodity: 'Electronics',
    incoterm: 'FOB',
    customer: 'SupplyChain Corp.',
    riskFactors: [
      { factor: 'Port Congestion', impact: 'high', description: 'Origin port handling delays' },
      { factor: 'Weather', impact: 'medium', description: 'Seasonal swells on route' },
    ],
  };
}

export function getMockTimeline(id) {
  return [
    { event: 'Order Created', timestamp: new Date(Date.now() - 20 * 86400000).toISOString(), location: 'System', status: 'completed' },
    { event: 'Cargo Picked Up', timestamp: new Date(Date.now() - 18 * 86400000).toISOString(), location: 'Warehouse', status: 'completed' },
    { event: 'Departed Origin Port', timestamp: new Date(Date.now() - 15 * 86400000).toISOString(), location: MOCK_SHIPMENTS.find(s => s.id === id)?.origin || 'Origin', status: 'completed' },
    { event: 'In Transit', timestamp: new Date(Date.now() - 5 * 86400000).toISOString(), location: 'Ocean', status: 'in_progress' },
    { event: 'Estimated Arrival', timestamp: new Date(Date.now() + 5 * 86400000).toISOString(), location: MOCK_SHIPMENTS.find(s => s.id === id)?.destination || 'Destination', status: 'pending' },
  ];
}
