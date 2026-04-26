import math
import time
from typing import Dict, List, Optional, Tuple

import httpx

from app.config import settings


class RouteGeometryService:
    def __init__(self):
        self.api_key = settings.GOOGLE_MAPS_API_KEY or settings.GOOGLE_API_KEY
        self._cache: Dict[str, Tuple] = {}
        self._ttl_seconds = 12 * 60 * 60
        self._base_url = "https://maps.googleapis.com/maps/api/directions/json"

    def _decode_polyline(self, encoded: str) -> List[dict]:
        coords = []
        index = 0
        lat = 0
        lng = 0
        length = len(encoded)

        while index < length:
            shift = 0
            result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            dlat = ~(result >> 1) if (result & 1) else (result >> 1)
            lat += dlat

            shift = 0
            result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            dlng = ~(result >> 1) if (result & 1) else (result >> 1)
            lng += dlng

            coords.append({"lat": lat / 1e5, "lng": lng / 1e5})

        return coords

    def _direct_path(self, start: dict, end: dict) -> List[dict]:
        return [
            {"lat": start["lat"], "lng": start["lng"]},
            {"lat": end["lat"], "lng": end["lng"]},
        ]

    def _multi_direct_path(self, points: List[dict]) -> List[dict]:
        return [{"lat": p["lat"], "lng": p["lng"]} for p in points if "lat" in p and "lng" in p]

    async def _fetch_route_path(self, start: dict, end: dict) -> Tuple[List[dict], str]:
        if not self.api_key:
            return self._direct_path(start, end), "fallback_no_api_key"

        try:
            async with httpx.AsyncClient(timeout=12.0, trust_env=False) as client:
                response = await client.get(
                    self._base_url,
                    params={
                        "origin": f"{start['lat']},{start['lng']}",
                        "destination": f"{end['lat']},{end['lng']}",
                        "mode": "driving",
                        "key": self.api_key,
                    },
                )
            if response.status_code != 200:
                return self._direct_path(start, end), "fallback_http_error"

            payload = response.json()
            routes = payload.get("routes", [])
            if not routes:
                return self._direct_path(start, end), "fallback_no_routes"

            encoded = routes[0].get("overview_polyline", {}).get("points")
            if not encoded:
                return self._direct_path(start, end), "fallback_no_polyline"

            return self._decode_polyline(encoded), "google_directions"
        except Exception as exc:
            print(f"[RouteGeometryService] Directions API error: {exc}")
            return self._direct_path(start, end), "fallback_exception"

    def _fallback_metrics(self, points: List[dict]) -> Dict:
        distance_km = 0.0
        for idx in range(len(points) - 1):
            distance_km += self._haversine_km(points[idx], points[idx + 1])
        # Conservative truck speed fallback for India highway movement.
        duration_hours = distance_km / 45.0 if distance_km > 0 else 0.0
        return {
            "distanceKm": round(distance_km, 1),
            "durationHours": round(duration_hours, 1),
        }

    def _haversine_km(self, a: dict, b: dict) -> float:
        r = 6371.0
        lat1 = math.radians(float(a["lat"]))
        lng1 = math.radians(float(a["lng"]))
        lat2 = math.radians(float(b["lat"]))
        lng2 = math.radians(float(b["lng"]))
        d_lat = lat2 - lat1
        d_lng = lng2 - lng1
        h = (
            math.sin(d_lat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(d_lng / 2) ** 2
        )
        return 2 * r * math.asin(math.sqrt(max(0.0, h)))

    def _point_to_segment_distance_km(self, p: dict, a: dict, b: dict) -> float:
        """Approximate shortest distance from a point to a lat/lng segment."""
        mean_lat = math.radians((float(a["lat"]) + float(b["lat"]) + float(p["lat"])) / 3.0)

        def to_xy(point: dict) -> Tuple[float, float]:
            return (
                float(point["lng"]) * 111.320 * math.cos(mean_lat),
                float(point["lat"]) * 110.574,
            )

        px, py = to_xy(p)
        ax, ay = to_xy(a)
        bx, by = to_xy(b)
        abx, aby = bx - ax, by - ay
        apx, apy = px - ax, py - ay
        ab_len2 = abx * abx + aby * aby
        if ab_len2 < 1e-9:
            return math.hypot(px - ax, py - ay)
        t = max(0.0, min(1.0, (apx * abx + apy * aby) / ab_len2))
        closest_x = ax + t * abx
        closest_y = ay + t * aby
        return math.hypot(px - closest_x, py - closest_y)

    def min_distance_to_path_km(self, point: dict, path: List[dict]) -> Optional[float]:
        """Return the closest distance from point to any segment in a road trace."""
        valid_path = [p for p in path or [] if p.get("lat") is not None and p.get("lng") is not None]
        if not point or point.get("lat") is None or point.get("lng") is None or not valid_path:
            return None
        if len(valid_path) == 1:
            return self._haversine_km(point, valid_path[0])
        return min(
            self._point_to_segment_distance_km(point, valid_path[idx], valid_path[idx + 1])
            for idx in range(len(valid_path) - 1)
        )

    async def enrich_edges_with_geometry(self, nodes: List[dict], edges: List[dict]) -> List[dict]:
        node_by_id = {node["id"]: node for node in nodes}
        now = time.time()
        enriched = []

        for edge in edges:
            edge_copy = dict(edge)
            from_node = node_by_id.get(edge.get("fromNode"))
            to_node = node_by_id.get(edge.get("toNode"))

            if not from_node or not to_node:
                enriched.append(edge_copy)
                continue

            if isinstance(edge_copy.get("routePath"), list) and edge_copy["routePath"]:
                edge_copy["pathSource"] = edge_copy.get("pathSource", "precomputed")
                enriched.append(edge_copy)
                continue

            cache_key = f"{edge.get('fromNode')}->{edge.get('toNode')}"
            cached = self._cache.get(cache_key)
            if cached and cached[0] > now:
                path, source = cached[1], cached[2]
            else:
                path, source = await self._fetch_route_path(from_node, to_node)
                self._cache[cache_key] = (now + self._ttl_seconds, path, source)

            edge_copy["routePath"] = path
            edge_copy["pathSource"] = source
            enriched.append(edge_copy)

        return enriched

    def _trace_cache_key(
        self,
        points: List[dict],
        alternatives: bool = False,
        avoid_point: Optional[dict] = None,
        avoid_radius_km: Optional[float] = None,
        waypoint_modes: Optional[List[str]] = None,
    ) -> str:
        normalized = [f"{p['lat']:.4f},{p['lng']:.4f}" for p in points]
        modes = ""
        if waypoint_modes:
            modes = f"::modes:{','.join(waypoint_modes)}"
        avoid = ""
        if avoid_point and avoid_point.get("lat") is not None and avoid_point.get("lng") is not None:
            avoid = f"::avoid:{float(avoid_point['lat']):.4f},{float(avoid_point['lng']):.4f},{float(avoid_radius_km or 0.0):.1f}"
        return f"trace::{'>'.join(normalized)}::alts:{int(bool(alternatives))}{modes}{avoid}"

    async def get_trace_path(self, points: List[dict]) -> Tuple[List[dict], str]:
        trace = await self.get_trace_details(points)
        return trace["path"], trace["pathSource"]

    def _route_metrics(self, route: dict, decoded: List[dict]) -> Dict:
        legs = route.get("legs", [])
        distance_m = sum(float((leg.get("distance") or {}).get("value", 0.0)) for leg in legs)
        duration_s = sum(float((leg.get("duration") or {}).get("value", 0.0)) for leg in legs)
        fallback = self._fallback_metrics(decoded)
        return {
            "distanceKm": round(distance_m / 1000.0, 1) if distance_m else fallback["distanceKm"],
            "durationHours": round(duration_s / 3600.0, 1) if duration_s else fallback["durationHours"],
        }

    async def get_trace_details(
        self,
        points: List[dict],
        alternatives: bool = False,
        avoid_point: Optional[dict] = None,
        avoid_radius_km: Optional[float] = None,
        waypoint_modes: Optional[List[str]] = None,
    ) -> Dict:
        if len(points) < 2:
            return {
                "path": points,
                "pathSource": "fallback_insufficient_points",
                **self._fallback_metrics(points),
            }

        now = time.time()
        cache_key = self._trace_cache_key(points, alternatives, avoid_point, avoid_radius_km, waypoint_modes)
        cached = self._cache.get(cache_key)
        if cached and cached[0] > now:
            cached_path = cached[1]
            cached_source = cached[2]
            cached_metrics = cached[3] if len(cached) > 3 else self._fallback_metrics(points)
            cached_meta = cached[4] if len(cached) > 4 else {}
            return {"path": cached_path, "pathSource": cached_source, **cached_metrics, **cached_meta}

        if not self.api_key:
            path = self._multi_direct_path(points)
            metrics = self._fallback_metrics(path)
            meta = self._avoidance_meta(path, avoid_point, avoid_radius_km)
            self._cache[cache_key] = (now + self._ttl_seconds, path, "fallback_no_api_key", metrics, meta)
            return {"path": path, "pathSource": "fallback_no_api_key", **metrics, **meta}

        origin = points[0]
        destination = points[-1]
        waypoint_points = points[1:-1]
        waypoint_modes = waypoint_modes or []
        formatted_waypoints = []
        for idx, point in enumerate(waypoint_points):
            prefix = "via:" if idx < len(waypoint_modes) and waypoint_modes[idx] == "via" else ""
            formatted_waypoints.append(f"{prefix}{point['lat']},{point['lng']}")
        waypoints = "|".join(formatted_waypoints) if formatted_waypoints else None

        params = {
            "origin": f"{origin['lat']},{origin['lng']}",
            "destination": f"{destination['lat']},{destination['lng']}",
            "mode": "driving",
            "alternatives": "true" if alternatives and not waypoints else "false",
            "key": self.api_key,
        }
        if waypoints:
            params["waypoints"] = waypoints

        try:
            async with httpx.AsyncClient(timeout=18.0, trust_env=False) as client:
                response = await client.get(self._base_url, params=params)
            if response.status_code != 200:
                path = self._multi_direct_path(points)
                metrics = self._fallback_metrics(path)
                meta = self._avoidance_meta(path, avoid_point, avoid_radius_km)
                self._cache[cache_key] = (now + self._ttl_seconds, path, "fallback_http_error", metrics, meta)
                return {"path": path, "pathSource": "fallback_http_error", **metrics, **meta}

            payload = response.json()
            status = payload.get("status")
            routes = payload.get("routes", [])
            if status != "OK" or not routes:
                path = self._multi_direct_path(points)
                source = f"fallback_directions_{status or 'unknown'}"
                metrics = self._fallback_metrics(path)
                meta = self._avoidance_meta(path, avoid_point, avoid_radius_km)
                self._cache[cache_key] = (now + self._ttl_seconds, path, source, metrics, meta)
                return {"path": path, "pathSource": source, **metrics, **meta}

            candidates = []
            for route in routes:
                encoded = route.get("overview_polyline", {}).get("points")
                if not encoded:
                    continue
                decoded = self._decode_polyline(encoded)
                meta = self._avoidance_meta(decoded, avoid_point, avoid_radius_km)
                candidates.append((route, decoded, meta))

            if not candidates:
                path = self._multi_direct_path(points)
                metrics = self._fallback_metrics(path)
                meta = self._avoidance_meta(path, avoid_point, avoid_radius_km)
                self._cache[cache_key] = (now + self._ttl_seconds, path, "fallback_no_polyline", metrics, meta)
                return {"path": path, "pathSource": "fallback_no_polyline", **metrics, **meta}

            chosen_route, decoded, meta = self._choose_route_candidate(candidates)
            metrics = self._route_metrics(chosen_route, decoded)
            source = "google_trace_alternative" if alternatives and not meta.get("intersectsAvoidZone") else "google_trace"
            self._cache[cache_key] = (now + self._ttl_seconds, decoded, source, metrics, meta)
            return {"path": decoded, "pathSource": source, **metrics, **meta}
        except Exception as exc:
            print(f"[RouteGeometryService] Trace API error: {exc}")
            path = self._multi_direct_path(points)
            metrics = self._fallback_metrics(path)
            meta = self._avoidance_meta(path, avoid_point, avoid_radius_km)
            self._cache[cache_key] = (now + self._ttl_seconds, path, "fallback_exception", metrics, meta)
            return {"path": path, "pathSource": "fallback_exception", **metrics, **meta}

    def _avoidance_meta(
        self,
        path: List[dict],
        avoid_point: Optional[dict],
        avoid_radius_km: Optional[float],
    ) -> Dict:
        if not avoid_point or avoid_point.get("lat") is None or avoid_point.get("lng") is None:
            return {}
        min_distance = self.min_distance_to_path_km(avoid_point, path)
        radius = float(avoid_radius_km or 0.0)
        return {
            "avoidanceMinDistanceKm": round(min_distance, 2) if min_distance is not None else None,
            "avoidanceRadiusKm": round(radius, 2),
            "intersectsAvoidZone": bool(min_distance is not None and min_distance <= radius),
        }

    def _choose_route_candidate(self, candidates: List[Tuple[dict, List[dict], Dict]]) -> Tuple[dict, List[dict], Dict]:
        safe = [candidate for candidate in candidates if not candidate[2].get("intersectsAvoidZone")]
        pool = safe or candidates

        def duration(candidate: Tuple[dict, List[dict], Dict]) -> float:
            metrics = self._route_metrics(candidate[0], candidate[1])
            return float(metrics.get("durationHours") or 999999.0)

        return min(pool, key=duration)


route_geometry_service = RouteGeometryService()
