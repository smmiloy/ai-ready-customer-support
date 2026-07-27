from pydantic import BaseModel, Field

from app.schemas.file import FileResponse


class MessageCreate(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=2000,
    )


class MessageResponse(BaseModel):
    id: str
    chat_id: str
    sender: str
    content: str
    created_at: str
    files: list[FileResponse] = []


class MessageListResponse(BaseModel):
    messages: list[MessageResponse]
    total: int
