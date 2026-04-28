"""Contract persistence and lifecycle helpers."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

from app.data.demo_contracts import DEMO_CONTRACTS, DEMO_DRIVER_PROFILES, DEMO_VEHICLES
from app.services.firebase_service import firebase_service


_memory_contracts = {contract["id"]: deepcopy(contract) for contract in DEMO_CONTRACTS}
_memory_drivers = {driver["id"]: deepcopy(driver) for driver in DEMO_DRIVER_PROFILES}
_memory_vehicles = {vehicle["id"]: deepcopy(vehicle) for vehicle in DEMO_VEHICLES}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _db():
    return firebase_service.db


def _collection(name: str):
    db = _db()
    return db.collection(name) if db else None


def _event(event_type: str, actor_user_id: str | None, message: str) -> dict:
    return {
        "type": event_type,
        "actorUserId": actor_user_id,
        "message": message,
        "createdAt": utc_now(),
    }


def _snapshot_driver(driver_id: str | None) -> dict:
    if not driver_id:
        return {}
    driver = get_driver_profile(driver_id)
    rating = driver.get("rating") or {}
    history = driver.get("history") or {}
    return {
        "driverOverallRating": rating.get("overall"),
        "driverOnTime": rating.get("onTime"),
        "driverNoDamage": rating.get("noDamage"),
        "previousTrips": history.get("completedTrips"),
    }


def list_contracts() -> list[dict]:
    evaluate_contract_breaches()
    collection = _collection("contracts")
    if not collection:
        return list(deepcopy(_memory_contracts).values())

    docs = list(collection.stream())
    if not docs:
        return list(deepcopy(_memory_contracts).values())
    return [doc.to_dict() for doc in docs]


def get_contract(contract_id: str) -> dict | None:
    collection = _collection("contracts")
    if collection:
        doc = collection.document(contract_id).get()
        if doc.exists:
            return doc.to_dict()
    return deepcopy(_memory_contracts.get(contract_id))


def create_contract(payload: dict, actor_user: dict) -> dict:
    contract_id = f"CTR-{uuid4().hex[:8].upper()}"
    now = utc_now()
    contract = {
        "id": contract_id,
        "createdBy": actor_user.get("id"),
        "status": "draft",
        "events": [
            _event(
                "contract_created",
                actor_user.get("id"),
                f"Contract {contract_id} created for shipment {payload.get('shipmentId')}.",
            )
        ],
        "createdAt": now,
        "updatedAt": now,
        "acceptedAt": None,
        "completedAt": None,
        "performanceSnapshot": _snapshot_driver(payload.get("driverId")),
        **payload,
    }
    _save_contract(contract)
    return contract


def patch_contract(contract_id: str, patch: dict, actor_user: dict) -> dict | None:
    contract = get_contract(contract_id)
    if not contract:
        return None
    for key, value in patch.items():
        if value is not None:
            contract[key] = value
    if "driverId" in patch:
        contract["performanceSnapshot"] = _snapshot_driver(patch.get("driverId"))
    contract["updatedAt"] = utc_now()
    contract.setdefault("events", []).append(
        _event("contract_updated", actor_user.get("id"), f"Contract {contract_id} updated.")
    )
    _save_contract(contract)
    return contract


def transition_contract(contract_id: str, status: str, actor_user: dict, message: str, event_type: str | None = None) -> dict | None:
    contract = get_contract(contract_id)
    if not contract:
        return None
    now = utc_now()
    contract["status"] = status
    contract["updatedAt"] = now
    if status == "accepted":
        contract["acceptedAt"] = now
    if status == "completed":
        contract["completedAt"] = now
    contract.setdefault("events", []).append(
        _event(event_type or f"contract_{status}", actor_user.get("id"), message)
    )
    _save_contract(contract)
    return contract


def assign_driver(contract_id: str, driver_id: str, vehicle_id: str | None, actor_user: dict) -> dict | None:
    contract = get_contract(contract_id)
    if not contract:
        return None
    contract["driverId"] = driver_id
    if vehicle_id:
        contract["vehicleId"] = vehicle_id
    contract["status"] = "assigned_driver"
    contract["performanceSnapshot"] = _snapshot_driver(driver_id)
    contract["updatedAt"] = utc_now()
    contract.setdefault("events", []).append(
        _event("driver_assigned", actor_user.get("id"), f"Driver {driver_id} assigned to contract {contract_id}.")
    )
    _save_contract(contract)
    return contract


def confirm_handoff(contract_id: str, node_id: str, actor_user: dict, message: str | None = None) -> dict | None:
    contract = get_contract(contract_id)
    if not contract:
        return None
    now = utc_now()
    handoff_message = message or f"Handoff confirmed at {node_id}."
    handoffs = contract.setdefault("handoffs", [])
    handoffs.append(
        {
            "nodeId": node_id,
            "actorUserId": actor_user.get("id"),
            "role": actor_user.get("role"),
            "confirmedAt": now,
            "message": handoff_message,
        }
    )
    if contract.get("status") == "in_progress":
        contract["status"] = "handoff_pending"
    contract["updatedAt"] = now
    contract.setdefault("events", []).append(
        _event("handoff_confirmed", actor_user.get("id"), handoff_message)
    )
    _save_contract(contract)
    return contract


def evaluate_contract_breaches() -> dict:
    """
    Mark active overdue contracts as breached.
    This is intentionally lightweight so the demo can surface SLA risk without
    needing a separate worker process.
    """
    collection = _collection("contracts")
    contracts = []
    if collection:
        docs = list(collection.stream())
        contracts = [doc.to_dict() for doc in docs]
    else:
        contracts = list(deepcopy(_memory_contracts).values())

    now = datetime.now(timezone.utc)
    breached = []
    for contract in contracts:
        if contract.get("status") in {"completed", "cancelled", "rejected", "breached"}:
            continue
        sla_raw = contract.get("slaDeliveryAt")
        if not sla_raw:
            continue
        try:
            sla_at = datetime.fromisoformat(str(sla_raw).replace("Z", "+00:00"))
        except Exception:
            continue
        if sla_at >= now:
            continue

        hours_late = max(1, int((now - sla_at).total_seconds() // 3600) + 1)
        penalty = float((contract.get("penaltyRules") or {}).get("lateDeliveryPerHour") or 0)
        contract["status"] = "breached"
        contract["breachedAt"] = utc_now()
        contract["breachSummary"] = {
            "hoursLate": hours_late,
            "estimatedPenalty": round(hours_late * penalty, 2),
            "reason": "SLA delivery deadline passed before completion.",
        }
        contract["updatedAt"] = utc_now()
        contract.setdefault("events", []).append(
            _event(
                "contract_breached",
                None,
                f"Contract breached SLA by {hours_late}h. Estimated penalty: {round(hours_late * penalty, 2)} {contract.get('currency', 'INR')}.",
            )
        )
        _save_contract(contract)
        breached.append(contract.get("id"))

    return {"breached": len(breached), "contractIds": breached}


def _save_contract(contract: dict) -> None:
    collection = _collection("contracts")
    if collection:
        collection.document(contract["id"]).set(contract)
        return
    _memory_contracts[contract["id"]] = deepcopy(contract)


def list_driver_profiles() -> list[dict]:
    collection = _collection("driver_profiles")
    if not collection:
        return list(deepcopy(_memory_drivers).values())
    docs = list(collection.stream())
    if not docs:
        return list(deepcopy(_memory_drivers).values())
    return [doc.to_dict() for doc in docs]


def get_driver_profile(driver_id: str) -> dict:
    collection = _collection("driver_profiles")
    if collection:
        doc = collection.document(driver_id).get()
        if doc.exists:
            return doc.to_dict()
    return deepcopy(_memory_drivers.get(driver_id, {}))


def list_vehicles() -> list[dict]:
    collection = _collection("vehicles")
    if not collection:
        return list(deepcopy(_memory_vehicles).values())
    docs = list(collection.stream())
    if not docs:
        return list(deepcopy(_memory_vehicles).values())
    return [doc.to_dict() for doc in docs]
