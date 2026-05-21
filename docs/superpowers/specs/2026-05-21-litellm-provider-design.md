# Sub-project A: LiteLLM + Provider/Model System Design

**Date:** 2026-05-21
**Scope:** Replace ad-hoc LLM providers with LiteLLM, add user-configurable provider/model system with OpenRouter included, cascading dropdowns in chat, and Telegram slash commands.

---

## 1. Database Schema

### 1.1 New Table: `providers`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | Integer | PK | |
| `user_id` | Integer | FK → users.id, nullable | NULL = builtin/static |
| `name` | String | not null | e.g. "OpenAI", "OpenRouter" |
| `slug` | String | not null, unique per user_id | e.g. "openai", "openrouter" |
| `base_url` | String | nullable | e.g. `https://api.openai.com/v1` |
| `api_key` | String | nullable | Encrypted at rest (Fernet) |
| `is_builtin` | Boolean | default=False | Seed providers have is_builtin=True |
| `is_active` | Boolean | default=True | Can toggle off |
| `created_at` | DateTime(timezone=True) | server_default=func.now() | |

**Builtin providers seeded on startup:**
- `openai` — `https://api.openai.com/v1`
- `anthropic` — `https://api.anthropic.com/v1`
- `deepseek` — `https://api.deepseek.com/v1`
- `openrouter` — `https://openrouter.ai/api/v1`

### 1.2 New Table: `provider_models`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | Integer | PK | |
| `provider_id` | Integer | FK → providers.id, cascade delete | |
| `user_id` | Integer | FK → users.id, nullable | NULL = hardcoded default models |
| `slug` | String | not null | Model slug used by LiteLLM |
| `display_name` | String | not null | e.g. "GPT-4o" |
| `supports_vision` | Boolean | default=False | |
| `is_active` | Boolean | default=True | |

**Builtin models seeded per provider:**
- openai: `openai/gpt-4o` (vision), `openai/gpt-4o-mini` (vision)
- anthropic: `anthropic/claude-sonnet-4-20250514` (vision), `anthropic/claude-opus-4-20250514` (vision)
- deepseek: `deepseek/deepseek-chat`
- openrouter: not seeded (user can add from list, see below)

### 1.3 Modified: `users`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `default_provider_id` | Integer | FK → providers.id, nullable | |
| `default_model_id` | Integer | FK → provider_models.id, nullable | Replaces `default_model` string |
| `telegram_provider_id` | Integer | FK → providers.id, nullable | |
| `telegram_model_id` | Integer | FK → provider_models.id, nullable | |

**Deprecate:** `default_model`, `openai_api_key`, `anthropic_api_key`, `deepseek_api_key` — keep columns for migration, mark deprecated.

### 1.4 Modified: `chats`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `provider_id` | Integer | FK → providers.id, nullable | |
| `model_id` | Integer | FK → provider_models.id, nullable | |

---

## 2. Backend Changes

### 2.1 Dependencies

Add to `requirements.txt`:
```
litellm==1.65.0
```

Remove: old 3 custom provider classes (keep file, refactor).

### 2.2 API Key Encryption

Add API key encryption using `cryptography.fernet` with `SECRET_KEY` as base:
```
from cryptography.fernet import Fernet
import hashlib
fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(SECRET_KEY.encode()).digest()[:32].ljust(32, b'0')))
```
Store encrypted, decrypt on read.

### 2.3 New Endpoints

```
GET   /api/providers          → list providers (masked keys)
POST  /api/providers          → add custom provider
PATCH /api/providers/{id}     → update provider (toggle active, update key)
DELETE /api/providers/{id}    → delete custom provider
GET   /api/providers/{id}/models → list models for provider
POST  /api/providers/{id}/models → add custom model to provider
DELETE /api/providers/{id}/models/{model_id} → remove model
GET   /api/models             → all models grouped by provider (public + user custom)
POST  /api/models/refresh     → fetch OpenRouter models list and cache
```

### 2.4 Modified Endpoints

```
POST /api/query
POST /api/chats/{chat_id}/query
```

Request body accepts:
```json
{
  "message": "...",
  "provider_id": 1,     // optional, fallback to user default
  "model_id": 2,        // optional, fallback to user default
  "files": []
}
```

**LiteLLM integration flow:**
```
resolve_provider_and_model(body, user)
→ get provider config (base_url, api_key decrypted)
→ call litellm.acompletion(
     model=f"{provider.slug}/{model.slug}",
     api_key=api_key,
     api_base=provider.base_url,
     messages=messages,
     stream=True
   )
```

### 2.5 OpenRouter Model Discovery

```
POST /api/models/refresh
→ GET https://openrouter.ai/api/v1/models
→ Store in table `provider_models` for provider_id of openrouter
→ Cache for 1 hour (in-memory or Redis later)
```

### 2.6 Migration

On startup (`main.py:startup`):
1. Seed builtins if `providers` empty
2. If user has `openai_api_key` etc, create child providers with those keys
3. Set `default_provider_id`, `default_model_id` from old `default_model` string

---

## 3. Frontend Changes

### 3.1 Mobile-Responsive Strategy

- Current layout: sidebar (14px/256px) + main chat + right panel (settings/memories)
- On mobile (<768px): sidebar collapses to hamburger drawer overlay, right panel becomes bottom sheet
- `InputBar`: full-width with comfortable touch targets (min 44px)
- `ChatPage`: full viewport, model selector moved to sticky header or floating menu
- `SettingsPanel`: full-width drawer on mobile, sidebar on desktop
- Use Tailwind breakpoints: `sm:`, `md:`, `lg:`

### 3.2 New Components

**`ModelSelector`** (used in ChatPage header, mobile floating pill):
- Two cascading dropdowns: Provider ➜ Model
- Dropdowns auto-close on mobile after selection
- Shows active model as compact pill (e.g. "OpenAI / GPT-4o")
- On mobile: expands to full-select modal on click

**`ProviderSettings`** (inside SettingsPanel):
- Table/list of providers
- Each row: name, toggle active, masked api_key input, "show/hide" eye
- "Add Provider" button → modal form (name, slug, base_url, api_key)
- OpenRouter section: "Refresh Models" button, shows count of synced models

**`ProviderModelList`** (sub-component of ProviderSettings):
- List models per provider
- Toggle vision flag
- Custom model add form (slug, display_name)
- Remove custom models (builtins hidden/not removable)

### 3.3 Modified Components

**`SettingsPanel`**:
- Remove old API key inputs
- Add `ProviderSettings` section
- Keep system prompt textarea (Project C will enhance)

**`ChatPage`**:
- Replace single `model` dropdown with `ModelSelector`
- Pass `provider_id` + `model_id` in query body

**`api.js`**:
- Add endpoints for providers/models

---

## 4. Telegram Slash Commands

New commands:
```
/models                    → list all models grouped by provider
/model <provider>/<slug>   → set default model for this user
/provider <provider_slug>  → set default provider (auto-picks first model)
/providers                 → list available providers
```

Store in `users.telegram_provider_id`, `users.telegram_model_id`.
Fallback chain: telegram prefs → user default → first builtin.

---

## 5. Implementation Order

1. **DB schema** — models.py + Alembic migration
2. **Backend core** — provider/model models, encryption, LiteLLM refactor
3. **API routes** — CRUD for providers/models, query migration
4. **OpenRouter** — model discovery endpoint
5. **Frontend components** — SettingsPanel, ModelSelector
6. **Mobile responsiveness** — sidebar/panel/drawer fixes
7. **Telegram commands** — slash handlers
8. **Migration + testing**

---

## Open Questions

- Should we cache OpenRouter models in DB or in-memory? **Decision:** DB for persistence, in-memory TTL for freshness.
- How to handle vision flag when user uploads non-image files? **Decision:** Gate visual model use by file mimetype check, allow any model for docs.
