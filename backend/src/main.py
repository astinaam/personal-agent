from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from . import models
from .database import engine
from .routes_auth import router as auth_router
from .routes_chat import router as chat_router
from .routes_chat_mgmt import router as chat_mgmt_router
from .routes_memory import router as memory_router
from .routes_config import router as config_router
from .routes_files import router as files_router
from .telegram_bot import start_telegram
import os

app = FastAPI(title="Personal Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth")
app.include_router(chat_router, prefix="/api")
app.include_router(chat_mgmt_router, prefix="/api")
app.include_router(memory_router, prefix="/api")
app.include_router(config_router, prefix="/api")
app.include_router(files_router, prefix="/api")

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    await start_telegram()

@app.get("/health")
async def health():
    return {"status": "ok"}
