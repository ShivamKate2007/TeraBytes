"""Smart Supply Chain Backend — FastAPI Application"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

from app.routers import health, shipments, disruptions, routes, simulator, analytics, news, auto_reroute, auth, contracts

app = FastAPI(
    title="Smart Supply Chain API",
    description="Resilient Logistics & Dynamic Supply Chain Optimization",
    version="1.0.0",
)

# CORS — allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.FRONTEND_ORIGINS.split(",") if origin.strip()],
    allow_origin_regex=settings.FRONTEND_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(auth.router, prefix="/api", tags=["Auth"])
app.include_router(shipments.router, prefix="/api", tags=["Shipments"])
app.include_router(disruptions.router, prefix="/api", tags=["Disruptions"])
app.include_router(routes.router, prefix="/api", tags=["Routes"])
app.include_router(simulator.router, prefix="/api", tags=["Simulator"])
app.include_router(analytics.router, prefix="/api", tags=["Analytics"])
app.include_router(news.router, prefix="/api", tags=["News"])
app.include_router(auto_reroute.router, prefix="/api", tags=["Auto Reroute"])
app.include_router(contracts.router, prefix="/api", tags=["Contracts"])


from app.services.firebase_service import firebase_service
from app.services.lstm_predictor import lstm_predictor
from app.services.movement_scheduler import movement_scheduler

@app.on_event("startup")
async def startup_event():
    """Initialize core services tightly coupled to startup"""
    print("[INFO] Smart Supply Chain API starting up...")
    
    # 1. Boot Firebase Admin SDK
    firebase_service.initialize()
    
    # 2. Boot LSTM Predictor into VRAM
    lstm_predictor.load_model()
    lstm_predictor.predict([[0.5, 5.0, 0.5]]) # Run dummy tensor to warm up CUDA/CPU memory

    if settings.MOVEMENT_ENGINE_ENABLED:
        movement_scheduler.start()
    
    print("[OK] API Core Services Booted Successfully!")


@app.on_event("shutdown")
async def shutdown_event():
    if settings.MOVEMENT_ENGINE_ENABLED:
        await movement_scheduler.stop()
