"""Alert Pydantic models"""
from pydantic import BaseModel
from typing import Optional, List


class Alert(BaseModel):
    id: str
    severity: str  # low, moderate, high, critical
    title: str
    message: str  # Gemini-generated human-readable text
    disruptionId: Optional[str] = None
    affectedShipments: List[str] = []
    timestamp: str = ""
    isRead: bool = False
