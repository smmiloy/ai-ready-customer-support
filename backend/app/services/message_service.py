import logging
import random

from fastapi import HTTPException, status

from app.db.client import prisma

logger = logging.getLogger(__name__)

SYSTEM_RESPONSES = [
    "Thank you for your message. Our team will get back to you shortly.",
    "We have received your query and will respond as soon as possible.",
    "Thanks for reaching out! A support agent will be with you soon.",
    "Your message has been received. Please allow us some time to assist you.",
    "Hello! Thanks for contacting us. We appreciate your patience.",
]


async def send_message(
    user_id: int,
    chat_id: str,
    content: str,
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

    user_message = await prisma.messages.create(
        data={
            "chat_id": chat_id,
            "sender": "user",
            "content": content,
        }
    )

    logger.info(
        "User message created with id: %s", user_message.id
    )

    system_content = random.choice(SYSTEM_RESPONSES)

    system_message = await prisma.messages.create(
        data={
            "chat_id": chat_id,
            "sender": "system",
            "content": system_content,
        }
    )

    logger.info(
        "System message created with id: %s", system_message.id
    )

    return user_message, system_message


async def get_chat_messages(
    chat_id: str,
    user_id: int,
    skip: int = 0,
    limit: int = 50,
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

    messages = await prisma.messages.find_many(
        where={
            "chat_id": chat_id,
        },
        skip=skip,
        take=limit,
        order={
            "created_at": "asc",
        },
        include={"message_files": {"files": {}}},
    )

    total = await prisma.messages.count(
        where={
            "chat_id": chat_id,
        }
    )

    return messages, total


async def attach_file_to_message(
    user_id: int,
    chat_id: str,
    message_id: str,
    file_id: str,
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

    message = await prisma.messages.find_unique(
        where={
            "id": message_id,
        }
    )

    if not message or message.chat_id != chat_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found",
        )

    existing = await prisma.message_files.find_unique(
        where={
            "message_id_file_id": {
                "message_id": message_id,
                "file_id": file_id,
            }
        }
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File already attached to this message",
        )

    await prisma.message_files.create(
        data={
            "message_id": message_id,
            "file_id": file_id,
        }
    )

    logger.info("File %s attached to message %s", file_id, message_id)
