"""Error response models for standardized error handling."""

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field, field_serializer


class ErrorResponse(BaseModel):
    """Standardized error response format for all API endpoints."""
    
    error: Dict[str, Any] = Field(
        ...,
        description="Error details containing code, message, and optional details"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Error occurrence timestamp"
    )
    request_id: Optional[str] = Field(
        None,
        description="Request ID for tracking and debugging"
    )
    
    @field_serializer('timestamp')
    def serialize_timestamp(self, dt: datetime) -> str:
        """Serialize datetime to ISO format string."""
        return dt.isoformat() + 'Z'
    
    class Config:
        json_schema_extra = {
            "example": {
                "error": {
                    "code": "INVALID_INPUT",
                    "message": "Image format not supported",
                    "details": {
                        "supported_formats": ["jpg", "png", "webp"],
                        "received_format": "gif"
                    }
                },
                "timestamp": "2024-01-15T10:30:00Z",
                "request_id": "req_123456"
            }
        }