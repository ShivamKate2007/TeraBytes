from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from app.services.firebase_service import firebase_service
from app.services.risk_engine import risk_engine
from app.services.movement_scheduler import movement_scheduler

router = APIRouter()


class FastForwardRequest(BaseModel):
    hours: float = 1.0


class ApplyRerouteRequest(BaseModel):
    newRoute: List[str]
    disruptionId: Optional[str] = None


@router.get("/shipments")
async def get_shipments():
    """Get all shipments with their dynamically calculated live risk scores."""
    try:
        db = firebase_service.db
        if not db:
            return {"shipments": [], "count": 0, "error": "Database not initialized"}
        shipments_ref = db.collection("shipments")
        docs = shipments_ref.stream()
        
        results = []
        for doc in docs:
            shipment = doc.to_dict()
            
            # 1. Run live environmental evaluation (LSTM + Rule Engine)
            risk_payload = await risk_engine.evaluate_shipment_risk(shipment)
            
            # 2. Inject calculated risk directly into the API response
            shipment["riskScore"] = risk_payload["riskScore"]
            shipment["lstmPrediction"] = risk_payload["lstmMultiplier"]
            shipment["isCritical"] = risk_payload["isCritical"]
            
            # Note: We do NOT push this constantly to Firebase to save writes, 
            # we just dynamically evaluate it for the frontend upon poll.
            results.append(shipment)
            
        return {"shipments": results, "count": len(results)}
    except Exception as e:
        print(f"[API ERROR] shipments: {e}")
        return {"error": str(e), "shipments": [], "count": 0}

@router.get("/shipments/{shipment_id}")
async def get_shipment(shipment_id: str):
    """Get full specific shipment detail."""
    try:
        db = firebase_service.db
        if not db:
            return {"error": "Database not initialized", "shipment": None}
        doc = db.collection("shipments").document(shipment_id).get()
        if not doc.exists:
            return {"error": "Shipment not found", "shipment": None}
            
        shipment = doc.to_dict()
        risk_payload = await risk_engine.evaluate_shipment_risk(shipment)
        shipment["liveRisk"] = risk_payload
        shipment["riskScore"] = risk_payload.get("riskScore", shipment.get("riskScore", 0))
        shipment["lstmPrediction"] = risk_payload.get("lstmMultiplier", shipment.get("lstmPrediction"))
        shipment["isCritical"] = risk_payload.get("isCritical", shipment.get("isCritical", False))
        
        return {"shipment": shipment, "error": None}
    except Exception as e:
        return {"error": str(e), "shipment": None}


@router.post("/shipments/fast-forward")
async def fast_forward_shipments(request: FastForwardRequest):
    """
    Fast-forward ALL shipments by N simulated hours.
    Handles multi-hop leg completion and delivery detection:
    - If a shipment is 30min from destination and you FF 1hr, it arrives and shows 'delivered'
    - If a shipment crosses multiple nodes in the FF window, all intermediate journey statuses update
    """
    hours = max(0.1, min(24.0, request.hours))
    try:
        result = await movement_scheduler.fast_forward(hours)
        return {
            "success": True,
            "hoursAdvanced": hours,
            **result,
        }
    except Exception as e:
        print(f"[API ERROR] fast-forward: {e}")
        return {"success": False, "error": str(e), "hoursAdvanced": 0}


@router.post("/shipments/{shipment_id}/apply-reroute")
async def apply_reroute(shipment_id: str, request: ApplyRerouteRequest):
    """
    Apply an approved reroute plan to a specific shipment.
    Updates the optimizedRoute in Firestore and resets simState
    to start from the nearest node on the new route.
    Only called after user clicks 'Approve' in the dashboard.
    """
    try:
        db = firebase_service.db
        if not db:
            return {"error": "Database not initialized", "applied": False}

        doc_ref = db.collection("shipments").document(shipment_id)
        doc = doc_ref.get()
        if not doc.exists:
            return {"error": "Shipment not found", "applied": False}

        shipment = doc.to_dict()
        new_route = request.newRoute

        if len(new_route) < 2:
            return {"error": "Route must have at least 2 nodes", "applied": False}

        # Determine the nearest node on the new route to the shipment's current position
        current_pos = shipment.get("currentPosition") or {}
        sim_state = shipment.get("simState") or {}
        current_node = sim_state.get("fromNode") or sim_state.get("toNode")

        # Find the best starting point on the new route
        start_node = new_route[0]
        next_node = new_route[1] if len(new_route) > 1 else new_route[0]

        if current_node and current_node in new_route:
            idx = new_route.index(current_node)
            start_node = current_node
            next_node = new_route[idx + 1] if idx + 1 < len(new_route) else new_route[-1]

        # Build updated journey stages for the new route
        from app.services.route_optimizer import route_optimizer
        graph = route_optimizer.base_graph
        new_journey = []
        for i, node_id in enumerate(new_route):
            node_data = graph.nodes.get(node_id, {})
            stage = node_data.get("type", "warehouse")
            status = "completed" if (current_node and current_node in new_route and new_route.index(current_node) > i) else "pending"
            if node_id == start_node:
                status = "active"
            new_journey.append({
                "nodeId": node_id,
                "stage": stage,
                "status": status,
                "arrivedAt": None,
                "departedAt": None,
            })

        update = {
            "optimizedRoute": new_route,
            "journey": new_journey,
            "reroutedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "rerouteDisruptionId": request.disruptionId,
            "simState": {
                "mode": "in_transit",
                "fromNode": start_node,
                "toNode": next_node,
                "progress": 0.0,
                "dwellRemainingHrs": 0.0,
                "legGeometry": None,
                "updatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            },
        }

        doc_ref.update(update)

        return {
            "applied": True,
            "shipmentId": shipment_id,
            "newRoute": new_route,
            "startNode": start_node,
            "disruptionId": request.disruptionId,
        }
    except Exception as e:
        print(f"[API ERROR] apply-reroute: {e}")
        return {"error": str(e), "applied": False}

