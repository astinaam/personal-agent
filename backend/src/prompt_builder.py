"""Build system prompt from design config, memories, and skills."""
import json
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import SystemConfig, Skill, Memory
from .memory import get_relevant_memories, build_memory_context

DEFAULT_DESIGN = {
    "base_prompt": "You are Grok, a personal AI agent. Speak in caveman style. Use short sentences. Drop articles. Be direct. No fancy words. Keep answers short but complete. Use grunts when appropriate (ug, argh). You remember things about user. You use memories to help. No markdown unless user ask. No code blocks unless user ask.",
    "include_memories": True,
    "include_project_memories": True,
    "skill_ids": [],
}


async def get_prompt_design(db: AsyncSession) -> dict:
    """Load prompt design from SystemConfig, fallback to default."""
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == "prompt_design"))
    cfg = result.scalar_one_or_none()
    if cfg:
        try:
            design = json.loads(cfg.value)
            # merge with defaults for missing keys
            return {**DEFAULT_DESIGN, **design}
        except json.JSONDecodeError:
            pass
    return DEFAULT_DESIGN.copy()


async def get_skill_snippets(db: AsyncSession, skill_ids: List[int], user_id: int) -> str:
    """Fetch skill content for given IDs, filtered by user ownership and active status."""
    if not skill_ids:
        return ""
    result = await db.execute(
        select(Skill).where(
            Skill.id.in_(skill_ids),
            Skill.user_id == user_id,
            Skill.is_active == True
        )
    )
    skills = result.scalars().all()
    if not skills:
        return ""
    parts = ["SKILLS:"]
    for s in skills:
        parts.append(f"- {s.name}: {s.content}")
    return "\n".join(parts)


async def build_system_prompt(
    db: AsyncSession,
    user_id: int,
    project_id: Optional[int] = None,
    design: Optional[dict] = None,
) -> str:
    """Assemble the full system prompt from design, memories, and skills."""
    if design is None:
        design = await get_prompt_design(db)

    parts = [design.get("base_prompt", DEFAULT_DESIGN["base_prompt"])]

    # Memories
    if design.get("include_memories", True):
        memories = await get_relevant_memories(db, user_id, "", project_id=project_id)
        mem_ctx = await build_memory_context(memories)
        if mem_ctx:
            parts.append(mem_ctx)

    # Skills
    skill_ids = design.get("skill_ids", [])
    if skill_ids:
        skill_ctx = await get_skill_snippets(db, skill_ids, user_id)
        if skill_ctx:
            parts.append(skill_ctx)

    return "\n\n".join(parts)
