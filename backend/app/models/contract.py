"""Contract and carrier execution models."""
from typing import Any, Literal

from pydantic import BaseModel, Field


ContractStatus = Literal[
    "draft",
    "sent",
    "accepted",
    "assigned_driver",
    "in_progress",
    "handoff_pending",
    "completed",
    "breached",
    "cancelled",
    "rejected",
]


class PenaltyRules(BaseModel):
    lateDeliveryPerHour: float = 0


class ContractEvent(BaseModel):
    type: str
    actorUserId: str | None = None
    message: str
    createdAt: str


class ContractCreate(BaseModel):
    shipmentId: str
    contractType: str = "transport_order"
    carrierOrgId: str
    driverId: str | None = None
    vehicleId: str | None = None
    originNodeId: str
    destinationNodeId: str
    mandatoryStopNodeIds: list[str] = Field(default_factory=list)
    slaDeliveryAt: str
    price: float = 0
    currency: str = "INR"
    penaltyRules: PenaltyRules = Field(default_factory=PenaltyRules)


class ContractPatch(BaseModel):
    driverId: str | None = None
    vehicleId: str | None = None
    slaDeliveryAt: str | None = None
    price: float | None = None
    status: ContractStatus | None = None
    mandatoryStopNodeIds: list[str] | None = None
    metadata: dict[str, Any] | None = None


class AssignDriverRequest(BaseModel):
    driverId: str
    vehicleId: str | None = None


class HandoffRequest(BaseModel):
    nodeId: str
    message: str | None = None


class ContractResponse(BaseModel):
    contract: dict[str, Any] | None = None
    error: str | None = None


class ContractListResponse(BaseModel):
    contracts: list[dict[str, Any]]
    count: int
    error: str | None = None
