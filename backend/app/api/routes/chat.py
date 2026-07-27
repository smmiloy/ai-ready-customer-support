import logging

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import get_current_user
from app.schemas.chat import (
    ChatCreate,
    ChatListResponse,
    ChatResponse,
    ChatUpdate,
)
from app.services.chat_service import (
    create_chat,
    delete_chat,
    get_chat,
    list_chats,
    update_chat,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/chats",
    tags=["Chats"],
)


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    response_model=ChatResponse,
)
async def create(
    request: ChatCreate,
    current_user=Depends(get_current_user),  # noqa: B008
):
    chat = await create_chat(
        user_id=current_user.id,
        title=request.title,
    )

    return ChatResponse(
        id=chat.id,
        user_id=chat.user_id,
        title=chat.title,
        status=str(chat.status),
        created_at=str(chat.created_at),
    )


@router.get(
    "/",
    response_model=ChatListResponse,
)
async def list_all(
    current_user=Depends(get_current_user),  # noqa: B008
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    chats, total = await list_chats(
        user_id=current_user.id,
        skip=skip,
        limit=limit,
    )

    return ChatListResponse(
        chats=[
            ChatResponse(
                id=chat.id,
                user_id=chat.user_id,
                title=chat.title,
                status=str(chat.status),
                created_at=str(chat.created_at),
            )
            for chat in chats
        ],
        total=total,
    )


@router.get(
    "/{chat_id}",
    response_model=ChatResponse,
)
async def get(
    chat_id: str,
    current_user=Depends(get_current_user),  # noqa: B008
):
    chat = await get_chat(
        chat_id=chat_id,
        user_id=current_user.id,
    )

    return ChatResponse(
        id=chat.id,
        user_id=chat.user_id,
        title=chat.title,
        status=str(chat.status),
        created_at=str(chat.created_at),
    )


@router.patch(
    "/{chat_id}",
    response_model=ChatResponse,
)
async def update(
    chat_id: str,
    request: ChatUpdate,
    current_user=Depends(get_current_user),  # noqa: B008
):
    chat = await update_chat(
        chat_id=chat_id,
        user_id=current_user.id,
        title=request.title,
    )

    return ChatResponse(
        id=chat.id,
        user_id=chat.user_id,
        title=chat.title,
        status=str(chat.status),
        created_at=str(chat.created_at),
    )


@router.delete(
    "/{chat_id}",
    status_code=status.HTTP_200_OK,
)
async def delete(
    chat_id: str,
    current_user=Depends(get_current_user),  # noqa: B008
):
    return await delete_chat(
        chat_id=chat_id,
        user_id=current_user.id,
    )
