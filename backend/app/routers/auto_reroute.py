"""Auto-reroute suggestions API — read-only analysis endpoint"""
from fastapi import APIRouter
from google.cloud.firestore_v1.base_query import FieldFilter
from app.services.firebase_service import firebase_service
from app.services.cascade_analyzer import cascade_analyzer
from app.services.route_geometry_service import route_geometry_service
from app.services.route_optimizer import route_optimizer

router = APIRouter()


def _path_to_coords(node_ids: list) -> list:
    """Convert a list of node IDs to [{lat, lng, nodeId}] for map rendering."""
    graph = route_optimizer.base_graph
    coords = []
    for node_id in node_ids:
        data = graph.nodes.get(node_id, {})
        lat = data.get("lat")
        lng = data.get("lng")
        if lat is not None and lng is not None:
            coords.append({"lat": float(lat), "lng": float(lng), "nodeId": node_id})
    return coords


async def _directions_duration(node_ids: list):
    coords = _path_to_coords(node_ids)
    points = [{"lat": item["lat"], "lng": item["lng"]} for item in coords]
    if len(points) < 2:
        return None
    trace = await route_geometry_service.get_trace_details(points)
    return trace


@router.get("/disruptions/reroute-suggestions")
async def get_reroute_suggestions():
    """
    Analyze all active disruptions against all active shipments and return
    reroute suggestions with map-ready coordinates. READ-ONLY — does NOT modify Firestore.
    Uses Dynamic Node Injection for GPS-based disruptions (zero external API calls).
    """
    try:
        db = firebase_service.db
        if not db:
            return {"suggestions": [], "error": "Database not initialized"}

        # 1. Fetch active disruptions
        try:
            disruption_docs = list(
                db.collection("disruptions")
                .where(filter=FieldFilter("status", "==", "active"))
                .stream()
            )
        except Exception:
            disruption_docs = []

        disruptions = [doc.to_dict() for doc in disruption_docs]
        if not disruptions:
            return {"suggestions": [], "count": 0}

        # 2. Fetch active (non-delivered) shipments
        shipment_docs = list(db.collection("shipments").stream())
        all_shipments = [
            doc.to_dict() for doc in shipment_docs
            if doc.to_dict().get("status") != "delivered"
        ]

        if not all_shipments:
            return {"suggestions": [], "count": 0}

        # 3. For each disruption, run cascade analysis with Dynamic Node Injection
        suggestions = []
        seen_shipment_ids = set()

        for disruption in disruptions:
            location = disruption.get("location") or {}
            lat = location.get("lat")
            lng = location.get("lng")
            radius = float(location.get("radius", 60))

            disruption_node = disruption.get("nodeId")
            if not disruption_node and lat is not None and lng is not None:
                disruption_node = cascade_analyzer._find_nearest_graph_node(float(lat), float(lng))

            if not disruption_node:
                continue

            disruption_location = {"lat": lat, "lng": lng} if lat is not None and lng is not None else None

            incident_type = disruption.get("incidentType") or disruption.get("type", "unknown")
            duration_map = {
                "flood": 8.0, "accident": 4.0, "protest": 6.0,
                "strike": 12.0, "landslide": 10.0, "storm": 6.0,
                "road_block": 5.0, "weather": 4.0, "risk_spike": 2.0,
                "news_incident": 6.0,
            }
            duration_hrs = duration_map.get(incident_type, 6.0)

            cascade_result = cascade_analyzer.analyze_cascade(
                disruption_node=disruption_node,
                all_shipments=all_shipments,
                disruption_location=disruption_location,
                disruption_radius_km=radius,
                disruption_duration_hrs=duration_hrs,
                use_current_position=True,
            )

            reroute_plans = cascade_result.get("reroutePlans") or []

            for plan in reroute_plans:
                shipment_id = plan.get("shipmentId")
                if not shipment_id or shipment_id in seen_shipment_ids:
                    continue
                seen_shipment_ids.add(shipment_id)

                status = plan.get("status", "unknown")
                old_time = float(plan.get("oldTimeHrs", 0))
                new_time = float(plan.get("newTimeHrs", old_time))
                added_delay = float(plan.get("addedDelayHrs", 0))

                if status == "rerouted":
                    recommendation = plan.get("recommendation", "reroute")
                    time_saved = float(plan.get("timeSavedVsWait", 0))
                elif status == "disruption_clears_before_arrival":
                    recommendation = "continue_as_planned"
                    time_saved = 0.0
                elif status in ("no_alternative_path", "blocked_at_disruption_node"):
                    recommendation = "wait_for_reopen"
                    time_saved = 0.0
                elif status == "wait_for_reopen":
                    recommendation = plan.get("recommendation", "wait_for_reopen")
                    time_saved = 0.0
                else:
                    continue

                original_path = plan.get("oldPath", [])
                suggested_path = plan.get("newPath", [])
                original_trace = await _directions_duration(original_path)
                suggested_trace = await _directions_duration(suggested_path)
                if original_trace and original_trace.get("durationHours") is not None:
                    old_time = float(original_trace.get("durationHours", old_time))
                if suggested_trace and suggested_trace.get("durationHours") is not None:
                    new_time = float(suggested_trace.get("durationHours", new_time))
                    added_delay = max(0.0, new_time - old_time)

                suggestions.append({
                    "id": f"SUGG-{disruption.get('id', 'X')}-{shipment_id}",
                    "shipmentId": shipment_id,
                    "disruptionId": disruption.get("id"),
                    "disruptionType": incident_type,
                    "disruptionDescription": disruption.get("description", ""),
                    "disruptionLocation": disruption_location,
                    "currentPosition": plan.get("rerouteOriginPosition"),
                    "originalPath": original_path,
                    "suggestedPath": suggested_path,
                    "originalPathCoords": _path_to_coords(original_path),
                    "suggestedPathCoords": _path_to_coords(suggested_path),
                    "originalEtaHrs": round(old_time, 1),
                    "rerouteEtaHrs": round(new_time, 1),
                    "waitEtaHrs": round(old_time + duration_hrs, 1),
                    "timeSavedVsWait": round(time_saved, 1),
                    "addedDelayHrs": round(added_delay, 1),
                    "recommendation": recommendation,
                    "status": "pending_review",
                    "rerouteStatus": status,
                    # New realism fields
                    "etaToDisruptionHrs": plan.get("etaToDisruptionHrs"),
                    "disruptionDurationHrs": plan.get("disruptionDurationHrs", duration_hrs),
                    "mandatoryNodeBlocked": plan.get("mandatoryNodeBlocked"),
                })

        return {"suggestions": suggestions, "count": len(suggestions)}

    except Exception as exc:
        print(f"[API ERROR] reroute-suggestions: {exc}")
        return {"suggestions": [], "count": 0, "error": str(exc)}
