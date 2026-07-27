import logging
import uuid

import cloudinary  # type: ignore[import-not-found, import-untyped]
import cloudinary.uploader  # type: ignore[import-not-found, import-untyped]
from fastapi import HTTPException, status
from fastapi.datastructures import UploadFile

from app.core.config import settings
from app.db.client import prisma

logger = logging.getLogger(__name__)

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
)


async def upload_file(
    user_id: int,
    file: UploadFile,
):
    if not file.content_type or not file.content_type.startswith(("image/", "application/pdf", "text/")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type",
        )

    file_content = await file.read()
    file_size = len(file_content)

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file",
        )

    if file_size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be less than 10MB",
        )

    public_id = f"user_{user_id}/{uuid.uuid4().hex}"

    try:
        upload_result = cloudinary.uploader.upload(
            file_content,
            public_id=public_id,
            resource_type="auto",
            overwrite=False,
        )

    except Exception as exc:
        logger.error("Cloudinary upload failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"File upload failed: {str(exc)}",
        ) from exc

    uploaded_file = await prisma.uploaded_files.create(
        data={
            "public_id": upload_result["public_id"],
            "secure_url": upload_result["secure_url"],
            "resource_type": upload_result["resource_type"],
            "file_name": file.filename or "uploaded_file",
            "file_type": file.content_type or "application/octet-stream",
            "file_size": file_size,
            "uploaded_by": user_id,
        }
    )

    logger.info("File uploaded with id: %s", uploaded_file.id)

    return uploaded_file
