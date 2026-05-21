from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

# Providers system (NEW)
class Provider(Base):
    __tablename__ = "providers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False)
    base_url = Column(String, nullable=True)
    api_key = Column(String, nullable=True)
    is_builtin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="providers", foreign_keys=[user_id])
    models = relationship("ProviderModel", back_populates="provider", cascade="all, delete")

    __table_args__ = (
        # unique per user; builtins (user_id=NULL) are unique by slug globally
        # handled in application logic since partial unique indexes differ by dialect
    )

class ProviderModel(Base):
    __tablename__ = "provider_models"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    slug = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    supports_vision = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    provider = relationship("Provider", back_populates="models")

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_global = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="projects")
    chats = relationship("Chat", back_populates="project")
    memories = relationship("Memory", back_populates="project")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    telegram_chat_id = Column(String, unique=True, index=True, nullable=True)
    openai_api_key = Column(String, nullable=True)
    anthropic_api_key = Column(String, nullable=True)
    deepseek_api_key = Column(String, nullable=True)
    default_model = Column(String, default="openai/gpt-4o")
    default_provider_id = Column(Integer, ForeignKey("providers.id"), nullable=True)
    default_model_id = Column(Integer, ForeignKey("provider_models.id"), nullable=True)
    telegram_provider_id = Column(Integer, ForeignKey("providers.id"), nullable=True)
    telegram_model_id = Column(Integer, ForeignKey("provider_models.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    chats = relationship("Chat", back_populates="user", cascade="all, delete")
    memories = relationship("Memory", back_populates="user", cascade="all, delete")
    providers = relationship("Provider", back_populates="user", foreign_keys="Provider.user_id")
    projects = relationship("Project", back_populates="user", cascade="all, delete")

class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    provider_id = Column(Integer, ForeignKey("providers.id"), nullable=True)
    model_id = Column(Integer, ForeignKey("provider_models.id"), nullable=True)
    title = Column(String, default="New Chat")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="chats")
    project = relationship("Project", back_populates="chats")
    messages = relationship("Message", back_populates="chat", cascade="all, delete", order_by="Message.created_at")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"))
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    model_used = Column(String, nullable=True)
    tokens_input = Column(Integer, nullable=True)
    tokens_output = Column(Integer, nullable=True)
    files = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    chat = relationship("Chat", back_populates="messages")

class Memory(Base):
    __tablename__ = "memories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    content = Column(Text, nullable=False)
    category = Column(String, default="general")
    importance = Column(Float, default=1.0)
    source = Column(String, default="manual")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="memories")
    project = relationship("Project", back_populates="memories")

class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
