from fastapi import HTTPException, status

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)

from app.db.client import prisma


async def register_user(
    name: str,
    email: str,
    password: str,
):
    email = email.lower().strip()

    existing_user = await prisma.users.find_unique(
        where={
            "email": email,
        }
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user_role = await prisma.roles.find_unique(
        where={
            "name": "USER",
        }
    )

    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="USER role does not exist",
        )

    hashed_password = hash_password(password)

    user = await prisma.users.create(
        data={
            "name": name,
            "email": email,
            "password_hash": hashed_password,
            "role_id": user_role.id,
        }
    )

    return user


async def login_user(
    email: str,
    password: str,
):
    email = email.lower().strip()

    user = await prisma.users.find_unique(
        where={
            "email": email,
        }
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    is_password_valid = verify_password(
        password,
        user.password_hash,
    )

    if not is_password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(
        user_id=user.id,
    )

    refresh_token, expires_at = create_refresh_token(
        user_id=user.id,
    )

    token_hash = hash_refresh_token(
        refresh_token,
    )

    await prisma.refresh_tokens.create(
        data={
            "user_id": user.id,
            "token_hash": token_hash,
            "expires_at": expires_at,
        }
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }