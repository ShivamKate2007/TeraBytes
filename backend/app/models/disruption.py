"""Disruption Pydantic models"""
from pydantic import BaseModel
from typing import Optional, List


class DisruptionLocation(BaseModel):
    lat: float
    lng: float
    radius: float = 50  # km


class Disruption(BaseModel):
    id: str
    type: str  # weather, strike, accident, construction, storm, port_closure
    severity: str  # low, moderate, high, critical
    location: DisruptionLocation
    affectedNodes: List[str] = []
    affectedShipments: List[str] = []
    description: str = ""
    source: str = ""  # weather_api, news_api, lstm_prediction, manual
    startTime: Optional[str] = None
    estimatedEndTime: Optional[str] = None
    riskContribution: float = 0
    status: str = "active"  # active, resolved, predicted


class WhatIfRequest(BaseModel):
    lat: float
    lng: float
    type: str
    severity: str = "high"
    radius: float = 50
    duration: float = 24  # hours
