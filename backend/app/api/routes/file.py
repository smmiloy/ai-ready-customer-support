import logging

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.api.dependencies import get_current_user
from app.schemas.file import FileResponse
from app.services.file_service import upload_file

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/files",
    tags=["Files"],
)


@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
    response_model=FileResponse,
)
async def upload(
    current_user=Depends(get_current_user),  # noqa: B008
    file: UploadFile = File(...),  # noqa: B008
):
    uploaded_file = await upload_file(
        user_id=current_user.id,
        file=file,
    )

    return FileResponse(
        id=uploaded_file.id,
        public_id=uploaded_file.public_id,
        secure_url=uploaded_file.secure_url,
        resource_type=uploaded_file.resource_type,
        file_name=uploaded_file.file_name,
        file_type=uploaded_file.file_type,
        file_size=uploaded_file.file_size,
        uploaded_by=uploaded_file.uploaded_by,
        created_at=str(uploaded_file.created_at),
    )
