from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List, Optional
from .models import Memory

async def get_relevant_memories(db: AsyncSession, user_id: int, query: str, project_id: Optional[int] = None, limit: int = 10) -> List[Memory]:
    conditions = [Memory.user_id == user_id]
    if project_id is not None:
        # Global + project-specific memories
        conditions.append(or_(Memory.project_id == project_id, Memory.project_id == None))
    else:
        # Only global memories
        conditions.append(Memory.project_id == None)
    result = await db.execute(
        select(Memory)
        .where(*conditions)
        .order_by(Memory.importance.desc(), Memory.created_at.desc())
        .limit(limit)
    )
    memories = result.scalars().all()
    return list(memories)

async def build_memory_context(memories: List[Memory]) -> str:
    if not memories:
        return ""
    ctx = "MEMORIES:\n"
    for m in memories:
        ctx += f"- [{m.category}] {m.content}\n"
    return ctx
