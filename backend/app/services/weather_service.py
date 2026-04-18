import httpx
import time
from app.config import settings

class WeatherService:
    def __init__(self):
        self.api_key = settings.OPENWEATHER_API_KEY
        self.base_url = "https://api.openweathermap.org/data/2.5/weather"
        self._cache = {}
        self._cache_ttl_seconds = 300
        
    async def get_weather(self, lat: float, lng: float):
        """Fetch current weather data for coordinates to calculate severity multiplier."""
        cache_key = f"{round(lat, 2)}:{round(lng, 2)}"
        now = time.time()
        cached = self._cache.get(cache_key)
        if cached and cached["expires_at"] > now:
            return cached["data"]

        # For Hackathon robustness: if API key isn't provided or valid, return a mock response.
        if not self.api_key or self.api_key == "your_openweathermap_key_here":
            data = self._mock_weather(lat, lng, reason="missing_api_key")
            self._cache[cache_key] = {"data": data, "expires_at": now + self._cache_ttl_seconds}
            return data
            
        try:
            # Ignore broken system proxy vars (e.g., HTTP_PROXY=127.0.0.1:9)
            # so API-key based live weather can still work in local dev.
            async with httpx.AsyncClient(trust_env=False) as client:
                response = await client.get(
                    self.base_url,
                    params={
                        "lat": lat,
                        "lon": lng,
                        "appid": self.api_key,
                        "units": "metric"
                    },
                    timeout=5.0
                )
                if response.status_code == 200:
                    data = response.json()
                    # Calculate a 0.0 to 1.0 severity based on weather conditions
                    severity = 0.1 # base
                    condition = data.get("weather", [{}])[0].get("main", "Clear").lower()
                    
                    if "rain" in condition or "thunder" in condition:
                        severity = 0.6
                    elif "snow" in condition or "extreme" in condition:
                        severity = 0.9
                    elif "cloud" in condition:
                        severity = 0.3
                        
                    result = {
                        "condition": condition,
                        "temp_c": data.get("main", {}).get("temp"),
                        "severity_index": severity,
                        "data_source": "weather_api_live",
                        "is_mock": False,
                        "fallback_reason": None,
                    }
                    self._cache[cache_key] = {"data": result, "expires_at": now + self._cache_ttl_seconds}
                    return result
                else:
                    print(f"[WeatherService] Non-200 from OpenWeather: {response.status_code}")
                    data = self._mock_weather(lat, lng, reason=f"http_{response.status_code}")
                    self._cache[cache_key] = {"data": data, "expires_at": now + self._cache_ttl_seconds}
                    return data
        except Exception as e:
            print(f"[WeatherService] Error: {e}")
            data = self._mock_weather(lat, lng, reason=type(e).__name__)
            self._cache[cache_key] = {"data": data, "expires_at": now + self._cache_ttl_seconds}
            return data

    def _mock_weather(self, lat, lng, reason: str = "fallback"):
        # Deterministic mock
        val = (lat + lng) % 10
        if val > 8:
            return {
                "condition": "heavy rain",
                "temp_c": 24,
                "severity_index": 0.75,
                "data_source": "weather_api_mock",
                "is_mock": True,
                "fallback_reason": reason,
            }
        if val > 5:
            return {
                "condition": "cloudy",
                "temp_c": 28,
                "severity_index": 0.3,
                "data_source": "weather_api_mock",
                "is_mock": True,
                "fallback_reason": reason,
            }
        return {
            "condition": "clear",
            "temp_c": 32,
            "severity_index": 0.1,
            "data_source": "weather_api_mock",
            "is_mock": True,
            "fallback_reason": reason,
        }

weather_service = WeatherService()
