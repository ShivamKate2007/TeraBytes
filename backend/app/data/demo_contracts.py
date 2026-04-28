"""Seed contracts, drivers, and vehicles for Phase 9D development."""
from datetime import datetime, timedelta, timezone


def _iso(hours_from_now: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours_from_now)).isoformat().replace("+00:00", "Z")


DEMO_VEHICLES = [
    {
        "id": "TRK-7001",
        "plateNumber": "MH-12-TB-7001",
        "vehicleType": "Refrigerated Truck",
        "carrierOrgId": "ORG-CARRIER-1",
        "capacityKg": 12000,
        "status": "on_trip",
    },
    {
        "id": "TRK-7002",
        "plateNumber": "DL-01-TB-7002",
        "vehicleType": "Container Truck",
        "carrierOrgId": "ORG-CARRIER-1",
        "capacityKg": 16000,
        "status": "available",
    },
    {
        "id": "TRK-7003",
        "plateNumber": "KA-05-TB-7003",
        "vehicleType": "Dry Van",
        "carrierOrgId": "ORG-CARRIER-1",
        "capacityKg": 9000,
        "status": "available",
    },
]


DEMO_DRIVER_PROFILES = [
    {
        "id": "USR-DRIVER-001",
        "name": "Driver Arjun",
        "carrierOrgId": "ORG-CARRIER-1",
        "phone": "+91-90000-70001",
        "licenseId": "DL-SSC-ARJUN-001",
        "status": "on_trip",
        "assignedVehicleId": "TRK-7001",
        "skills": ["long-haul", "cold-chain", "night-driving"],
        "rating": {
            "overall": 4.7,
            "onTime": 94,
            "noDamage": 98,
            "routeCompliance": 91,
            "incidentFree": 96,
        },
        "history": {
            "completedTrips": 42,
            "lateDeliveries": 3,
            "damageIncidents": 1,
            "lastCompletedShipmentId": "SHP-HIST-2042",
        },
    },
    {
        "id": "USR-DRIVER-002",
        "name": "Driver Meera",
        "carrierOrgId": "ORG-CARRIER-1",
        "phone": "+91-90000-70002",
        "licenseId": "DL-SSC-MEERA-002",
        "status": "available",
        "assignedVehicleId": "TRK-7002",
        "skills": ["express", "fragile-goods", "urban-delivery"],
        "rating": {
            "overall": 4.9,
            "onTime": 97,
            "noDamage": 99,
            "routeCompliance": 95,
            "incidentFree": 99,
        },
        "history": {
            "completedTrips": 58,
            "lateDeliveries": 2,
            "damageIncidents": 0,
            "lastCompletedShipmentId": "SHP-HIST-3058",
        },
    },
    {
        "id": "USR-DRIVER-003",
        "name": "Driver Kabir",
        "carrierOrgId": "ORG-CARRIER-1",
        "phone": "+91-90000-70003",
        "licenseId": "DL-SSC-KABIR-003",
        "status": "available",
        "assignedVehicleId": "TRK-7003",
        "skills": ["hazmat-ready", "interstate", "heavy-load"],
        "rating": {
            "overall": 4.5,
            "onTime": 90,
            "noDamage": 96,
            "routeCompliance": 89,
            "incidentFree": 94,
        },
        "history": {
            "completedTrips": 31,
            "lateDeliveries": 4,
            "damageIncidents": 1,
            "lastCompletedShipmentId": "SHP-HIST-1031",
        },
    },
]


DEMO_CONTRACTS = [
    {
        "id": "CTR-DEMO-001",
        "shipmentId": "SHP-16FBEEC9",
        "contractType": "transport_order",
        "createdBy": "USR-SCM-001",
        "carrierOrgId": "ORG-CARRIER-1",
        "driverId": "USR-DRIVER-001",
        "vehicleId": "TRK-7001",
        "originNodeId": "nagpur_hub",
        "destinationNodeId": "retailer_delhi",
        "mandatoryStopNodeIds": ["kolkata_dc"],
        "slaDeliveryAt": _iso(52),
        "price": 52000,
        "currency": "INR",
        "status": "in_progress",
        "penaltyRules": {"lateDeliveryPerHour": 750},
        "performanceSnapshot": {
            "driverOverallRating": 4.7,
            "carrierReliability": 94,
            "previousTrips": 42,
        },
        "events": [
            {
                "type": "contract_accepted",
                "actorUserId": "USR-CARRIER-001",
                "message": "Carrier accepted transport order.",
                "createdAt": _iso(-9),
            },
            {
                "type": "driver_assigned",
                "actorUserId": "USR-CARRIER-001",
                "message": "Driver Arjun assigned to shipment.",
                "createdAt": _iso(-8),
            },
        ],
        "createdAt": _iso(-10),
        "acceptedAt": _iso(-9),
        "completedAt": None,
        "updatedAt": _iso(-1),
    }
]
