# Sub-project B: Workspace/Project Chat System Design

**Date:** 2026-05-21
**Scope:** Add project/workspace-based chat organization with project-scoped memories and a global memory layer.

---

## 1. Database Schema

### 1.1 New Table: `projects`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | Integer | PK | |
| `user_id` | Integer | FK → users.id, cascade delete | |
| `name` | String | not null | e.g. "Work", "Personal", "Global" |
| `slug` | String | not null | URL-safe identifier |
| `description` | String | nullable | |
| `is_global` | Boolean | default=False | One global project per user |
| `created_at` | DateTime(timezone=True) | server_default=func.now() | |

### 1.2 Modified: `chats`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `project_id` | Integer | FK → projects.id, nullable | NULL = orphaned (legacy) |

### 1.3 Modified: `memories`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `project_id` | Integer | FK → projects.id, nullable | NULL = global memory |

---

## 2. Backend Changes

### 2.1 Seeding

On user registration, create a `Global` project with `is_global=True`.
Existing users: create global project on first access if missing.

### 2.2 New Endpoints

```
GET    /api/projects           → list user's projects
POST   /api/projects           → create project
PATCH  /api/projects/{id}      → rename/description
DELETE /api/projects/{id}      → delete project (move chats to global)
GET    /api/projects/{id}/chats → list chats in project
```

### 2.3 Modified Endpoints

```
GET    /api/chats              → filter by project_id param
POST   /api/chats              → accept project_id in body (default to global)
POST   /api/query              → use current chat's project for memory scope
```

### 2.4 Memory Scope Logic

When querying LLM in a project chat:
1. Fetch **global memories** (`project_id IS NULL`)
2. Fetch **project memories** (`project_id == current_project_id`)
3. Combine both in memory context

When adding memory from a project chat, auto-set `project_id`.

---

## 3. Frontend Changes

### 3.1 Sidebar Redesign

Two sections:
```
Projects
  ▼ Global (always first)
  ▶ Work
  ▶ Personal
  + New Project

Chats (of selected project)
  [chat list...]
```

- Click project to expand/collapse and show its chats
- Project selection highlighted
- Mobile: same structure inside drawer

### 3.2 New Components

**`ProjectList`** (in Sidebar):
- List projects
- Create project inline (name input)
- Rename inline on right-click or small edit button
- Delete with confirmation (moves chats to global)

### 3.3 MemoryPanel

Add project filter tabs:
- "All" / "Global" / "Current Project"
- Creating memory in project chat auto-tags to project

### 3.4 ChatPage

- New chat creates in selected project
- If no project selected, defaults to global

---

## 4. Telegram

No changes for Telegram — all Telegram chats go to Global project.

---

## Implementation Order

1. DB schema — models.py + migration
2. Backend routes — projects CRUD, chat filtering
3. Memory scope — query memory context builder
4. Frontend sidebar — project list + chat grouping
5. MemoryPanel — project filter tabs
