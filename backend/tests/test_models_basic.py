"""Basic unit tests for data models to verify correct instantiation."""

import pytest
from datetime import datetime
from pydantic import ValidationError

from app.models import (
    ChatRequest, ChatResponse, Location, HospitalResult, 
    ErrorResponse, FunctionCall, AIResponse
)


class TestBasicModelInstantiation:
    """Basic tests to verify models can be instantiated correctly."""

    def test_location_creation(self):
        """Test Location model can be created with valid coordinates."""
        location = Location(latitude=37.7749, longitude=-122.4194)
        assert location.latitude == 37.7749
        assert location.longitude == -122.4194

    def test_hospital_result_creation(self):
        """Test HospitalResult model can be created with valid data."""
        hospital = HospitalResult(
            name="Test Hospital",
            address="123 Test St",
            distance_km=2.5,
            place_id="test_place_id",
            rating=4.2
        )
        assert hospital.name == "Test Hospital"
        assert hospital.distance_km == 2.5
        assert hospital.rating == 4.2

    def test_chat_request_creation(self):
        """Test ChatRequest model can be created with valid data."""
        location = Location(latitude=37.7749, longitude=-122.4194)
        request = ChatRequest(
            text="I have a medical emergency",
            location=location
        )
        assert request.text == "I have a medical emergency"
        assert request.location.latitude == 37.7749

    def test_chat_response_creation(self):
        """Test ChatResponse model can be created with valid data."""
        hospital = HospitalResult(
            name="Test Hospital",
            address="123 Test St", 
            distance_km=2.5,
            place_id="test_place_id"
        )
        response = ChatResponse(
            advice="Apply pressure to the wound",
            hospitals=[hospital],
            confidence_level="high"
        )
        assert response.advice == "Apply pressure to the wound"
        assert len(response.hospitals) == 1
        assert response.confidence_level == "high"
        assert isinstance(response.timestamp, datetime)

    def test_function_call_creation(self):
        """Test FunctionCall model can be created with valid data."""
        func_call = FunctionCall(
            name="search_hospitals",
            parameters={"latitude": 37.7749, "longitude": -122.4194}
        )
        assert func_call.name == "search_hospitals"
        assert func_call.parameters["latitude"] == 37.7749

    def test_ai_response_creation(self):
        """Test AIResponse model can be created with valid data."""
        func_call = FunctionCall(name="search_hospitals", parameters={})
        ai_response = AIResponse(
            text="Let me find hospitals for you",
            function_calls=[func_call]
        )
        assert ai_response.text == "Let me find hospitals for you"
        assert len(ai_response.function_calls) == 1

    def test_error_response_creation(self):
        """Test ErrorResponse model can be created with valid data."""
        error_response = ErrorResponse(
            error={
                "code": "INVALID_INPUT",
                "message": "Invalid coordinates",
                "details": {"latitude": "out of range"}
            },
            request_id="req_123"
        )
        assert error_response.error["code"] == "INVALID_INPUT"
        assert error_response.request_id == "req_123"
        assert isinstance(error_response.timestamp, datetime)