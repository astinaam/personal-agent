"""Provider CRUD, seeding, and resolution logic."""
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .database import async_session_maker
from .models import Provider, ProviderModel, User
from .crypto import encrypt, decrypt

BUILTIN_PROVIDERS = [
    {"name": "OpenAI", "slug": "openai", "base_url": "https://api.openai.com/v1"},
    {"name": "Anthropic", "slug": "anthropic", "base_url": "https://api.anthropic.com/v1"},
    {"name": "DeepSeek", "slug": "deepseek", "base_url": "https://api.deepseek.com/v1"},
    {"name": "OpenRouter", "slug": "openrouter", "base_url": "https://openrouter.ai/api/v1"},
    {"name": "GitHub Copilot", "slug": "copilot", "base_url": "https://api.githubcopilot.com"},
]

BUILTIN_MODELS = {
    "openai": [
        {"slug": "openai/gpt-4o", "display_name": "GPT-4o", "supports_vision": True},
        {"slug": "openai/gpt-4o-mini", "display_name": "GPT-4o Mini", "supports_vision": True},
    ],
    "anthropic": [
        {"slug": "anthropic/claude-sonnet-4-20250514", "display_name": "Claude 4 Sonnet", "supports_vision": True},
        {"slug": "anthropic/claude-opus-4-20250514", "display_name": "Claude 4 Opus", "supports_vision": True},
    ],
    "deepseek": [
        {"slug": "deepseek/deepseek-chat", "display_name": "DeepSeek Chat", "supports_vision": False},
    ],
    "copilot": [
        {"slug": "gpt-4.1", "display_name": "GPT-4.1", "supports_vision": True},
        {"slug": "claude-sonnet-4", "display_name": "Claude 4 Sonnet", "supports_vision": True},
    ],
}


async def seed_builtin_providers(db: AsyncSession) -> None:
    """Seed builtin providers and models if none exist."""
    result = await db.execute(select(Provider).where(Provider.is_builtin == True))
    existing = result.scalars().all()
    if existing:
        return

    for prov_data in BUILTIN_PROVIDERS:
        provider = Provider(
            user_id=None,
            name=prov_data["name"],
            slug=prov_data["slug"],
            base_url=prov_data["base_url"],
            api_key=None,
            is_builtin=True,
            is_active=True,
        )
        db.add(provider)
        await db.flush()

        for mdl in BUILTIN_MODELS.get(prov_data["slug"], []):
            model = ProviderModel(
                provider_id=provider.id,
                user_id=None,
                slug=mdl["slug"],
                display_name=mdl["display_name"],
                supports_vision=mdl["supports_vision"],
                is_active=True,
            )
            db.add(model)

    await db.commit()


async def migrate_user_keys(db: AsyncSession) -> None:
    """Migrate legacy api_key columns on users to provider rows."""
    result = await db.execute(
        select(User).where(
            (User.openai_api_key != None) | (User.anthropic_api_key != None) | (User.deepseek_api_key != None)
        )
    )
    users = result.scalars().all()
    for user in users:
        mapping = [
            ("openai", user.openai_api_key),
            ("anthropic", user.anthropic_api_key),
            ("deepseek", user.deepseek_api_key),
        ]
        for slug, key in mapping:
            if not key:
                continue
            # check already migrated
            exists = await db.execute(
                select(Provider).where(Provider.user_id == user.id, Provider.slug == slug)
            )
            if exists.scalar_one_or_none():
                continue
            result = await db.execute(select(Provider).where(Provider.slug == slug, Provider.is_builtin == True))
            builtin = result.scalar_one_or_none()
            if builtin:
                new_prov = Provider(
                    user_id=user.id,
                    name=builtin.name,
                    slug=slug,
                    base_url=builtin.base_url,
                    api_key=encrypt(key),
                    is_builtin=False,
                    is_active=True,
                )
                db.add(new_prov)
                await db.flush()
                # copy models
                models = await db.execute(
                    select(ProviderModel).where(ProviderModel.provider_id == builtin.id, ProviderModel.user_id == None)
                )
                for m in models.scalars().all():
                    db.add(ProviderModel(
                        provider_id=new_prov.id,
                        user_id=user.id,
                        slug=m.slug,
                        display_name=m.display_name,
                        supports_vision=m.supports_vision,
                        is_active=m.is_active,
                    ))
        # migrate default_model
        if user.default_model and not user.default_provider_id:
            parts = user.default_model.split("/")
            if len(parts) >= 2:
                prov_slug = parts[0]
                model_slug = user.default_model
                prov_result = await db.execute(
                    select(Provider).where(Provider.user_id == user.id, Provider.slug == prov_slug)
                )
                prov = prov_result.scalar_one_or_none()
                if not prov:
                    # try builtin
                    prov_result = await db.execute(
                        select(Provider).where(Provider.slug == prov_slug, Provider.is_builtin == True)
                    )
                    prov = prov_result.scalar_one_or_none()
                if prov:
                    mdl_result = await db.execute(
                        select(ProviderModel).where(
                            ProviderModel.provider_id == prov.id,
                            ProviderModel.slug == model_slug
                        )
                    )
                    mdl = mdl_result.scalar_one_or_none()
                    if mdl:
                        user.default_provider_id = prov.id
                        user.default_model_id = mdl.id

    await db.commit()


async def get_user_providers(db: AsyncSession, user_id: int) -> List[Provider]:
    """Return builtins + user-specific providers."""
    result = await db.execute(
        select(Provider).where(
            (Provider.is_builtin == True) | (Provider.user_id == user_id)
        ).order_by(Provider.is_builtin.desc(), Provider.name)
    )
    return result.scalars().all()


async def get_provider(db: AsyncSession, provider_id: int, user_id: int) -> Optional[Provider]:
    result = await db.execute(
        select(Provider).where(
            Provider.id == provider_id,
            (Provider.is_builtin == True) | (Provider.user_id == user_id)
        )
    )
    return result.scalar_one_or_none()


async def get_provider_models(db: AsyncSession, provider_id: int) -> List[ProviderModel]:
    result = await db.execute(
        select(ProviderModel).where(
            ProviderModel.provider_id == provider_id,
            ProviderModel.is_active == True
        ).order_by(ProviderModel.display_name)
    )
    return result.scalars().all()


async def resolve_model_for_request(
    db: AsyncSession, user: User,
    requested_provider_id: Optional[int] = None,
    requested_model_id: Optional[int] = None,
    telegram: bool = False,
) -> dict:
    """Resolve provider and model for a request, falling back to user defaults."""
    provider_id = requested_provider_id
    model_id = requested_model_id

    if telegram:
        if not provider_id:
            provider_id = user.telegram_provider_id
        if not model_id:
            model_id = user.telegram_model_id

    if not provider_id:
        provider_id = user.default_provider_id
    if not model_id:
        model_id = user.default_model_id

    # final fallback: first builtin openai model
    if not provider_id:
        result = await db.execute(
            select(Provider).where(Provider.slug == "openai", Provider.is_builtin == True)
        )
        prov = result.scalar_one_or_none()
        if prov:
            provider_id = prov.id

    if provider_id and not model_id:
        result = await db.execute(
            select(ProviderModel).where(
                ProviderModel.provider_id == provider_id,
                ProviderModel.is_active == True
            ).order_by(ProviderModel.id)
        )
        mdl = result.scalar_one_or_none()
        if mdl:
            model_id = mdl.id

    if not provider_id or not model_id:
        raise ValueError("No provider or model could be resolved")

    prov_result = await db.execute(select(Provider).where(Provider.id == provider_id))
    provider = prov_result.scalar_one_or_none()
    mdl_result = await db.execute(select(ProviderModel).where(ProviderModel.id == model_id))
    model = mdl_result.scalar_one_or_none()

    if not provider or not model:
        raise ValueError("Resolved provider or model not found")

    return {
        "provider": provider,
        "model": model,
        "api_key": decrypt(provider.api_key),
        "base_url": provider.base_url,
    }
