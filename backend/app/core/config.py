from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SCOUT Data Ingestion"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/scout"

    newsapi_key: str | None = None
    enable_google_news: bool = True
    google_news_query: str = "supply chain OR commodity OR conflict OR logistics"
    google_news_language: str = "en-US"
    google_news_country: str = "US"
    freightos_api_key: str | None = None
    enable_freightos: bool = False
    world_bank_base_url: str = "https://api.worldbank.org/v2"
    gdelt_base_url: str = "https://api.gdeltproject.org/api/v2/doc/doc"
    acled_base_url: str = "https://acleddata.com/api/acled/read"
    acled_auth_url: str = "https://acleddata.com/oauth/token"
    acled_client_id: str = "acled"
    acled_username: str | None = None
    acled_password: str | None = None
    acled_access_token: str | None = None
    fred_api_key: str | None = None
    event_classifier_model: str = "distilbert-base-uncased-finetuned-sst-2-english"
    summarizer_model: str = "mistralai/Mistral-7B-Instruct-v0.2"
    use_llm_summarizer: bool = False
    spacy_model: str = "en_core_web_sm"

    ingestion_interval_minutes: int = 30
    ingestion_connector_timeout_seconds: int = 20
    ingestion_job_timeout_seconds: int = 60
    db_connect_timeout_seconds: int = 5
    ingestion_fallback_path: str = "backend/data/ingestion_fallback.jsonl"

    neo4j_uri: str | None = None
    neo4j_user: str | None = Field(default=None, validation_alias=AliasChoices("NEO4J_USER", "NEO4J_USERNAME"))
    neo4j_password: str | None = None
    neo4j_database: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    def model_post_init(self, __context) -> None:  # type: ignore[override]
        if self.neo4j_uri and self.neo4j_user and self.neo4j_password:
            return

        app_dir = Path(__file__).resolve().parents[1]
        candidates = sorted(app_dir.glob("Neo4j-*.txt"))
        if not candidates:
            return

        content = candidates[0].read_text(encoding="utf-8")
        values: dict[str, str] = {}
        for line in content.splitlines():
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()

        object.__setattr__(self, "neo4j_uri", self.neo4j_uri or values.get("NEO4J_URI"))
        object.__setattr__(
            self,
            "neo4j_user",
            self.neo4j_user or values.get("NEO4J_USER") or values.get("NEO4J_USERNAME"),
        )
        object.__setattr__(self, "neo4j_password", self.neo4j_password or values.get("NEO4J_PASSWORD"))
        object.__setattr__(self, "neo4j_database", self.neo4j_database or values.get("NEO4J_DATABASE"))


settings = Settings()
