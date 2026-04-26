import math
import networkx as nx
from typing import List, Dict, Optional, Tuple
from app.utils.graph_builder import graph_builder


class RouteOptimizer:
    def __init__(self):
        self.base_graph = graph_builder.get_graph()

    # ── Dynamic Node Injection ────────────────────────────────────────

    def inject_disruption(
        self,
        graph: nx.DiGraph,
        disruption_lat: float,
        disruption_lng: float,
        radius_km: float,
        disruption_id: str = "DIS",
    ) -> Tuple[nx.DiGraph, List[str], List[str]]:
        """
        Dynamic Node Injection: for ANY arbitrary GPS disruption point,
        find all graph edges whose path segment falls within the disruption
        radius, inject temporary nodes at the disruption zone, and block them.

        Returns: (modified_graph, injected_node_ids, blocked_edge_ids)
        
        This uses ZERO external API calls — purely haversine math + graph ops.
        """
        G = graph.copy()
        injected_nodes = []
        blocked_edge_ids = []
        disruption_point = {"lat": disruption_lat, "lng": disruption_lng}

        # 1. Find all edges within the disruption radius
        affected_edges = []
        for u, v, data in list(G.edges(data=True)):
            u_data = G.nodes.get(u, {})
            v_data = G.nodes.get(v, {})
            if u_data.get("lat") is None or v_data.get("lat") is None:
                continue

            u_point = {"lat": float(u_data["lat"]), "lng": float(u_data["lng"])}
            v_point = {"lat": float(v_data["lat"]), "lng": float(v_data["lng"])}

            # Check if disruption point is close to this edge segment
            seg_dist = self._point_to_segment_distance_km(disruption_point, u_point, v_point)
            endpoint_dist = min(
                self._haversine_km(disruption_point, u_point),
                self._haversine_km(disruption_point, v_point),
            )

            # Edge is affected if disruption is within radius of the road segment
            if seg_dist <= radius_km or endpoint_dist <= radius_km:
                affected_edges.append((u, v, data, seg_dist))

        if not affected_edges:
            return G, [], []

        # 2. For each affected edge, inject a temporary disruption node
        for idx, (u, v, edge_data, seg_dist) in enumerate(affected_edges):
            edge_id = edge_data.get("id", f"{u}->{v}")

            # Compute where on the edge the disruption is closest (projection ratio)
            u_data = G.nodes[u]
            v_data = G.nodes[v]
            t = self._project_point_onto_segment(
                disruption_point,
                {"lat": float(u_data["lat"]), "lng": float(u_data["lng"])},
                {"lat": float(v_data["lat"]), "lng": float(v_data["lng"])},
            )

            # Create a unique temp node ID
            temp_node_id = f"_disruption_{disruption_id}_{idx}"
            
            # Interpolate position for the temp node
            temp_lat = float(u_data["lat"]) + t * (float(v_data["lat"]) - float(u_data["lat"]))
            temp_lng = float(u_data["lng"]) + t * (float(v_data["lng"]) - float(u_data["lng"]))

            # Add the temporary node
            G.add_node(
                temp_node_id,
                name=f"Disruption Zone ({disruption_id})",
                type="disruption_zone",
                lat=temp_lat,
                lng=temp_lng,
                is_temporary=True,
                disruption_id=disruption_id,
            )
            injected_nodes.append(temp_node_id)

            # Split the original edge into two sub-edges
            original_time = float(edge_data.get("time", 1.0))
            original_dist = float(edge_data.get("distance", 100))
            original_cost = float(edge_data.get("cost", 5000))
            original_risk = float(edge_data.get("risk", 0.3))
            mode = edge_data.get("mode", "road")

            t_clamped = max(0.05, min(0.95, t))

            # Remove affected road instead of giving it a huge fake travel time.
            # Fake penalties leak into ETA displays and create impossible routes.
            if G.has_edge(u, v):
                G.remove_edge(u, v)
            blocked_edge_ids.append(edge_id)

            # Also block reverse edge if it exists (bidirectional roads)
            if G.has_edge(v, u):
                rev_data = dict(G[v][u])
                rev_id = rev_data.get("id", f"{v}->{u}")
                G.remove_edge(v, u)
                blocked_edge_ids.append(rev_id)

        return G, injected_nodes, blocked_edge_ids

    def find_route_around_disruption(
        self,
        origin: str,
        destination: str,
        disruption_lat: float,
        disruption_lng: float,
        radius_km: float,
        disruption_id: str = "DIS",
    ) -> Optional[Dict]:
        """
        High-level API: find the best route that avoids an arbitrary GPS disruption.
        Uses Dynamic Node Injection internally. Zero external API calls.
        
        Returns the same format as find_optimal_route, plus:
        - injectedNodes: list of temp node IDs
        - cleanPath: path with temp nodes filtered out (for display)
        """
        # Try strict directed graph
        base = self.base_graph.copy()
        G, injected, blocked = self.inject_disruption(
            base, disruption_lat, disruption_lng, radius_km, disruption_id
        )
        result = self._solve_on_graph(G, origin, destination)
        if result:
            result["solverMode"] = "dynamic_injection_strict"
            result["injectedNodes"] = injected
            result["cleanPath"] = [n for n in result["path"] if not n.startswith("_disruption_")]
            return result

        # Try with bidirectional edges for more bypass options
        bidir = self._with_bidirectional_land(self.base_graph.copy())
        G2, injected2, blocked2 = self.inject_disruption(
            bidir, disruption_lat, disruption_lng, radius_km, disruption_id
        )
        result2 = self._solve_on_graph(G2, origin, destination)
        if result2:
            result2["solverMode"] = "dynamic_injection_bidirectional"
            result2["injectedNodes"] = injected2
            result2["cleanPath"] = [n for n in result2["path"] if not n.startswith("_disruption_")]
            return result2

        return None

    # ── Geometry helpers (no API calls) ───────────────────────────────

    @staticmethod
    def _haversine_km(a: Dict, b: Dict) -> float:
        r = 6371.0
        lat1, lng1 = math.radians(float(a["lat"])), math.radians(float(a["lng"]))
        lat2, lng2 = math.radians(float(b["lat"])), math.radians(float(b["lng"]))
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
        return 2 * r * math.asin(math.sqrt(max(0.0, h)))

    @staticmethod
    def _point_to_segment_distance_km(p: Dict, a: Dict, b: Dict) -> float:
        """Distance from point p to line segment a-b, in km (flat approx)."""
        px, py = float(p["lat"]), float(p["lng"])
        ax, ay = float(a["lat"]), float(a["lng"])
        bx, by = float(b["lat"]), float(b["lng"])
        abx, aby = bx - ax, by - ay
        apx, apy = px - ax, py - ay
        ab_len2 = abx * abx + aby * aby
        if ab_len2 < 1e-12:
            d_deg = math.sqrt(apx ** 2 + apy ** 2)
        else:
            t = max(0.0, min(1.0, (apx * abx + apy * aby) / ab_len2))
            cx = ax + t * abx
            cy = ay + t * aby
            d_deg = math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
        # Convert degree distance to approximate km
        return d_deg * 111.0

    @staticmethod
    def _project_point_onto_segment(p: Dict, a: Dict, b: Dict) -> float:
        """Returns t ∈ [0,1] — where the projection of p falls on segment a-b."""
        px, py = float(p["lat"]), float(p["lng"])
        ax, ay = float(a["lat"]), float(a["lng"])
        bx, by = float(b["lat"]), float(b["lng"])
        abx, aby = bx - ax, by - ay
        apx, apy = px - ax, py - ay
        ab_len2 = abx * abx + aby * aby
        if ab_len2 < 1e-12:
            return 0.0
        return max(0.0, min(1.0, (apx * abx + apy * aby) / ab_len2))

    # ── Standard graph operations (unchanged) ─────────────────────────

    def _get_dynamic_graph(self, blocked_edges: List[str] = None, high_risk_nodes: List[str] = None) -> nx.DiGraph:
        """
        Clones the base graph and dramatically penalizes blocked edges/nodes dynamically 
        so the A*/Dijkstra algorithm routes around them naturally.
        """
        G = self.base_graph.copy()
        
        if blocked_edges:
            to_remove = []
            for u, v, data in list(G.edges(data=True)):
                if data.get('id') in blocked_edges:
                    to_remove.append((u, v))
            for u, v in to_remove:
                if G.has_edge(u, v):
                    G.remove_edge(u, v)
                    
        if high_risk_nodes:
            for u, v, data in G.edges(data=True):
                if v in high_risk_nodes:
                    G[u][v]['time'] *= 5.0
                    G[u][v]['risk'] = 0.9

        return G

    def _with_bidirectional_land(self, graph: nx.DiGraph) -> nx.DiGraph:
        """
        Relaxed routing mode for realistic traffic:
        if a road/rail edge exists one-way in sample data, add reverse edge when missing.
        """
        G = graph.copy()
        for u, v, data in list(graph.edges(data=True)):
            mode = str(data.get("mode", "")).lower()
            if mode not in {"road", "rail"}:
                continue
            if G.has_edge(v, u):
                continue
            reverse = dict(data)
            if reverse.get("id"):
                reverse["id"] = f"{reverse['id']}_rev"
            G.add_edge(v, u, **reverse)
        return G

    def _solve_on_graph(self, G: nx.DiGraph, origin: str, destination: str) -> Optional[Dict]:
        def weight_func(u, v, d):
            return (d.get('time', 1.0) * 0.6) + (d.get('risk', 0.1) * 100 * 0.4)

        try:
            path = nx.shortest_path(G, source=origin, target=destination, weight=weight_func)
            total_time = sum(G[path[i]][path[i+1]]['time'] for i in range(len(path)-1))
            total_dist = sum(G[path[i]][path[i+1]]['distance'] for i in range(len(path)-1))
            avg_risk = sum(G[path[i]][path[i+1]]['risk'] for i in range(len(path)-1)) / max(1, (len(path)-1))
            return {
                "path": path,
                "totalDistance": round(total_dist, 1),
                "totalTime": round(total_time, 1),
                "totalCost": 0,
                "riskScore": round(avg_risk * 100, 1),
            }
        except nx.NetworkXNoPath:
            return None
        except nx.NodeNotFound:
            return None

    def find_optimal_route(self, origin: str, destination: str, 
                         blocked_edges: List[str] = None, 
                         high_risk_nodes: List[str] = None) -> Optional[Dict]:
        """Runs weighted search to find fastest, safest path around disruptions."""
        strict_graph = self._get_dynamic_graph(blocked_edges, high_risk_nodes)
        strict = self._solve_on_graph(strict_graph, origin, destination)
        if strict:
            strict["solverMode"] = "directed_strict"
            return strict

        if blocked_edges:
            relaxed_block = self._get_dynamic_graph(None, high_risk_nodes)
            candidate = self._solve_on_graph(relaxed_block, origin, destination)
            if candidate:
                candidate["solverMode"] = "directed_relaxed_blocking"
                return candidate

        bidirectional = self._with_bidirectional_land(self._get_dynamic_graph(blocked_edges, high_risk_nodes))
        candidate = self._solve_on_graph(bidirectional, origin, destination)
        if candidate:
            candidate["solverMode"] = "bidirectional_road"
            return candidate

        if blocked_edges:
            bidirectional_relaxed = self._with_bidirectional_land(self._get_dynamic_graph(None, high_risk_nodes))
            candidate = self._solve_on_graph(bidirectional_relaxed, origin, destination)
            if candidate:
                candidate["solverMode"] = "bidirectional_relaxed_blocking"
                return candidate

        print(f"[RouteOptimizer] No valid path exists from {origin} to {destination}.")
        return None


route_optimizer = RouteOptimizer()
