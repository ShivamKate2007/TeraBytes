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
    FRONTEND_ORIGINS: str = os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://localhost:3000",
    )
    FRONTEND_ORIGIN_REGEX: str = os.getenv(
        "FRONTEND_ORIGIN_REGEX",
        r"https://.*\.vercel\.app",
    )

    # Firebase
    FIREBASE_SERVICE_ACCOUNT: str = os.getenv("FIREBASE_SERVICE_ACCOUNT", "")
    FIREBASE_SERVICE_ACCOUNT_JSON: str = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "")

    # App Settings
    RISK_THRESHOLD_REROUTE: int = int(os.getenv("RISK_THRESHOLD_REROUTE", "70"))
    WEATHER_DISRUPTION_THRESHOLD: float = float(os.getenv("WEATHER_DISRUPTION_THRESHOLD", "0.5"))
    DATA_REFRESH_INTERVAL: int = int(os.getenv("DATA_REFRESH_INTERVAL", "300"))  # seconds
    MOVEMENT_ENGINE_ENABLED: bool = os.getenv("MOVEMENT_ENGINE_ENABLED", "true").lower() == "true"
    MOVEMENT_TICK_SECONDS: int = int(os.getenv("MOVEMENT_TICK_SECONDS", "10"))
    MOVEMENT_TIME_SCALE: float = float(os.getenv("MOVEMENT_TIME_SCALE", "1"))  # sim sec per real sec (1 = real-time)
    GOOGLE_DIRECTIONS_FOR_MOVEMENT: bool = os.getenv("GOOGLE_DIRECTIONS_FOR_MOVEMENT", "false").lower() == "true"
    MOVEMENT_MAX_ELAPSED_SECONDS: float = float(
        os.getenv("MOVEMENT_MAX_ELAPSED_SECONDS", str(max(5, int(MOVEMENT_TICK_SECONDS * 1.5))))
    )
    MOVEMENT_NODE_DWELL_HOURS: float = float(os.getenv("MOVEMENT_NODE_DWELL_HOURS", "0.25"))
    NEWS_DISRUPTION_RADIUS_DEFAULT_KM: float = float(os.getenv("NEWS_DISRUPTION_RADIUS_DEFAULT_KM", "15"))


settings = Settings()
