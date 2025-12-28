"""Data models for FirstAidVox backend."""

from .chat import ChatRequest, ChatResponse
from .location import Location
from .hospital import HospitalResult
from .error import ErrorResponse
from .internal import FunctionCall, AIResponse

__all__ = [
    "ChatRequest",
    "ChatResponse", 
    "Location",
    "HospitalResult",
    "ErrorResponse",
    "FunctionCall",
    "AIResponse",
]