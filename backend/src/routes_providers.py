"""Provider and model CRUD routes."""
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException, Request

from .database import get_db
from .models import Provider, ProviderModel, User
from .dependencies import get_user_from_request
from .crypto import encrypt, decrypt, mask
from .providers import get_user_providers, get_provider as _get_provider, get_provider_models
from .llm import _COPILOT_AVAILABLE
from .schemas import (
    ProviderCreate, ProviderUpdate, ProviderResponse,
    ModelCreate, ModelUpdate, ModelResponse,
    ProviderListResponse, ModelsByProviderResponse, AllModelsResponse,
)

router = APIRouter()


def _provider_response(p: Provider, user_id: int) -> ProviderResponse:
    return ProviderResponse(
        id=p.id,
        user_id=p.user_id,
        name=p.name,
        slug=p.slug,
        base_url=p.base_url,
        is_builtin=p.is_builtin,
        is_active=p.is_active,
        created_at=p.created_at,
    )


def _model_response(m: ProviderModel) -> ModelResponse:
    return ModelResponse(
        id=m.id,
        provider_id=m.provider_id,
        slug=m.slug,
        display_name=m.display_name,
        supports_vision=m.supports_vision,
        is_active=m.is_active,
    )


@router.get("/providers", response_model=ProviderListResponse)
async def list_providers(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    items = await get_user_providers(db, user.id)
    return ProviderListResponse(items=[_provider_response(p, user.id) for p in items])


@router.post("/providers", response_model=ProviderResponse)
async def create_provider(request: Request, data: ProviderCreate, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    collision = await db.execute(
        select(Provider).where(Provider.user_id == user.id, Provider.slug == data.slug)
    )
    if collision.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Provider slug already exists")

    prov = Provider(
        user_id=user.id,
        name=data.name,
        slug=data.slug,
        base_url=data.base_url,
        api_key=encrypt(data.api_key),
        is_builtin=False,
        is_active=data.is_active,
    )
    db.add(prov)
    await db.commit()
    await db.refresh(prov)
    return _provider_response(prov, user.id)


@router.patch("/providers/{provider_id}", response_model=ProviderResponse)
async def update_provider(provider_id: int, request: Request, data: ProviderUpdate, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    prov = await _get_provider(db, provider_id, user.id)
    if not prov or prov.is_builtin:
        raise HTTPException(status_code=404, detail="Provider not found")
    if prov.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if data.name is not None:
        prov.name = data.name
    if data.api_key is not None:
        prov.api_key = encrypt(data.api_key)
    if data.base_url is not None:
        prov.base_url = data.base_url
    if data.is_active is not None:
        prov.is_active = data.is_active

    await db.commit()
    await db.refresh(prov)
    return _provider_response(prov, user.id)


@router.delete("/providers/{provider_id}")
async def delete_provider(provider_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    prov = await _get_provider(db, provider_id, user.id)
    if not prov or prov.is_builtin:
        raise HTTPException(status_code=404, detail="Provider not found")
    if prov.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.delete(prov)
    await db.commit()
    return {"ok": True}


@router.get("/providers/{provider_id}/models", response_model=ModelsByProviderResponse)
async def list_provider_models(provider_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    prov = await _get_provider(db, provider_id, user.id)
    if not prov:
        raise HTTPException(status_code=404, detail="Provider not found")

    models = await get_provider_models(db, provider_id)
    return ModelsByProviderResponse(
        provider=_provider_response(prov, user.id),
        models=[_model_response(m) for m in models],
    )


@router.post("/providers/{provider_id}/models", response_model=ModelResponse)
async def create_provider_model(provider_id: int, request: Request, data: ModelCreate, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    prov = await _get_provider(db, provider_id, user.id)
    if not prov:
        raise HTTPException(status_code=404, detail="Provider not found")
    if prov.user_id and prov.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    mdl = ProviderModel(
        provider_id=provider_id,
        user_id=user.id,
        slug=data.slug,
        display_name=data.display_name,
        supports_vision=data.supports_vision,
        is_active=data.is_active,
    )
    db.add(mdl)
    await db.commit()
    await db.refresh(mdl)
    return _model_response(mdl)


@router.delete("/providers/{provider_id}/models/{model_id}")
async def delete_provider_model(provider_id: int, model_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    prov = await _get_provider(db, provider_id, user.id)
    if not prov:
        raise HTTPException(status_code=404, detail="Provider not found")

    result = await db.execute(
        select(ProviderModel).where(
            ProviderModel.id == model_id,
            ProviderModel.provider_id == provider_id
        )
    )
    mdl = result.scalar_one_or_none()
    if not mdl:
        raise HTTPException(status_code=404, detail="Model not found")
    # builtins require user_id=NULL; dont let user delete builtins
    if mdl.user_id is None:
        raise HTTPException(status_code=403, detail="Cannot delete builtin model")

    await db.delete(mdl)
    await db.commit()
    return {"ok": True}


@router.get("/models", response_model=AllModelsResponse)
async def list_all_models(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    providers = await get_user_providers(db, user.id)
    items = []
    for p in providers:
        models = await get_provider_models(db, p.id)
        items.append(ModelsByProviderResponse(
            provider=_provider_response(p, user.id),
            models=[_model_response(m) for m in models],
        ))
    return AllModelsResponse(items=items)


@router.post("/models/refresh")
async def refresh_openrouter_models(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    result = await db.execute(
        select(Provider).where(Provider.slug == "openrouter", Provider.is_builtin == True)
    )
    prov = result.scalar_one_or_none()
    if not prov:
        raise HTTPException(status_code=404, detail="OpenRouter not configured")

    # fetch models from OpenRouter
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://openrouter.ai/api/v1/models", timeout=30)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="OpenRouter API error")
        data = resp.json().get("data", [])

    for m in data:
        slug = f"openrouter/{m['id']}"
        exists = await db.execute(
            select(ProviderModel).where(
                ProviderModel.provider_id == prov.id,
                ProviderModel.slug == slug
            )
        )
        if exists.scalar_one_or_none():
            continue
        mdl = ProviderModel(
            provider_id=prov.id,
            user_id=None,
            slug=slug,
            display_name=m.get("name", m["id"]),
            supports_vision=False,  # openrouter doesn't expose this consistently
            is_active=True,
        )
        db.add(mdl)

    await db.commit()
    return {"ok": True, "count": len(data)}


@router.post("/providers/{provider_id}/test")
async def test_provider(provider_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_request(request, db)
    prov = await _get_provider(db, provider_id, user.id)
    if not prov:
        raise HTTPException(status_code=404, detail="Provider not found")

    api_key = decrypt(prov.api_key)
    if prov.slug == "copilot":
        if not _COPILOT_AVAILABLE:
            raise HTTPException(status_code=503, detail="Copilot SDK not installed")
        try:
            from copilot import CopilotClient
            token = api_key or os.getenv("COPILOT_GITHUB_TOKEN") or os.getenv("GH_TOKEN")
            if not token:
                raise HTTPException(status_code=401, detail="GitHub Copilot not authenticated")
            client = CopilotClient(github_token=token)
            await client.start()
            await client.stop()
            return {"ok": True, "provider": prov.name}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        # test with litellm
        import litellm
        try:
            kwargs = {
                "model": f"{prov.slug}/gpt-4o" if prov.slug == "openai" else f"{prov.slug}/deepseek-chat",
                "messages": [{"role": "user", "content": "Hi"}],
                "max_tokens": 1,
            }
            if api_key:
                kwargs["api_key"] = api_key
            if prov.base_url:
                kwargs["api_base"] = prov.base_url
            await litellm.acompletion(**kwargs)
            return {"ok": True, "provider": prov.name}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
