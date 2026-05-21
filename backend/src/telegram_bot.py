import asyncio
import os
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from .models import User, Chat, Message
from .database import async_session_maker
from .llm import get_provider

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

def get_session():
    return async_session_maker()

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    code = update.message.text.replace("/start", "").strip() if update.message.text else ""
    if not code:
        await update.message.reply_text("Welcome! Link account at web. Send /link <code>")
        return
    async with get_session() as db:
        user = await db.execute(select(User).where(User.email == code))
        user = user.scalar_one_or_none()
        if user:
            user.telegram_chat_id = str(update.effective_chat.id)
            await db.commit()
            await update.message.reply_text("Account linked!")
        else:
            await update.message.reply_text("Invalid code.")

async def link_command(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    args = ctx.args
    if not args:
        await update.message.reply_text("Usage: /link <your@email.com>")
        return
    email = args[0]
    async with get_session() as db:
        user_res = await db.execute(select(User).where(User.email == email))
        user = user_res.scalar_one_or_none()
        if not user:
            await update.message.reply_text("User not found.")
            return
        user.telegram_chat_id = str(update.effective_chat.id)
        await db.commit()
        await update.message.reply_text("Linked to " + email)

async def handle_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_chat.id)
    text = update.message.text

    async with get_session() as db:
        res = await db.execute(select(User).where(User.telegram_chat_id == chat_id))
        user = res.scalar_one_or_none()
        if not user:
            await update.message.reply_text("Link account first. Use /link <your@email.com>")
            return

        model = user.default_model
        provider_key = model.split("/")[0]
        api_key = None
        if provider_key == "openai":
            api_key = user.openai_api_key or os.getenv("OPENAI_API_KEY")
        elif provider_key == "anthropic":
            api_key = user.anthropic_api_key or os.getenv("ANTHROPIC_API_KEY")
        elif provider_key == "deepseek":
            api_key = user.deepseek_api_key or os.getenv("DEEPSEEK_API_KEY")

        if not api_key:
            await update.message.reply_text("No API key configured.")
            return

        system_prompt = "You are Grok, personal AI agent. Speak caveman style. Short sentences. No articles. Direct. You remember things."

        chat = Chat(user_id=user.id, title=text[:40])
        db.add(chat)
        await db.commit()
        await db.refresh(chat)

        msg = Message(chat_id=chat.id, role="user", content=text)
        db.add(msg)
        await db.commit()

        msgs = [{"role": "system", "content": system_prompt}, {"role": "user", "content": text}]
        provider = get_provider(model, api_key)
        full = ""
        async for chunk in provider.stream(msgs, model):
            content = ""
            if "choices" in chunk and len(chunk["choices"]) > 0:
                delta = chunk["choices"][0].get("delta", {})
                content = delta.get("content", "")
            elif "delta" in chunk:
                content = chunk["delta"].get("text", "")
            elif chunk.get("type") == "content_block_delta":
                content = chunk.get("delta", {}).get("text", "")
            full += content

        resp = Message(chat_id=chat.id, role="assistant", content=full, model_used=model)
        db.add(resp)
        await db.commit()
        await update.message.reply_text(full)

bt = TELEGRAM_BOT_TOKEN
app = None

async def start_telegram():
    global app
    if not bt:
        return
    app = Application.builder().token(bt).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("link", link_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    await app.initialize()
    await app.start()
    await app.updater.start_polling()
