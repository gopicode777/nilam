from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"  # "production" tightens uploads + HSTS
    database_url: str = "sqlite:///./data/nilam.db"  # Postgres: postgresql+psycopg://user:pw@host/db
    data_dir: Path = Path("./data")
    client_origin: str = "http://localhost:5173"
    max_upload_mb: int = 15
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5-5"
    contact_email: str = "admin@example.com"  # sent in User-Agent to OpenStreetMap services (their usage policy)

    @property
    def upload_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def production(self) -> bool:
        return self.env == "production"


settings = Settings()
