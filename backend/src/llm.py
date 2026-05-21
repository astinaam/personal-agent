import os
import json
import httpx
from typing import List, Dict, Optional, AsyncIterator

class LLMProvider:
    def __init__(self, provider: str, api_key: str):
        self.provider = provider
        self.api_key = api_key

    async def stream(self, messages: List[Dict], model: str) -> AsyncIterator[dict]:
        raise NotImplementedError

class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str):
        super().__init__("openai", api_key)
        self.base_url = "https://api.openai.com/v1"

    async def stream(self, messages: List[Dict], model: str) -> AsyncIterator[dict]:
        async with httpx.AsyncClient() as client:
            payload = {
                "model": model.replace("openai/", ""),
                "messages": messages,
                "stream": True,
                "max_tokens": 4096
            }
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=120
            ) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data:"):
                        data = line[5:].strip()
                        if data == "[DONE]":
                            continue
                        try:
                            parsed = json.loads(data)
                            yield parsed
                        except:
                            pass

class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str):
        super().__init__("anthropic", api_key)
        self.base_url = "https://api.anthropic.com/v1"

    async def stream(self, messages: List[Dict], model: str) -> AsyncIterator[dict]:
        system = None
        msgs = []
        for m in messages:
            if m["role"] == "system":
                system = m["content"]
            else:
                msgs.append(m)
        async with httpx.AsyncClient() as client:
            payload = {
                "model": model.replace("anthropic/", ""),
                "messages": msgs,
                "max_tokens": 4096,
                "stream": True
            }
            if system:
                payload["system"] = system
            async with client.stream(
                "POST",
                f"{self.base_url}/messages",
                headers={
                    "x-api-key": self.api_key,
                    "Content-Type": "application/json",
                    "anthropic-version": "2023-06-01"
                },
                json=payload,
                timeout=120
            ) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data:"):
                        data = line[5:].strip()
                        try:
                            parsed = json.loads(data)
                            yield parsed
                        except:
                            pass

class DeepSeekProvider(LLMProvider):
    def __init__(self, api_key: str):
        super().__init__("deepseek", api_key)
        self.base_url = "https://api.deepseek.com/v1"

    async def stream(self, messages: List[Dict], model: str) -> AsyncIterator[dict]:
        async with httpx.AsyncClient() as client:
            payload = {
                "model": model.replace("deepseek/", ""),
                "messages": messages,
                "stream": True,
                "max_tokens": 4096
            }
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=120
            ) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data:"):
                        data = line[5:].strip()
                        if data == "[DONE]":
                            continue
                        try:
                            parsed = json.loads(data)
                            yield parsed
                        except:
                            pass

def get_provider(model: str, api_key: str) -> LLMProvider:
    if model.startswith("anthropic/"):
        return AnthropicProvider(api_key)
    elif model.startswith("deepseek/"):
        return DeepSeekProvider(api_key)
    else:
        return OpenAIProvider(api_key)
