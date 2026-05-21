# Personal Agent

A personal AI agent with web chat interface and Telegram integration. Talk to your agent from anywhere. Built with FastAPI, React, PostgreSQL, and Docker.

## Features

- **Web Chat** — Dark-themed chat interface with streaming responses
- **File Uploads** — Attach files, images, and videos to any message
- **Multi-Model Support** — GPT-4o, Claude 4, DeepSeek V3 (user-configurable API keys)
- **Memory System** — Centralized memory store the agent uses for context. Edit memories manually
- **System Prompt Editor** — Customize how the agent talks (defaults to caveman style)
- **Telegram Bot** — Talk to your agent from mobile via Telegram
- **JWT Auth** — Secure email/password authentication
- **Dockerized** — One-command local dev and production deploy

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   React     │────▶│   Nginx     │────▶│  FastAPI    │
│  Frontend   │     │  (prod)     │     │   Backend   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                                         ┌──────┴──────┐
                                         │  PostgreSQL │
                                         └─────────────┘
```

## Quick Start — Local Development (Docker)

### 1. Clone and configure

```bash
cd personal-agent
cp .env.local .env
# Edit .env and add your API keys
```

### 2. Start everything

```bash
docker compose up --build
```

### 3. Access

- **Web UI**: http://localhost:3001
- **API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs

### 4. First use

1. Open http://localhost:3001
2. Sign up with any email/password
3. Go to **Settings** (gear icon) → add your OpenAI/Anthropic/DeepSeek API key
4. Start chatting!

## Quick Start — Local Development (No Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL locally (or use docker run postgres:16)
# Then:
cp ../.env.local .env
uvicorn src.main:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Production Deployment

### 1. Configure environment

```bash
cp .env.example .env
# Fill in ALL values — especially SECRET_KEY and database password
```

### 2. Deploy

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### 3. Update

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up --build -d
```

### 4. HTTPS (recommended)

Put Nginx or Traefik in front with SSL termination, or use a cloud load balancer.

## Telegram Setup

1. Message [@BotFather](https://t.me/botfather) on Telegram, create a bot, get token
2. Add token to `.env` as `TELEGRAM_BOT_TOKEN`
3. Restart: `docker compose up -d`
4. In Telegram, message your bot: `/link your@email.com`
5. Done — your Telegram account is linked to your web account

## Project Structure

```
personal-agent/
├── backend/
│   ├── src/
│   │   ├── main.py           # FastAPI app
│   │   ├── models.py         # SQLAlchemy models
│   │   ├── auth.py           # JWT auth
│   │   ├── llm.py            # OpenAI/Anthropic/DeepSeek clients
│   │   ├── memory.py         # Memory retrieval
│   │   ├── telegram_bot.py   # Telegram bot handler
│   │   └── routes_*.py       # API routes
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/            # Chat, Login
│   │   ├── components/       # Sidebar, InputBar, MemoryPanel, SettingsPanel
│   │   ├── hooks/            # Auth, UI state
│   │   └── api.js            # API client
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   └── nginx.conf
├── docker-compose.yml        # Local dev
├── docker-compose.prod.yml   # Production
├── .env.local                # Local env template
├── .env.example              # Production env template
└── README.md
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SECRET_KEY` | JWT signing key (change in prod!) | Yes |
| `OPENAI_API_KEY` | OpenAI API key | No |
| `ANTHROPIC_API_KEY` | Anthropic API key | No |
| `DEEPSEEK_API_KEY` | DeepSeek API key | No |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | No |
| `UPLOAD_DIR` | File upload directory | Yes |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT token |
| GET | `/api/auth/me` | Current user |
| GET | `/api/chats` | List chats |
| POST | `/api/chats` | Create chat |
| GET | `/api/chats/{id}` | Get chat with messages |
| POST | `/api/query` | Send message (SSE stream) |
| GET | `/api/memories` | List memories |
| POST | `/api/memories` | Create memory |
| GET | `/api/config/system-prompt` | Get system prompt |
| POST | `/api/config/system-prompt` | Set system prompt |
| POST | `/api/upload` | Upload files |
| GET | `/api/files/{name}` | Download file |

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy (async), PostgreSQL, python-telegram-bot
- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide icons
- **LLMs**: OpenAI GPT-4o, Anthropic Claude 4, DeepSeek V3
- **Infra**: Docker, Docker Compose, Nginx

## License

MIT
