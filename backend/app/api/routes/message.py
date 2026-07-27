import logging

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import get_current_user
from app.schemas.message import (
    MessageCreate,
    MessageListResponse,
    MessageResponse,
)
from app.services.message_service import (
    get_chat_messages,
    send_message,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/chats",
    tags=["Messages"],
)


@router.post(
    "/{chat_id}/messages",
    status_code=status.HTTP_201_CREATED,
    response_model=MessageResponse,
)
async def send(
    chat_id: str,
    request: MessageCreate,
    current_user=Depends(get_current_user),  # noqa: B008
):
    user_message, system_message = await send_message(
        user_id=current_user.id,
        chat_id=chat_id,
        content=request.content,
    )

    return MessageResponse(
        id=user_message.id,
        chat_id=user_message.chat_id,
        sender=user_message.sender,
        content=user_message.content,
        created_at=str(user_message.created_at),
    )


@router.get(
    "/{chat_id}/messages",
    response_model=MessageListResponse,
)
async def list_messages(
    chat_id: str,
    current_user=Depends(get_current_user),  # noqa: B008
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    messages, total = await get_chat_messages(
        chat_id=chat_id,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
    )

    return MessageListResponse(
        messages=[
            MessageResponse(
                id=message.id,
                chat_id=message.chat_id,
                sender=message.sender,
                content=message.content,
                created_at=str(message.created_at),
            )
            for message in messages
        ],
        total=total,
    )
