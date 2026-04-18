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
        articles = await news_service.get_regional_news(location)
        headlines = []
        for article in articles[:limit]:
            headlines.append(
                {
                    "title": article.get("title"),
                    "description": article.get("description"),
                    "location": location,
                }
            )
        return {"headlines": headlines, "count": len(headlines), "error": None}
    except Exception as exc:
        return {"headlines": [], "count": 0, "error": str(exc)}
