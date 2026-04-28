"""Analytics API endpoints"""
from collections import Counter
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from app.services.firebase_service import firebase_service
from app.services.risk_engine import risk_engine
from app.services.auth_service import get_current_user
from app.services.access_control import scope_shipments

router = APIRouter()
HIGH_RISK_SCORE = 56


@router.get("/analytics/kpis")
async def get_kpis(current_user: dict = Depends(get_current_user)):
    """Get dashboard KPIs"""
    db = firebase_service.db
    if not db:
        return {
            "active_shipments": 0,
            "at_risk": 0,
            "avg_risk_score": 0,
            "on_time_rate": 0,
            "count": 0,
            "error": "Database not initialized",
        }

    try:
        shipment_docs = list(db.collection("shipments").stream())
        shipments = scope_shipments(current_user, [doc.to_dict() for doc in shipment_docs])

        scores = []
        at_risk = 0
        delivered = 0
        on_time = 0

        for shipment in shipments:
            risk_payload = await risk_engine.evaluate_shipment_risk(shipment)
            score = float(risk_payload.get("riskScore", shipment.get("riskScore", 0.0)))
            scores.append(score)
            if score >= HIGH_RISK_SCORE:
                at_risk += 1

            status = shipment.get("status")
            if status == "delivered":
                delivered += 1
                if score < 55:
                    on_time += 1

        active_shipments = len([s for s in shipments if s.get("status") != "delivered"])
        avg_risk = round(sum(scores) / len(scores), 1) if scores else 0.0
        on_time_rate = round((on_time / delivered) * 100, 1) if delivered else round(max(0, 100 - (at_risk / max(1, len(shipments)) * 100)), 1)
        role_label = str(current_user.get("role", "user")).replace("_", " ").title()
        risk_ratio = round((at_risk / max(1, len(shipments))) * 100, 1)

        return {
            "active_shipments": active_shipments,
            "at_risk": at_risk,
            "avg_risk_score": avg_risk,
            "on_time_rate": on_time_rate,
            "count": len(shipments),
            "scopeRole": current_user.get("role"),
            "riskThreshold": HIGH_RISK_SCORE,
            "explanations": [
                f"{role_label} analytics are scoped to shipments visible to this role.",
                f"High-risk lanes use the same threshold as the dashboard badge: risk score >= {HIGH_RISK_SCORE}.",
                f"{risk_ratio}% of visible shipments currently need closer operational monitoring.",
            ],
            "recommendations": [
                "Review high-risk routes before applying reroutes.",
                "Use What-If Simulator for route alternatives instead of auto-changing live routes.",
                "Check contract SLA health for shipments with active carrier responsibility.",
            ],
            "error": None,
        }
    except Exception as exc:
        return {
            "active_shipments": 0,
            "at_risk": 0,
            "avg_risk_score": 0,
            "on_time_rate": 0,
            "count": 0,
            "error": str(exc),
        }


@router.get("/analytics/trends")
async def get_trends(current_user: dict = Depends(get_current_user)):
    """Get historical disruption trends for charts"""
    db = firebase_service.db
    if not db:
        return {"trends": [], "error": "Database not initialized"}

    try:
        disruptions = [doc.to_dict() for doc in db.collection("disruptions").stream()]
        now = datetime.now(timezone.utc).date()
        labels = [(now - timedelta(days=idx)) for idx in range(6, -1, -1)]
        counts = Counter()

        for disruption in disruptions:
            ts = disruption.get("timestamp")
            if not ts:
                continue
            try:
                date_val = datetime.fromisoformat(ts.replace("Z", "+00:00")).date()
            except Exception:
                continue
            if date_val in labels:
                counts[date_val] += 1

        trends = [{"date": day.isoformat(), "disruptions": counts.get(day, 0)} for day in labels]
        peak = max((item["disruptions"] for item in trends), default=0)
        return {
            "trends": trends,
            "scopeRole": current_user.get("role"),
            "explanation": (
                "Trend counts show active detected disruption volume by day. "
                f"Peak daily count in this window is {peak}."
            ),
            "error": None,
        }
    except Exception as exc:
        return {"trends": [], "error": str(exc)}
