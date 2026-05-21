import os
import uuid
import shutil
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from .database import get_db
from .dependencies import get_user_from_request
from typing import List

router = APIRouter()
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_files(
    request: Request,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db)
):
    await get_user_from_request(request, db)
    uploaded = []
    for file in files:
        ext = os.path.splitext(file.filename)[1] if file.filename else ""
        fname = f"{uuid.uuid4()}{ext}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        with open(fpath, "wb") as f:
            shutil.copyfileobj(file.file, f)
        uploaded.append({
            "id": fname,
            "filename": file.filename,
            "url": f"/api/files/{fname}",
            "mimetype": file.content_type or "application/octet-stream",
            "size": os.path.getsize(fpath)
        })
    return {"files": uploaded}

@router.get("/files/{filename}")
async def get_file(filename: str):
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=404, detail="File not found")
    fpath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(fpath)
