from pydantic import BaseModel, Field


class ChatCreate(BaseModel):
    title: str | None = Field(
        default=None,
        max_length=200,
    )


class ChatUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        max_length=200,
    )


class ChatResponse(BaseModel):
    id: str
    user_id: int
    title: str | None
    status: str
    created_at: str


class ChatListResponse(BaseModel):
    chats: list[ChatResponse]
    total: int
