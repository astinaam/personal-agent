"""Skills CRUD routes."""
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException, Request

from .database import get_db
from .models import Skill
from .dependencies import get_user_from_request
from .schemas import SkillCreate, SkillUpdate, SkillResponse, SkillListResponse

router = APIRouter()


@router.get("/skills", response_model=SkillListResponse)
async def list_skills(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    result = await db.execute(
        select(Skill).where(Skill.user_id == user.id).order_by(Skill.created_at.desc())
    )
    items = result.scalars().all()
    return SkillListResponse(items=[
        SkillResponse(
            id=s.id, user_id=s.user_id, name=s.name, description=s.description,
            content=s.content, is_active=s.is_active, created_at=s.created_at
        ) for s in items
    ])


@router.post("/skills", response_model=SkillResponse)
async def create_skill(request: Request, data: SkillCreate, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    skill = Skill(
        user_id=user.id,
        name=data.name,
        description=data.description,
        content=data.content,
        is_active=True,
    )
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return SkillResponse(
        id=skill.id, user_id=skill.user_id, name=skill.name, description=skill.description,
        content=skill.content, is_active=skill.is_active, created_at=skill.created_at
    )


@router.patch("/skills/{skill_id}", response_model=SkillResponse)
async def update_skill(skill_id: int, request: Request, data: SkillUpdate, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    result = await db.execute(
        select(Skill).where(Skill.id == skill_id, Skill.user_id == user.id)
    )
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    if data.name is not None:
        skill.name = data.name
    if data.description is not None:
        skill.description = data.description
    if data.content is not None:
        skill.content = data.content
    if data.is_active is not None:
        skill.is_active = data.is_active
    await db.commit()
    await db.refresh(skill)
    return SkillResponse(
        id=skill.id, user_id=skill.user_id, name=skill.name, description=skill.description,
        content=skill.content, is_active=skill.is_active, created_at=skill.created_at
    )


@router.delete("/skills/{skill_id}")
async def delete_skill(skill_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    result = await db.execute(
        select(Skill).where(Skill.id == skill_id, Skill.user_id == user.id)
    )
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    await db.delete(skill)
    await db.commit()
    return {"ok": True}
