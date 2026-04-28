"""Development auth endpoints for role-based UI work."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.services.auth_service import (
    authenticate_demo_user,
    get_current_user,
    list_demo_organizations,
    list_demo_users,
)
from app.config import settings

router = APIRouter()


class LoginRequest(BaseModel):
    userType: str
    role: str
    email: str
    password: str


@router.get("/auth/dev-users")
async def get_dev_users():
    return {
        "users": list_demo_users(),
        "organizations": list_demo_organizations(),
        "authMode": "dev_header",
        "firebaseProjectId": settings.FIREBASE_PROJECT_ID or None,
    }


@router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user": current_user,
        "authMode": "dev_header",
        "firebaseReady": bool(settings.FIREBASE_PROJECT_ID),
    }


@router.post("/auth/login")
async def login(request: LoginRequest):
    user = authenticate_demo_user(
        user_type=request.userType,
        role=request.role,
        email=request.email,
        password=request.password,
    )
    if not user:
        return {"authenticated": False, "user": None, "error": "Invalid credentials or role selection"}
    return {"authenticated": True, "user": user, "authMode": "dev_header", "error": None}
