from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserBase(BaseModel):
    email: str
    default_model: str = "openai/gpt-4o"

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserSettings(BaseModel):
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    default_model: Optional[str] = None

class UserResponse(UserBase):
    id: int
    created_at: datetime
    default_model: str

    class Config:
        from_attributes = True

# Provider schemas
class ProviderBase(BaseModel):
    name: str
    slug: str
    base_url: Optional[str] = None
    is_active: bool = True

class ProviderCreate(ProviderBase):
    api_key: Optional[str] = None

class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    is_active: Optional[bool] = None

class ProviderResponse(ProviderBase):
    id: int
    user_id: Optional[int] = None
    is_builtin: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ProviderListResponse(BaseModel):
    items: List[ProviderResponse]

# Provider model schemas
class ModelBase(BaseModel):
    slug: str
    display_name: str
    supports_vision: bool = False
    is_active: bool = True

class ModelCreate(ModelBase):
    pass

class ModelUpdate(BaseModel):
    display_name: Optional[str] = None
    supports_vision: Optional[bool] = None
    is_active: Optional[bool] = None

class ModelResponse(ModelBase):
    id: int
    provider_id: int

    class Config:
        from_attributes = True

class ModelsByProviderResponse(BaseModel):
    provider: ProviderResponse
    models: List[ModelResponse]

class AllModelsResponse(BaseModel):
    items: List[ModelsByProviderResponse]

class FileAttachment(BaseModel):
    filename: str
    mimetype: str
    url: str
    size: int

class MessageCreate(BaseModel):
    content: str
    files: Optional[List[int]] = []

class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    model_used: Optional[str]
    tokens_input: Optional[int]
    tokens_output: Optional[int]
    files: List[Dict]
    created_at: datetime

    class Config:
        from_attributes = True

class ChatCreate(BaseModel):
    title: Optional[str] = "New Chat"
    first_message: Optional[str] = None
    files: Optional[List[int]] = []
    provider_id: Optional[int] = None
    model_id: Optional[int] = None
    project_id: Optional[int] = None

class ChatResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    provider_id: Optional[int] = None
    model_id: Optional[int] = None
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True

class ProjectCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: int
    user_id: int
    name: str
    slug: str
    description: Optional[str] = None
    is_global: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ProjectListResponse(BaseModel):
    items: List[ProjectResponse]

class MemoryCreate(BaseModel):
    content: str
    category: str = "general"
    importance: float = 1.0
    source: str = "manual"
    project_id: Optional[int] = None

class MemoryResponse(BaseModel):
    id: int
    user_id: int
    project_id: Optional[int] = None
    content: str
    category: str
    importance: float
    source: str
    created_at: datetime

    class Config:
        from_attributes = True

class QueryRequest(BaseModel):
    message: str
    model: Optional[str] = None
    chat_id: Optional[int] = None
    files: Optional[List[int]] = []
    provider_id: Optional[int] = None
    model_id: Optional[int] = None

class ChatQueryRequest(BaseModel):
    message: str
    model: Optional[str] = None
    files: Optional[List[int]] = []
    provider_id: Optional[int] = None
    model_id: Optional[int] = None

class StreamResponse(BaseModel):
    role: str = "assistant"
    content: str = ""
    done: bool = False

class SystemPromptUpdate(BaseModel):
    prompt: str
