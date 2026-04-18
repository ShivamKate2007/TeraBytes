import json
import os
import sys

# Add parent dir to path so we can import app modules properly when running as script
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.firebase_service import firebase_service
from app.config import settings

def load_json(filename):
    filepath = os.path.join(os.path.dirname(__file__), filename)
    with open(filepath, 'r') as f:
        return json.load(f)

def run_seed():
    print("[INFO] Starting database seed process...")
    
    # Needs service account to seed
    if not settings.FIREBASE_SERVICE_ACCOUNT or not os.path.exists(settings.FIREBASE_SERVICE_ACCOUNT):
        print("[WARNING] FIREBASE_SERVICE_ACCOUNT is not set or file not found in environment variables.")
        print("[WARNING] Skipping push to Firestore. (Data files were correctly generated locally).")
        return

    firebase_service.initialize()
    db = firebase_service.db
    
    if not db:
        print("[ERROR] Could not connect to Firestore to seed db.")
        return

    print("[INFO] Connected to Firestore. Starting chunk uploads...")
    
    # Load data
    nodes = load_json("india_nodes.json")
    edges = load_json("india_edges.json")
    shipments = load_json("sample_shipments.json")
    
    # 1. Seed Nodes
    batch = db.batch()
    for node in nodes:
        doc_ref = db.collection('nodes').document(node['id'])
        batch.set(doc_ref, node)
    batch.commit()
    print(f"[OK] Seeded {len(nodes)} nodes.")
    
    # 2. Seed Edges
    batch = db.batch()
    for edge in edges:
        doc_ref = db.collection('edges').document(edge['id'])
        batch.set(doc_ref, edge)
    batch.commit()
    print(f"[OK] Seeded {len(edges)} edges.")
    
    # 3. Seed Shipments (Max 500 ops per batch, we have 50 so it's safe)
    batch = db.batch()
    for shipment in shipments:
        doc_ref = db.collection('shipments').document(shipment['id'])
        batch.set(doc_ref, shipment)
    batch.commit()
    print(f"[OK] Seeded {len(shipments)} shipments.")
    
    print("[OK] Database seeded successfully!")

if __name__ == "__main__":
    run_seed()
