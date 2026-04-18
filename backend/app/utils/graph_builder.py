import networkx as nx
import json
import os

class GraphBuilder:
    def __init__(self):
        self.graph = nx.DiGraph()
        self.load_graph()

    def load_graph(self):
        """Loads static supply chain topology into a NetworkX Directed Graph."""
        nodes_path = os.path.join(os.path.dirname(__file__), '../data/india_nodes.json')
        edges_path = os.path.join(os.path.dirname(__file__), '../data/india_edges.json')

        try:
            with open(nodes_path, 'r') as f:
                nodes_data = json.load(f)
            with open(edges_path, 'r') as f:
                edges_data = json.load(f)

            # Add nodes with metadata
            for node in nodes_data:
                self.graph.add_node(
                    node['id'], 
                    name=node['name'], 
                    type=node['type'], 
                    lat=node['lat'], 
                    lng=node['lng']
                )

            # Add edges with weights (Cost, Time, Distance, Base Risk)
            for edge in edges_data:
                self.graph.add_edge(
                    edge['fromNode'],
                    edge['toNode'],
                    id=edge['id'],
                    distance=edge['distance'],
                    time=edge['avgTransitTime'],
                    cost=edge['cost'],
                    risk=edge['riskFactor'],
                    mode=edge['mode']
                )

            print(f"[GraphBuilder] Constructed graph with {self.graph.number_of_nodes()} nodes and {self.graph.number_of_edges()} edges.")
        except Exception as e:
            print(f"[GraphBuilder] Failed to initialize graph state: {e}")

    def get_graph(self) -> nx.DiGraph:
        """Returns the base static graph"""
        return self.graph

graph_builder = GraphBuilder()
