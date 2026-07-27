from pydantic import BaseModel


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


class FileAssociationRequest(BaseModel):
    file_id: str
