import json
import random
import uuid
import math
from datetime import datetime, timedelta

def load_json(filepath):
    with open(filepath, 'r') as f:
        return json.load(f)

nodes = load_json("app/data/india_nodes.json")
edges = load_json("app/data/india_edges.json")

def generate_shipments(num=50):
    shipments = []
    
    manufacturers = [n for n in nodes if n['type'] == 'manufacturer']
    retailers = [n for n in nodes if n['type'] == 'retailer']
    warehouses = [n for n in nodes if n['type'] == 'warehouse']
    hubs = [n for n in nodes if n['type'] == 'transport_hub']
    dcs = [n for n in nodes if n['type'] == 'distribution_center']

    priorities = ["low", "medium", "high", "critical"]
    cargo_types = ["Electronics", "Auto Parts", "Pharmaceuticals", "FMCG", "Apparel"]

    now = datetime.utcnow()

    for i in range(num):
        start = random.choice(manufacturers)
        end = random.choice(retailers)
        priority = random.choices(priorities, weights=[0.4, 0.3, 0.2, 0.1])[0]
        cargo = random.choice(cargo_types)
        
        # Build a pseudo path
        # 1. Manufacturer -> 2. Warehouse/Hub -> 3. DC -> 4. Retailer
        wh_hub = random.choice(warehouses + hubs)
        dc = random.choice(dcs)
        
        path_nodes = [start, wh_hub, dc, end]
        
        status = random.choice(["at_manufacturer", "in_transit", "at_warehouse", "at_distributor"])
        
        journey = []
        stages = [
            ("manufacturer", start),
            ("warehouse", wh_hub),
            ("distribution_center", dc),
            ("retailer", end)
        ]
        
        curr_stage_idx = 0
        if status == "at_manufacturer": curr_stage_idx = 0
        elif status == "at_warehouse": curr_stage_idx = 1
        elif status == "at_distributor": curr_stage_idx = 2
        elif status == "in_transit": curr_stage_idx = random.choice([0, 1]) # transit between 0->1 or 1->2
        
        current_pos = None
        current_stage_name = None
        
        btime = now - timedelta(days=random.randint(1, 5))
        
        for idx, (stg_name, node) in enumerate(stages):
            j_status = "pending"
            arr = None
            dep = None
            
            if idx < curr_stage_idx:
                j_status = "completed"
                arr = (btime + timedelta(hours=idx*10)).isoformat() + "Z"
                dep = (btime + timedelta(hours=idx*10 + 2)).isoformat() + "Z"
            elif idx == curr_stage_idx and status != "in_transit":
                j_status = "active"
                arr = (btime + timedelta(hours=idx*10)).isoformat() + "Z"
                current_pos = {"lat": node["lat"], "lng": node["lng"]}
                current_stage_name = stg_name
            elif idx == curr_stage_idx and status == "in_transit":
                j_status = "completed"
                arr = (btime + timedelta(hours=idx*10)).isoformat() + "Z"
                dep = (btime + timedelta(hours=idx*10 + 2)).isoformat() + "Z"
            elif idx == curr_stage_idx + 1 and status == "in_transit":
                j_status = "active"
                next_node = node
                prev_node = stages[idx-1][1]
                # Interpolate position
                frac = random.uniform(0.2, 0.8)
                current_pos = {
                    "lat": prev_node["lat"] + (next_node["lat"] - prev_node["lat"]) * frac,
                    "lng": prev_node["lng"] + (next_node["lng"] - prev_node["lng"]) * frac
                }
                current_stage_name = "in_transit"
                
            journey.append({
                "stage": stg_name,
                "nodeId": node["id"],
                "nodeName": node["name"],
                "status": j_status,
                "arrivedAt": arr,
                "departedAt": dep,
                "eta": (btime + timedelta(hours=idx*10 + 5)).isoformat() + "Z" if j_status == "pending" else None
            })
            
        shipments.append({
            "id": f"SHP-{uuid.uuid4().hex[:8].upper()}",
            "cargoType": cargo,
            "priority": priority,
            "weight": round(random.uniform(100, 5000), 1), # kg
            "value": round(random.uniform(50000, 5000000), 2), # INR
            "manufacturer": start["name"],
            "endCustomer": end["name"],
            "journey": journey,
            "currentPosition": current_pos,
            "currentStage": current_stage_name,
            "riskScore": random.randint(5, 45) if priority != "critical" else random.randint(40, 85),
            "lstmPrediction": 0.0,
            "vehicleId": f"TRK-{random.randint(1000, 9999)}",
            "routeId": f"RT-{random.randint(100, 999)}",
            "status": status,
            "isRerouted": random.random() > 0.8,
            "originalRoute": [n["id"] for n in path_nodes],
            "optimizedRoute": [n["id"] for n in path_nodes]
        })
        
    with open("app/data/sample_shipments.json", "w") as f:
        json.dump(shipments, f, indent=2)
        
    print(f"Generated {num} shipments.")

if __name__ == "__main__":
    generate_shipments(50)
