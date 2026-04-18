"""Disruptions API endpoints"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter
from google.cloud.firestore_v1.base_query import FieldFilter
from app.config import settings
from app.services.disruption_detector import disruption_detector
from app.services.firebase_service import firebase_service
from app.services.risk_engine import risk_engine

router = APIRouter()


def _safe_parse_ts(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)


def _dedup_key(disruption: dict):
    location = disruption.get("location") or {}
    lat = round(float(location.get("lat", 0.0)), 2)
    lng = round(float(location.get("lng", 0.0)), 2)
    return (
        disruption.get("status", "active"),
        disruption.get("type", "unknown"),
        lat,
        lng,
    )


async def _auto_resolve_risk_spikes(db) -> int:
    """
    Auto-resolve active risk_spike disruptions when live computed shipment risk
    drops below threshold with a small hysteresis margin.
    """
    resolve_threshold = max(0, settings.RISK_THRESHOLD_REROUTE - 2)
    try:
        docs = list(
            db.collection("disruptions")
            .where(filter=FieldFilter("status", "==", "active"))
            .where(filter=FieldFilter("type", "==", "risk_spike"))
            .stream()
        )
    except Exception as exc:
        print(f"[Disruptions] Risk-spike scan failed: {exc}")
        return 0

    if not docs:
        return 0

    shipment_ids = []
    for doc in docs:
        item = doc.to_dict() or {}
        shipment_id = item.get("shipmentId")
        if shipment_id:
            shipment_ids.append(shipment_id)
    shipment_ids = list(dict.fromkeys(shipment_ids))
    if not shipment_ids:
        return 0

    live_risk_by_shipment = {}
    for shipment_id in shipment_ids:
        try:
            shipment_doc = db.collection("shipments").document(shipment_id).get()
            if not shipment_doc.exists:
                live_risk_by_shipment[shipment_id] = None
                continue
            shipment = shipment_doc.to_dict()
            risk_payload = await risk_engine.evaluate_shipment_risk(shipment)
            live_risk_by_shipment[shipment_id] = float(risk_payload.get("riskScore", 0.0))
        except Exception as exc:
            print(f"[Disruptions] Live risk eval failed for {shipment_id}: {exc}")
            live_risk_by_shipment[shipment_id] = None

    resolved_count = 0
    batch = db.batch()
    writes = 0
    for doc in docs:
        item = doc.to_dict() or {}
        shipment_id = item.get("shipmentId")
        if not shipment_id:
            continue
        live_score = live_risk_by_shipment.get(shipment_id)
        if live_score is None:
            continue
        if live_score >= resolve_threshold:
            continue

        ref = db.collection("disruptions").document(doc.id)
        batch.update(
            ref,
            {
                "status": "resolved",
                "resolvedAt": datetime.utcnow().isoformat() + "Z",
                "resolutionReason": "risk_back_to_normal",
                "currentRiskScore": round(live_score, 1),
            },
        )
        writes += 1
        resolved_count += 1

        if writes >= 450:
            batch.commit()
            batch = db.batch()
            writes = 0

    if writes > 0:
        batch.commit()

    if resolved_count:
        print(f"[Disruptions] Auto-resolved {resolved_count} stale risk_spike disruptions.")
    return resolved_count


@router.get("/disruptions")
async def get_disruptions():
    """Get active disruptions from Firestore with computed fallback from risky shipments."""
    db = firebase_service.db
    disruptions = []

    try:
        if db:
            await _auto_resolve_risk_spikes(db)
            docs = db.collection("disruptions").where(filter=FieldFilter("status", "==", "active")).stream()
            disruptions = [doc.to_dict() for doc in docs]
    except Exception as exc:
        print(f"[Disruptions] Firestore read failed: {exc}")

    if disruptions:
        return {"disruptions": disruptions, "count": len(disruptions)}

    if not db:
        return {"disruptions": [], "count": 0}

    fallback = []
    try:
        shipment_docs = db.collection("shipments").stream()
        for doc in shipment_docs:
            shipment = doc.to_dict()
            risk_payload = await risk_engine.evaluate_shipment_risk(shipment)
            score = float(risk_payload.get("riskScore", shipment.get("riskScore", 0.0)))
            pos = shipment.get("currentPosition") or {}
            if score < settings.RISK_THRESHOLD_REROUTE or not pos.get("lat") or not pos.get("lng"):
                continue

            severity = "critical" if score >= 85 else "high"
            fallback.append(
                {
                    "id": f"RISK-{shipment.get('id')}",
                    "type": "risk_spike",
                    "severity": severity,
                    "status": "active",
                    "shipmentId": shipment.get("id"),
                    "nodeId": shipment.get("currentStage"),
                    "location": {"lat": pos["lat"], "lng": pos["lng"], "radius": 70},
                    "description": f"Shipment {shipment.get('id')} has elevated risk score {round(score, 1)}.",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                }
            )
    except Exception as exc:
        print(f"[Disruptions] Fallback generation failed: {exc}")

    return {"disruptions": fallback, "count": len(fallback)}


@router.post("/disruptions/detect")
async def detect_disruptions():
    """Trigger disruption detection scan and persist active events when DB exists."""
    try:
        detected = await disruption_detector.detect()
        db = firebase_service.db
        deduped = []
        if db:
            existing_docs = list(
                db.collection("disruptions")
                .where(filter=FieldFilter("status", "==", "active"))
                .stream()
            )
            existing = [doc.to_dict() for doc in existing_docs]
            batch = db.batch()
            for event in detected:
                event_type = event.get("type")
                event_location = event.get("location") or {}
                event_lat = round(float(event_location.get("lat", 0.0)), 2)
                event_lng = round(float(event_location.get("lng", 0.0)), 2)
                event_ts_raw = event.get("timestamp")
                try:
                    event_ts = datetime.fromisoformat(str(event_ts_raw).replace("Z", "+00:00"))
                except Exception:
                    event_ts = datetime.now(timezone.utc)

                cutoff = event_ts - timedelta(hours=3)
                is_duplicate = False
                for existing_item in existing:
                    if existing_item.get("type") != event_type:
                        continue
                    location = existing_item.get("location") or {}
                    if round(float(location.get("lat", 0.0)), 2) != event_lat:
                        continue
                    if round(float(location.get("lng", 0.0)), 2) != event_lng:
                        continue
                    existing_ts_raw = existing_item.get("timestamp")
                    try:
                        existing_ts = datetime.fromisoformat(str(existing_ts_raw).replace("Z", "+00:00"))
                    except Exception:
                        existing_ts = datetime.min.replace(tzinfo=timezone.utc)
                    if existing_ts >= cutoff:
                        is_duplicate = True
                        break

                if is_duplicate:
                    continue

                doc_id = event.get("id") or f"DIS-{datetime.utcnow().timestamp()}"
                ref = db.collection("disruptions").document(doc_id)
                batch.set(ref, event)
                deduped.append(event)
                existing.append(event)
            batch.commit()
        else:
            deduped = detected
        return {"detected": len(deduped), "disruptions": deduped}
    except Exception as exc:
        print(f"[Disruptions] Detect failed: {exc}")
        return {"detected": 0, "disruptions": [], "error": str(exc)}


@router.post("/disruptions/cleanup")
async def cleanup_disruptions():
    """
    One-time maintenance endpoint.
    Deduplicates active disruptions by (status + type + rounded lat/lng),
    keeps the newest event, and deletes older duplicates.
    """
    db = firebase_service.db
    if not db:
        return {"removed": 0, "kept": 0, "error": "Database not initialized"}

    try:
        docs = list(
            db.collection("disruptions")
            .where(filter=FieldFilter("status", "==", "active"))
            .stream()
        )
        if not docs:
            return {"removed": 0, "kept": 0, "error": None}

        grouped = {}
        for doc in docs:
            item = doc.to_dict()
            key = _dedup_key(item)
            grouped.setdefault(key, []).append((doc.id, item))

        to_delete_ids = []
        kept = 0
        for _, entries in grouped.items():
            entries_sorted = sorted(
                entries,
                key=lambda pair: _safe_parse_ts((pair[1] or {}).get("timestamp")),
                reverse=True,
            )
            kept += 1
            for duplicate in entries_sorted[1:]:
                to_delete_ids.append(duplicate[0])

        for i in range(0, len(to_delete_ids), 450):
            chunk = to_delete_ids[i : i + 450]
            batch = db.batch()
            for doc_id in chunk:
                ref = db.collection("disruptions").document(doc_id)
                batch.delete(ref)
            batch.commit()

        return {"removed": len(to_delete_ids), "kept": kept, "error": None}
    except Exception as exc:
        print(f"[Disruptions] Cleanup failed: {exc}")
        return {"removed": 0, "kept": 0, "error": str(exc)}


@router.post("/disruptions/purge-legacy-weather")
async def purge_legacy_weather_disruptions():
    """
    Removes legacy weather disruption documents that were created before source-tagging.
    Legacy criteria:
    - type == weather
    - source == "weather_api"
    - missing weatherMeta
    """
    db = firebase_service.db
    if not db:
        return {"removed": 0, "error": "Database not initialized"}

    try:
        docs = list(db.collection("disruptions").stream())
        legacy_ids = []
        for doc in docs:
            item = doc.to_dict() or {}
            if item.get("type") != "weather":
                continue
            if item.get("source") != "weather_api":
                continue
            if item.get("weatherMeta") is not None:
                continue
            legacy_ids.append(doc.id)

        for i in range(0, len(legacy_ids), 450):
            chunk = legacy_ids[i : i + 450]
            batch = db.batch()
            for doc_id in chunk:
                ref = db.collection("disruptions").document(doc_id)
                batch.delete(ref)
            batch.commit()

        return {"removed": len(legacy_ids), "error": None}
    except Exception as exc:
        print(f"[Disruptions] Purge legacy weather failed: {exc}")
        return {"removed": 0, "error": str(exc)}
