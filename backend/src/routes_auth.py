from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException, Request
from .database import get_db
from .models import User
from .dependencies import get_user_from_request
from .auth import hash_password, verify_password, create_access_token, get_user_by_email
from .schemas import UserCreate, UserResponse, UserSettings, Token

router = APIRouter()

@router.post("/register")
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        default_model=data.default_model
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token({"sub": user.email})
    return {"token": token, "user": UserResponse(id=user.id, email=user.email, created_at=user.created_at, default_model=user.default_model)}

@router.post("/login")
async def login(data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user.email})
    return {"token": token, "user": UserResponse(id=user.id, email=user.email, created_at=user.created_at, default_model=user.default_model)}

@router.get("/me", response_model=UserResponse)
async def me(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    return UserResponse(id=user.id, email=user.email, created_at=user.created_at, default_model=user.default_model)

@router.patch("/me/settings")
async def update_settings(request: Request, settings: UserSettings, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    if settings.openai_api_key is not None:
        user.openai_api_key = settings.openai_api_key
    if settings.anthropic_api_key is not None:
        user.anthropic_api_key = settings.anthropic_api_key
    if settings.deepseek_api_key is not None:
        user.deepseek_api_key = settings.deepseek_api_key
    if settings.default_model is not None:
        user.default_model = settings.default_model
    await db.commit()
    return {"ok": True}
