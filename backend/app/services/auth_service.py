import logging
from datetime import datetime, timezone

import jwt
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.db.client import prisma

logger = logging.getLogger(__name__)


async def register_user(
    name: str,
    email: str,
    password: str,
):
    email = email.lower().strip()

    logger.info("Registering user with email: %s", email)

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

    logger.info("User registered successfully with id: %s", user.id)

    return user


async def login_user(
    email: str,
    password: str,
):
    email = email.lower().strip()

    logger.info("Login attempt for email: %s", email)

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

    logger.info("Login successful for user id: %s", user.id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


async def refresh_access_token(
    refresh_token: str,
):
    """
    Generate new access and refresh tokens
    using a valid refresh token.
    """

    try:
        payload = jwt.decode(
            refresh_token,
            settings.JWT_SECRET_KEY,
            algorithms=[
                settings.JWT_ALGORITHM
            ],
        )

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
        ) from None

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        ) from None

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    try:
        user_id = int(user_id)

    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
        ) from None

    old_token_hash = hash_refresh_token(
        refresh_token,
    )

    stored_token = (
        await prisma.refresh_tokens.find_unique(
            where={
                "token_hash": old_token_hash,
            }
        )
    )

    if not stored_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Refresh token has been revoked "
                "or does not exist"
            ),
        )

    now = datetime.now(timezone.utc)

    if stored_token.expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
        )

    if stored_token.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user = await prisma.users.find_unique(
        where={
            "id": user_id,
        }
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )

    access_token = create_access_token(
        user_id=user.id,
    )

    new_refresh_token, expires_at = (
        create_refresh_token(
            user_id=user.id,
        )
    )

    new_token_hash = hash_refresh_token(
        new_refresh_token,
    )

    await prisma.refresh_tokens.update(
        where={
            "id": stored_token.id,
        },
        data={
            "token_hash": new_token_hash,
            "expires_at": expires_at,
        },
    )

    logger.info(
        "Access token refreshed for user id: %s", user.id
    )

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


async def logout_user(
    refresh_token: str,
):
    """
    Invalidate a refresh token by deleting it
    from the database.
    """

    token_hash = hash_refresh_token(
        refresh_token,
    )

    stored_token = (
        await prisma.refresh_tokens.find_unique(
            where={
                "token_hash": token_hash,
            }
        )
    )

    if stored_token:
        await prisma.refresh_tokens.delete(
            where={
                "id": stored_token.id,
            }
        )
        logger.info(
            "Refresh token invalidated for user id: %s",
            stored_token.user_id,
        )

    return {
        "message": "Logged out successfully",
    }
