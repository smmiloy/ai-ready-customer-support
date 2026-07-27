from typing import List

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=2000,
    )


class FileResponse(BaseModel):
    id: str
    public_id: str
    secure_url: str
    resource_type: str
    file_name: str
    file_type: str
    file_size: int
    uploaded_by: int
    created_at: str


class MessageResponse(BaseModel):
    id: str
    chat_id: str
    sender: str
    content: str
    created_at: str
    files: List[FileResponse] = []


class MessageListResponse(BaseModel):
    messages: list[MessageResponse]
    total: int
