from fastapi import APIRouter
from app.services.firebase_service import firebase_service
from app.services.risk_engine import risk_engine

router = APIRouter()

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
