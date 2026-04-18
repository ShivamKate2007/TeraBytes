"""Application configuration from environment variables"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # API Keys
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    OPENWEATHER_API_KEY: str = os.getenv("OPENWEATHER_API_KEY", "")
    NEWS_API_KEY: str = os.getenv("NEWS_API_KEY", "")

    # Firebase
    FIREBASE_SERVICE_ACCOUNT: str = os.getenv("FIREBASE_SERVICE_ACCOUNT", "")
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "")

    # App Settings
    RISK_THRESHOLD_REROUTE: int = int(os.getenv("RISK_THRESHOLD_REROUTE", "70"))
    WEATHER_DISRUPTION_THRESHOLD: float = float(os.getenv("WEATHER_DISRUPTION_THRESHOLD", "0.5"))
    DATA_REFRESH_INTERVAL: int = int(os.getenv("DATA_REFRESH_INTERVAL", "300"))  # seconds


settings = Settings()
