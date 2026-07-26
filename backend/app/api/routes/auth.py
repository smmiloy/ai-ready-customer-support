from fastapi import APIRouter, status

from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    RefreshTokenRequest
  
)

from app.services.auth_service import (
    login_user,
    register_user,  
    refresh_access_token
)


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
    user = await register_user(
        name=request.name,
        email=request.email,
        password=request.password,
    )
    print(request.name,request.email,request.password)

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
    print(request.refresh_token);  
    return await refresh_access_token(
        refresh_token=request.refresh_token,
    )
