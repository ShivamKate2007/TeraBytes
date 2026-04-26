import uuid
import math
import re
from datetime import datetime
from app.config import settings
from app.services.weather_service import weather_service
from app.services.news_service import news_service
from app.services.firebase_service import firebase_service

class DisruptionDetector:
    INCIDENT_KEYWORDS = {
        "flood": {"type": "flood", "radius_km": 20},
        "waterlogging": {"type": "flood", "radius_km": 18},
        "roadblock": {"type": "road_block", "radius_km": 12},
        "blocked": {"type": "road_block", "radius_km": 12},
        "accident": {"type": "accident", "radius_km": 10},
        "strike": {"type": "strike", "radius_km": 15},
        "protest": {"type": "protest", "radius_km": 12},
        "landslide": {"type": "landslide", "radius_km": 22},
        "storm": {"type": "storm", "radius_km": 25},
    }

    AREA_ALIAS = {
        "goregaon": {"lat": 19.1649, "lng": 72.8493, "name": "Goregaon"},
        "dadar": {"lat": 19.0178, "lng": 72.8478, "name": "Dadar"},
        "anantapur": {"lat": 14.6819, "lng": 77.6006, "name": "Anantapur"},
        "navi mumbai": {"lat": 19.0330, "lng": 73.0297, "name": "Navi Mumbai"},
    }

    def _latlng_to_xy_km(self, lat: float, lng: float, ref_lat: float):
        earth_radius_km = 6371.0
        x = earth_radius_km * math.radians(lng) * math.cos(math.radians(ref_lat))
        y = earth_radius_km * math.radians(lat)
        return x, y

    def _point_to_segment_distance_km(self, p: dict, a: dict, b: dict) -> float:
        ref_lat = (float(a["lat"]) + float(b["lat"]) + float(p["lat"])) / 3.0
        px, py = self._latlng_to_xy_km(float(p["lat"]), float(p["lng"]), ref_lat)
        ax, ay = self._latlng_to_xy_km(float(a["lat"]), float(a["lng"]), ref_lat)
        bx, by = self._latlng_to_xy_km(float(b["lat"]), float(b["lng"]), ref_lat)
        abx, aby = bx - ax, by - ay
        apx, apy = px - ax, py - ay
        denom = abx * abx + aby * aby
        if denom <= 1e-9:
            return math.sqrt((px - ax) ** 2 + (py - ay) ** 2)
        t = max(0.0, min(1.0, (apx * abx + apy * aby) / denom))
        cx, cy = ax + t * abx, ay + t * aby
        return math.sqrt((px - cx) ** 2 + (py - cy) ** 2)

    def _route_points(self, shipment: dict, node_by_id: dict):
        points = []
        pos = shipment.get("currentPosition") or {}
        if pos.get("lat") is not None and pos.get("lng") is not None:
            points.append({"lat": pos["lat"], "lng": pos["lng"]})
        route = shipment.get("optimizedRoute") or shipment.get("originalRoute") or []
        if not isinstance(route, list):
            return points
        for node_id in route:
            node = node_by_id.get(node_id)
            if not node:
                continue
            points.append({"lat": node.get("lat"), "lng": node.get("lng")})
        cleaned = [p for p in points if p.get("lat") is not None and p.get("lng") is not None]
        out = []
        for p in cleaned:
            if not out or out[-1] != p:
                out.append(p)
        return out

    def _incident_from_text(self, text: str):
        lower = text.lower()
        for keyword, meta in self.INCIDENT_KEYWORDS.items():
            if keyword in lower:
                return keyword, meta
        return None, None

    def _extract_location(self, text: str, node_locations: list):
        lower = text.lower()
        for alias, info in self.AREA_ALIAS.items():
            if alias in lower:
                return {"lat": info["lat"], "lng": info["lng"], "name": info["name"]}

        # Try node names/city tokens
        for loc in node_locations:
            name = str(loc.get("name", "")).lower()
            if not name:
                continue
            city_tokens = [t for t in re.split(r"[^a-z0-9]+", name) if len(t) >= 4]
            if any(tok in lower for tok in city_tokens):
                return {"lat": loc["lat"], "lng": loc["lng"], "name": loc["name"]}
        return None

    def _impacted_shipments(self, incident: dict, shipments: list, node_by_id: dict, radius_km: float):
        impacted = []
        center = {"lat": incident["lat"], "lng": incident["lng"]}
        for shipment in shipments:
            pts = self._route_points(shipment, node_by_id)
            if len(pts) < 2:
                continue
            affected = False
            for i in range(len(pts) - 1):
                distance = self._point_to_segment_distance_km(center, pts[i], pts[i + 1])
                if distance <= radius_km:
                    affected = True
                    break
            if affected:
                impacted.append(shipment.get("id"))
        return impacted

    async def detect(self):
        """
        Run full disruption detection scan across all major hubs.
        Returns a list of newly detected disruptions.
        """
        detected_disruptions = []
        
        key_locations = []
        node_by_id = {}
        db = firebase_service.db
        if db:
            try:
                for doc in db.collection("nodes").stream():
                    node = doc.to_dict()
                    if node.get("lat") is None or node.get("lng") is None:
                        continue
                    key_locations.append(
                        {
                            "id": node.get("id"),
                            "lat": node.get("lat"),
                            "lng": node.get("lng"),
                            "name": node.get("name", node.get("id", "Unknown")),
                        }
                    )
                    node_by_id[node.get("id")] = node
            except Exception as exc:
                print(f"[DisruptionDetector] Failed reading nodes from Firestore: {exc}")

        if not key_locations:
            # Safe fallback dataset for local dev
            key_locations = [
                {"id": "mumbai_mfg", "lat": 19.0760, "lng": 72.8777, "name": "Mumbai"},
                {"id": "chennai_mfg", "lat": 13.0827, "lng": 80.2707, "name": "Chennai"},
                {"id": "delhi_dc", "lat": 28.7041, "lng": 77.1025, "name": "Delhi"},
                {"id": "bangalore_dc", "lat": 12.9716, "lng": 77.5946, "name": "Bangalore"},
            ]
        
        weather_threshold = settings.WEATHER_DISRUPTION_THRESHOLD
        for loc in key_locations:
            # Check weather
            weather = await weather_service.get_weather(loc["lat"], loc["lng"])
            if weather.get("severity_index", 0) >= weather_threshold:
                weather_source = weather.get("data_source", "weather_api_mock")
                source_label = "LIVE" if weather_source == "weather_api_live" else "MOCK"
                detected_disruptions.append({
                    "id": f"DIS-{uuid.uuid4().hex[:6].upper()}",
                    "type": "weather",
                    "severity": "high" if weather["severity_index"] < 0.8 else "critical",
                    "location": {"lat": loc["lat"], "lng": loc["lng"], "radius": 100.0},
                    "description": f"[{source_label}] Severe weather ({weather['condition']}) detected at {loc['name']}",
                    "source": weather_source,
                    "weatherMeta": {
                        "isMock": bool(weather.get("is_mock", False)),
                        "fallbackReason": weather.get("fallback_reason"),
                    },
                    "status": "active",
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                })
                
        # Check news with route-impact filtering
        shipments = []
        if db:
            try:
                shipments = [doc.to_dict() for doc in db.collection("shipments").stream()]
            except Exception as exc:
                print(f"[DisruptionDetector] Failed reading shipments for news impact: {exc}")

        news_locations = key_locations[:8] if key_locations else []
        if not news_locations:
            news_locations = [{"name": "India", "lat": 20.5937, "lng": 78.9629}]

        for loc in news_locations:
            news_payload = await news_service.get_regional_news_payload(loc["name"], allow_mock=False)
            if news_payload.get("isMock"):
                continue

            for article in news_payload.get("articles", []):
                title = str(article.get("title") or "")
                description = str(article.get("description") or "")
                merged = f"{title}. {description}"
                keyword, meta = self._incident_from_text(merged)
                if not keyword:
                    continue

                incident_loc = self._extract_location(merged, key_locations) or {
                    "lat": loc["lat"],
                    "lng": loc["lng"],
                    "name": loc["name"],
                }
                radius = float(meta.get("radius_km", settings.NEWS_DISRUPTION_RADIUS_DEFAULT_KM))
                impacted = self._impacted_shipments(incident_loc, shipments, node_by_id, radius)
                if not impacted:
                    continue

                detected_disruptions.append({
                    "id": f"DIS-{uuid.uuid4().hex[:6].upper()}",
                    "type": "news_incident",
                    "incidentType": meta.get("type", "news_incident"),
                    "severity": "high",
                    "location": {"lat": incident_loc["lat"], "lng": incident_loc["lng"], "radius": radius},
                    "description": f"{meta.get('type', 'incident').replace('_', ' ').title()} reported near {incident_loc['name']}: {title}",
                    "source": news_payload.get("source", "news_api_live"),
                    "newsMeta": {
                        "url": article.get("url"),
                        "publishedAt": article.get("publishedAt"),
                        "sourceName": article.get("sourceName"),
                        "query": news_payload.get("query"),
                    },
                    "status": "active",
                    "impactedShipments": impacted[:10],
                    "impactedCount": len(impacted),
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                })
                break
                    
        return detected_disruptions

disruption_detector = DisruptionDetector()
