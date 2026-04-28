"""Role and scope checks for the Smart Supply Chain platform."""
from fastapi import HTTPException


GLOBAL_READ_ROLES = {"admin", "supply_chain_manager", "analyst"}
GLOBAL_WRITE_ROLES = {"admin", "supply_chain_manager"}
CONTRACT_CREATE_ROLES = {"admin", "supply_chain_manager"}
CONTRACT_MANAGE_ROLES = {"admin", "supply_chain_manager"}
SIMULATOR_ROLES = {
    "admin",
    "supply_chain_manager",
    "warehouse_manager",
    "distributor_manager",
    "carrier_partner",
    "analyst",
}


def role(user: dict) -> str:
    return (user or {}).get("role", "")


def is_global_reader(user: dict) -> bool:
    return role(user) in GLOBAL_READ_ROLES


def is_global_operator(user: dict) -> bool:
    return role(user) in GLOBAL_WRITE_ROLES


def _as_set(value) -> set:
    if not value:
        return set()
    if isinstance(value, str):
        return {value}
    return {item for item in value if item}


def shipment_id(shipment: dict) -> str | None:
    return shipment.get("id") or shipment.get("shipmentId")


def shipment_node_ids(shipment: dict) -> set:
    node_ids = set()
    for key in ("route", "optimizedRoute", "originalRoute"):
        node_ids.update(_as_set(shipment.get(key)))

    for item in shipment.get("journey") or []:
        if isinstance(item, dict):
            node_ids.add(item.get("nodeId"))

    sim_state = shipment.get("simState") or {}
    node_ids.update(
        node for node in [sim_state.get("fromNode"), sim_state.get("toNode")] if node
    )
    return {node for node in node_ids if node}


def current_or_destination_nodes(shipment: dict) -> set:
    nodes = set()
    sim_state = shipment.get("simState") or {}
    nodes.update(
        node for node in [sim_state.get("fromNode"), sim_state.get("toNode")] if node
    )
    journey = shipment.get("journey") or []
    for item in journey:
        if isinstance(item, dict) and item.get("status") in {"active", "pending"}:
            nodes.add(item.get("nodeId"))
    route = shipment.get("optimizedRoute") or shipment.get("route") or []
    if route:
        nodes.add(route[-1])
    return {node for node in nodes if node}


def contract_node_ids(contract: dict) -> set:
    node_ids = set()
    for key in ("originNodeId", "destinationNodeId"):
        if contract.get(key):
            node_ids.add(contract.get(key))
    node_ids.update(_as_set(contract.get("mandatoryStopNodeIds")))
    return {node for node in node_ids if node}


def can_view_shipment(user: dict, shipment: dict) -> bool:
    if is_global_reader(user):
        return True

    sid = shipment_id(shipment)
    if sid and sid in _as_set(user.get("assignedShipmentIds")):
        return True

    user_role = role(user)
    assigned_nodes = _as_set(user.get("assignedNodeIds"))
    assigned_vehicles = _as_set(user.get("assignedVehicleIds"))
    vehicle_id = shipment.get("vehicleId") or shipment.get("truckId")

    if user_role == "driver":
        return bool(
            (vehicle_id and vehicle_id in assigned_vehicles)
            or (sid and sid in _as_set(user.get("assignedShipmentIds")))
        )

    if user_role == "carrier_partner":
        # Demo carrier scope: shipments with a vehicle assignment are fleet work.
        return bool(vehicle_id or shipment.get("status") != "delivered")

    if user_role in {"warehouse_manager", "distributor_manager"}:
        return bool(assigned_nodes & shipment_node_ids(shipment))

    if user_role == "retailer_receiver":
        return bool(assigned_nodes & current_or_destination_nodes(shipment))

    return False


def scope_shipments(user: dict, shipments: list[dict]) -> list[dict]:
    if is_global_reader(user):
        return shipments
    return [shipment for shipment in shipments if can_view_shipment(user, shipment)]


def can_apply_reroute(user: dict, shipment: dict | None = None) -> bool:
    return is_global_operator(user)


def can_fast_forward(user: dict) -> bool:
    return is_global_operator(user)


def can_run_simulator(user: dict) -> bool:
    return role(user) in SIMULATOR_ROLES


def can_trigger_detection(user: dict) -> bool:
    return is_global_operator(user)


def can_create_contract(user: dict) -> bool:
    return role(user) in CONTRACT_CREATE_ROLES


def can_view_contract(user: dict, contract: dict) -> bool:
    if is_global_reader(user):
        return True

    user_role = role(user)
    user_id = user.get("id")
    org_id = user.get("organizationId")

    if contract.get("createdBy") == user_id:
        return True
    if contract.get("driverId") == user_id:
        return True
    if contract.get("carrierOrgId") == org_id:
        return user_role == "carrier_partner"

    assigned_nodes = _as_set(user.get("assignedNodeIds"))
    if user_role in {"warehouse_manager", "distributor_manager", "retailer_receiver"}:
        return bool(assigned_nodes & contract_node_ids(contract))

    return False


def can_manage_contract(user: dict, contract: dict | None = None) -> bool:
    if role(user) in CONTRACT_MANAGE_ROLES:
        return True
    if not contract:
        return False
    if role(user) == "carrier_partner":
        return contract.get("carrierOrgId") == user.get("organizationId")
    return False


def can_assign_contract_driver(user: dict, contract: dict) -> bool:
    if role(user) in CONTRACT_MANAGE_ROLES:
        return True
    return role(user) == "carrier_partner" and contract.get("carrierOrgId") == user.get("organizationId")


def can_execute_contract(user: dict, contract: dict) -> bool:
    if can_manage_contract(user, contract):
        return True
    return role(user) == "driver" and contract.get("driverId") == user.get("id")


def can_confirm_contract_handoff(user: dict, contract: dict, node_id: str | None = None) -> bool:
    if can_manage_contract(user, contract) or can_execute_contract(user, contract):
        return True
    user_role = role(user)
    if user_role not in {"warehouse_manager", "distributor_manager", "retailer_receiver"}:
        return False
    assigned_nodes = _as_set(user.get("assignedNodeIds"))
    if node_id:
        return node_id in assigned_nodes and node_id in contract_node_ids(contract)
    return bool(assigned_nodes & contract_node_ids(contract))


def scope_contracts(user: dict, contracts: list[dict]) -> list[dict]:
    if is_global_reader(user):
        return contracts
    return [contract for contract in contracts if can_view_contract(user, contract)]


def scope_driver_profiles(user: dict, drivers: list[dict], contracts: list[dict] | None = None) -> list[dict]:
    user_role = role(user)
    if user_role in {"admin", "supply_chain_manager", "analyst"}:
        return drivers
    if user_role == "carrier_partner":
        return [driver for driver in drivers if driver.get("carrierOrgId") == user.get("organizationId")]
    if user_role == "driver":
        return [driver for driver in drivers if driver.get("id") == user.get("id")]
    visible_driver_ids = {
        contract.get("driverId")
        for contract in scope_contracts(user, contracts or [])
        if contract.get("driverId")
    }
    return [driver for driver in drivers if driver.get("id") in visible_driver_ids]


def require_allowed(condition: bool, detail: str = "Not authorized"):
    if not condition:
        raise HTTPException(status_code=403, detail=detail)


def scope_graph(user: dict, nodes: list[dict], edges: list[dict], shipments: list[dict] | None = None):
    if is_global_reader(user):
        return nodes, edges

    visible_shipments = scope_shipments(user, shipments or [])
    allowed_node_ids = set()
    for shipment in visible_shipments:
        allowed_node_ids.update(shipment_node_ids(shipment))

    allowed_node_ids.update(_as_set(user.get("assignedNodeIds")))
    if not allowed_node_ids:
        return [], []

    scoped_nodes = [
        node for node in nodes
        if (node.get("id") or node.get("nodeId")) in allowed_node_ids
    ]
    scoped_edges = [
        edge for edge in edges
        if edge.get("from") in allowed_node_ids and edge.get("to") in allowed_node_ids
    ]
    return scoped_nodes, scoped_edges
