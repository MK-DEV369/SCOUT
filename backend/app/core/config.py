from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SCOUT Data Ingestion"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/scout"

    newsapi_key: str | None = None
    freightos_api_key: str | None = None
    world_bank_base_url: str = "https://api.worldbank.org/v2"
    gdelt_base_url: str = "https://api.gdeltproject.org/api/v2/doc/doc"
    acled_base_url: str = "https://api.acleddata.com/acled/read"
    fred_api_key: str | None = None
    event_classifier_model: str = "distilbert-base-uncased-finetuned-sst-2-english"
    summarizer_model: str = "mistralai/Mistral-7B-Instruct-v0.2"
    spacy_model: str = "en_core_web_sm"

    ingestion_interval_minutes: int = 30

    neo4j_uri: str | None = None
    neo4j_user: str | None = None
    neo4j_password: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
