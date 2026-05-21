from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from fastapi import APIRouter, Depends, HTTPException, Request
from .database import get_db
from .models import Memory
from .dependencies import get_user_from_request
from .schemas import MemoryCreate, MemoryResponse
from typing import List

router = APIRouter()

@router.get("/memories", response_model=List[MemoryResponse])
async def list_memories(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    result = await db.execute(
        select(Memory)
        .where(Memory.user_id == user.id)
        .order_by(desc(Memory.importance), desc(Memory.created_at))
    )
    return result.scalars().all()

@router.post("/memories", response_model=MemoryResponse)
async def create_memory(request: Request, data: MemoryCreate, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    mem = Memory(
        user_id=user.id,
        content=data.content,
        category=data.category,
        importance=data.importance,
        source=data.source
    )
    db.add(mem)
    await db.commit()
    await db.refresh(mem)
    return mem

@router.patch("/memories/{memory_id}")
async def update_memory(memory_id: int, request: Request, data: MemoryCreate, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    result = await db.execute(
        select(Memory).where(Memory.id == memory_id, Memory.user_id == user.id)
    )
    mem = result.scalar_one_or_none()
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found")
    mem.content = data.content
    mem.category = data.category
    mem.importance = data.importance
    await db.commit()
    return mem

@router.delete("/memories/{memory_id}")
async def delete_memory(memory_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    result = await db.execute(
        select(Memory).where(Memory.id == memory_id, Memory.user_id == user.id)
    )
    mem = result.scalar_one_or_none()
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found")
    await db.delete(mem)
    await db.commit()
    return {"ok": True}
