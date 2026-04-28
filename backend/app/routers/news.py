from fastapi import APIRouter, Depends, Query
from app.services.news_service import news_service
from app.services.disruption_detector import disruption_detector
from app.services.firebase_service import firebase_service
from app.services.auth_service import get_current_user

router = APIRouter()
REVIEW_WATCH_TERMS = {
    "accident",
    "blocked",
    "cargo",
    "closure",
    "construction",
    "delay",
    "flood",
    "freight",
    "highway",
    "landslide",
    "logistics",
    "port",
    "rail",
    "rain",
    "road",
    "shipment",
    "shipping",
    "storm",
    "strike",
    "supply",
    "traffic",
    "transport",
    "truck",
    "warehouse",
    "waterlogging",
}


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


@router.get("/news/external-events")
async def get_external_event_review_queue(
    location: str = Query(default="India logistics", min_length=1, max_length=120),
    limit: int = Query(default=10, ge=1, le=30),
    current_user: dict = Depends(get_current_user),
):
    """
    Convert live logistics news into reviewable disruption candidates.
    This endpoint intentionally does not write active disruptions; operators review
    the candidate before it becomes operational truth.
    """
    try:
        payload = await news_service.get_regional_news_payload(location, limit=limit, allow_mock=False)
        db = firebase_service.db
        nodes = []
        shipments = []
        node_by_id = {}

        if db:
            try:
                nodes = [
                    doc.to_dict()
                    for doc in db.collection("nodes").stream()
                    if doc.to_dict().get("lat") is not None and doc.to_dict().get("lng") is not None
                ]
                node_by_id = {node.get("id"): node for node in nodes if node.get("id")}
                shipments = [doc.to_dict() for doc in db.collection("shipments").stream()]
            except Exception as exc:
                print(f"[NewsReview] Firestore read failed: {exc}")

        review_items = []
        for idx, article in enumerate(payload.get("articles", [])[:limit]):
            title = str(article.get("title") or "")
            description = str(article.get("description") or "")
            merged = f"{title}. {description}"
            keyword, meta = disruption_detector._incident_from_text(merged)
            watch_match = any(term in merged.lower() for term in REVIEW_WATCH_TERMS)
            if not keyword and not watch_match:
                continue

            incident_loc = disruption_detector._extract_location(merged, nodes) if nodes else None
            radius = float((meta or {}).get("radius_km", 15))
            impacted = (
                disruption_detector._impacted_shipments(incident_loc, shipments, node_by_id, radius)
                if incident_loc and shipments and node_by_id
                else []
            )
            confidence = 0.45 if keyword else 0.3
            if incident_loc:
                confidence += 0.25
            if impacted:
                confidence += 0.2
            if article.get("publishedAt"):
                confidence += 0.05
            confidence = min(confidence, 0.95)

            review_items.append(
                {
                    "id": f"EXT-{idx + 1:03d}",
                    "source": payload.get("source", "news_api_live"),
                    "title": title,
                    "description": description,
                    "url": article.get("url"),
                    "publishedAt": article.get("publishedAt"),
                    "incidentType": (meta or {}).get("type", "logistics_watch"),
                    "locationName": incident_loc.get("name") if incident_loc else location,
                    "location": (
                        {"lat": incident_loc["lat"], "lng": incident_loc["lng"], "radius": radius}
                        if incident_loc
                        else None
                    ),
                    "confidence": round(confidence, 2),
                    "affectedShipmentIds": impacted[:10],
                    "affectedCount": len(impacted),
                    "status": "active_candidate" if confidence >= 0.75 and impacted else "pending_review",
                }
            )

        return {
            "events": review_items,
            "count": len(review_items),
            "query": payload.get("query"),
            "source": payload.get("source"),
            "isMock": payload.get("isMock", False),
            "viewerRole": current_user.get("role"),
            "error": payload.get("error"),
        }
    except Exception as exc:
        return {"events": [], "count": 0, "error": str(exc)}
