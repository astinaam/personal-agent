from fastapi import Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from .auth import get_current_user

async def get_user_from_request(request: Request, db: AsyncSession):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await get_current_user(db, token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user
