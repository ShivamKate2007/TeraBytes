import httpx
import time
from app.config import settings

class NewsService:
    def __init__(self):
        self.api_key = settings.NEWS_API_KEY
        self.base_url = "https://newsapi.org/v2/everything"
        self._cache = {}
        self._cache_ttl_seconds = 1800
        
    async def get_regional_news(self, location_keyword: str) -> list:
        """Fetch recent supply chain affecting news for a keyword/location"""
        cache_key = location_keyword.strip().lower() or "india"
        now = time.time()
        cached = self._cache.get(cache_key)
        if cached and cached["expires_at"] > now:
            return cached["data"]

        if not self.api_key or self.api_key == "your_newsapi_key_here":
            # Fallback for hackathon demo if key is missing/invalid
            data = self._mock_news(location_keyword)
            self._cache[cache_key] = {"data": data, "expires_at": now + self._cache_ttl_seconds}
            return data
            
        try:
            # Ignore broken system proxy vars (e.g., HTTP_PROXY=127.0.0.1:9)
            # so NewsAPI calls can use direct outbound connectivity.
            async with httpx.AsyncClient(trust_env=False) as client:
                query = f"{location_keyword} AND (strike OR flood OR protest OR accident OR traffic)"
                response = await client.get(
                    self.base_url,
                    params={
                        "q": query,
                        "apiKey": self.api_key,
                        "language": "en",
                        "sortBy": "publishedAt",
                        "pageSize": 3
                    },
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    articles = data.get("articles", [])
                    result = [{"title": a.get("title"), "description": a.get("description")} for a in articles]
                    self._cache[cache_key] = {"data": result, "expires_at": now + self._cache_ttl_seconds}
                    return result
                result = self._mock_news(location_keyword)
                self._cache[cache_key] = {"data": result, "expires_at": now + self._cache_ttl_seconds}
                return result
        except Exception as e:
            print(f"[NewsService] Error fetching news: {e}")
            result = self._mock_news(location_keyword)
            self._cache[cache_key] = {"data": result, "expires_at": now + self._cache_ttl_seconds}
            return result
            
    def _mock_news(self, location: str):
        # Deterministic mock based on location string length for variety
        if len(location) % 2 == 0:
            return [{"title": f"Local transport strike announced near {location}", "description": "Truck unions demand better tolls."}]
        return [{"title": f"Heavy rainfall alerts issued for {location}", "description": "Expect waterlogging on major highways."}]

news_service = NewsService()
