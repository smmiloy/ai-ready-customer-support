import logging

from fastapi import HTTPException, status

from app.db.client import prisma

logger = logging.getLogger(__name__)


async def create_chat(
    user_id: int,
    title: str | None = None,
):
    chat = await prisma.chats.create(
        data={
            "user_id": user_id,
            "title": title,
        }
    )

    logger.info("Chat created with id: %s", chat.id)

    return chat


async def get_chat(
    chat_id: str,
    user_id: int,
):
    chat = await prisma.chats.find_unique(
        where={
            "id": chat_id,
        }
    )

    if not chat or chat.user_id != user_id or chat.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )

    return chat


async def list_chats(
    user_id: int,
    skip: int = 0,
    limit: int = 20,
):
    chats = await prisma.chats.find_many(
        where={  # type: ignore[arg-type]
            "user_id": user_id,
            "status": "ACTIVE",
        },
        skip=skip,
        take=limit,
        order={
            "created_at": "desc",
        },
    )

    total = await prisma.chats.count(  # type: ignore[call-overload]
        where={
            "user_id": user_id,
            "status": "ACTIVE",
        }
    )

    return chats, total


async def update_chat(
    chat_id: str,
    user_id: int,
    title: str | None = None,
):
    chat = await prisma.chats.find_unique(
        where={
            "id": chat_id,
        }
    )

    if not chat or chat.user_id != user_id or chat.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )

    updated_chat = await prisma.chats.update(
        where={
            "id": chat_id,
        },
        data={
            "title": title,
        }
    )

    logger.info("Chat updated with id: %s", chat_id)

    return updated_chat


async def delete_chat(
    chat_id: str,
    user_id: int,
):
    chat = await prisma.chats.find_unique(
        where={
            "id": chat_id,
        }
    )

    if not chat or chat.user_id != user_id or chat.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )

    await prisma.chats.update(
        where={
            "id": chat_id,
        },
        data={
            "status": "DELETED",  # type: ignore[typeddict-item]
        }
    )

    logger.info("Chat soft-deleted with id: %s", chat_id)

    return {
        "message": "Chat deleted successfully",
    }
