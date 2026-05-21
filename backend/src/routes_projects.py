"""Project CRUD routes."""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException, Request

from .database import get_db
from .models import Project, Chat, Memory
from .dependencies import get_user_from_request
from .schemas import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse, ChatResponse

router = APIRouter()


async def get_or_create_global_project(db: AsyncSession, user_id: int) -> Project:
    result = await db.execute(
        select(Project).where(Project.user_id == user_id, Project.is_global == True)
    )
    proj = result.scalar_one_or_none()
    if not proj:
        proj = Project(
            user_id=user_id,
            name="Global",
            slug="global",
            description="Global memories and chats",
            is_global=True,
        )
        db.add(proj)
        await db.commit()
        await db.refresh(proj)
    return proj


@router.get("/projects", response_model=ProjectListResponse)
async def list_projects(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    result = await db.execute(
        select(Project).where(Project.user_id == user.id).order_by(Project.is_global.desc(), Project.created_at)
    )
    items = result.scalars().all()
    return ProjectListResponse(items=[
        ProjectResponse(
            id=p.id, user_id=p.user_id, name=p.name, slug=p.slug,
            description=p.description, is_global=p.is_global, created_at=p.created_at
        ) for p in items
    ])


@router.post("/projects", response_model=ProjectResponse)
async def create_project(request: Request, data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    existing = await db.execute(
        select(Project).where(Project.user_id == user.id, Project.slug == data.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Project slug already exists")
    proj = Project(
        user_id=user.id,
        name=data.name,
        slug=data.slug,
        description=data.description,
        is_global=False,
    )
    db.add(proj)
    await db.commit()
    await db.refresh(proj)
    return ProjectResponse(
        id=proj.id, user_id=proj.user_id, name=proj.name, slug=proj.slug,
        description=proj.description, is_global=proj.is_global, created_at=proj.created_at
    )


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: int, request: Request, data: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user.id)
    )
    proj = result.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    if proj.is_global:
        raise HTTPException(status_code=403, detail="Cannot modify global project")
    if data.name is not None:
        proj.name = data.name
    if data.description is not None:
        proj.description = data.description
    await db.commit()
    await db.refresh(proj)
    return ProjectResponse(
        id=proj.id, user_id=proj.user_id, name=proj.name, slug=proj.slug,
        description=proj.description, is_global=proj.is_global, created_at=proj.created_at
    )


@router.delete("/projects/{project_id}")
async def delete_project(project_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user.id)
    )
    proj = result.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    if proj.is_global:
        raise HTTPException(status_code=403, detail="Cannot delete global project")
    # Move chats and memories to global
    global_proj = await get_or_create_global_project(db, user.id)
    chats = await db.execute(select(Chat).where(Chat.project_id == project_id))
    for c in chats.scalars().all():
        c.project_id = global_proj.id
    memories = await db.execute(select(Memory).where(Memory.project_id == project_id))
    for m in memories.scalars().all():
        m.project_id = None  # global
    await db.delete(proj)
    await db.commit()
    return {"ok": True}


@router.get("/projects/{project_id}/chats")
async def list_project_chats(project_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user.id)
    )
    proj = result.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    result = await db.execute(
        select(Chat).where(Chat.project_id == project_id, Chat.user_id == user.id).order_by(Chat.created_at.desc())
    )
    chats = result.scalars().all()
    return [ChatResponse(
        id=c.id, title=c.title, created_at=c.created_at,
        provider_id=c.provider_id, model_id=c.model_id, messages=[]
    ) for c in chats]
