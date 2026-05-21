from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException, Request
from .database import get_db
from .models import SystemConfig
from .dependencies import get_user_from_request
from .prompt_builder import get_prompt_design

router = APIRouter()

@router.get("/config/system-prompt")
async def get_system_prompt(request: Request, db: AsyncSession = Depends(get_db)):
    await get_user_from_request(request, db)
    design = await get_prompt_design(db)
    return {"prompt": design.get("base_prompt", ""), "design": design}

@router.post("/config/system-prompt")
async def set_system_prompt(request: Request, data: dict, db: AsyncSession = Depends(get_db)):
    await get_user_from_request(request, db)
    # data can be {prompt} or {design: {...}}
    if "design" in data:
        design = data["design"]
        result = await db.execute(select(SystemConfig).where(SystemConfig.key == "prompt_design"))
        cfg = result.scalar_one_or_none()
        import json
        if cfg:
            cfg.value = json.dumps(design)
        else:
            cfg = SystemConfig(key="prompt_design", value=json.dumps(design))
            db.add(cfg)
    if "prompt" in data:
        # Also update the base_prompt within the design
        result = await db.execute(select(SystemConfig).where(SystemConfig.key == "prompt_design"))
        cfg = result.scalar_one_or_none()
        import json
        if cfg:
            try:
                design = json.loads(cfg.value)
            except:
                design = {}
            design["base_prompt"] = data["prompt"]
            cfg.value = json.dumps(design)
        else:
            design = {"base_prompt": data["prompt"], "include_memories": True, "include_project_memories": True, "skill_ids": []}
            cfg = SystemConfig(key="prompt_design", value=json.dumps(design))
            db.add(cfg)
    await db.commit()
    return {"ok": True}
