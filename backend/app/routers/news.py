from fastapi import APIRouter, Query
from app.services.news_service import news_service

router = APIRouter()


@router.get("/news/headlines")
async def get_news_headlines(
    location: str = Query(default="India logistics", min_length=1, max_length=120),
    limit: int = Query(default=5, ge=1, le=20),
):
    """
    Fetch regional/logistics headlines via NewsAPI service.
    Frontend should consume this endpoint instead of calling NewsAPI directly.
    """
    try:
        payload = await news_service.get_regional_news_payload(location, limit=limit)
        articles = payload.get("articles", [])
        headlines = []
        for article in articles[:limit]:
            headlines.append(
                {
                    "title": article.get("title"),
                    "description": article.get("description"),
                    "url": article.get("url"),
                    "publishedAt": article.get("publishedAt"),
                    "sourceName": article.get("sourceName"),
                    "location": location,
                    "dataSource": payload.get("source"),
                    "isMock": payload.get("isMock", False),
                }
            )
        return {
            "headlines": headlines,
            "count": len(headlines),
            "source": payload.get("source"),
            "query": payload.get("query"),
            "isMock": payload.get("isMock", False),
            "error": payload.get("error"),
        }
    except Exception as exc:
        return {"headlines": [], "count": 0, "error": str(exc)}
