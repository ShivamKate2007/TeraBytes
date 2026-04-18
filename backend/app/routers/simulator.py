from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.services.firebase_service import firebase_service
from app.services.cascade_analyzer import cascade_analyzer
from app.services.gemini_service import gemini_service

router = APIRouter()

class WhatIfRequest(BaseModel):
    disruptedNodeId: str
    eventType: str
    severity: str

@router.post("/simulator/what-if")
async def run_what_if(request: WhatIfRequest):
    """Run what-if scenario → cascade analysis + reroutes + narrative"""
    try:
        db = firebase_service.db
        if not db:
            return {
                "scenario": request.dict(),
                "cascadeMetrics": {
                    "disruptedNode": request.disruptedNodeId,
                    "totalShipmentsAffected": 0,
                    "networkDelayHrs": 0.0,
                    "reroutePlans": [],
                },
                "executiveSummary": "Database not initialized. Simulation could not be executed against live shipment data.",
                "error": "Database not initialized",
            }
        
        # 1. Fetch all active shipments currently traversing the network
        docs = db.collection("shipments").stream()
        all_shipments = [doc.to_dict() for doc in docs]
        
        # 2. Run the Mathematical Cascade Analyzer
        cascade_results = cascade_analyzer.analyze_cascade(
            disruption_node=request.disruptedNodeId,
            all_shipments=all_shipments
        )
        
        # 3. Use Gemini to generate a high-level executive summary of the cascade
        affected = cascade_results["totalShipmentsAffected"]
        delay = cascade_results["networkDelayHrs"]
        
        narrative = await gemini_service.generate_whatif_narrative(
            disrupted_node=request.disruptedNodeId,
            event_type=request.eventType,
            severity=request.severity,
            affected_shipments=affected,
            delay_hours=delay,
        )
            
        return {
            "scenario": request.dict(),
            "cascadeMetrics": cascade_results,
            "executiveSummary": narrative,
            "error": None,
        }
        
    except Exception as e:
        print(f"[API ERROR] simulator: {e}")
        return {
            "scenario": request.dict(),
            "cascadeMetrics": {
                "disruptedNode": request.disruptedNodeId,
                "totalShipmentsAffected": 0,
                "networkDelayHrs": 0.0,
                "reroutePlans": [],
            },
            "executiveSummary": "Simulation failed unexpectedly. Please retry after checking backend logs.",
            "error": str(e),
        }
