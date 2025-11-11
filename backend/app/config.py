from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/postgres"
    
    # Security
    secret_key: str = "your-secret-key-here"
    debug: bool = True
    
    # API Keys (если понадобятся)
    openai_api_key: Optional[str] = None
    
    class Config:
        env_file = ".env"

settings = Settings()