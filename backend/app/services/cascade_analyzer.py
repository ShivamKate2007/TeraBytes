import math
from collections import Counter
from typing import List, Dict, Optional, Tuple
from app.services.route_optimizer import route_optimizer

class CascadeAnalyzer:
    def _find_nearest_graph_node(
        self,
        lat: float,
        lng: float,
        exclude_nodes: Optional[List[str]] = None,
    ) -> Optional[str]:
        """Find the nearest graph node to a GPS position, optionally excluding disrupted nodes."""
        graph = route_optimizer.base_graph
        exclude = set(exclude_nodes or [])
        best_node = None
        best_dist = float("inf")
        for node_id, data in graph.nodes(data=True):
            if node_id in exclude:
                continue
            node_lat = data.get("lat")
            node_lng = data.get("lng")
            if node_lat is None or node_lng is None:
                continue
            d = self._haversine_km(
                {"lat": lat, "lng": lng},
                {"lat": node_lat, "lng": node_lng},
            )
            if d < best_dist:
                best_dist = d
                best_node = node_id
        return best_node

    def _is_hard_node_disruption(
        self,
        disruption_node: Optional[str],
        disruption_location: Optional[Dict],
        disruption_radius_km: float,
    ) -> bool:
        if not disruption_node:
            return False
        if not disruption_location:
            return True
        graph = route_optimizer.base_graph
        node_data = graph.nodes.get(disruption_node, {})
        if node_data.get("lat") is None or node_data.get("lng") is None:
            return False
        d = self._haversine_km(
            {"lat": disruption_location["lat"], "lng": disruption_location["lng"]},
            {"lat": node_data["lat"], "lng": node_data["lng"]},
        )
        # Only treat as node-failure when click is genuinely close to that node.
        threshold = max(6.0, min(20.0, float(disruption_radius_km) * 0.25))
        return d <= threshold

    def _resolve_current_node_id(self, shipment: Dict) -> Optional[str]:
        journey = shipment.get("journey") or []
        if shipment.get("currentStage") == "in_transit":
            completed = [step for step in journey if step.get("status") == "completed" and step.get("nodeId")]
            if completed:
                return completed[-1].get("nodeId")

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

    def _latlng_to_xy_km(self, lat: float, lng: float, ref_lat: float) -> Tuple[float, float]:
        earth_radius_km = 6371.0
        x = earth_radius_km * math.radians(lng) * math.cos(math.radians(ref_lat))
        y = earth_radius_km * math.radians(lat)
        return x, y

    def _haversine_km(self, a: Dict, b: Dict) -> float:
        earth_radius_km = 6371.0
        lat1 = math.radians(float(a["lat"]))
        lon1 = math.radians(float(a["lng"]))
        lat2 = math.radians(float(b["lat"]))
        lon2 = math.radians(float(b["lng"]))
        d_lat = lat2 - lat1
        d_lon = lon2 - lon1
        h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
        return 2 * earth_radius_km * math.asin(math.sqrt(max(0.0, h)))

    def _point_to_segment_distance_km(self, p: Dict, a: Dict, b: Dict) -> float:
        if not p or not a or not b:
            return float("inf")
        ref_lat = (float(a["lat"]) + float(b["lat"]) + float(p["lat"])) / 3.0
        px, py = self._latlng_to_xy_km(float(p["lat"]), float(p["lng"]), ref_lat)
        ax, ay = self._latlng_to_xy_km(float(a["lat"]), float(a["lng"]), ref_lat)
        bx, by = self._latlng_to_xy_km(float(b["lat"]), float(b["lng"]), ref_lat)

        abx = bx - ax
        aby = by - ay
        apx = px - ax
        apy = py - ay
        ab_len2 = abx * abx + aby * aby
        if ab_len2 <= 1e-9:
            return math.sqrt((px - ax) ** 2 + (py - ay) ** 2)

        t = max(0.0, min(1.0, (apx * abx + apy * aby) / ab_len2))
        cx = ax + t * abx
        cy = ay + t * aby
        return math.sqrt((px - cx) ** 2 + (py - cy) ** 2)

    def _segment_hit_threshold_km(self, disruption_radius_km: float) -> float:
        """
        Conservative impact threshold for coarse graph segments.
        A small city accident should not affect a route tens of kilometres away.
        """
        radius = max(1.0, float(disruption_radius_km or 0.0))
        return min(35.0, max(radius * 1.25, radius + 5.0))

    def _affected_edges_from_path(
        self,
        node_path: List[str],
        disruption_location: Optional[Dict],
        disruption_radius_km: float,
        disruption_node: Optional[str],
        current_position: Optional[Dict] = None,
    ) -> Tuple[List[str], bool, Dict]:
        graph = route_optimizer.base_graph
        if not node_path or len(node_path) < 2:
            return [], False, {"hitType": "none", "minEndpointKm": None, "minSegmentKm": None}

        affected_edge_ids: List[str] = []
        any_affected = False
        min_endpoint_km = float("inf")
        min_segment_km = float("inf")
        hit_type = "none"
        for idx in range(len(node_path) - 1):
            u = node_path[idx]
            v = node_path[idx + 1]
            edge_data = graph.get_edge_data(u, v) or {}
            edge_id = edge_data.get("id")

            edge_is_affected = False
            if disruption_node and (u == disruption_node or v == disruption_node):
                edge_is_affected = True
                hit_type = "node"

            if disruption_location and not edge_is_affected:
                u_node = graph.nodes.get(u, {})
                v_node = graph.nodes.get(v, {})
                if u_node.get("lat") is not None and v_node.get("lat") is not None:
                    # Hybrid impact model:
                    # 1) endpoint within radius OR
                    # 2) disruption lies close to the path segment (for mid-edge city disruptions).
                    du = self._haversine_km(
                        {"lat": disruption_location["lat"], "lng": disruption_location["lng"]},
                        {"lat": u_node["lat"], "lng": u_node["lng"]},
                    )
                    dv = self._haversine_km(
                        {"lat": disruption_location["lat"], "lng": disruption_location["lng"]},
                        {"lat": v_node["lat"], "lng": v_node["lng"]},
                    )
                    min_endpoint_km = min(min_endpoint_km, du, dv)
                    seg_distance = self._point_to_segment_distance_km(
                        p=disruption_location,
                        a={"lat": u_node["lat"], "lng": u_node["lng"]},
                        b={"lat": v_node["lat"], "lng": v_node["lng"]},
                    )
                    min_segment_km = min(min_segment_km, seg_distance)
                    seg_threshold = self._segment_hit_threshold_km(disruption_radius_km)
                    if min(du, dv) <= disruption_radius_km or seg_distance <= seg_threshold:
                        # CRITICAL FIX for BUG 3: If the disruption hits the start node (u) of the very first segment
                        # (which is often the last_completed node), check if the truck's actual GPS position
                        # has already driven OUT of the disruption radius. If so, it's safely past the event!
                        hit_type = "endpoint" if min(du, dv) <= disruption_radius_km else "segment"
                        edge_is_affected = True

                        if idx == 0 and current_position and current_position.get("lat") is not None:
                            dist_to_truck = self._haversine_km(
                                {"lat": disruption_location["lat"], "lng": disruption_location["lng"]},
                                {"lat": current_position["lat"], "lng": current_position["lng"]},
                            )
                            # If the truck is outside the radius, AND the disruption is closer to 'u' than 'v'
                            # (meaning it's behind the truck), we ignore it.
                            if dist_to_truck > disruption_radius_km and du < dv:
                                edge_is_affected = False
                                hit_type = "none"

            if edge_is_affected:
                any_affected = True
                if edge_id:
                    affected_edge_ids.append(edge_id)

        meta = {
            "hitType": hit_type,
            "minEndpointKm": None if min_endpoint_km == float("inf") else round(float(min_endpoint_km), 2),
            "minSegmentKm": None if min_segment_km == float("inf") else round(float(min_segment_km), 2),
        }
        return affected_edge_ids, any_affected, meta

    def _edge_ids_for_path(self, node_path: List[str]) -> List[str]:
        graph = route_optimizer.base_graph
        if not node_path or len(node_path) < 2:
            return []
        edge_ids: List[str] = []
        for idx in range(len(node_path) - 1):
            u = node_path[idx]
            v = node_path[idx + 1]
            edge = graph.get_edge_data(u, v) or {}
            edge_id = edge.get("id")
            if edge_id:
                edge_ids.append(edge_id)
        return edge_ids

    def _path_metrics(self, node_path: List[str]) -> Tuple[float, float]:
        graph = route_optimizer.base_graph
        if not node_path or len(node_path) < 2:
            return 0.0, 0.0

        total_time = 0.0
        total_risk = 0.0
        edges = 0
        for idx in range(len(node_path) - 1):
            u = node_path[idx]
            v = node_path[idx + 1]
            edge_data = graph.get_edge_data(u, v)
            if edge_data:
                total_time += float(edge_data.get("time", 0.0))
                total_risk += float(edge_data.get("risk", 0.35))
                edges += 1
                continue

            u_node = graph.nodes.get(u, {})
            v_node = graph.nodes.get(v, {})
            if u_node.get("lat") is None or v_node.get("lat") is None:
                continue
            distance_km = self._haversine_km(
                {"lat": u_node["lat"], "lng": u_node["lng"]},
                {"lat": v_node["lat"], "lng": v_node["lng"]},
            )
            total_time += distance_km / 45.0
            total_risk += 0.35
            edges += 1
        avg_risk = (total_risk / edges) * 100 if edges else 0.0
        return total_time, avg_risk

    def _estimate_eta_to_disruption(
        self,
        node_path: List[str],
        disruption_location: Optional[Dict],
        disruption_node: Optional[str],
        hard_node_disruption: bool,
        disruption_radius_km: float,
        current_position: Optional[Dict] = None,
    ) -> Optional[float]:
        """
        Estimate how many hours until the shipment reaches the disruption zone.
        Walks the remaining path leg-by-leg, accumulating travel time.
        If a live GPS/currentPosition is available, the first leg starts there
        instead of re-counting from the last completed node.
        Returns None if we can't determine ETA (e.g., no graph data).
        """
        graph = route_optimizer.base_graph
        if not node_path or len(node_path) < 2:
            return None

        cumulative_time = 0.0
        for idx in range(len(node_path) - 1):
            u = node_path[idx]
            v = node_path[idx + 1]

            u_node = graph.nodes.get(u, {})
            v_node = graph.nodes.get(v, {})
            leg_start = u_node
            if (
                idx == 0
                and current_position
                and current_position.get("lat") is not None
                and current_position.get("lng") is not None
            ):
                leg_start = current_position

            # Accumulate travel time for this leg FIRST.
            # For a shipment already in transit, only count the remaining
            # portion from its live position to the next route node.
            edge_data = graph.get_edge_data(u, v)
            if edge_data:
                full_leg_time = float(edge_data.get("time", 0.0))
                if leg_start is not u_node and u_node.get("lat") is not None and v_node.get("lat") is not None:
                    full_dist = max(
                        0.1,
                        self._haversine_km(
                            {"lat": u_node["lat"], "lng": u_node["lng"]},
                            {"lat": v_node["lat"], "lng": v_node["lng"]},
                        ),
                    )
                    remaining_dist = self._haversine_km(
                        {"lat": leg_start["lat"], "lng": leg_start["lng"]},
                        {"lat": v_node["lat"], "lng": v_node["lng"]},
                    )
                    leg_time = full_leg_time * max(0.0, min(1.0, remaining_dist / full_dist))
                else:
                    leg_time = full_leg_time
            else:
                if leg_start.get("lat") is not None and v_node.get("lat") is not None:
                    dist = self._haversine_km(
                        {"lat": leg_start["lat"], "lng": leg_start["lng"]},
                        {"lat": v_node["lat"], "lng": v_node["lng"]},
                    )
                    leg_time = dist / 45.0
                else:
                    leg_time = 0.0

            cumulative_time += leg_time

            # Check if THIS leg hits the disruption
            leg_hits = False

            # Node-based check
            if hard_node_disruption and disruption_node:
                if v == disruption_node:
                    leg_hits = True

            # GPS-based check
            if disruption_location and disruption_location.get("lat") is not None and not leg_hits:
                if leg_start.get("lat") is not None and v_node.get("lat") is not None:
                    du = self._haversine_km(
                        {"lat": disruption_location["lat"], "lng": disruption_location["lng"]},
                        {"lat": leg_start["lat"], "lng": leg_start["lng"]},
                    )
                    dv = self._haversine_km(
                        {"lat": disruption_location["lat"], "lng": disruption_location["lng"]},
                        {"lat": v_node["lat"], "lng": v_node["lng"]},
                    )
                    seg_dist = self._point_to_segment_distance_km(
                        p=disruption_location,
                        a={"lat": leg_start["lat"], "lng": leg_start["lng"]},
                        b={"lat": v_node["lat"], "lng": v_node["lng"]},
                    )
                    if min(du, dv) <= disruption_radius_km or seg_dist <= self._segment_hit_threshold_km(disruption_radius_km):
                        leg_hits = True

            if leg_hits:
                # Shipment will reach disruption after cumulative_time hours
                return cumulative_time

        return None  # Disruption not on this path

    def _find_route_preserving_waypoints(
        self,
        required_path: List[str],
        blocked_edges: List[str],
        high_risk_nodes: List[str],
    ) -> Optional[Dict]:
        """
        Compute a reroute while preserving all remaining mandatory stops in order.
        If any leg cannot be routed, the shipment is considered blocked.
        """
        if not required_path or len(required_path) < 2:
            return None

        stitched_path: List[str] = [required_path[0]]
        total_time = 0.0

        for idx in range(len(required_path) - 1):
            leg_origin = required_path[idx]
            leg_destination = required_path[idx + 1]

            leg_route = route_optimizer.find_optimal_route(
                origin=leg_origin,
                destination=leg_destination,
                blocked_edges=blocked_edges or None,
                high_risk_nodes=high_risk_nodes or None,
            )
            if not leg_route:
                return None

            leg_nodes = [node for node in (leg_route.get("path") or []) if node]
            if not leg_nodes or leg_nodes[0] != leg_origin or leg_nodes[-1] != leg_destination:
                return None

            stitched_path.extend(leg_nodes[1:])
            total_time += float(leg_route.get("totalTime", 0.0))

        _, new_risk = self._path_metrics(stitched_path)
        return {
            "path": stitched_path,
            "totalTime": round(total_time, 1),
            "riskScore": round(float(new_risk), 1),
            "solverMode": "preserve_waypoints",
        }

    def analyze_cascade(
        self,
        disruption_node: Optional[str],
        all_shipments: List[Dict],
        disruption_location: Optional[Dict] = None,
        disruption_radius_km: float = 80.0,
        disruption_duration_hrs: float = 12.0,
        use_current_position: bool = False,
    ) -> Dict:
        """
        What-If Engine: Triggers when a node goes down.
        Identifies all shipments headed towards or through that node,
        calculates delay cascades, and automatically reroutes them via NetworkX.
        
        When use_current_position=True, reroutes start from the shipment's actual
        GPS position (nearest reachable graph node) instead of the last completed
        journey node. This enables realistic rerouting from mid-highway positions.
        """
        disruption_node = disruption_node or ""
        affected_count = 0
        rerouted_shipments = []
        total_delay_added = 0.0
        cargo_counter = Counter()
        priority_counter = Counter()
        diagnostics = []
        hard_node_disruption = self._is_hard_node_disruption(
            disruption_node=disruption_node or None,
            disruption_location=disruption_location,
            disruption_radius_km=float(disruption_radius_km or 0.0),
        )
        
        for shipment in all_shipments:
            current_node = self._resolve_current_node_id(shipment)
            destination = self._resolve_destination_node_id(shipment)
            if not current_node or not destination:
                continue

            # Use GPS for ETA/diagnostics only. Do NOT snap an in-transit truck
            # to the nearest graph node, because that can "teleport" the cargo
            # to an unscheduled city such as Patna.
            reroute_origin_position = None
            if use_current_position:
                pos = shipment.get("currentPosition") or {}
                if pos.get("lat") is not None and pos.get("lng") is not None:
                    reroute_origin_position = {"lat": pos["lat"], "lng": pos["lng"]}

            # Build the REMAINING route from the shipment's actual position.
            # Use journey completion status to determine where the shipment actually is.
            route = shipment.get("optimizedRoute") or shipment.get("originalRoute") or []
            journey = shipment.get("journey") or []
            completed_nodes = []
            first_pending_node = None
            for step in journey:
                nid = step.get("nodeId")
                if not nid:
                    continue
                if step.get("status") == "completed":
                    completed_nodes.append(nid)
                elif step.get("status") in ("active", "pending") and first_pending_node is None:
                    first_pending_node = nid

            # Determine the remaining stops: everything after the last completed node
            if route and completed_nodes:
                last_completed = completed_nodes[-1]
                if last_completed in route:
                    idx = route.index(last_completed)
                    remaining_stops = route[idx + 1:]  # everything AFTER last completed
                else:
                    remaining_stops = route[:]
            elif route:
                remaining_stops = route[:]
            else:
                remaining_stops = [destination] if destination else []

            # The effective graph start is the last operational stop, not an
            # arbitrary nearest road node. Live GPS is still used for ETA-to-hit.
            if completed_nodes:
                remaining_path = [completed_nodes[-1]] + remaining_stops
            else:
                remaining_path = route[:] if route else [current_node, destination]

            # Ensure destination is at the end
            if destination and (not remaining_path or remaining_path[-1] != destination):
                remaining_path.append(destination)
            # Deduplicate consecutive nodes
            remaining_path = [n for i, n in enumerate(remaining_path) if i == 0 or n != remaining_path[i - 1]]
            if remaining_path:
                current_node = remaining_path[0]
            effective_disruption_node = None
            if hard_node_disruption and disruption_node:
                # If disruption is on a node the truck has already completed (and won't return to), ignore it
                if disruption_node not in completed_nodes or disruption_node in remaining_stops:
                    effective_disruption_node = disruption_node

            affected_edge_ids, disruption_hits_path, hit_meta = self._affected_edges_from_path(
                node_path=remaining_path,
                disruption_location=disruption_location,
                disruption_radius_km=float(disruption_radius_km or 0.0),
                disruption_node=effective_disruption_node,
                current_position=reroute_origin_position,
            )
            diagnostics.append({
                "shipmentId": shipment.get("id"),
                "currentNode": current_node,
                "destinationNode": destination,
                "remainingPath": remaining_path,
                "affected": bool(disruption_hits_path),
                "hitType": hit_meta.get("hitType"),
                "minEndpointKm": hit_meta.get("minEndpointKm"),
                "minSegmentKm": hit_meta.get("minSegmentKm"),
                "status": shipment.get("status"),
                "currentStage": shipment.get("currentStage"),
            })
            if not disruption_hits_path:
                continue

            affected_count += 1
            cargo_counter.update([shipment.get("cargoType", "unknown")])
            priority_counter.update([shipment.get("priority", "unknown")])

            old_path = self._normalize_path_destination(remaining_path, destination)
            old_time, old_risk = self._path_metrics(old_path)
            if hard_node_disruption and disruption_node and current_node == disruption_node:
                rerouted_shipments.append({
                    "shipmentId": shipment.get("id"),
                    "currentStage": shipment.get("currentStage"),
                    "shipmentStatus": shipment.get("status"),
                    "oldPath": old_path,
                    "newPath": [],
                    "destinationNode": destination,
                    "oldDestinationNode": old_path[-1] if old_path else None,
                    "newDestinationNode": None,
                    "oldTimeHrs": round(float(old_time), 1),
                    "addedDelayHrs": 0.0,
                    "oldRiskScore": round(float(old_risk), 1),
                    "newRiskScore": 100.0,
                    "status": "blocked_at_disruption_node",
                    "disruptionEdgeIds": affected_edge_ids,
                })
                continue

            # ── REALISM RULE 1: ETA-to-Disruption Check ──────────────────
            # If shipment won't reach the disruption zone until AFTER it clears
            # → no reroute needed, the road will be open by the time it arrives.
            eta_to_disruption = self._estimate_eta_to_disruption(
                old_path,
                disruption_location,
                disruption_node,
                hard_node_disruption,
                float(disruption_radius_km or 0.0),
                current_position=reroute_origin_position,
            )
            disruption_dur = float(disruption_duration_hrs or 0.0)
            if disruption_dur > 0 and eta_to_disruption is not None and eta_to_disruption > disruption_dur:
                rerouted_shipments.append({
                    "shipmentId": shipment.get("id"),
                    "currentStage": shipment.get("currentStage"),
                    "shipmentStatus": shipment.get("status"),
                    "oldPath": old_path, "newPath": old_path,
                    "destinationNode": destination,
                    "oldDestinationNode": old_path[-1] if old_path else None,
                    "newDestinationNode": old_path[-1] if old_path else None,
                    "oldTimeHrs": round(float(old_time), 1),
                    "newTimeHrs": round(float(old_time), 1),
                    "addedDelayHrs": 0.0,
                    "oldRiskScore": round(float(old_risk), 1),
                    "newRiskScore": round(float(old_risk), 1),
                    "status": "disruption_clears_before_arrival",
                    "disruptionEdgeIds": affected_edge_ids,
                    "rerouteOriginPosition": reroute_origin_position,
                    "rerouteOriginNode": current_node,
                    "etaToDisruptionHrs": round(eta_to_disruption, 1),
                    "disruptionDurationHrs": round(disruption_dur, 1),
                    "timeSavedVsWait": 0.0,
                    "recommendation": "continue_as_planned",
                })
                continue

            # ── REALISM RULE 2: Identify mandatory vs bypassable nodes ───
            # Mandatory = DCs, warehouses, retailers, manufacturers → cargo must
            #   be unloaded/sorted there. NEVER skip unless physically closed.
            # Bypassable = transport_hubs → only transit points on the highway.
            graph = route_optimizer.base_graph
            BYPASSABLE_TYPES = {"transport_hub"}

            mandatory_stops = []
            disrupted_hubs = []
            for node in old_path:
                node_data = graph.nodes.get(node, {})
                node_type = node_data.get("type", "unknown")
                is_disrupted = (hard_node_disruption and node == disruption_node)
                if node_type in BYPASSABLE_TYPES and is_disrupted:
                    disrupted_hubs.append(node)
                else:
                    mandatory_stops.append(node)

            # Ensure start = current_node, end = destination
            if not mandatory_stops or mandatory_stops[0] != current_node:
                mandatory_stops = [current_node] + mandatory_stops
            if mandatory_stops[-1] != destination:
                mandatory_stops.append(destination)
            mandatory_stops = [n for i, n in enumerate(mandatory_stops) if i == 0 or n != mandatory_stops[i - 1]]

            # ── REALISM RULE 3: Never go backward ────────────────────────
            journey = shipment.get("journey") or []
            completed_ids = {s["nodeId"] for s in journey if s.get("status") == "completed" and s.get("nodeId")}
            mandatory_stops = [n for n in mandatory_stops if n == current_node or n not in completed_ids]
            if len(mandatory_stops) < 2:
                mandatory_stops = [current_node, destination]

            # ── REALISM RULE 4: Route leg-by-leg preserving ALL mandatory stops
            new_route = None
            if disruption_location and disruption_location.get("lat") is not None and len(mandatory_stops) >= 2:
                stitched = [mandatory_stops[0]]
                total_t = 0.0
                ok = True
                for li in range(len(mandatory_stops) - 1):
                    lo, ld = mandatory_stops[li], mandatory_stops[li + 1]
                    leg_blocked_edges, leg_is_affected, _ = self._affected_edges_from_path(
                        node_path=[lo, ld],
                        disruption_location=disruption_location,
                        disruption_radius_km=float(disruption_radius_km or 0.0),
                        disruption_node=effective_disruption_node,
                        current_position=reroute_origin_position if li == 0 else None,
                    )
                    if not leg_is_affected:
                        stitched.append(ld)
                        leg_time, _ = self._path_metrics([lo, ld])
                        total_t += float(leg_time)
                        continue

                    if hard_node_disruption and disruption_node == ld:
                        node_type = graph.nodes.get(disruption_node, {}).get("type", "unknown")
                        if node_type not in BYPASSABLE_TYPES:
                            ok = False
                            break

                    leg = route_optimizer.find_route_around_disruption(
                        origin=lo, destination=ld,
                        disruption_lat=float(disruption_location["lat"]),
                        disruption_lng=float(disruption_location["lng"]),
                        radius_km=float(disruption_radius_km or 60.0),
                        disruption_id=str(disruption_node or "GPS"),
                    )
                    if leg:
                        cp = leg.get("cleanPath") or leg.get("path", [])
                        stitched.extend(cp[1:] if cp and cp[0] == lo else cp)
                        total_t += float(leg.get("totalTime", 0.0))
                    else:
                        fb = route_optimizer.find_optimal_route(lo, ld, blocked_edges=leg_blocked_edges, high_risk_nodes=disrupted_hubs)
                        if fb:
                            fp = fb.get("path", [])
                            stitched.extend(fp[1:] if fp and fp[0] == lo else fp)
                            total_t += float(fb.get("totalTime", 0.0))
                        else:
                            ok = False
                            break
                if ok and len(stitched) >= 2:
                    _, nr = self._path_metrics(stitched)
                    new_route = {"path": stitched, "totalTime": round(total_t, 1), "riskScore": round(float(nr), 1)}

            if not new_route:
                new_route = self._find_route_preserving_waypoints(
                    required_path=mandatory_stops,
                    blocked_edges=affected_edge_ids,
                    high_risk_nodes=disrupted_hubs,
                )

            if not new_route:
                rerouted_shipments.append({
                    "shipmentId": shipment.get("id"),
                    "currentStage": shipment.get("currentStage"),
                    "shipmentStatus": shipment.get("status"),
                    "oldPath": old_path, "newPath": [],
                    "destinationNode": destination,
                    "oldDestinationNode": old_path[-1] if old_path else None,
                    "newDestinationNode": None,
                    "oldTimeHrs": round(float(old_time), 1),
                    "addedDelayHrs": round(disruption_dur, 1),
                    "oldRiskScore": round(float(old_risk), 1),
                    "newRiskScore": 100.0,
                    "status": "no_alternative_path",
                    "disruptionEdgeIds": affected_edge_ids,
                })
                total_delay_added += disruption_dur
                continue

            new_path = self._normalize_path_destination(new_route.get("path", []), destination)
            if current_node and new_path and new_path[0] != current_node:
                new_path = [current_node, *new_path]
            if destination and new_path and new_path[-1] != destination:
                new_path.append(destination)
            new_time, new_risk = self._path_metrics(new_path)
            delay_delta = max(0.0, new_time - old_time)
            total_delay_added += delay_delta

            # ── REALISM RULE 5: Mandatory node in new path can't be skipped ─
            if hard_node_disruption and disruption_node and disruption_node in new_path[1:]:
                node_type = graph.nodes.get(disruption_node, {}).get("type", "unknown")
                if node_type not in BYPASSABLE_TYPES:
                    # It's a DC/warehouse/retailer → must wait for it to reopen
                    rerouted_shipments.append({
                        "shipmentId": shipment.get("id"),
                        "currentStage": shipment.get("currentStage"),
                        "shipmentStatus": shipment.get("status"),
                        "oldPath": old_path, "newPath": old_path,
                        "destinationNode": destination,
                        "oldDestinationNode": old_path[-1] if old_path else None,
                        "newDestinationNode": old_path[-1] if old_path else None,
                        "oldTimeHrs": round(float(old_time), 1),
                        "newTimeHrs": round(float(old_time + disruption_dur), 1),
                        "addedDelayHrs": round(disruption_dur, 1),
                        "oldRiskScore": round(float(old_risk), 1),
                        "newRiskScore": round(float(old_risk), 1),
                        "status": "wait_for_reopen",
                        "disruptionEdgeIds": affected_edge_ids,
                        "rerouteOriginPosition": reroute_origin_position,
                        "rerouteOriginNode": current_node,
                        "timeSavedVsWait": 0.0,
                        "recommendation": "wait_for_reopen",
                        "mandatoryNodeBlocked": disruption_node,
                    })
                    total_delay_added += disruption_dur
                    continue

            status = "rerouted" if old_path != new_path else "rerouted_same_path"
            if status == "rerouted_same_path":
                continue
            wait_delay = disruption_dur
            if wait_delay > 0 and delay_delta >= wait_delay:
                rerouted_shipments.append({
                    "shipmentId": shipment.get("id"),
                    "currentStage": shipment.get("currentStage"),
                    "shipmentStatus": shipment.get("status"),
                    "oldPath": old_path, "newPath": old_path,
                    "destinationNode": destination,
                    "oldDestinationNode": old_path[-1] if old_path else None,
                    "newDestinationNode": old_path[-1] if old_path else None,
                    "oldTimeHrs": round(float(old_time), 1),
                    "newTimeHrs": round(float(old_time + wait_delay), 1),
                    "addedDelayHrs": round(wait_delay, 1),
                    "oldRiskScore": round(float(old_risk), 1),
                    "newRiskScore": round(float(old_risk), 1),
                    "status": "wait_for_reopen",
                    "disruptionEdgeIds": affected_edge_ids,
                })
                total_delay_added += wait_delay
                continue

            wait_time = disruption_dur
            time_saved_vs_wait = max(0.0, wait_time - delay_delta) if wait_time > 0 else 0.0
            recommendation = "reroute" if time_saved_vs_wait > 0 else "wait_for_reopen"

            rerouted_shipments.append({
                "shipmentId": shipment.get("id"),
                "currentStage": shipment.get("currentStage"),
                "shipmentStatus": shipment.get("status"),
                "oldPath": old_path,
                "newPath": new_path,
                "destinationNode": destination,
                "oldDestinationNode": old_path[-1] if old_path else None,
                "newDestinationNode": new_path[-1] if new_path else None,
                "oldTimeHrs": round(float(old_time), 1),
                "newTimeHrs": round(float(new_time), 1),
                "addedDelayHrs": round(float(delay_delta), 1),
                "oldRiskScore": round(float(old_risk), 1),
                "newRiskScore": round(float(new_risk), 1),
                "status": status,
                "disruptionEdgeIds": affected_edge_ids,
                "rerouteOriginPosition": reroute_origin_position,
                "rerouteOriginNode": current_node,
                "timeSavedVsWait": round(time_saved_vs_wait, 1),
                "recommendation": recommendation,
            })

        return {
            "disruptedNode": disruption_node,
            "disruptionLocation": disruption_location,
            "disruptionRadiusKm": disruption_radius_km,
            "disruptionDurationHrs": disruption_duration_hrs,
            "totalShipmentsAffected": affected_count,
            "networkDelayHrs": round(total_delay_added, 1),
            "reroutePlans": rerouted_shipments,
            "impactBreakdown": {
                "byCargo": dict(cargo_counter),
                "byPriority": dict(priority_counter),
            },
            "diagnostics": diagnostics,
        }

cascade_analyzer = CascadeAnalyzer()
