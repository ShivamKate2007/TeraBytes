import networkx as nx
from typing import List, Dict, Optional
from app.utils.graph_builder import graph_builder

class RouteOptimizer:
    def __init__(self):
        self.base_graph = graph_builder.get_graph()

    def _get_dynamic_graph(self, blocked_edges: List[str] = None, high_risk_nodes: List[str] = None) -> nx.DiGraph:
        """
        Clones the base graph and dramatically penalizes blocked edges/nodes dynamically 
        so the A*/Dijkstra algorithm routes around them naturally.
        """
        G = self.base_graph.copy()
        
        if blocked_edges:
            for u, v, data in G.edges(data=True):
                if data.get('id') in blocked_edges:
                    # Effectively sever this path by maxing the cost/time
                    G[u][v]['time'] += 9999
                    G[u][v]['risk'] = 1.0
                    
        if high_risk_nodes:
            for u, v, data in G.edges(data=True):
                if v in high_risk_nodes:
                    G[u][v]['time'] *= 5.0 # High penalty for entering a risk-designated node
                    G[u][v]['risk'] = 0.9

        return G

    def find_optimal_route(self, origin: str, destination: str, 
                         blocked_edges: List[str] = None, 
                         high_risk_nodes: List[str] = None) -> Optional[Dict]:
        """Runs weighted search to find fastest, safest path around disruptions."""
        G = self._get_dynamic_graph(blocked_edges, high_risk_nodes)

        # Custom weight function: Heavy priority to time and risk
        def weight_func(u, v, d):
            return (d.get('time', 1.0) * 0.6) + (d.get('risk', 0.1) * 100 * 0.4)

        try:
            # Calculate shortest path mathematically
            path = nx.shortest_path(G, source=origin, target=destination, weight=weight_func)
            
            # Aggregate metrics for the resulting path
            total_time = sum(G[path[i]][path[i+1]]['time'] for i in range(len(path)-1))
            total_dist = sum(G[path[i]][path[i+1]]['distance'] for i in range(len(path)-1))
            avg_risk = sum(G[path[i]][path[i+1]]['risk'] for i in range(len(path)-1)) / max(1, (len(path)-1))
            
            return {
                "path": path,
                "totalDistance": round(total_dist, 1),
                "totalTime": round(total_time, 1),
                "totalCost": 0, # simplified for prototype
                "riskScore": round(avg_risk * 100, 1)
            }
        except nx.NetworkXNoPath:
            print(f"[RouteOptimizer] No valid path exists from {origin} to {destination}.")
            return None

route_optimizer = RouteOptimizer()
