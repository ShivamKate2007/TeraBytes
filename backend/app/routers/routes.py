from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List
from app.services.firebase_service import firebase_service
from app.services.route_geometry_service import route_geometry_service

router = APIRouter()


class LatLng(BaseModel):
    lat: float
    lng: float


class RouteTraceRequest(BaseModel):
    points: List[LatLng] = Field(default_factory=list)

@router.get("/routes/graph")
async def get_route_graph():
    """Get full supply chain network graph (nodes + edges) for the React Map UI."""
    try:
        db = firebase_service.db
        if not db:
            return {"nodes": [], "edges": []}
        
        nodes = [doc.to_dict() for doc in db.collection("nodes").stream()]
        edges = [doc.to_dict() for doc in db.collection("edges").stream()]
        edges = await route_geometry_service.enrich_edges_with_geometry(nodes, edges)
        
        return {"nodes": nodes, "edges": edges}
    except Exception as e:
        print(f"[API ERROR] roots/graph: {e}")
        return {"error": str(e), "nodes": [], "edges": []}


@router.post("/routes/trace")
async def trace_route(request: RouteTraceRequest):
    """Get exact Google Directions route for a sequence of points (origin->...->destination)."""
    try:
        points = [p.model_dump() for p in request.points]
        path, source = await route_geometry_service.get_trace_path(points)
        return {"path": path, "pathSource": source, "pointCount": len(points)}
    except Exception as e:
        print(f"[API ERROR] routes/trace: {e}")
        return {"error": str(e), "path": [], "pathSource": "error", "pointCount": 0}
