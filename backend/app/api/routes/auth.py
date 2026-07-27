import logging

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_current_user
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
)
from app.services.auth_service import (
    login_user,
    logout_user,
    refresh_access_token,
    register_user,
)

logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
)
async def register(
    request: RegisterRequest,
):
    request.validate_password()

    user = await register_user(
        name=request.name,
        email=request.email,
        password=request.password,
    )

    logger.info(
        "User registered: name=%s, email=%s",
        request.name,
        request.email,
    )

    return {
        "message": "User registered successfully",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        },
    }


@router.post(
    "/login",
    response_model=TokenResponse,
)
async def login(
    request: LoginRequest,
):
    return await login_user(
        email=request.email,
        password=request.password,
    )

@router.post(
    "/refresh",
)
async def refresh_token(
    request: RefreshTokenRequest,
):
    return await refresh_access_token(
        refresh_token=request.refresh_token,
    )


@router.post(
    "/logout",
)
async def logout(
    request: LogoutRequest,
):
    return await logout_user(
        refresh_token=request.refresh_token,
    )


@router.get(
    "/me",
)
async def me(current_user=Depends(get_current_user)):  # noqa: B008
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
    }
