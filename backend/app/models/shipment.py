"""Shipment Pydantic models"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class Position(BaseModel):
    lat: float
    lng: float


class JourneyStage(BaseModel):
    stage: str  # manufacturer, warehouse, in_transit, distribution_center, retailer
    nodeId: Optional[str] = None
    nodeName: Optional[str] = None
    status: str  # completed, active, pending
    arrivedAt: Optional[str] = None
    departedAt: Optional[str] = None
    eta: Optional[str] = None
    currentLeg: Optional[str] = None  # for in_transit stage


class Shipment(BaseModel):
    id: str
    cargoType: str
    priority: str  # critical, high, medium, low
    weight: float
    value: float
    manufacturer: str
    endCustomer: str
    journey: List[JourneyStage]
    currentPosition: Optional[Position] = None
    currentStage: str
    riskScore: float = 0
    lstmPrediction: float = 0
    vehicleId: Optional[str] = None
    routeId: Optional[str] = None
    status: str  # at_manufacturer, at_warehouse, in_transit, at_distributor, delivered
    isRerouted: bool = False
    originalRoute: Optional[List[str]] = None
    optimizedRoute: Optional[List[str]] = None


class ShipmentResponse(BaseModel):
    shipments: List[Shipment]
    count: int
