from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import List
from .models import Memory

async def get_relevant_memories(db: AsyncSession, user_id: int, query: str, limit: int = 10) -> List[Memory]:
    result = await db.execute(
        select(Memory)
        .where(Memory.user_id == user_id)
        .order_by(Memory.importance.desc(), Memory.created_at.desc())
        .limit(limit)
    )
    memories = result.scalars().all()
    return list(memories)

async def extract_memories_from_message(db: AsyncSession, user_id: int, message: str) -> List[Memory]:
    return []

async def build_memory_context(memories: List[Memory]) -> str:
    if not memories:
        return ""
    ctx = "MEMORIES:\n"
    for m in memories:
        ctx += f"- [{m.category}] {m.content}\n"
    return ctx
