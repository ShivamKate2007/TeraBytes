import os
import firebase_admin
from firebase_admin import credentials, firestore
from app.config import settings

class FirebaseService:
    def __init__(self):
        self._db = None

    def initialize(self):
        """Initialize Firebase Admin SDK"""
        if not firebase_admin._apps:
            if settings.FIREBASE_SERVICE_ACCOUNT and os.path.exists(settings.FIREBASE_SERVICE_ACCOUNT):
                cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT)
                firebase_admin.initialize_app(cred)
                print("[INFO] Firebase initialized with service account.")
            else:
                # Fallback to default application credentials if inside GCP / Render with env vars built-in
                try:
                    firebase_admin.initialize_app()
                    print("[INFO] Firebase initialized with default credentials.")
                except Exception as e:
                    print(f"[ERROR] Could not initialize Firebase: {e}")
        
    @property
    def db(self):
        if self._db is None and firebase_admin._apps:
            self._db = firestore.client()
        return self._db

firebase_service = FirebaseService()
