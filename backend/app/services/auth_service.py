"""Development authentication helpers.

Phase 9A starts with a hackathon-friendly identity layer: the frontend sends an
X-User-Id header and the backend resolves that to a seeded demo user. Later this
module can be swapped to verify Firebase Auth tokens without changing routers.
"""
from fastapi import Header, HTTPException

from app.data.demo_users import DEFAULT_DEV_USER_ID, DEMO_ORGANIZATIONS, DEMO_PASSWORD, DEMO_USERS


def _org_by_id():
    return {org["id"]: org for org in DEMO_ORGANIZATIONS}


def list_demo_users():
    orgs = _org_by_id()
    return [
        {
            **user,
            "organization": orgs.get(user.get("organizationId")),
        }
        for user in DEMO_USERS
    ]


def _user_type_for_role(user: dict) -> str:
    return "admin" if user.get("role") == "admin" else "user"


def authenticate_demo_user(user_type: str, role: str, email: str, password: str):
    if password != DEMO_PASSWORD:
        return None

    normalized_user_type = (user_type or "").strip().lower()
    normalized_role = (role or "").strip().lower()
    normalized_email = (email or "").strip().lower()

    for user in list_demo_users():
        if user.get("status") != "active":
            continue
        if _user_type_for_role(user) != normalized_user_type:
            continue
        if (user.get("role") or "").lower() != normalized_role:
            continue
        if (user.get("email") or "").lower() != normalized_email:
            continue
        return user
    return None


def list_demo_organizations():
    return DEMO_ORGANIZATIONS


def get_demo_user(user_id: str | None):
    selected_id = user_id or DEFAULT_DEV_USER_ID
    orgs = _org_by_id()
    for user in DEMO_USERS:
        if user.get("id") == selected_id and user.get("status") == "active":
            return {
                **user,
                "organization": orgs.get(user.get("organizationId")),
            }
    return None


async def get_current_user(x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    user = get_demo_user(x_user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown or inactive user")
    return user
