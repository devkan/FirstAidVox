"""Location data model for coordinate handling."""

from pydantic import BaseModel, Field


class Location(BaseModel):
    """Location coordinates for hospital search and emergency services."""
    
    latitude: float = Field(
        ..., 
        ge=-90, 
        le=90,
        description="Latitude coordinate in decimal degrees"
    )
    longitude: float = Field(
        ..., 
        ge=-180, 
        le=180,
        description="Longitude coordinate in decimal degrees"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "latitude": 37.7749,
                "longitude": -122.4194
            }
        }