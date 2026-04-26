from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from app.services.firebase_service import firebase_service
from app.services.cascade_analyzer import cascade_analyzer
from app.services.gemini_service import gemini_service
from app.services.route_geometry_service import route_geometry_service
from app.services.route_optimizer import route_optimizer

router = APIRouter()

class WhatIfRequest(BaseModel):
    disruptedNodeId: str
    eventType: str
    severity: str
    disruptionLat: Optional[float] = None
    disruptionLng: Optional[float] = None
    impactRadiusKm: Optional[float] = 80.0
    disruptionDurationHrs: Optional[float] = 12.0
    focusShipmentIds: Optional[List[str]] = None


def _path_to_points(node_ids: List[str]) -> List[dict]:
    graph = route_optimizer.base_graph
    points = []
    for node_id in node_ids or []:
        node = graph.nodes.get(node_id, {})
        if node.get("lat") is None or node.get("lng") is None:
            continue
        points.append({"lat": float(node["lat"]), "lng": float(node["lng"])})
    return points


def _valid_avoid_point(cascade_results: dict) -> Optional[dict]:
    location = cascade_results.get("disruptionLocation") or {}
    if location.get("lat") is None or location.get("lng") is None:
        return None
    return {"lat": float(location["lat"]), "lng": float(location["lng"])}


async def _trace_points(
    points: List[dict],
    alternatives: bool = False,
    avoid_point: Optional[dict] = None,
    avoid_radius_km: Optional[float] = None,
    waypoint_modes: Optional[List[str]] = None,
) -> dict:
    """
    Trace a route using Google for road geometry. When alternatives are requested,
    trace each mandatory leg separately so the road can detour between required
    supply-chain stops without dropping those stops.
    """
    if len(points) < 2:
        return {"path": points, "pathSource": "fallback_insufficient_points", "distanceKm": 0.0, "durationHours": 0.0}

    if waypoint_modes:
        return await route_geometry_service.get_trace_details(
            points,
            alternatives=False,
            avoid_point=avoid_point,
            avoid_radius_km=avoid_radius_km,
            waypoint_modes=waypoint_modes,
        )

    if not alternatives or len(points) == 2:
        return await route_geometry_service.get_trace_details(
            points,
            alternatives=alternatives,
            avoid_point=avoid_point,
            avoid_radius_km=avoid_radius_km,
        )

    combined_path = []
    distance_km = 0.0
    duration_hours = 0.0
    intersects = False
    min_avoid_distance = None
    sources = set()

    for idx in range(len(points) - 1):
        leg_trace = await route_geometry_service.get_trace_details(
            [points[idx], points[idx + 1]],
            alternatives=True,
            avoid_point=avoid_point,
            avoid_radius_km=avoid_radius_km,
        )
        leg_path = leg_trace.get("path") or [points[idx], points[idx + 1]]
        if combined_path and leg_path:
            combined_path.extend(leg_path[1:])
        else:
            combined_path.extend(leg_path)

        distance_km += float(leg_trace.get("distanceKm") or 0.0)
        duration_hours += float(leg_trace.get("durationHours") or 0.0)
        intersects = intersects or bool(leg_trace.get("intersectsAvoidZone"))
        if leg_trace.get("avoidanceMinDistanceKm") is not None:
            leg_min = float(leg_trace["avoidanceMinDistanceKm"])
            min_avoid_distance = leg_min if min_avoid_distance is None else min(min_avoid_distance, leg_min)
        if leg_trace.get("pathSource"):
            sources.add(str(leg_trace["pathSource"]))

    return {
        "path": combined_path,
        "pathSource": "legwise_" + ("+".join(sorted(sources)) if sources else "unknown"),
        "distanceKm": round(distance_km, 1),
        "durationHours": round(duration_hours, 1),
        "avoidanceMinDistanceKm": round(min_avoid_distance, 2) if min_avoid_distance is not None else None,
        "avoidanceRadiusKm": round(float(avoid_radius_km or 0.0), 2),
        "intersectsAvoidZone": intersects,
    }


def _apply_trace(plan: dict, prefix: str, trace: dict) -> None:
    plan[f"{prefix}TracePath"] = trace.get("path") or []
    plan[f"{prefix}DistanceKm"] = trace.get("distanceKm")
    plan[f"{prefix}PathSource"] = trace.get("pathSource")
    if trace.get("durationHours") is not None:
        plan[f"{prefix}TimeHrs"] = trace["durationHours"]
    if trace.get("avoidanceMinDistanceKm") is not None:
        plan[f"{prefix}AvoidanceMinDistanceKm"] = trace.get("avoidanceMinDistanceKm")
        plan[f"{prefix}IntersectsDisruption"] = bool(trace.get("intersectsAvoidZone"))


def _convert_to_road_reroute(plan: dict, old_trace: dict, road_alt: dict) -> None:
    plan["status"] = "road_rerouted"
    plan["recommendation"] = "road_reroute_same_stops"
    plan["newPath"] = plan.get("oldPath") or []
    plan["newDestinationNode"] = plan.get("oldDestinationNode")
    plan["newTracePath"] = road_alt.get("path") or []
    plan["newDistanceKm"] = road_alt.get("distanceKm")
    plan["newPathSource"] = road_alt.get("pathSource")
    plan["newAvoidanceMinDistanceKm"] = road_alt.get("avoidanceMinDistanceKm")
    plan["newIntersectsDisruption"] = bool(road_alt.get("intersectsAvoidZone"))
    plan["newTimeHrs"] = road_alt.get("durationHours")
    if old_trace.get("durationHours") is not None and road_alt.get("durationHours") is not None:
        plan["addedDelayHrs"] = round(max(0.0, float(road_alt["durationHours"]) - float(old_trace["durationHours"])), 1)
    plan["roadRerouteReason"] = "Google Directions found a safer road between the same mandatory stops."


def _convert_to_corridor_reroute(plan: dict, old_trace: dict, corridor_trace: dict, corridor_path: List[str]) -> None:
    old_path = plan.get("oldPath") or []
    via_nodes = [node_id for node_id in corridor_path if node_id not in old_path]
    plan["status"] = "road_rerouted"
    plan["recommendation"] = "road_reroute_same_stops"
    plan["newPath"] = old_path
    plan["newDestinationNode"] = plan.get("oldDestinationNode")
    plan["newTracePath"] = corridor_trace.get("path") or []
    plan["newDistanceKm"] = corridor_trace.get("distanceKm")
    plan["newPathSource"] = corridor_trace.get("pathSource")
    plan["newAvoidanceMinDistanceKm"] = corridor_trace.get("avoidanceMinDistanceKm")
    plan["newIntersectsDisruption"] = bool(corridor_trace.get("intersectsAvoidZone"))
    plan["newTimeHrs"] = corridor_trace.get("durationHours")
    plan["roadViaNodes"] = via_nodes
    if old_trace.get("durationHours") is not None and corridor_trace.get("durationHours") is not None:
        plan["addedDelayHrs"] = round(max(0.0, float(corridor_trace["durationHours"]) - float(old_trace["durationHours"])), 1)
    plan["roadRerouteReason"] = (
        "Safe road corridor uses intermediate highway via-points only; "
        "mandatory unload/sort stops are unchanged."
    )


def _corridor_waypoint_modes(new_path: List[str], old_path: List[str]) -> List[str]:
    mandatory = set((old_path or [])[1:-1])
    return ["stop" if node_id in mandatory else "via" for node_id in (new_path or [])[1:-1]]


def _convert_to_wait(plan: dict, old_trace: dict, disruption_duration: float, reason: str) -> None:
    plan["status"] = "wait_for_reopen"
    plan["recommendation"] = "wait_for_reopen"
    plan["newPath"] = plan.get("oldPath") or []
    plan["newTracePath"] = []
    plan["rerouteRejectedReason"] = reason
    plan["addedDelayHrs"] = round(float(disruption_duration or 0.0), 1)
    if old_trace.get("durationHours") is not None:
        plan["newTimeHrs"] = round(float(old_trace["durationHours"]) + float(disruption_duration or 0.0), 1)


async def _enrich_plan_times_with_directions(cascade_results: dict) -> dict:
    """
    Keep optimization decisions graph-based, but report Google Directions duration
    when available so the UI does not show inflated coarse-graph ETAs.
    """
    plans = cascade_results.get("reroutePlans") or []
    avoid_point = _valid_avoid_point(cascade_results)
    avoid_radius_km = float(cascade_results.get("disruptionRadiusKm") or 0.0)
    disruption_duration = float(cascade_results.get("disruptionDurationHrs") or 0.0)
    for plan in plans:
        status = plan.get("status")
        planned_delay = float(plan.get("addedDelayHrs") or 0.0)
        old_points = _path_to_points(plan.get("oldPath") or [])
        new_points = _path_to_points(plan.get("newPath") or [])
        old_trace = {}

        if len(old_points) >= 2:
            old_trace = await _trace_points(
                old_points,
                alternatives=False,
                avoid_point=avoid_point,
                avoid_radius_km=avoid_radius_km,
            )
            _apply_trace(plan, "old", old_trace)

        if status in {"wait_for_reopen", "no_alternative_path", "blocked_at_disruption_node"}:
            if status != "blocked_at_disruption_node" and len(old_points) >= 2 and avoid_point:
                road_alt = await _trace_points(
                    old_points,
                    alternatives=True,
                    avoid_point=avoid_point,
                    avoid_radius_km=avoid_radius_km,
                )
                if old_trace.get("intersectsAvoidZone") and not road_alt.get("intersectsAvoidZone"):
                    _convert_to_road_reroute(plan, old_trace, road_alt)
                    continue

            if plan.get("oldTimeHrs") is not None:
                plan["newTimeHrs"] = round(float(plan["oldTimeHrs"]) + planned_delay, 1)
            plan["addedDelayHrs"] = round(planned_delay, 1)
            continue

        if len(new_points) >= 2:
            new_path_ids = plan.get("newPath") or []
            old_path_ids = plan.get("oldPath") or []
            extra_hubs = max(0, len(new_path_ids) - len(old_path_ids))
            waypoint_modes = _corridor_waypoint_modes(new_path_ids, old_path_ids) if extra_hubs > 0 else None
            new_trace = await _trace_points(
                new_points,
                alternatives=True,
                avoid_point=avoid_point,
                avoid_radius_km=avoid_radius_km,
                waypoint_modes=waypoint_modes,
            )
            if waypoint_modes and new_trace.get("intersectsAvoidZone"):
                safer_legwise_trace = await _trace_points(
                    new_points,
                    alternatives=True,
                    avoid_point=avoid_point,
                    avoid_radius_km=avoid_radius_km,
                )
                if not safer_legwise_trace.get("intersectsAvoidZone"):
                    safer_legwise_trace["pathSource"] = f"{safer_legwise_trace.get('pathSource', 'google_trace')}_corridor"
                    new_trace = safer_legwise_trace

            road_alt = {}
            if old_trace.get("intersectsAvoidZone") and len(old_points) >= 2:
                road_alt = await _trace_points(
                    old_points,
                    alternatives=True,
                    avoid_point=avoid_point,
                    avoid_radius_km=avoid_radius_km,
                )

            if new_trace.get("intersectsAvoidZone"):
                if old_trace.get("intersectsAvoidZone") and not road_alt.get("intersectsAvoidZone"):
                    _convert_to_road_reroute(plan, old_trace, road_alt)
                else:
                    _convert_to_wait(
                        plan,
                        old_trace,
                        disruption_duration,
                        "candidate_route_still_crosses_disruption_zone",
                    )
                continue

            if road_alt and not road_alt.get("intersectsAvoidZone"):
                road_alt_time = float(road_alt.get("durationHours") or 999999.0)
                graph_route_time = float(new_trace.get("durationHours") or 999999.0)
                extra_hubs = max(0, len(plan.get("newPath") or []) - len(plan.get("oldPath") or []))
                # Prefer a road-level detour between the same mandatory stops unless
                # extra graph hubs provide a large operational benefit. A few hours
                # saved is not enough reason to add unscheduled logistics stops.
                min_extra_hub_saving = 8.0 + (2.0 * extra_hubs)
                if extra_hubs > 0 and graph_route_time < road_alt_time - min_extra_hub_saving:
                    plan["extraHubJustification"] = (
                        f"Graph hub reroute saves {round(road_alt_time - graph_route_time, 1)}h "
                        f"versus same-stop road detour."
                    )
                else:
                    _convert_to_road_reroute(plan, old_trace, road_alt)
                    continue

            if extra_hubs > 0:
                _convert_to_corridor_reroute(plan, old_trace, new_trace, plan.get("newPath") or [])
                continue

            _apply_trace(plan, "new", new_trace)

        if plan.get("newTimeHrs") is not None and plan.get("oldTimeHrs") is not None:
            plan["addedDelayHrs"] = round(max(0.0, float(plan["newTimeHrs"]) - float(plan["oldTimeHrs"])), 1)

    cascade_results["networkDelayHrs"] = round(
        sum(float(plan.get("addedDelayHrs") or 0.0) for plan in plans),
        1,
    )
    return cascade_results

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
        if request.focusShipmentIds:
            focus = set(request.focusShipmentIds)
            all_shipments = [shipment for shipment in all_shipments if shipment.get("id") in focus]
        
        # 2. Run the Mathematical Cascade Analyzer
        cascade_results = cascade_analyzer.analyze_cascade(
            disruption_node=request.disruptedNodeId,
            all_shipments=all_shipments,
            disruption_location=(
                {"lat": request.disruptionLat, "lng": request.disruptionLng}
                if request.disruptionLat is not None and request.disruptionLng is not None
                else None
            ),
            disruption_radius_km=float(request.impactRadiusKm or 80.0),
            disruption_duration_hrs=float(request.disruptionDurationHrs or 12.0),
            use_current_position=True,
        )
        cascade_results = await _enrich_plan_times_with_directions(cascade_results)
        
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
