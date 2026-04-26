import asyncio
import math
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from app.config import settings
from app.services.firebase_service import firebase_service
from app.services.route_optimizer import route_optimizer


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(value: Optional[str]) -> datetime:
    if not value:
        return _now_utc()
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return _now_utc()


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class MovementScheduler:
    """
    Live shipment movement engine:
    - advances shipment positions continuously based on graph leg times
    - interpolates along local leg geometry by default
    - can opt into Google road geometry with GOOGLE_DIRECTIONS_FOR_MOVEMENT=true
    - persists simState in Firestore so movement resumes from last point after restart
    - supports fast-forward with smart delivery detection
    """

    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._running = False
        self._node_cache: Dict[str, dict] = {}
        self._geometry_cache: Dict[str, List[dict]] = {}

    def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        print("[MovementScheduler] Started.")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        print("[MovementScheduler] Stopped.")

    async def _loop(self):
        while self._running:
            try:
                await self.tick_once()
            except Exception as exc:
                print(f"[MovementScheduler] Tick error: {exc}")
            await asyncio.sleep(max(1, settings.MOVEMENT_TICK_SECONDS))

    async def tick_once(self):
        db = firebase_service.db
        if not db:
            return

        node_docs = list(db.collection("nodes").stream())
        self._node_cache = {doc.to_dict().get("id"): doc.to_dict() for doc in node_docs if doc.to_dict().get("id")}
        shipment_docs = list(db.collection("shipments").stream())
        if not shipment_docs:
            return

        batch = db.batch()
        writes = 0
        now = _now_utc()
        for doc in shipment_docs:
            shipment = doc.to_dict() or {}
            update = await self._advance_shipment(shipment, now)
            if not update:
                continue
            batch.update(db.collection("shipments").document(doc.id), update)
            writes += 1
            if writes >= 350:
                batch.commit()
                batch = db.batch()
                writes = 0
        if writes:
            batch.commit()

    # ── Fast Forward ──────────────────────────────────────────────────

    async def fast_forward(self, hours: float) -> Dict:
        """
        Advance ALL shipments by `hours` simulated hours.
        Handles multi-hop leg completion and delivery detection.
        Returns summary: { advanced, delivered, totalShipments }
        """
        db = firebase_service.db
        if not db:
            return {"advanced": 0, "delivered": 0, "totalShipments": 0, "error": "Database not initialized"}

        node_docs = list(db.collection("nodes").stream())
        self._node_cache = {doc.to_dict().get("id"): doc.to_dict() for doc in node_docs if doc.to_dict().get("id")}
        shipment_docs = list(db.collection("shipments").stream())
        if not shipment_docs:
            return {"advanced": 0, "delivered": 0, "totalShipments": 0}

        now = _now_utc()
        advanced = 0
        delivered = 0
        batch = db.batch()
        writes = 0

        for doc in shipment_docs:
            shipment = doc.to_dict() or {}
            if shipment.get("status") == "delivered":
                continue

            update = await self._advance_shipment_by_hours(shipment, hours, now)
            if not update:
                continue

            batch.update(db.collection("shipments").document(doc.id), update)
            writes += 1
            advanced += 1
            if update.get("status") == "delivered":
                delivered += 1

            if writes >= 350:
                batch.commit()
                batch = db.batch()
                writes = 0

        if writes:
            batch.commit()

        return {
            "advanced": advanced,
            "delivered": delivered,
            "totalShipments": len(shipment_docs),
        }

    async def _advance_shipment_by_hours(self, shipment: Dict, hours: float, now: datetime) -> Optional[Dict]:
        """
        Advance a single shipment by `hours` sim-hours.
        Handles multi-hop: if remaining leg time < hours, complete that leg,
        move to next, subtract used time, repeat. Delivers if all legs done.
        """
        route = self._route(shipment)
        if len(route) < 2:
            return None

        sim_state = shipment.get("simState") or {}
        mode = sim_state.get("mode")
        from_node = sim_state.get("fromNode")
        to_node = sim_state.get("toNode")
        progress = float(sim_state.get("progress", 0.0) or 0.0)
        dwell_remaining = float(sim_state.get("dwellRemainingHrs", 0.0) or 0.0)
        leg_geometry = sim_state.get("legGeometry")

        if not from_node or not to_node:
            inferred_from, inferred_to = self._current_and_next(shipment)
            if not inferred_from or not inferred_to:
                return None
            from_node, to_node = inferred_from, inferred_to
            mode = "in_transit"
            progress = 0.0
            dwell_remaining = 0.0

        remaining_hours = float(hours)
        journey = shipment.get("journey") or []
        journey_index = self._journey_by_node(shipment)

        # Consume dwell time first
        if mode == "at_node" and dwell_remaining > 0:
            if remaining_hours < dwell_remaining:
                return {
                    "journey": self._reconcile_journey(shipment, route, from_node, to_node, "at_node", 0.0),
                    "simState": {
                        "mode": "at_node",
                        "fromNode": from_node,
                        "toNode": to_node,
                        "progress": 0.0,
                        "dwellRemainingHrs": dwell_remaining - remaining_hours,
                        "legGeometry": leg_geometry,
                        "updatedAt": _iso(now),
                    },
                }
            remaining_hours -= dwell_remaining
            dwell_remaining = 0.0
            mode = "in_transit"
            progress = 0.0

        # Walk through legs until hours are exhausted or shipment is delivered
        while remaining_hours > 0:
            leg_hours = self._leg_time_hours(from_node, to_node)
            remaining_on_leg = max(0.0, (1.0 - progress) * leg_hours)

            if remaining_hours < remaining_on_leg:
                # Partial leg advancement
                progress += remaining_hours / max(0.2, leg_hours)
                progress = min(progress, 0.9999)
                remaining_hours = 0.0

                # Fetch geometry for position interpolation
                geometry = await self._get_leg_geometry(from_node, to_node, leg_geometry)
                cur_lat, cur_lng = self._walk_along_path(geometry, progress, from_node, to_node)

                return {
                    "currentPosition": {"lat": cur_lat, "lng": cur_lng},
                    "currentStage": "in_transit",
                    "status": "in_transit",
                    "journey": self._reconcile_journey(shipment, route, from_node, to_node, "in_transit", progress),
                    "simState": {
                        "mode": "in_transit",
                        "fromNode": from_node,
                        "toNode": to_node,
                        "progress": progress,
                        "dwellRemainingHrs": 0.0,
                        "legGeometry": geometry,
                        "updatedAt": _iso(now),
                    },
                }

            # Complete this leg
            remaining_hours -= remaining_on_leg

            # Update journey for arrived node
            for item in journey:
                if item.get("nodeId") == to_node:
                    item["status"] = "completed"
                    if not item.get("arrivedAt"):
                        item["arrivedAt"] = _iso(now)
                elif item.get("nodeId") == from_node:
                    item["status"] = "completed"
                    if not item.get("departedAt"):
                        item["departedAt"] = _iso(now)

            # Find next leg
            next_index = route.index(to_node) + 1 if to_node in route else len(route)
            next_node = route[next_index] if next_index < len(route) else None

            if not next_node:
                # DELIVERED — all legs exhausted within the FF window
                to_pos = self._node_cache.get(to_node) or {}
                return {
                    "currentPosition": {
                        "lat": float(to_pos.get("lat", 0)),
                        "lng": float(to_pos.get("lng", 0)),
                    },
                    "currentStage": "retailer",
                    "status": "delivered",
                    "journey": journey,
                    "simState": {
                        "mode": "completed",
                        "fromNode": to_node,
                        "toNode": to_node,
                        "progress": 1.0,
                        "dwellRemainingHrs": 0.0,
                        "legGeometry": None,
                        "updatedAt": _iso(now),
                    },
                }

            # Consume node dwell time
            dwell = float(settings.MOVEMENT_NODE_DWELL_HOURS)
            if remaining_hours < dwell:
                to_pos = self._node_cache.get(to_node) or {}
                return {
                    "currentPosition": {
                        "lat": float(to_pos.get("lat", 0)),
                        "lng": float(to_pos.get("lng", 0)),
                    },
                    "currentStage": journey_index.get(to_node, {}).get("stage", "warehouse"),
                    "status": self._status_from_stage(journey_index.get(to_node, {}).get("stage", "warehouse")),
                    "journey": journey,
                    "simState": {
                        "mode": "at_node",
                        "fromNode": to_node,
                        "toNode": next_node,
                        "progress": 0.0,
                        "dwellRemainingHrs": dwell - remaining_hours,
                        "legGeometry": None,
                        "updatedAt": _iso(now),
                    },
                }

            remaining_hours -= dwell
            from_node = to_node
            to_node = next_node
            progress = 0.0
            leg_geometry = None

        # Should not reach here, but safe fallback
        return None

    # ── Route & Journey helpers ───────────────────────────────────────

    def _route(self, shipment: Dict) -> List[str]:
        route = shipment.get("optimizedRoute") or shipment.get("originalRoute") or []
        return route if isinstance(route, list) else []

    def _journey_by_node(self, shipment: Dict) -> Dict[str, Dict]:
        journey = shipment.get("journey") or []
        index = {}
        for item in journey:
            node_id = item.get("nodeId")
            if node_id:
                index[node_id] = item
        return index

    def _last_completed_node(self, shipment: Dict) -> Optional[str]:
        journey = shipment.get("journey") or []
        completed = [step for step in journey if step.get("status") == "completed" and step.get("nodeId")]
        if completed:
            return completed[-1].get("nodeId")
        route = self._route(shipment)
        return route[0] if route else None

    def _current_and_next(self, shipment: Dict) -> Tuple[Optional[str], Optional[str]]:
        route = self._route(shipment)
        if len(route) < 2:
            return (route[0], None) if route else (None, None)

        current_stage = shipment.get("currentStage")
        if current_stage == "in_transit":
            current_node = self._last_completed_node(shipment)
            if current_node in route:
                idx = route.index(current_node)
                return current_node, route[idx + 1] if idx + 1 < len(route) else None

        journey = shipment.get("journey") or []
        active = next((step for step in journey if step.get("status") == "active" and step.get("nodeId")), None)
        if active and active.get("nodeId") in route:
            idx = route.index(active.get("nodeId"))
            return active.get("nodeId"), route[idx + 1] if idx + 1 < len(route) else None

        start = route[0]
        return start, route[1] if len(route) > 1 else None

    def _leg_time_hours(self, from_node: str, to_node: str) -> float:
        graph = route_optimizer.base_graph
        edge = graph.get_edge_data(from_node, to_node)
        if edge:
            return max(0.5, float(edge.get("time", 1.0)))

        a = self._node_cache.get(from_node) or {}
        b = self._node_cache.get(to_node) or {}
        if a.get("lat") is None or b.get("lat") is None:
            return 1.0
        distance = self._haversine_km(float(a["lat"]), float(a["lng"]), float(b["lat"]), float(b["lng"]))
        return max(0.5, distance / 45.0)

    def _haversine_km(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        r = 6371.0
        d_lat = math.radians(lat2 - lat1)
        d_lng = math.radians(lng2 - lng1)
        a = (
            math.sin(d_lat / 2) ** 2
            + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
        )
        return 2 * r * math.asin(math.sqrt(max(0.0, a)))

    def _lerp(self, a: float, b: float, t: float) -> float:
        return a + (b - a) * max(0.0, min(1.0, t))

    def _status_from_stage(self, stage_key: str) -> str:
        mapping = {
            "manufacturer": "at_manufacturer",
            "warehouse": "at_warehouse",
            "distribution_center": "at_distributor",
            "retailer": "delivered",
            "in_transit": "in_transit",
        }
        return mapping.get(stage_key, "in_transit")

    # ── Road Geometry ─────────────────────────────────────────────────

    async def _get_leg_geometry(
        self, from_node: str, to_node: str, cached_geometry=None
    ) -> List[dict]:
        """
        Get display geometry for a leg. Priority:
        1. Already cached in simState (from previous tick)
        2. In-memory cache
        3. If enabled, fetch from route_geometry_service (Google Directions, cached)
        4. Fallback: straight line between nodes
        """
        if cached_geometry and isinstance(cached_geometry, list) and len(cached_geometry) >= 2:
            return cached_geometry

        cache_key = f"{from_node}->{to_node}"
        if cache_key in self._geometry_cache:
            return self._geometry_cache[cache_key]

        from_pos = self._node_cache.get(from_node) or {}
        to_pos = self._node_cache.get(to_node) or {}
        if from_pos.get("lat") is None or to_pos.get("lat") is None:
            return []

        # Keep live movement cheap and deterministic by default. Google Directions
        # remains reserved for selected/final route visualization unless explicitly enabled.
        fallback = [
            {"lat": float(from_pos["lat"]), "lng": float(from_pos["lng"])},
            {"lat": float(to_pos["lat"]), "lng": float(to_pos["lng"])},
        ]
        if not settings.GOOGLE_DIRECTIONS_FOR_MOVEMENT:
            self._geometry_cache[cache_key] = fallback
            return fallback

        try:
            from app.services.route_geometry_service import route_geometry_service
            points = [
                {"lat": float(from_pos["lat"]), "lng": float(from_pos["lng"])},
                {"lat": float(to_pos["lat"]), "lng": float(to_pos["lng"])},
            ]
            path, source = await route_geometry_service.get_trace_path(points)
            if path and len(path) >= 2:
                self._geometry_cache[cache_key] = path
                return path
        except Exception as exc:
            print(f"[MovementScheduler] Geometry fetch error {from_node}->{to_node}: {exc}")

        # Fallback: straight line
        self._geometry_cache[cache_key] = fallback
        return fallback

    def _path_total_distance_km(self, geometry: List[dict]) -> float:
        """Compute total distance of a polyline path in km."""
        total = 0.0
        for i in range(len(geometry) - 1):
            total += self._haversine_km(
                float(geometry[i]["lat"]), float(geometry[i]["lng"]),
                float(geometry[i + 1]["lat"]), float(geometry[i + 1]["lng"]),
            )
        return total

    def _walk_along_path(
        self, geometry: List[dict], progress: float,
        from_node: str, to_node: str,
    ) -> Tuple[float, float]:
        """
        Given a road geometry path and a progress (0→1), find the interpolated
        lat/lng position along the path. Walks segment by segment.
        Falls back to straight-line lerp if geometry is empty.
        """
        if not geometry or len(geometry) < 2:
            from_pos = self._node_cache.get(from_node) or {}
            to_pos = self._node_cache.get(to_node) or {}
            return (
                self._lerp(float(from_pos.get("lat", 0)), float(to_pos.get("lat", 0)), progress),
                self._lerp(float(from_pos.get("lng", 0)), float(to_pos.get("lng", 0)), progress),
            )

        progress = max(0.0, min(1.0, progress))
        if progress <= 0.0:
            return float(geometry[0]["lat"]), float(geometry[0]["lng"])
        if progress >= 1.0:
            return float(geometry[-1]["lat"]), float(geometry[-1]["lng"])

        # Compute segment distances
        segment_distances = []
        for i in range(len(geometry) - 1):
            d = self._haversine_km(
                float(geometry[i]["lat"]), float(geometry[i]["lng"]),
                float(geometry[i + 1]["lat"]), float(geometry[i + 1]["lng"]),
            )
            segment_distances.append(d)

        total_distance = sum(segment_distances)
        if total_distance < 1e-6:
            return float(geometry[0]["lat"]), float(geometry[0]["lng"])

        target_distance = progress * total_distance
        accumulated = 0.0

        for i, seg_dist in enumerate(segment_distances):
            if accumulated + seg_dist >= target_distance:
                # Interpolate within this segment
                remaining = target_distance - accumulated
                t = remaining / seg_dist if seg_dist > 1e-9 else 0.0
                lat = self._lerp(float(geometry[i]["lat"]), float(geometry[i + 1]["lat"]), t)
                lng = self._lerp(float(geometry[i]["lng"]), float(geometry[i + 1]["lng"]), t)
                return lat, lng
            accumulated += seg_dist

        # Edge case: return last point
        return float(geometry[-1]["lat"]), float(geometry[-1]["lng"])

    # ── Journey Reconciliation ────────────────────────────────────────

    def _reconcile_journey(
        self,
        shipment: Dict,
        route: List[str],
        from_node: str,
        to_node: str,
        mode: str,
        progress: float,
    ) -> List[Dict]:
        """
        Keep journey statuses/timestamps consistent with live sim state.
        Prevent stale "arrived at retailer" when shipment is actually still in transit.
        """
        journey = shipment.get("journey") or []
        if not journey or from_node not in route:
            return journey

        by_node = self._journey_by_node(shipment)
        from_idx = route.index(from_node)
        to_idx = route.index(to_node) if to_node in route else min(from_idx + 1, len(route) - 1)

        for idx, node_id in enumerate(route):
            item = by_node.get(node_id)
            if not item:
                continue

            if idx < from_idx:
                item["status"] = "completed"
                continue

            if idx > to_idx:
                item["status"] = "pending"
                if item.get("arrivedAt"):
                    item["arrivedAt"] = None
                if item.get("departedAt"):
                    item["departedAt"] = None
                continue

            if idx == from_idx:
                item["status"] = "active" if mode == "at_node" else "completed"
                continue

            if idx == to_idx:
                if mode == "in_transit" and progress < 1.0:
                    item["status"] = "pending"
                    if item.get("arrivedAt"):
                        item["arrivedAt"] = None
                    if item.get("departedAt"):
                        item["departedAt"] = None
                elif mode == "at_node":
                    item["status"] = "active"
                else:
                    item["status"] = "completed"

        return journey

    # ── Core Tick Advancement ─────────────────────────────────────────

    async def _advance_shipment(self, shipment: Dict, now: datetime) -> Optional[Dict]:
        route = self._route(shipment)
        if len(route) < 2:
            return None

        if shipment.get("status") == "delivered":
            return None

        sim_state = shipment.get("simState") or {}
        mode = sim_state.get("mode")
        from_node = sim_state.get("fromNode")
        to_node = sim_state.get("toNode")
        progress = float(sim_state.get("progress", 0.0) or 0.0)
        dwell_remaining = float(sim_state.get("dwellRemainingHrs", 0.0) or 0.0)
        updated_at = _parse_ts(sim_state.get("updatedAt"))
        leg_geometry = sim_state.get("legGeometry")

        if mode == "completed":
            return None

        if not from_node or not to_node:
            inferred_from, inferred_to = self._current_and_next(shipment)
            if not inferred_from or not inferred_to:
                return None
            from_node, to_node = inferred_from, inferred_to
            mode = "in_transit"
            progress = 0.0
            dwell_remaining = 0.0
            updated_at = now

        elapsed_real_seconds = max(0.0, (now - updated_at).total_seconds())
        # Prevent long offline gaps from "fast-forwarding" shipments on restart.
        elapsed_real_seconds = min(elapsed_real_seconds, float(settings.MOVEMENT_MAX_ELAPSED_SECONDS))
        sim_hours = (elapsed_real_seconds * float(settings.MOVEMENT_TIME_SCALE)) / 3600.0
        if sim_hours <= 1e-6:
            return {
                "journey": self._reconcile_journey(
                    shipment=shipment,
                    route=route,
                    from_node=from_node,
                    to_node=to_node,
                    mode=mode or "in_transit",
                    progress=progress,
                ),
                "simState": {
                    "mode": mode,
                    "fromNode": from_node,
                    "toNode": to_node,
                    "progress": progress,
                    "dwellRemainingHrs": dwell_remaining,
                    "legGeometry": leg_geometry,
                    "updatedAt": _iso(now),
                }
            }

        journey = shipment.get("journey") or []
        journey_index = self._journey_by_node(shipment)

        if mode == "at_node":
            dwell_remaining = max(0.0, dwell_remaining - sim_hours)
            if dwell_remaining > 0:
                return {
                    "journey": self._reconcile_journey(
                        shipment=shipment,
                        route=route,
                        from_node=from_node,
                        to_node=to_node,
                        mode="at_node",
                        progress=0.0,
                    ),
                    "simState": {
                        "mode": "at_node",
                        "fromNode": from_node,
                        "toNode": to_node,
                        "progress": 0.0,
                        "dwellRemainingHrs": dwell_remaining,
                        "legGeometry": leg_geometry,
                        "updatedAt": _iso(now),
                    }
                }
            mode = "in_transit"
            progress = 0.0

        leg_hours = self._leg_time_hours(from_node, to_node)
        progress += sim_hours / max(0.2, leg_hours)

        from_pos = self._node_cache.get(from_node) or {}
        to_pos = self._node_cache.get(to_node) or {}
        if from_pos.get("lat") is None or to_pos.get("lat") is None:
            return None

        if progress < 1.0:
            # Fetch road geometry for this leg (cached after first call)
            geometry = await self._get_leg_geometry(from_node, to_node, leg_geometry)
            cur_lat, cur_lng = self._walk_along_path(geometry, progress, from_node, to_node)
            return {
                "currentPosition": {"lat": cur_lat, "lng": cur_lng},
                "currentStage": "in_transit",
                "status": "in_transit",
                "journey": self._reconcile_journey(
                    shipment=shipment,
                    route=route,
                    from_node=from_node,
                    to_node=to_node,
                    mode="in_transit",
                    progress=progress,
                ),
                "simState": {
                    "mode": "in_transit",
                    "fromNode": from_node,
                    "toNode": to_node,
                    "progress": progress,
                    "dwellRemainingHrs": 0.0,
                    "legGeometry": geometry,
                    "updatedAt": _iso(now),
                },
            }

        # Arrived to target node
        next_index = route.index(to_node) + 1 if to_node in route else len(route)
        next_node = route[next_index] if next_index < len(route) else None
        to_stage_item = journey_index.get(to_node)
        to_stage = to_stage_item.get("stage") if to_stage_item else "warehouse"
        status = self._status_from_stage(to_stage)
        next_sim_mode = "at_node" if next_node else "completed"

        for item in journey:
            if item.get("nodeId") == to_node:
                item["status"] = "active" if next_node else "completed"
                if not item.get("arrivedAt"):
                    item["arrivedAt"] = _iso(now)
            elif item.get("nodeId") == from_node:
                item["status"] = "completed"
                if not item.get("departedAt"):
                    item["departedAt"] = _iso(now)

        update = {
            "currentPosition": {"lat": float(to_pos["lat"]), "lng": float(to_pos["lng"])},
            "currentStage": to_stage if next_node else "retailer",
            "status": status if next_node else "delivered",
            "journey": journey,
            "simState": {
                "mode": next_sim_mode,
                "fromNode": to_node if next_node else to_node,
                "toNode": next_node if next_node else to_node,
                "progress": 0.0,
                "dwellRemainingHrs": float(settings.MOVEMENT_NODE_DWELL_HOURS) if next_node else 0.0,
                "legGeometry": None,
                "updatedAt": _iso(now),
            },
        }
        return update


movement_scheduler = MovementScheduler()
