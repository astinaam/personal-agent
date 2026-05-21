import os
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from sqlalchemy import select
from .models import User, Chat, Message
from .database import async_session_maker
from .providers import resolve_model_for_request, get_user_providers, get_provider_models
from .llm import stream_llm

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

async def list_models_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_chat.id)
    async with get_session() as db:
        res = await db.execute(select(User).where(User.telegram_chat_id == chat_id))
        user = res.scalar_one_or_none()
        if not user:
            await update.message.reply_text("Link account first. /link <email>")
            return
        providers = await get_user_providers(db, user.id)
        lines = []
        for p in providers:
            if not p.is_active:
                continue
            models = await get_provider_models(db, p.id)
            if models:
                lines.append(f"📡 {p.name}")
                for m in models:
                    lines.append(f"   {m.slug} — {m.display_name}")
        if not lines:
            await update.message.reply_text("No active providers.")
            return
        await update.message.reply_text("\n".join(lines))

async def list_providers_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_chat.id)
    async with get_session() as db:
        res = await db.execute(select(User).where(User.telegram_chat_id == chat_id))
        user = res.scalar_one_or_none()
        if not user:
            await update.message.reply_text("Link account first. /link <email>")
            return
        providers = await get_user_providers(db, user.id)
        lines = [f"{'🟢' if p.is_active else '⚪'} {p.name} ({p.slug})" for p in providers]
        await update.message.reply_text("\n".join(lines))

async def set_model_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    args = ctx.args
    if not args:
        await update.message.reply_text("Usage: /model <provider>/<slug>\nExample: /model openai/gpt-4o")
        return
    chat_id = str(update.effective_chat.id)
    slug = args[0].strip()
    parts = slug.split("/", 1)
    if len(parts) != 2:
        await update.message.reply_text("Invalid format. Use: /model <provider>/<slug>")
        return
    provider_slug, model_slug = parts

    async with get_session() as db:
        res = await db.execute(select(User).where(User.telegram_chat_id == chat_id))
        user = res.scalar_one_or_none()
        if not user:
            await update.message.reply_text("Link account first. /link <email>")
            return
        providers = await get_user_providers(db, user.id)
        provider = next((p for p in providers if p.slug == provider_slug), None)
        if not provider:
            await update.message.reply_text(f"Provider '{provider_slug}' not found.")
            return
        models = await get_provider_models(db, provider.id)
        model = next((m for m in models if m.slug == model_slug), None)
        if not model:
            await update.message.reply_text(f"Model '{model_slug}' not found for {provider.name}.")
            return
        user.telegram_provider_id = provider.id
        user.telegram_model_id = model.id
        await db.commit()
        await update.message.reply_text(f"Default model set: {provider.name} / {model.display_name}")

async def handle_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_chat.id)
    text = update.message.text

    async with get_session() as db:
        res = await db.execute(select(User).where(User.telegram_chat_id == chat_id))
        user = res.scalar_one_or_none()
        if not user:
            await update.message.reply_text("Link account first. Use /link <your@email.com>")
            return

        try:
            resolved = await resolve_model_for_request(db, user, telegram=True)
        except ValueError as e:
            await update.message.reply_text(f"No model configured: {e}")
            return

        provider = resolved["provider"]
        model = resolved["model"]
        api_key = resolved["api_key"]
        base_url = resolved["base_url"]

        if not api_key and provider.slug != "copilot":
            await update.message.reply_text(f"No API key for {provider.name}.")
            return

        system_prompt = "You are Grok, personal AI agent. Speak caveman style. Short sentences. No articles. Direct. You remember things."

        chat = Chat(user_id=user.id, provider_id=provider.id, model_id=model.id, title=text[:40])
        db.add(chat)
        await db.commit()
        await db.refresh(chat)

        msg = Message(chat_id=chat.id, role="user", content=text)
        db.add(msg)
        await db.commit()

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ]

        full = ""
        async for chunk in stream_llm(messages, provider, model, api_key):
            data_str = chunk.replace("data: ", "").strip()
            if not data_str:
                continue
            try:
                import json
                data = json.loads(data_str)
                if data.get("error"):
                    await update.message.reply_text(f"Error: {data['error']}")
                    return
                full += data.get("content", "")
            except:
                pass

        resp = Message(chat_id=chat.id, role="assistant", content=full, model_used=model.slug)
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
    app.add_handler(CommandHandler("models", list_models_cmd))
    app.add_handler(CommandHandler("providers", list_providers_cmd))
    app.add_handler(CommandHandler("model", set_model_cmd))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    await app.initialize()
    await app.start()
    await app.updater.start_polling()
