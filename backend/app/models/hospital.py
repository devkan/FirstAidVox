"""Hospital search result data model."""

from typing import Optional
from pydantic import BaseModel, Field


class HospitalResult(BaseModel):
    """Hospital or pharmacy search result from Google Maps Places API."""
    
    name: str = Field(
        ...,
        min_length=1,
        description="Name of the hospital or pharmacy"
    )
    address: str = Field(
        ...,
        min_length=1,
        description="Full address of the facility"
    )
    distance_km: float = Field(
        ...,
        ge=0,
        description="Distance from user location in kilometers"
    )
    place_id: str = Field(
        ...,
        min_length=1,
        description="Google Maps Place ID for the facility"
    )
    rating: Optional[float] = Field(
        None,
        ge=0,
        le=5,
        description="Google Maps rating (0-5 stars)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "San Francisco General Hospital",
                "address": "1001 Potrero Ave, San Francisco, CA 94110",
                "distance_km": 2.5,
                "place_id": "ChIJd8BlQ2BZwokRAFUEcm_qrcA",
                "rating": 4.2
            }
        }