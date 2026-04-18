import time
from typing import Dict, List, Tuple

import httpx

from app.config import settings


class RouteGeometryService:
    def __init__(self):
        self.api_key = settings.GOOGLE_MAPS_API_KEY or settings.GOOGLE_API_KEY
        self._cache: Dict[str, Tuple[float, List[dict], str]] = {}
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
            async with httpx.AsyncClient(timeout=12.0) as client:
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

    def _trace_cache_key(self, points: List[dict]) -> str:
        normalized = [f"{p['lat']:.4f},{p['lng']:.4f}" for p in points]
        return f"trace::{'>'.join(normalized)}"

    async def get_trace_path(self, points: List[dict]) -> Tuple[List[dict], str]:
        if len(points) < 2:
            return points, "fallback_insufficient_points"

        now = time.time()
        cache_key = self._trace_cache_key(points)
        cached = self._cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1], cached[2]

        if not self.api_key:
            path = self._multi_direct_path(points)
            self._cache[cache_key] = (now + self._ttl_seconds, path, "fallback_no_api_key")
            return path, "fallback_no_api_key"

        origin = points[0]
        destination = points[-1]
        waypoint_points = points[1:-1]
        waypoints = "|".join([f"{p['lat']},{p['lng']}" for p in waypoint_points]) if waypoint_points else None

        params = {
            "origin": f"{origin['lat']},{origin['lng']}",
            "destination": f"{destination['lat']},{destination['lng']}",
            "mode": "driving",
            "alternatives": "false",
            "key": self.api_key,
        }
        if waypoints:
            params["waypoints"] = waypoints

        try:
            async with httpx.AsyncClient(timeout=18.0) as client:
                response = await client.get(self._base_url, params=params)
            if response.status_code != 200:
                path = self._multi_direct_path(points)
                self._cache[cache_key] = (now + self._ttl_seconds, path, "fallback_http_error")
                return path, "fallback_http_error"

            payload = response.json()
            status = payload.get("status")
            routes = payload.get("routes", [])
            if status != "OK" or not routes:
                path = self._multi_direct_path(points)
                source = f"fallback_directions_{status or 'unknown'}"
                self._cache[cache_key] = (now + self._ttl_seconds, path, source)
                return path, source

            encoded = routes[0].get("overview_polyline", {}).get("points")
            if not encoded:
                path = self._multi_direct_path(points)
                self._cache[cache_key] = (now + self._ttl_seconds, path, "fallback_no_polyline")
                return path, "fallback_no_polyline"

            decoded = self._decode_polyline(encoded)
            self._cache[cache_key] = (now + self._ttl_seconds, decoded, "google_trace")
            return decoded, "google_trace"
        except Exception as exc:
            print(f"[RouteGeometryService] Trace API error: {exc}")
            path = self._multi_direct_path(points)
            self._cache[cache_key] = (now + self._ttl_seconds, path, "fallback_exception")
            return path, "fallback_exception"


route_geometry_service = RouteGeometryService()
