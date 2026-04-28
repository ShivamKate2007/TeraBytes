"""Contract lifecycle APIs for Phase 9D."""
from fastapi import APIRouter, Depends, HTTPException

from app.models.contract import AssignDriverRequest, ContractCreate, ContractPatch, HandoffRequest
from app.services.auth_service import get_current_user
from app.services.access_control import (
    can_assign_contract_driver,
    can_confirm_contract_handoff,
    can_create_contract,
    can_execute_contract,
    can_manage_contract,
    can_view_contract,
    require_allowed,
    scope_contracts,
    scope_driver_profiles,
)
from app.services import contract_service


router = APIRouter()


def _viewer_payload(user: dict) -> dict:
    return {
        "id": user.get("id"),
        "role": user.get("role"),
        "roleLabel": user.get("roleLabel"),
        "organizationId": user.get("organizationId"),
    }


@router.get("/contracts")
async def get_contracts(current_user: dict = Depends(get_current_user)):
    contracts = contract_service.list_contracts()
    scoped = scope_contracts(current_user, contracts)
    return {"contracts": scoped, "count": len(scoped), "viewer": _viewer_payload(current_user)}


@router.post("/contracts")
async def create_contract(payload: ContractCreate, current_user: dict = Depends(get_current_user)):
    require_allowed(can_create_contract(current_user), "Only Admin or Supply Chain Manager can create contracts")
    contract = contract_service.create_contract(payload.model_dump(), current_user)
    return {"contract": contract, "error": None, "viewer": _viewer_payload(current_user)}


@router.get("/contracts/drivers")
async def get_driver_profiles(current_user: dict = Depends(get_current_user)):
    drivers = contract_service.list_driver_profiles()
    contracts = contract_service.list_contracts()
    scoped = scope_driver_profiles(current_user, drivers, contracts)
    return {"drivers": scoped, "count": len(scoped), "viewer": _viewer_payload(current_user)}


@router.get("/contracts/vehicles")
async def get_vehicles(current_user: dict = Depends(get_current_user)):
    vehicles = contract_service.list_vehicles()
    if current_user.get("role") == "carrier_partner":
        vehicles = [item for item in vehicles if item.get("carrierOrgId") == current_user.get("organizationId")]
    if current_user.get("role") == "driver":
        allowed = set(current_user.get("assignedVehicleIds") or [])
        vehicles = [item for item in vehicles if item.get("id") in allowed]
    return {"vehicles": vehicles, "count": len(vehicles), "viewer": _viewer_payload(current_user)}


@router.post("/contracts/evaluate-breaches")
async def evaluate_breaches(current_user: dict = Depends(get_current_user)):
    require_allowed(
        can_manage_contract(current_user, {"carrierOrgId": current_user.get("organizationId")}),
        "Only Admin, Supply Chain Manager, or Carrier Partner can evaluate contract breaches",
    )
    result = contract_service.evaluate_contract_breaches()
    return {**result, "error": None, "viewer": _viewer_payload(current_user)}


@router.get("/contracts/{contract_id}")
async def get_contract(contract_id: str, current_user: dict = Depends(get_current_user)):
    contract = contract_service.get_contract(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    require_allowed(can_view_contract(current_user, contract), "Contract is outside your role scope")
    return {"contract": contract, "error": None, "viewer": _viewer_payload(current_user)}


@router.patch("/contracts/{contract_id}")
async def patch_contract(contract_id: str, payload: ContractPatch, current_user: dict = Depends(get_current_user)):
    contract = contract_service.get_contract(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    require_allowed(can_manage_contract(current_user, contract), "You cannot manage this contract")
    updated = contract_service.patch_contract(
        contract_id,
        payload.model_dump(exclude_unset=True),
        current_user,
    )
    return {"contract": updated, "error": None, "viewer": _viewer_payload(current_user)}


@router.post("/contracts/{contract_id}/send")
async def send_contract(contract_id: str, current_user: dict = Depends(get_current_user)):
    contract = contract_service.get_contract(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    require_allowed(can_manage_contract(current_user, contract), "You cannot send this contract")
    updated = contract_service.transition_contract(
        contract_id,
        "sent",
        current_user,
        f"Contract {contract_id} sent to carrier.",
        "contract_sent",
    )
    return {"contract": updated, "error": None}


@router.post("/contracts/{contract_id}/accept")
async def accept_contract(contract_id: str, current_user: dict = Depends(get_current_user)):
    contract = contract_service.get_contract(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    require_allowed(can_manage_contract(current_user, contract), "You cannot accept this contract")
    updated = contract_service.transition_contract(
        contract_id,
        "accepted",
        current_user,
        f"Contract {contract_id} accepted.",
        "contract_accepted",
    )
    return {"contract": updated, "error": None}


@router.post("/contracts/{contract_id}/reject")
async def reject_contract(contract_id: str, current_user: dict = Depends(get_current_user)):
    contract = contract_service.get_contract(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    require_allowed(can_manage_contract(current_user, contract), "You cannot reject this contract")
    updated = contract_service.transition_contract(
        contract_id,
        "rejected",
        current_user,
        f"Contract {contract_id} rejected.",
        "contract_rejected",
    )
    return {"contract": updated, "error": None}


@router.post("/contracts/{contract_id}/assign-driver")
async def assign_driver(contract_id: str, payload: AssignDriverRequest, current_user: dict = Depends(get_current_user)):
    contract = contract_service.get_contract(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    require_allowed(can_assign_contract_driver(current_user, contract), "You cannot assign drivers to this contract")
    updated = contract_service.assign_driver(contract_id, payload.driverId, payload.vehicleId, current_user)
    return {"contract": updated, "error": None}


@router.post("/contracts/{contract_id}/handoff")
async def confirm_handoff(contract_id: str, payload: HandoffRequest, current_user: dict = Depends(get_current_user)):
    contract = contract_service.get_contract(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    require_allowed(
        can_confirm_contract_handoff(current_user, contract, payload.nodeId),
        "You cannot confirm handoff for this contract/node",
    )
    updated = contract_service.confirm_handoff(contract_id, payload.nodeId, current_user, payload.message)
    return {"contract": updated, "error": None}


@router.post("/contracts/{contract_id}/start")
async def start_contract(contract_id: str, current_user: dict = Depends(get_current_user)):
    contract = contract_service.get_contract(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    require_allowed(can_execute_contract(current_user, contract), "Only assigned driver/carrier/operator can start this contract")
    updated = contract_service.transition_contract(
        contract_id,
        "in_progress",
        current_user,
        f"Contract {contract_id} started.",
        "contract_started",
    )
    return {"contract": updated, "error": None}


@router.post("/contracts/{contract_id}/complete")
async def complete_contract(contract_id: str, current_user: dict = Depends(get_current_user)):
    contract = contract_service.get_contract(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    require_allowed(can_execute_contract(current_user, contract), "Only assigned driver/carrier/operator can complete this contract")
    updated = contract_service.transition_contract(
        contract_id,
        "completed",
        current_user,
        f"Contract {contract_id} completed.",
        "contract_completed",
    )
    return {"contract": updated, "error": None}


@router.post("/contracts/{contract_id}/cancel")
async def cancel_contract(contract_id: str, current_user: dict = Depends(get_current_user)):
    contract = contract_service.get_contract(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    require_allowed(can_manage_contract(current_user, contract), "You cannot cancel this contract")
    updated = contract_service.transition_contract(
        contract_id,
        "cancelled",
        current_user,
        f"Contract {contract_id} cancelled.",
        "contract_cancelled",
    )
    return {"contract": updated, "error": None}
