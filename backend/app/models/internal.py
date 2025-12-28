"""Internal models for AI service communication and function calling."""

from typing import Any, Dict, List
from pydantic import BaseModel, Field


class FunctionCall(BaseModel):
    """Represents a function call request from the AI model."""
    
    name: str = Field(
        ...,
        min_length=1,
        description="Name of the function to call"
    )
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Parameters to pass to the function"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "search_hospitals",
                "parameters": {
                    "latitude": 37.7749,
                    "longitude": -122.4194,
                    "radius_km": 10
                }
            }
        }


class AIResponse(BaseModel):
    """Internal model for AI service responses with function calling support."""
    
    text: str = Field(
        ...,
        description="Generated text response from the AI model"
    )
    function_calls: List[FunctionCall] = Field(
        default_factory=list,
        description="List of function calls requested by the AI model"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "Based on your symptoms, I recommend applying direct pressure to stop the bleeding. Let me find nearby hospitals for you.",
                "function_calls": [
                    {
                        "name": "search_hospitals",
                        "parameters": {
                            "latitude": 37.7749,
                            "longitude": -122.4194,
                            "radius_km": 10
                        }
                    }
                ]
            }
        }