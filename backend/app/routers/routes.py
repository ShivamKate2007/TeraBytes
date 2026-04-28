from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import List
from app.services.firebase_service import firebase_service
from app.services.route_geometry_service import route_geometry_service
from app.services.auth_service import get_current_user
from app.services.access_control import scope_graph

router = APIRouter()


class LatLng(BaseModel):
    lat: float
    lng: float


class RouteTraceRequest(BaseModel):
    points: List[LatLng] = Field(default_factory=list)

@router.get("/routes/graph")
async def get_route_graph(current_user: dict = Depends(get_current_user)):
    """
    Get supply-chain topology only.

    Google Directions is intentionally not called here. The optimizer and simulator
    make decisions from this graph, while /routes/trace enriches selected/final
    paths with real road geometry and ETA for visualization.
    """
    try:
        db = firebase_service.db
        if not db:
            return {"nodes": [], "edges": []}
        
        nodes = [doc.to_dict() for doc in db.collection("nodes").stream()]
        edges = [doc.to_dict() for doc in db.collection("edges").stream()]
        shipments = [doc.to_dict() for doc in db.collection("shipments").stream()]
        nodes, edges = scope_graph(current_user, nodes, edges, shipments)
        
        return {
            "nodes": nodes,
            "edges": edges,
            "edgeGeometrySource": "graph_only",
            "scopeRole": current_user.get("role"),
        }
    except Exception as e:
        print(f"[API ERROR] roots/graph: {e}")
        return {"error": str(e), "nodes": [], "edges": []}


@router.post("/routes/trace")
async def trace_route(request: RouteTraceRequest):
    """Get exact Google Directions route for a sequence of points (origin->...->destination)."""
    try:
        points = [p.model_dump() for p in request.points]
        trace = await route_geometry_service.get_trace_details(points)
        return {**trace, "pointCount": len(points)}
    except Exception as e:
        print(f"[API ERROR] routes/trace: {e}")
        return {"error": str(e), "path": [], "pathSource": "error", "pointCount": 0}
