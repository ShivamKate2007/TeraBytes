"""Route and Graph Pydantic models"""
from pydantic import BaseModel
from typing import Optional, List


class Node(BaseModel):
    id: str
    name: str
    type: str  # manufacturer, warehouse, transport_hub, distribution_center, retailer
    lat: float
    lng: float
    capacity: int = 1000
    currentLoad: int = 0
    status: str = "operational"
    region: str = ""


class Edge(BaseModel):
    id: str
    fromNode: str  # 'from' is reserved in Python
    toNode: str
    distance: float  # km
    avgTransitTime: float  # hours
    cost: float  # INR
    mode: str = "road"  # road, rail, sea, air
    riskFactor: float = 0.3
    status: str = "active"


class Route(BaseModel):
    path: List[str]  # list of node IDs
    totalDistance: float
    totalTime: float
    totalCost: float
    riskScore: float = 0


class RouteComparison(BaseModel):
    original: Route
    alternative: Route
    timeDelta: float
    costDelta: float
    riskDelta: float
    recommendation: str = ""
