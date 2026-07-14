from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SCOUT"
    port: int = Field(default=8000, validation_alias=AliasChoices("PORT"))
    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/scout",
        validation_alias=AliasChoices("DATABASE_URL")
    )

    newsapi_key: str = Field(default="", validation_alias=AliasChoices("NEWSAPI_KEY"))
    enable_google_news: bool = True
    google_news_query: str = "supply chain OR commodity OR conflict OR logistics"
    google_news_language: str = "en-US"
    google_news_country: str = "US"
    freightos_api_key: str | None = Field(default=None, validation_alias=AliasChoices("FREIGHTOS_API_KEY"))
    enable_freightos: bool = False
    world_bank_base_url: str = "https://api.worldbank.org/v2"
    gdelt_base_url: str = "https://api.gdeltproject.org/api/v2/doc/doc"
    acled_base_url: str = "https://acleddata.com/api/acled/read"
    acled_auth_url: str = "https://acleddata.com/oauth/token"
    acled_client_id: str = "acled"
    acled_username: str | None = Field(default=None, validation_alias=AliasChoices("ACLED_USERNAME"))
    acled_password: str | None = Field(default=None, validation_alias=AliasChoices("ACLED_PASSWORD"))
    acled_access_token: str | None = Field(default=None, validation_alias=AliasChoices("ACLED_ACCESS_TOKEN"))
    fred_api_key: str | None = Field(default=None, validation_alias=AliasChoices("FRED_API_KEY"))
    event_classifier_model: str = "distilbert-base-uncased-finetuned-sst-2-english"
    summarizer_model: str = "mistralai/Mistral-7B-Instruct-v0.2"
    use_llm_summarizer: bool = True
    load_mistral_on_startup: bool = False
    mistral_min_free_vram_mb: int = 12000
    allow_local_4bit_fallback: bool = Field(default=True, validation_alias=AliasChoices("MISTRAL_USE_4BIT"))
    llm_timeout_seconds: float = 20.0
    llm_max_output_tokens: int = 220
    databricks_llm_endpoint: str | None = Field(default=None, validation_alias=AliasChoices("DATABRICKS_LLM_ENDPOINT"))
    gemini_api_key: str | None = Field(default=None, validation_alias=AliasChoices("GEMINI_API_KEY"))
    gemini_model: str = "gemini-1.5-flash"
    spacy_model: str = "en_core_web_sm"
    embedding_model: str = "sentence-transformers/all-mpnet-base-v2"

    ingestion_interval_minutes: int = 15
    nlp_interval_minutes: int = 15
    risk_interval_minutes: int = 15
    ingestion_connector_timeout_seconds: int = 20
    ingestion_job_timeout_seconds: int = 60
    nlp_job_timeout_seconds: int = Field(default=600, validation_alias=AliasChoices("NLP_JOB_TIMEOUT_SECONDS"))
    risk_job_timeout_seconds: int = 120
    db_connect_timeout_seconds: int = 5
    backend_embedding_enabled: bool = True

    databricks_host: str = Field(
        default="https://dbc-d28584e4-22cf.cloud.databricks.com",
        validation_alias=AliasChoices("DATABRICKS_HOST")
    )
    databricks_token: str = Field(default="", validation_alias=AliasChoices("DATABRICKS_TOKEN"))
    databricks_default_job_id: str = Field(
        default="577132949372634",
        validation_alias=AliasChoices("DATABRICKS_DEFAULT_JOB_ID")
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
