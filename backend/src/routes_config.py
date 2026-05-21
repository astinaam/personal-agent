from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException, Request
from .database import get_db
from .models import SystemConfig
from .dependencies import get_user_from_request

router = APIRouter()

@router.get("/config/system-prompt")
async def get_system_prompt(request: Request, db: AsyncSession = Depends(get_db)):
    await get_user_from_request(request, db)
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == "system_prompt"))
    cfg = result.scalar_one_or_none()
    return {"prompt": cfg.value if cfg else None}

@router.post("/config/system-prompt")
async def set_system_prompt(request: Request, data: dict, db: AsyncSession = Depends(get_db)):
    await get_user_from_request(request, db)
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == "system_prompt"))
    cfg = result.scalar_one_or_none()
    if cfg:
        cfg.value = data.get("prompt", "")
    else:
        cfg = SystemConfig(key="system_prompt", value=data.get("prompt", ""))
        db.add(cfg)
    await db.commit()
    return {"ok": True}
