from collections import Counter
from typing import List, Dict, Optional
from app.services.route_optimizer import route_optimizer

class CascadeAnalyzer:
    def _resolve_current_node_id(self, shipment: Dict) -> Optional[str]:
        journey = shipment.get("journey") or []
        active = next((step for step in journey if step.get("status") == "active" and step.get("nodeId")), None)
        if active:
            return active.get("nodeId")

        completed = [step for step in journey if step.get("status") == "completed" and step.get("nodeId")]
        if completed:
            return completed[-1].get("nodeId")

        route = shipment.get("optimizedRoute") or shipment.get("originalRoute") or []
        return route[0] if route else None

    def _resolve_destination_node_id(self, shipment: Dict) -> Optional[str]:
        if shipment.get("endCustomerNodeId"):
            return shipment.get("endCustomerNodeId")
        route = shipment.get("optimizedRoute") or shipment.get("originalRoute") or []
        if route:
            return route[-1]
        journey = shipment.get("journey") or []
        for step in reversed(journey):
            if step.get("nodeId"):
                return step.get("nodeId")
        return None

    def _remaining_route(self, shipment: Dict, current_node: str, destination_node: str) -> List[str]:
        route = shipment.get("optimizedRoute") or shipment.get("originalRoute") or []
        if not route:
            if current_node and destination_node and current_node != destination_node:
                return [current_node, destination_node]
            return [current_node] if current_node else []

        if current_node in route:
            start_idx = route.index(current_node)
            remaining = route[start_idx:]
        else:
            remaining = [current_node, *route]

        if destination_node and destination_node not in remaining:
            remaining.append(destination_node)
        return [node for idx, node in enumerate(remaining) if idx == 0 or node != remaining[idx - 1]]

    def _normalize_path_destination(self, path: List[str], destination_node: Optional[str]) -> List[str]:
        cleaned = [node for node in (path or []) if node]
        if destination_node and (not cleaned or cleaned[-1] != destination_node):
            cleaned.append(destination_node)
        return cleaned

    def _find_recovery_route_from_blocked_node(self, disruption_node: str, destination: str):
        """
        When shipment is physically at disrupted node, attempt a practical recovery:
        1) pick nearby connected safe node(s) around disrupted node
        2) route from that safe node to destination while avoiding disrupted node
        """
        graph = route_optimizer.base_graph
        candidates = set()
        try:
            candidates.update(list(graph.successors(disruption_node)))
        except Exception:
            pass
        try:
            candidates.update(list(graph.predecessors(disruption_node)))
        except Exception:
            pass
        candidates.discard(disruption_node)

        best = None
        for node in candidates:
            candidate_route = route_optimizer.find_optimal_route(
                origin=node,
                destination=destination,
                high_risk_nodes=[disruption_node],
            )
            if not candidate_route:
                continue
            if disruption_node in (candidate_route.get("path") or []):
                continue
            if best is None or candidate_route.get("totalTime", float("inf")) < best.get("totalTime", float("inf")):
                best = candidate_route
        return best

    def analyze_cascade(self, disruption_node: str, all_shipments: List[Dict]) -> Dict:
        """
        What-If Engine: Triggers when a node goes down.
        Identifies all shipments headed towards or through that node,
        calculates delay cascades, and automatically reroutes them via NetworkX.
        """
        affected_count = 0
        rerouted_shipments = []
        total_delay_added = 0.0
        cargo_counter = Counter()
        priority_counter = Counter()
        
        for shipment in all_shipments:
            current_node = self._resolve_current_node_id(shipment)
            destination = self._resolve_destination_node_id(shipment)
            if not current_node or not destination:
                continue

            remaining_path = self._remaining_route(shipment, current_node, destination)
            if disruption_node not in remaining_path:
                continue

            affected_count += 1
            cargo_counter.update([shipment.get("cargoType", "unknown")])
            priority_counter.update([shipment.get("priority", "unknown")])

            if current_node == disruption_node:
                original_route = route_optimizer.find_optimal_route(
                    origin=current_node,
                    destination=destination,
                )
                recovery_route = self._find_recovery_route_from_blocked_node(disruption_node, destination)

                if recovery_route:
                    # Add a handling lag for transfer/reassignment from disrupted node to recovery node.
                    transfer_lag_hrs = 2.0
                    original_time = float((original_route or {}).get("totalTime", 0.0))
                    new_time = float(recovery_route.get("totalTime", 0.0)) + transfer_lag_hrs
                    # Even if graph travel appears shorter from recovery node, transfer still costs time.
                    delay_delta = max(transfer_lag_hrs, new_time - original_time)
                    total_delay_added += delay_delta
                    recovery_path = self._normalize_path_destination(
                        recovery_route.get("path") or [],
                        destination,
                    )
                    old_path = self._normalize_path_destination(remaining_path, destination)

                    rerouted_shipments.append({
                        "shipmentId": shipment.get("id"),
                        "currentStage": shipment.get("currentStage"),
                        "shipmentStatus": shipment.get("status"),
                        "oldPath": old_path,
                        "newPath": recovery_path,
                        "destinationNode": destination,
                        "oldDestinationNode": old_path[-1] if old_path else None,
                        "newDestinationNode": recovery_path[-1] if recovery_path else None,
                        "oldTimeHrs": round(original_time, 1),
                        "newTimeHrs": round(new_time, 1),
                        "addedDelayHrs": round(delay_delta, 1),
                        "oldRiskScore": round(float((original_route or {}).get("riskScore", 0.0)), 1),
                        "newRiskScore": round(float(recovery_route.get("riskScore", 0.0)), 1),
                        "status": "recovery_reroute",
                        "recoveryMode": "nearby_safe_node_transfer",
                        "recoveryFromNode": recovery_path[0] if recovery_path else None,
                        "transferLagHrs": transfer_lag_hrs,
                    })
                else:
                    old_path = self._normalize_path_destination(remaining_path, destination)
                    rerouted_shipments.append({
                        "shipmentId": shipment.get("id"),
                        "currentStage": shipment.get("currentStage"),
                        "shipmentStatus": shipment.get("status"),
                        "oldPath": old_path,
                        "newPath": [],
                        "destinationNode": destination,
                        "oldDestinationNode": old_path[-1] if old_path else None,
                        "newDestinationNode": None,
                        "addedDelayHrs": 0.0,
                        "newRiskScore": 100.0,
                        "status": "blocked_at_disruption_node",
                    })
                continue

            original_route = route_optimizer.find_optimal_route(
                origin=current_node,
                destination=destination,
            )
            new_route = route_optimizer.find_optimal_route(
                origin=current_node,
                destination=destination,
                high_risk_nodes=[disruption_node],
            )

            if not new_route:
                old_path = self._normalize_path_destination(remaining_path, destination)
                rerouted_shipments.append({
                    "shipmentId": shipment.get("id"),
                    "currentStage": shipment.get("currentStage"),
                    "shipmentStatus": shipment.get("status"),
                    "oldPath": old_path,
                    "newPath": [],
                    "destinationNode": destination,
                    "oldDestinationNode": old_path[-1] if old_path else None,
                    "newDestinationNode": None,
                    "addedDelayHrs": 0.0,
                    "newRiskScore": 100.0,
                    "status": "no_alternative_path",
                })
                continue

            original_time = (original_route or {}).get("totalTime", 0.0)
            new_time = new_route.get("totalTime", 0.0)
            delay_delta = max(0.0, new_time - original_time)
            total_delay_added += delay_delta
            old_path = self._normalize_path_destination(remaining_path, destination)
            new_path = self._normalize_path_destination(new_route.get("path", []), destination)

            rerouted_shipments.append({
                "shipmentId": shipment.get("id"),
                "currentStage": shipment.get("currentStage"),
                "shipmentStatus": shipment.get("status"),
                "oldPath": old_path,
                "newPath": new_path,
                "destinationNode": destination,
                "oldDestinationNode": old_path[-1] if old_path else None,
                "newDestinationNode": new_path[-1] if new_path else None,
                "oldTimeHrs": round(float(original_time), 1),
                "newTimeHrs": round(float(new_time), 1),
                "addedDelayHrs": round(float(delay_delta), 1),
                "oldRiskScore": round(float((original_route or {}).get("riskScore", 0.0)), 1),
                "newRiskScore": round(float(new_route.get("riskScore", 0.0)), 1),
                "status": "rerouted",
            })

        return {
            "disruptedNode": disruption_node,
            "totalShipmentsAffected": affected_count,
            "networkDelayHrs": round(total_delay_added, 1),
            "reroutePlans": rerouted_shipments,
            "impactBreakdown": {
                "byCargo": dict(cargo_counter),
                "byPriority": dict(priority_counter),
            },
        }

cascade_analyzer = CascadeAnalyzer()
