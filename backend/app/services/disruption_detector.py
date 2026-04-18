import uuid
from datetime import datetime
from app.config import settings
from app.services.weather_service import weather_service
from app.services.news_service import news_service
from app.services.firebase_service import firebase_service

class DisruptionDetector:
    async def detect(self):
        """
        Run full disruption detection scan across all major hubs.
        Returns a list of newly detected disruptions.
        """
        detected_disruptions = []
        
        key_locations = []
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
                
            # Check news
            news = await news_service.get_regional_news(loc["name"])
            # Very basic NLP entity check for prototype
            for article in news:
                title = article.get("title", "").lower()
                if any(keyword in title for keyword in ["strike", "protest", "blocked", "accident", "flood"]):
                    detected_disruptions.append({
                        "id": f"DIS-{uuid.uuid4().hex[:6].upper()}",
                        "type": "news_incident",
                        "severity": "high",
                        "location": {"lat": loc["lat"], "lng": loc["lng"], "radius": 50.0},
                        "description": f"Transport strike reported near {loc['name']}: {article.get('title')}",
                        "source": "news_api",
                        "status": "active",
                        "timestamp": datetime.utcnow().isoformat() + "Z"
                    })
                    break # just one per location
                    
        return detected_disruptions

disruption_detector = DisruptionDetector()
