"""Chat streaming routes — uses LiteLLM / Copilot SDK via providers."""
import os
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from .database import get_db, async_session_maker
from .models import Message, Chat
from .dependencies import get_user_from_request
from .llm import stream_llm
from .providers import resolve_model_for_request
from .prompt_builder import build_system_prompt

router = APIRouter()

@router.post("/query")
async def query(request: Request, req: dict, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    message = req.get("message", "")
    chat_id = req.get("chat_id")
    provider_id = req.get("provider_id")
    model_id = req.get("model_id")

    if not message:
        raise HTTPException(status_code=400, detail="Message required")

    resolved = await resolve_model_for_request(db, user, provider_id, model_id, telegram=False)
    provider = resolved["provider"]
    model = resolved["model"]
    api_key = resolved["api_key"]

    if not api_key and provider.slug != "copilot":
        raise HTTPException(status_code=400, detail=f"No API key configured for {provider.name}")

    # Get or create chat
    if not chat_id:
        chat = Chat(
            user_id=user.id,
            provider_id=provider.id,
            model_id=model.id,
            project_id=req.get("project_id"),
            title=message[:40] + "..." if len(message) > 40 else message
        )
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
        if chat.provider_id != provider.id:
            chat.provider_id = provider.id
        if chat.model_id != model.id:
            chat.model_id = model.id
        await db.commit()

    system_prompt = await build_system_prompt(db, user.id, project_id=chat.project_id)

    messages = [{"role": "system", "content": system_prompt}]
    result = await db.execute(
        select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at)
    )
    chat_msgs = result.scalars().all()
    for m in chat_msgs:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": message})

    async def stream():
        full_content = ""
        try:
            async for chunk in stream_llm(messages, provider, model, api_key):
                data_str = chunk.replace("data: ", "").strip()
                if not data_str:
                    continue
                try:
                    data = json.loads(data_str)
                    if data.get("error"):
                        yield f"data: {json.dumps({'error': data['error'], 'done': True})}\n\n"
                        return
                    content = data.get("content", "")
                    if content:
                        full_content += content
                        yield f"data: {json.dumps({'content': content, 'done': False})}\n\n"
                except:
                    pass
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"
            return

        # Save messages in a fresh session
        async with async_session_maker() as db_inner:
            msg = Message(chat_id=chat_id, role="user", content=message, model_used=model.slug)
            db_inner.add(msg)
            resp = Message(chat_id=chat_id, role="assistant", content=full_content, model_used=model.slug)
            db_inner.add(resp)
            await db_inner.commit()
            await db_inner.refresh(resp)
            yield f"data: {json.dumps({'chat_id': chat_id, 'message_id': resp.id, 'done': True})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")

@router.post("/chats/{chat_id}/query")
async def chat_query(chat_id: int, request: Request, req: dict, db: AsyncSession = Depends(get_db)):
    req = {**req, "chat_id": chat_id}
    return await query(request, req, db)
