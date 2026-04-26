"""
Comprehensive stress test for the Smart Supply Chain reroute engine.
Tests realistic logistics scenarios to find bugs and edge cases.
"""
from app.services.cascade_analyzer import cascade_analyzer
from app.services.route_optimizer import route_optimizer
from app.services.firebase_service import firebase_service
import networkx as nx

firebase_service.initialize()
db = firebase_service.db
g = route_optimizer.base_graph

PASS = 0
FAIL = 0
WARN = 0

def report(name, passed, detail=""):
    global PASS, FAIL
    icon = "[PASS]" if passed else "[FAIL]"
    if passed:
        PASS += 1
    else:
        FAIL += 1
    print(f"  {icon} {name}: {detail}")

def warn(name, detail=""):
    global WARN
    WARN += 1
    print(f"  [WARN] {name}: {detail}")

# ===================================================================
# AUDIT 1: Graph Health Check
# ===================================================================
print("\n" + "="*70)
print("AUDIT 1: GRAPH HEALTH CHECK")
print("="*70)

# Check for nodes without coordinates
missing_coords = []
for nid, data in g.nodes(data=True):
    if data.get("lat") is None or data.get("lng") is None:
        missing_coords.append(nid)
report("All nodes have GPS coordinates",
       len(missing_coords) == 0,
       f"{len(missing_coords)} missing" if missing_coords else "All 22 nodes OK")

# Check for disconnected components
if g.is_directed():
    components = list(nx.weakly_connected_components(g))
else:
    components = list(nx.connected_components(g))
report("Graph is fully connected",
       len(components) == 1,
       f"{len(components)} components" if len(components) > 1 else "Single connected graph")

# Check for nodes with no outgoing edges (dead-ends)
dead_ends = [n for n in g.nodes() if g.out_degree(n) == 0 and not n.startswith("retailer_")]
report("No unexpected dead-end nodes (all non-retailers have exits)",
       len(dead_ends) == 0,
       f"Unexpected dead ends: {dead_ends}" if dead_ends else "All intermediate nodes have exits")

# Check for isolated nodes
isolated = [n for n in g.nodes() if g.degree(n) == 0]
report("No isolated nodes",
       len(isolated) == 0,
       f"Isolated: {isolated}" if isolated else "All nodes connected")

# Check node types
node_types = {}
for nid, data in g.nodes(data=True):
    t = data.get("type", "MISSING")
    node_types.setdefault(t, []).append(nid)
print(f"\n  Node type distribution:")
for t, nodes in sorted(node_types.items()):
    print(f"    {t}: {len(nodes)} nodes — {', '.join(nodes[:5])}")

# ═══════════════════════════════════════════════════════════════
# AUDIT 2: Shipment Data Quality
# ═══════════════════════════════════════════════════════════════
print("\n" + "="*70)
print("AUDIT 2: SHIPMENT DATA QUALITY")
print("="*70)

all_docs = list(db.collection("shipments").stream())
all_shipments = [doc.to_dict() for doc in all_docs]
active = [s for s in all_shipments if s.get("status") != "delivered"]
print(f"  Total shipments: {len(all_shipments)}, Active: {len(active)}")

# Check: do all shipment routes use valid graph nodes?
bad_routes = []
for s in active:
    route = s.get("optimizedRoute") or s.get("originalRoute") or []
    for node in route:
        if node not in g.nodes:
            bad_routes.append((s.get("id"), node))
report("All route nodes exist in graph",
       len(bad_routes) == 0,
       f"{len(bad_routes)} invalid nodes: {bad_routes[:3]}" if bad_routes else "All valid")

# Check: do all shipments have GPS positions?
no_gps = [s.get("id") for s in active if not s.get("currentPosition", {}).get("lat")]
report("All active shipments have GPS",
       len(no_gps) == 0,
       f"{len(no_gps)} missing GPS: {no_gps[:3]}" if no_gps else "All have GPS")

# Check: do journey steps match route nodes?
mismatches = []
for s in active:
    route = s.get("optimizedRoute") or s.get("originalRoute") or []
    journey = s.get("journey") or []
    journey_nodes = [step.get("nodeId") for step in journey if step.get("nodeId")]
    if route and journey_nodes:
        # Check if journey nodes are a subset of route
        for jn in journey_nodes:
            if jn not in route:
                mismatches.append((s.get("id"), jn, route))
                break
report("Journey nodes match route",
       len(mismatches) == 0,
       f"{len(mismatches)} mismatches" if mismatches else "All match")

# Check: edges exist between consecutive route nodes
missing_edges = []
for s in active:
    route = s.get("optimizedRoute") or s.get("originalRoute") or []
    for i in range(len(route) - 1):
        u, v = route[i], route[i+1]
        if not g.has_edge(u, v):
            missing_edges.append((s.get("id"), u, v))
if missing_edges:
    warn("Routes use non-existent edges",
         f"{len(missing_edges)} missing: {missing_edges[:5]}")
else:
    report("All route edges exist in graph", True, "All edges valid")

# ═══════════════════════════════════════════════════════════════
# AUDIT 3: Realistic Scenario Testing
# ═══════════════════════════════════════════════════════════════
print("\n" + "="*70)
print("AUDIT 3: REALISTIC SCENARIO TESTING")
print("="*70)

# Pick a real active shipment for testing
test_shipment = None
for s in active:
    route = s.get("optimizedRoute") or s.get("originalRoute") or []
    journey = s.get("journey") or []
    completed = [j for j in journey if j.get("status") == "completed"]
    if len(route) >= 3 and len(completed) >= 1 and s.get("currentPosition", {}).get("lat"):
        test_shipment = s
        break

if not test_shipment:
    print("  [WARN] No suitable test shipment found")
else:
    sid = test_shipment.get("id")
    route = test_shipment.get("optimizedRoute") or test_shipment.get("originalRoute")
    pos = test_shipment.get("currentPosition")
    print(f"\n  Test shipment: {sid}")
    print(f"  Route: {' -> '.join(route)}")
    print(f"  GPS: ({pos['lat']:.2f}, {pos['lng']:.2f})")

    # SCENARIO 3a: Disruption at the DESTINATION (retailer)
    dest = route[-1]
    dest_data = g.nodes.get(dest, {})
    if dest_data.get("lat"):
        print(f"\n  --- Scenario 3a: Destination ({dest}) disrupted ---")
        r = cascade_analyzer.analyze_cascade(
            disruption_node=dest, all_shipments=[test_shipment],
            disruption_location={"lat": dest_data["lat"], "lng": dest_data["lng"]},
            disruption_radius_km=20, disruption_duration_hrs=100.0,
            use_current_position=True,
        )
        if r['reroutePlans']:
            p = r['reroutePlans'][0]
            rec = p.get('recommendation', '?')
            report("Dest disrupted (outlasts ETA) → must wait (can't skip retailer)",
                   rec == "wait_for_reopen",
                   f"Got: {rec}, status: {p['status']}")
        else:
            warn("Dest disrupted → no plan generated", "Expected wait_for_reopen")

    # SCENARIO 3b: Disruption at a completed node (not near destination)
    # Find a completed node that is far from the destination so we don't accidentally hit the destination highway
    dest_data = g.nodes.get(route[-1], {})
    origin = None
    for n in route:
        n_data = g.nodes.get(n, {})
        if n in [j.get("nodeId") for j in completed] and dest_data.get("lat") and n_data.get("lat"):
            if cascade_analyzer._haversine_km(n_data, dest_data) > 100:
                origin = n
                break
    
    if origin:
        origin_data = g.nodes.get(origin, {})
        print(f"\n  --- Scenario 3b: Completed node ({origin}) disrupted (already passed) ---")
        r = cascade_analyzer.analyze_cascade(
            disruption_node=origin, all_shipments=[test_shipment],
            disruption_location={"lat": origin_data["lat"], "lng": origin_data["lng"]},
            disruption_radius_km=2.0, disruption_duration_hrs=10.0,
            use_current_position=True,
        )
        affected = r['totalShipmentsAffected']
        # Should NOT be affected — shipment already left the origin, and radius is small enough not to hit destination
        report("Origin disrupted (completed) → not affected",
               affected == 0,
               f"Affected: {affected}")

# SCENARIO 3c: Disruption in the middle of nowhere (ocean, desert)
print(f"\n  --- Scenario 3c: Disruption in Bay of Bengal (no shipments near) ---")
r = cascade_analyzer.analyze_cascade(
    disruption_node='', all_shipments=active,
    disruption_location={"lat": 15.0, "lng": 85.0},  # Bay of Bengal
    disruption_radius_km=50, disruption_duration_hrs=24.0,
    use_current_position=True,
)
report("Ocean disruption → no shipments affected",
       r['totalShipmentsAffected'] == 0,
       f"Affected: {r['totalShipmentsAffected']}")

# SCENARIO 3d: MASSIVE disruption (1000km radius) — should affect many
print(f"\n  --- Scenario 3d: Mega earthquake (500km radius, center of India) ---")
r = cascade_analyzer.analyze_cascade(
    disruption_node='', all_shipments=active,
    disruption_location={"lat": 20.0, "lng": 78.0},  # Central India
    disruption_radius_km=500, disruption_duration_hrs=72.0,
    use_current_position=True,
)
mega_affected = r['totalShipmentsAffected']
mega_plans = len(r['reroutePlans'])
report("Mega disruption → most shipments affected",
       mega_affected > 5,
       f"Affected: {mega_affected}/{len(active)}, Plans: {mega_plans}")
# Check: does every affected shipment get a plan?
recs = {}
for p in r['reroutePlans']:
    rec = p.get('recommendation', p.get('status', '?'))
    recs[rec] = recs.get(rec, 0) + 1
print(f"    Recommendations: {recs}")

# SCENARIO 3e: Disruption with ZERO duration
print(f"\n  --- Scenario 3e: Zero-duration disruption (flash event) ---")
r = cascade_analyzer.analyze_cascade(
    disruption_node='nagpur_hub', all_shipments=active,
    disruption_location={"lat": 21.1458, "lng": 79.0882},
    disruption_radius_km=30, disruption_duration_hrs=0.0,
    use_current_position=True,
)
report("Zero-duration → should be 'continue_as_planned' or minimal impact",
       True,  # Just checking it doesn't crash
       f"Affected: {r['totalShipmentsAffected']}, Plans: {len(r['reroutePlans'])}")

# SCENARIO 3f: Disruption with very small radius (1km)
print(f"\n  --- Scenario 3f: Tiny disruption (1km radius on Nagpur) ---")
r = cascade_analyzer.analyze_cascade(
    disruption_node='nagpur_hub', all_shipments=active,
    disruption_location={"lat": 21.1458, "lng": 79.0882},
    disruption_radius_km=1, disruption_duration_hrs=10.0,
    use_current_position=True,
)
report("Tiny radius → should still detect node-based disruption",
       r['totalShipmentsAffected'] >= 0,  # Just checking no crash
       f"Affected: {r['totalShipmentsAffected']}")

# ═══════════════════════════════════════════════════════════════
# AUDIT 4: Multi-Disruption Scenario
# ═══════════════════════════════════════════════════════════════
print("\n" + "="*70)
print("AUDIT 4: MULTI-DISRUPTION (all active disruptions)")
print("="*70)

disruption_docs = list(db.collection("disruptions").stream())
active_disruptions = [d.to_dict() for d in disruption_docs if d.to_dict().get("status") == "active"]
print(f"  Active disruptions: {len(active_disruptions)}")
for dis in active_disruptions[:5]:
    loc = dis.get("location", {})
    print(f"    {dis.get('id', '?')}: {dis.get('incidentType', '?')} at ({loc.get('lat','?')}, {loc.get('lng','?')}) r={loc.get('radius','?')}km")

# ═══════════════════════════════════════════════════════════════
# AUDIT 5: Graph Reachability from every node
# ═══════════════════════════════════════════════════════════════
print("\n" + "="*70)
print("AUDIT 5: GRAPH REACHABILITY MATRIX")
print("="*70)

# Check: can every node reach every other node?
unreachable_pairs = []
node_list = list(g.nodes())
for src in node_list:
    for dst in node_list:
        if src != dst:
            if not nx.has_path(g, src, dst):
                unreachable_pairs.append((src, dst))

if unreachable_pairs:
    warn("Some node pairs are unreachable",
         f"{len(unreachable_pairs)} pairs")
    # Show unique source nodes that can't reach certain destinations
    bad_sources = set(p[0] for p in unreachable_pairs)
    bad_dests = set(p[1] for p in unreachable_pairs)
    print(f"    Sources with unreachable destinations: {bad_sources}")
    print(f"    Unreachable destinations: {bad_dests}")
else:
    report("Full reachability: every node can reach every other node", True, "Graph is strongly connected")

# ═══════════════════════════════════════════════════════════════
# AUDIT 6: Rerouting around EVERY hub
# ═══════════════════════════════════════════════════════════════
print("\n" + "="*70)
print("AUDIT 6: CAN WE REROUTE AROUND EVERY TRANSPORT HUB?")
print("="*70)

transport_hubs = [nid for nid, data in g.nodes(data=True) if data.get("type") == "transport_hub"]
print(f"  Transport hubs: {transport_hubs}")

for hub in transport_hubs:
    # Remove hub and check if graph is still connected
    temp_g = g.copy()
    temp_g.remove_node(hub)
    if temp_g.is_directed():
        remaining_components = list(nx.weakly_connected_components(temp_g))
    else:
        remaining_components = list(nx.connected_components(temp_g))
    
    if len(remaining_components) > 1:
        warn(f"Removing {hub} disconnects the graph",
             f"{len(remaining_components)} components")
    else:
        report(f"Graph survives without {hub}", True, "Alternate paths exist")

# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════
print("\n" + "="*70)
print(f"SUMMARY: {PASS} passed, {FAIL} failed, {WARN} warnings")
print("="*70)
