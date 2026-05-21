from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from fastapi import APIRouter, Depends, HTTPException, Request
from .database import get_db
from .models import Chat, Message
from .dependencies import get_user_from_request
from .schemas import ChatCreate, ChatResponse, MessageResponse
from typing import List

router = APIRouter()

@router.get("/chats", response_model=List[ChatResponse])
async def list_chats(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    result = await db.execute(
        select(Chat).where(Chat.user_id == user.id).order_by(desc(Chat.created_at))
    )
    chats = result.scalars().all()
    return [ChatResponse(
        id=c.id,
        title=c.title,
        created_at=c.created_at,
        provider_id=c.provider_id,
        model_id=c.model_id,
        messages=[]
    ) for c in chats]

@router.get("/chats/{chat_id}", response_model=ChatResponse)
async def get_chat(chat_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == user.id)
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return ChatResponse(
        id=chat.id,
        title=chat.title,
        created_at=chat.created_at,
        provider_id=chat.provider_id,
        model_id=chat.model_id,
        messages=[MessageResponse(
            id=m.id, role=m.role, content=m.content, model_used=m.model_used,
            tokens_input=m.tokens_input, tokens_output=m.tokens_output,
            files=m.files or [], created_at=m.created_at
        ) for m in chat.messages]
    )

@router.post("/chats", response_model=ChatResponse)
async def create_chat(request: Request, data: ChatCreate, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    chat = Chat(
        user_id=user.id,
        title=data.title or "New Chat",
        project_id=data.project_id,
        provider_id=data.provider_id,
        model_id=data.model_id,
    )
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    if data.first_message:
        msg = Message(chat_id=chat.id, role="user", content=data.first_message, files=data.files or [])
        db.add(msg)
        await db.commit()
    return ChatResponse(
        id=chat.id, title=chat.title, created_at=chat.created_at,
        provider_id=chat.provider_id, model_id=chat.model_id, messages=[]
    )

@router.delete("/chats/{chat_id}")
async def delete_chat(chat_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == user.id)
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    await db.delete(chat)
    await db.commit()
    return {"ok": True}
