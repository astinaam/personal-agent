# Sub-project A: LiteLLM + Provider/Model System Design

**Date:** 2026-05-21
**Scope:** Replace ad-hoc LLM providers with LiteLLM, add user-configurable provider/model system with OpenRouter and GitHub Copilot included, cascading dropdowns in chat, and Telegram slash commands.

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
- `copilot` — `https://api.githubcopilot.com` (uses Copilot SDK, not LiteLLM)

### 1.2 New Table: `provider_models`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | Integer | PK | |
| `provider_id` | Integer | FK → providers.id, cascade delete | |
| `user_id` | Integer | FK → users.id, nullable | NULL = hardcoded default models |
| `slug` | String | not null | Model slug used by LiteLLM or Copilot |
| `display_name` | String | not null | e.g. "GPT-4o" |
| `supports_vision` | Boolean | default=False | |
| `is_active` | Boolean | default=True | |

**Builtin models seeded per provider:**
- openai: `openai/gpt-4o` (vision), `openai/gpt-4o-mini` (vision)
- anthropic: `anthropic/claude-sonnet-4-20250514` (vision), `anthropic/claude-opus-4-20250514` (vision)
- deepseek: `deepseek/deepseek-chat`
- openrouter: not seeded (user can add from list, see below)
- copilot: `gpt-4.1` (vision), `claude-sonnet-4` (vision)

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
github-copilot-sdk==0.5.0
```

Remove: old 3 custom provider classes (keep file, refactor).

**Docker/Runtime note for Copilot:** The GitHub Copilot CLI (`copilot`) must be installed in the runtime environment and authenticated. For the Docker image, add a build step that installs the CLI from https://github.com/github/copilot-cli/releases. Authentication can be done via `GITHUB_COPILOT_API_TOKEN` or `GH_TOKEN` env var. In local dev, the user must run `copilot auth login` first.

### 2.2 API Key Encryption

Add API key encryption using `cryptography.fernet` with `SECRET_KEY` as base:
```
from cryptography.fernet import Fernet
import base64, hashlib
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
POST  /api/providers/{id}/test → test provider auth (Copilot: validate token; LiteLLM: test completions call)
```

### 2.4 LLM Provider Router

Two engine paths based on selected provider:

**LiteLLM path** (openai, anthropic, deepseek, openrouter):
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

**Copilot SDK path** (copilot):
```
resolve_provider_and_model(body, user)
→ create CopilotClient() with githubToken from provider.api_key
→ session = client.create_session({ model: model.slug, streaming: true })
→ stream via session.send_and_wait() with delta events
→ session.on(SessionEventType.ASSISTANT_MESSAGE_DELTA, ...) for streaming
```

**Important:** Copilot SDK sessions are stateful. For streaming, use a background task to run the session and emit SSE chunks to the client. Session ID can be persisted to allow resume (`client.resume_session(session_id)`), but for simplicity start with fire-and-forget per-request sessions.

Copilot SDK supports:
- BYOK mode via provider config in session create
- Custom tools (if we add tool calling later)
- MCP servers (future extensibility)
- Session persistence

### 2.5 OpenRouter Model Discovery

```
POST /api/models/refresh
→ GET https://openrouter.ai/api/v1/models
→ Store in table `provider_models` for provider_id of openrouter
→ Cache for 1 hour (in-memory or Redis later)
```

### 2.6 Copilot SDK Integration Details

**Authentication options (priority):**
1. `api_key` on copilot provider record → used as `githubToken` in `CopilotClient`
2. `COPILOT_GITHUB_TOKEN` env var
3. `GH_TOKEN` env var
4. CLI stored credentials (requires `copilot auth login` in container)

**Model slugs for Copilot provider:**
- `gpt-4.1`
- `gpt-4o`
- `claude-sonnet-4`
- `claude-opus-4`

**Copilot BYOK mode** (use own keys through Copilot runtime):
- If user selects a Copilot model but also provides a provider config, Copilot SDK can use BYOK with a `provider` object in `SessionConfig`
- Not required for basic Copilot usage (uses Copilot's own model access)

**Error handling:**
- If Copilot CLI not installed → 503 with message "Copilot CLI not available"
- If not authenticated → 401 with message "GitHub Copilot not authenticated"
- Catch SDK errors and return proper HTTP exceptions

### 2.7 Migration

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
- Copilot provider: shows GitHub icon/badge

**`ProviderSettings`** (inside SettingsPanel):
- Table/list of providers
- Each row: name, toggle active, masked api_key input, "show/hide" eye, "Test Auth" button
- "Add Provider" button → modal form (name, slug, base_url, api_key)
- OpenRouter section: "Refresh Models" button, shows count of synced models
- Copilot row: shows GitHub status, "Test Auth" button, tooltip "Copilot requires GitHub Copilot subscription or CLI auth"

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
2. **Backend core** — provider/model models, encryption, LiteLLM refactor, Copilot SDK adapter
3. **API routes** — CRUD for providers/models, query migration, Copilot test endpoint
4. **OpenRouter** — model discovery endpoint
5. **Frontend components** — SettingsPanel, ModelSelector
6. **Mobile responsiveness** — sidebar/panel/drawer fixes
7. **Telegram commands** — slash handlers
8. **Migration + testing**

---

## Open Questions

- Should we cache OpenRouter models in DB or in-memory? **Decision:** DB for persistence, in-memory TTL for freshness.
- How to handle vision flag when user uploads non-image files? **Decision:** Gate visual model use by file mimetype check, allow any model for docs.
- Copilot SDK `github-copilot-sdk` PyPI package name? **Decision:** use `github-copilot-sdk` or check latest release name at implementation time.
