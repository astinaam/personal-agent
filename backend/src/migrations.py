"""Startup migration — add missing columns to existing tables."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

NEW_COLUMNS = [
    ("users", [
        ("default_provider_id", "INTEGER"),
        ("default_model_id", "INTEGER"),
        ("telegram_provider_id", "INTEGER"),
        ("telegram_model_id", "INTEGER"),
    ]),
    ("chats", [
        ("provider_id", "INTEGER"),
        ("model_id", "INTEGER"),
    ]),
]


async def run_startup_migrations(db: AsyncSession) -> None:
    """Run lightweight startup migrations (add missing columns only)."""
    for table_name, columns in NEW_COLUMNS:
        for col_name, col_type in columns:
            try:
                # Check if column exists by querying it
                await db.execute(text(f"SELECT {col_name} FROM {table_name} LIMIT 0"))
            except Exception:
                # Rollback the aborted transaction from the failed SELECT
                await db.rollback()
                # Column doesn't exist; add it
                await db.execute(text(f'ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}'))
                await db.commit()
    # Also ensure new tables are created (create_all handles this, but in case we missed)
    from .database import engine
    from . import models
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
