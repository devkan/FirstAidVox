"""
Configuration settings for FirstAidVox Backend.
Handles environment variables and application configuration.
"""

import os
from typing import List, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Google Cloud Configuration
    google_cloud_project_id: str = Field(..., env="GOOGLE_CLOUD_PROJECT_ID")
    google_application_credentials: Optional[str] = Field(
        None, env="GOOGLE_APPLICATION_CREDENTIALS"
    )
    
    # Google Maps API Configuration
    google_maps_api_key: str = Field(..., env="GOOGLE_MAPS_API_KEY")
    
    # Vertex AI Configuration
    vertex_ai_location: str = Field(default="us-central1", env="VERTEX_AI_LOCATION")
    gemini_model_name: str = Field(
        default="gemini-2.0-flash-lite", env="GEMINI_MODEL_NAME"
    )
    
    # Vertex AI Search Configuration
    search_engine_id: str = Field(..., env="SEARCH_ENGINE_ID")
    vertex_search_location: str = Field(default="global", env="VERTEX_SEARCH_LOCATION")
    service_account_key_path: str = Field(default="service-account-key.json", env="SERVICE_ACCOUNT_KEY_PATH")
    
    # Application Configuration
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    environment: str = Field(default="development", env="ENVIRONMENT")
    debug: bool = Field(default=False, env="DEBUG")
    
    # API Configuration
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8080"],
        env="CORS_ORIGINS"
    )
    max_image_size_mb: int = Field(default=10, env="MAX_IMAGE_SIZE_MB")
    request_timeout_seconds: int = Field(default=30, env="REQUEST_TIMEOUT_SECONDS")
    
    # Performance Configuration
    max_concurrent_requests: int = Field(default=100, env="MAX_CONCURRENT_REQUESTS")
    response_time_limit_seconds: int = Field(
        default=3, env="RESPONSE_TIME_LIMIT_SECONDS"
    )
    
    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v):
        """Validate log level is one of the standard levels."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Log level must be one of: {valid_levels}")
        return v.upper()
    
    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v):
        """Validate environment is one of the expected values."""
        valid_envs = ["development", "staging", "production"]
        if v.lower() not in valid_envs:
            raise ValueError(f"Environment must be one of: {valid_envs}")
        return v.lower()
    
    @field_validator("max_image_size_mb")
    @classmethod
    def validate_max_image_size(cls, v):
        """Validate image size limit is reasonable."""
        if v <= 0 or v > 50:
            raise ValueError("Max image size must be between 1 and 50 MB")
        return v
    
    @field_validator("response_time_limit_seconds")
    @classmethod
    def validate_response_time_limit(cls, v):
        """Validate response time limit is reasonable for emergency use."""
        if v <= 0 or v > 10:
            raise ValueError("Response time limit must be between 1 and 10 seconds")
        return v
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance - will be initialized when needed
settings = None


def get_settings() -> Settings:
    """Get the global settings instance, creating it if needed."""
    global settings
    if settings is None:
        settings = Settings()
    return settings