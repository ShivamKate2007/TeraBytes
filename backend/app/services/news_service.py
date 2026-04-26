import httpx
import time
from app.config import settings

class NewsService:
    INCIDENT_TERMS = {
        "flood", "waterlogging", "roadblock", "blocked", "accident", "strike",
        "protest", "landslide", "storm", "rain", "traffic", "closure",
    }
    LOGISTICS_TERMS = {
        "logistics", "supply chain", "transport", "truck", "highway", "road",
        "rail", "port", "warehouse", "shipment", "freight", "cargo", "traffic",
    }

    def __init__(self):
        self.api_key = settings.NEWS_API_KEY
        self.base_url = "https://newsapi.org/v2/everything"
        self._cache = {}
        self._cache_ttl_seconds = 1800

    async def get_regional_news(self, location_keyword: str) -> list:
        """Backward-compatible list-only helper."""
        payload = await self.get_regional_news_payload(location_keyword)
        return payload.get("articles", [])

    async def get_regional_news_payload(self, location_keyword: str, limit: int = 5, allow_mock: bool = True) -> dict:
        """Fetch recent supply chain affecting news for a keyword/location"""
        cache_key = location_keyword.strip().lower() or "india"
        now = time.time()
        cached = self._cache.get(cache_key)
        if cached and cached["expires_at"] > now:
            return cached["data"]

        if not self.api_key or self.api_key == "your_newsapi_key_here":
            # Fallback for hackathon demo if key is missing/invalid
            data = {
                "articles": self._mock_news(location_keyword) if allow_mock else [],
                "source": "news_api_mock",
                "isMock": True,
                "error": "NEWS_API_KEY is missing",
            }
            self._cache[cache_key] = {"data": data, "expires_at": now + self._cache_ttl_seconds}
            return data
            
        try:
            # Ignore broken system proxy vars (e.g., HTTP_PROXY=127.0.0.1:9)
            # so NewsAPI calls can use direct outbound connectivity.
            async with httpx.AsyncClient(trust_env=False) as client:
                query = self._build_query(location_keyword)
                response = await client.get(
                    self.base_url,
                    params={
                        "q": query,
                        "apiKey": self.api_key,
                        "language": "en",
                        "sortBy": "publishedAt",
                        "pageSize": max(10, limit * 4)
                    },
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    articles = data.get("articles", [])
                    relevant = [
                        self._normalize_article(a)
                        for a in articles
                        if self._is_relevant(a)
                    ][:limit]
                    result = {
                        "articles": relevant,
                        "source": "news_api_live",
                        "isMock": False,
                        "query": query,
                        "error": None,
                    }
                    self._cache[cache_key] = {"data": result, "expires_at": now + self._cache_ttl_seconds}
                    return result

                result = {
                    "articles": self._mock_news(location_keyword) if allow_mock else [],
                    "source": "news_api_mock",
                    "isMock": True,
                    "query": query,
                    "error": f"NewsAPI returned HTTP {response.status_code}",
                }
                self._cache[cache_key] = {"data": result, "expires_at": now + self._cache_ttl_seconds}
                return result
        except Exception as e:
            print(f"[NewsService] Error fetching news: {e}")
            result = {
                "articles": self._mock_news(location_keyword) if allow_mock else [],
                "source": "news_api_mock",
                "isMock": True,
                "error": str(e),
            }
            self._cache[cache_key] = {"data": result, "expires_at": now + self._cache_ttl_seconds}
            return result

    def _build_query(self, location: str) -> str:
        clean = " ".join(str(location or "India").split())
        terms = " OR ".join(sorted(self.INCIDENT_TERMS | self.LOGISTICS_TERMS))
        return f'"{clean}" AND ({terms})'

    def _normalize_article(self, article: dict):
        return {
            "title": article.get("title"),
            "description": article.get("description"),
            "url": article.get("url"),
            "publishedAt": article.get("publishedAt"),
            "sourceName": (article.get("source") or {}).get("name"),
        }

    def _is_relevant(self, article: dict) -> bool:
        text = f"{article.get('title') or ''} {article.get('description') or ''}".lower()
        if not text.strip():
            return False
        terms = self.INCIDENT_TERMS | self.LOGISTICS_TERMS
        return any(term in text for term in terms)

    def _mock_news(self, location: str):
        # Deterministic mock based on location string length for variety
        if len(location) % 2 == 0:
            return [{
                "title": f"Local transport strike announced near {location}",
                "description": "Truck unions demand better tolls.",
                "url": None,
                "publishedAt": None,
                "sourceName": "Mock News",
            }]
        return [{
            "title": f"Heavy rainfall alerts issued for {location}",
            "description": "Expect waterlogging on major highways.",
            "url": None,
            "publishedAt": None,
            "sourceName": "Mock News",
        }]

news_service = NewsService()
