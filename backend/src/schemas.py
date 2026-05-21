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

class ChatResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True

class MemoryCreate(BaseModel):
    content: str
    category: str = "general"
    importance: float = 1.0
    source: str = "manual"

class MemoryResponse(BaseModel):
    id: int
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

class ChatQueryRequest(BaseModel):
    message: str
    model: Optional[str] = None
    files: Optional[List[int]] = []

class StreamResponse(BaseModel):
    role: str = "assistant"
    content: str = ""
    done: bool = False
