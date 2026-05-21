import os
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from .database import get_db, async_session_maker
from .models import Message, Memory, SystemConfig, Chat
from .dependencies import get_user_from_request
from .memory import get_relevant_memories, build_memory_context
from .llm import get_provider

router = APIRouter()
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
CAVE_SYSTEM_PROMPT = """You are Grok, a personal AI agent. Speak in caveman style. Use short sentences. Drop articles. Be direct. No fancy words. Keep answers short but complete. Use grunts when appropriate (ug, argh). You remember things about user. You use memories to help. No markdown unless user ask. No code blocks unless user ask."""

async def get_system_prompt(db: AsyncSession) -> str:
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == "system_prompt"))
    cfg = result.scalar_one_or_none()
    if cfg:
        return cfg.value
    return CAVE_SYSTEM_PROMPT

@router.get("/models")
async def list_models():
    return {
        "models": [
            {"id": "openai/gpt-4o", "name": "GPT-4o", "provider": "OpenAI", "supports_vision": True},
            {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini", "provider": "OpenAI", "supports_vision": True},
            {"id": "anthropic/claude-sonnet-4-20250514", "name": "Claude 4 Sonnet", "provider": "Anthropic", "supports_vision": True},
            {"id": "anthropic/claude-opus-4-20250514", "name": "Claude 4 Opus", "provider": "Anthropic", "supports_vision": True},
            {"id": "deepseek/deepseek-chat", "name": "DeepSeek V3", "provider": "DeepSeek", "supports_vision": False},
        ]
    }

@router.post("/query")
async def query(request: Request, req: dict, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    message = req.get("message", "")
    model = req.get("model") or user.default_model
    chat_id = req.get("chat_id")
    file_ids = req.get("files", [])

    if not message:
        raise HTTPException(status_code=400, detail="Message required")

    model_provider = model.split("/")[0]
    api_key = None
    if model_provider == "openai":
        api_key = user.openai_api_key or os.getenv("OPENAI_API_KEY")
    elif model_provider == "anthropic":
        api_key = user.anthropic_api_key or os.getenv("ANTHROPIC_API_KEY")
    elif model_provider == "deepseek":
        api_key = user.deepseek_api_key or os.getenv("DEEPSEEK_API_KEY")

    if not api_key:
        raise HTTPException(status_code=400, detail=f"No API key configured for {model_provider}")

    # Get or create chat
    if not chat_id:
        chat = Chat(user_id=user.id, title=message[:40] + "..." if len(message) > 40 else message)
        db.add(chat)
        await db.commit()
        await db.refresh(chat)
        chat_id = chat.id
    else:
        result = await db.execute(select(Chat).where(Chat.id == chat_id, Chat.user_id == user.id))
        chat = result.scalar_one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        chat_id = chat.id

    memories = await get_relevant_memories(db, user.id, message)
    memory_ctx = await build_memory_context(memories)
    system_prompt = await get_system_prompt(db)

    if memory_ctx:
        system_prompt = system_prompt + "\n\n" + memory_ctx

    messages = [{"role": "system", "content": system_prompt}]
    result = await db.execute(
        select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at)
    )
    chat_msgs = result.scalars().all()
    for m in chat_msgs:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": message})

    provider = get_provider(model, api_key)

    async def stream():
        full_content = ""
        try:
            async for chunk in provider.stream(messages, model):
                content = ""
                if "choices" in chunk and len(chunk["choices"]) > 0:
                    delta = chunk["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                elif "delta" in chunk:
                    content = chunk["delta"].get("text", "")
                elif "type" in chunk and chunk["type"] == "content_block_delta":
                    content = chunk.get("delta", {}).get("text", "")

                if content:
                    full_content += content
                    yield f"data: {json.dumps({'content': content, 'done': False})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"
            return

        # Save messages in a fresh session
        async with async_session_maker() as db_inner:
            msg = Message(chat_id=chat_id, role="user", content=message, model_used=model)
            db_inner.add(msg)
            resp = Message(chat_id=chat_id, role="assistant", content=full_content, model_used=model)
            db_inner.add(resp)
            await db_inner.commit()
            await db_inner.refresh(resp)
            yield f"data: {json.dumps({'chat_id': chat_id, 'message_id': resp.id, 'done': True})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")

@router.post("/chats/{chat_id}/query")
async def chat_query(chat_id: int, request: Request, req: dict, db: AsyncSession = Depends(get_db)):
    req = {**req, "chat_id": chat_id}
    return await query(request, req, db)
