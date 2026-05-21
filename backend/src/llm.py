"""LLM streaming via LiteLLM (OpenAI/Anthropic/DeepSeek/OpenRouter) and Copilot SDK."""
import os
import json
import asyncio
from typing import List, Dict, Optional, AsyncIterator

import litellm
from fastapi import HTTPException

from .models import Provider, ProviderModel
from .crypto import decrypt

# Silence litellm verbose logging
litellm.set_verbose = False

# Copilot SDK import (optional — graceful degradation if not installed)
try:
    from copilot import CopilotClient
    from copilot.generated.session_events import SessionEventType
    _COPILOT_AVAILABLE = True
except ImportError:
    _COPILOT_AVAILABLE = False


async def stream_lite_llm(
    messages: List[Dict],
    provider: Provider,
    model: ProviderModel,
    api_key: Optional[str],
) -> AsyncIterator[str]:
    """Stream completions via LiteLLM. Yields SSE data: lines."""
    # Build the model identifier for litellm
    model_id = model.slug  # e.g. "openai/gpt-4o", "anthropic/claude-sonnet-4-20250514"
    kwargs = {
        "model": model_id,
        "messages": messages,
        "stream": True,
        "max_tokens": 4096,
    }
    if api_key:
        kwargs["api_key"] = api_key
    if provider.base_url:
        kwargs["api_base"] = provider.base_url

    try:
        response = await litellm.acompletion(**kwargs)
        async for chunk in response:
            delta = chunk.choices[0].delta.content if chunk.choices else ""
            if delta:
                yield f"data: {json.dumps({'content': delta, 'done': False})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"


async def stream_copilot(
    messages: List[Dict],
    model: ProviderModel,
    api_key: Optional[str],
) -> AsyncIterator[str]:
    """Stream completions via Copilot SDK. Yields SSE data: lines."""
    if not _COPILOT_AVAILABLE:
        yield f"data: {json.dumps({'error': 'Copilot SDK not installed', 'done': True})}\n\n"
        return

    token = api_key or os.getenv("COPILOT_GITHUB_TOKEN") or os.getenv("GH_TOKEN") or os.getenv("GITHUB_TOKEN")
    if not token:
        yield f"data: {json.dumps({'error': 'GitHub Copilot not authenticated', 'done': True})}\n\n"
        return

    client = CopilotClient(github_token=token)
    await client.start()

    try:
        # Convert system messages to systemMessage param
        system_msg = None
        conversation = []
        for m in messages:
            if m["role"] == "system":
                system_msg = {"content": m["content"]}
            else:
                conversation.append({"role": m["role"], "content": m["content"]})

        config = {
            "model": model.slug,
            "streaming": True,
        }
        if system_msg:
            config["system_message"] = system_msg

        session = await client.create_session(config)

        buffer = asyncio.Queue()
        finished = asyncio.Event()

        def on_event(event):
            if event.type == SessionEventType.ASSISTANT_MESSAGE_DELTA:
                content = event.data.delta_content or ""
                asyncio.get_running_loop().call_soon_threadsafe(buffer.put_nowait, content)
            elif event.type == SessionEventType.SESSION_IDLE:
                asyncio.get_running_loop().call_soon_threadsafe(finished.set)

        session.on(on_event)

        # Fire the request in background
        async def send():
            for m in conversation:
                if m["role"] == "user":
                    await session.send_and_wait({"prompt": m["content"]})

        task = asyncio.create_task(send())

        while not finished.is_set() or not buffer.empty():
            try:
                content = await asyncio.wait_for(buffer.get(), timeout=0.1)
                if content:
                    yield f"data: {json.dumps({'content': content, 'done': False})}\n\n"
            except asyncio.TimeoutError:
                if finished.is_set() and buffer.empty():
                    break

        await task
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"
    finally:
        await client.stop()


async def stream_llm(
    messages: List[Dict],
    provider: Provider,
    model: ProviderModel,
    api_key: Optional[str],
) -> AsyncIterator[str]:
    """Route to correct engine based on provider slug."""
    if provider.slug == "copilot":
        async for chunk in stream_copilot(messages, model, api_key):
            yield chunk
    else:
        async for chunk in stream_lite_llm(messages, provider, model, api_key):
            yield chunk
