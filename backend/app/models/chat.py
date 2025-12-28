"""Chat request and response models for the API."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, field_serializer
from fastapi import UploadFile

from .location import Location
from .hospital import HospitalResult


class ChatRequest(BaseModel):
    """Request model for the chat endpoint with multimodal input support."""
    
    text: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Medical query or emergency description"
    )
    
    @field_validator('text')
    @classmethod
    def validate_text_not_empty(cls, v: str) -> str:
        """Ensure text is not empty or whitespace-only."""
        if not v.strip():
            raise ValueError("Text cannot be empty or contain only whitespace")
        return v
    location: Optional[Location] = Field(
        None,
        description="User's current location for hospital search"
    )
    # Note: image field will be handled separately as UploadFile in the endpoint
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "I have a deep cut on my hand that won't stop bleeding",
                "location": {
                    "latitude": 37.7749,
                    "longitude": -122.4194
                }
            }
        }


class ChatResponse(BaseModel):
    """Response model for the chat endpoint with AI advice and optional hospital data."""
    
    advice: str = Field(
        ...,
        min_length=1,
        description="AI-generated medical triage advice"
    )
    hospitals: Optional[List[HospitalResult]] = Field(
        None,
        description="Nearby hospitals if location-based search was performed"
    )
    confidence_level: str = Field(
        ...,
        description="AI confidence level in the provided advice"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Response generation timestamp"
    )
    
    @field_serializer('timestamp')
    def serialize_timestamp(self, dt: datetime) -> str:
        """Serialize datetime to ISO format string."""
        return dt.isoformat() + 'Z'
    
    class Config:
        json_schema_extra = {
            "example": {
                "advice": "Apply direct pressure to the wound with a clean cloth. If bleeding doesn't stop within 10 minutes, seek immediate medical attention.",
                "hospitals": [
                    {
                        "name": "San Francisco General Hospital",
                        "address": "1001 Potrero Ave, San Francisco, CA 94110",
                        "distance_km": 2.5,
                        "place_id": "ChIJd8BlQ2BZwokRAFUEcm_qrcA",
                        "rating": 4.2
                    }
                ],
                "confidence_level": "high",
                "timestamp": "2024-01-15T10:30:00Z"
            }
        }