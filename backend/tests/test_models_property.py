"""Property-based tests for data model validation.

**Feature: firstaidvox-backend, Property 6: Input validation and sanitization**
**Validates: Requirements 3.1, 3.3, 3.5**
"""

import pytest
from hypothesis import given, strategies as st
from pydantic import ValidationError

from app.models import ChatRequest, Location, HospitalResult, ErrorResponse, FunctionCall, AIResponse


class TestInputValidationProperties:
    """Property-based tests for input validation and sanitization."""

    @given(
        text=st.text(min_size=1, max_size=2000).filter(lambda x: x.strip()),
        latitude=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        longitude=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False)
    )
    def test_valid_chat_request_always_succeeds(self, text: str, latitude: float, longitude: float):
        """For any valid text and coordinates, ChatRequest should validate successfully."""
        location = Location(latitude=latitude, longitude=longitude)
        request = ChatRequest(text=text, location=location)
        
        assert request.text == text
        assert request.location.latitude == latitude
        assert request.location.longitude == longitude

    @given(
        text=st.one_of(
            st.text(max_size=0),  # Empty text
            st.text(min_size=2001),  # Too long text
            st.just("   "),  # Whitespace only
        )
    )
    def test_invalid_text_always_fails(self, text: str):
        """For any invalid text input, ChatRequest validation should fail."""
        with pytest.raises(ValidationError):
            ChatRequest(text=text)

    @given(
        latitude=st.one_of(
            st.floats(max_value=-90.1),  # Below valid range
            st.floats(min_value=90.1),   # Above valid range
            st.just(float('nan')),       # NaN values
            st.just(float('inf')),       # Infinity values
            st.just(float('-inf'))       # Negative infinity
        ).filter(lambda x: x != x or abs(x) == float('inf') or x < -90 or x > 90)
    )
    def test_invalid_latitude_always_fails(self, latitude: float):
        """For any invalid latitude, Location validation should fail."""
        with pytest.raises(ValidationError):
            Location(latitude=latitude, longitude=0.0)

    @given(
        longitude=st.one_of(
            st.floats(max_value=-180.1),  # Below valid range
            st.floats(min_value=180.1),   # Above valid range
            st.just(float('nan')),        # NaN values
            st.just(float('inf')),        # Infinity values
            st.just(float('-inf'))        # Negative infinity
        ).filter(lambda x: x != x or abs(x) == float('inf') or x < -180 or x > 180)
    )
    def test_invalid_longitude_always_fails(self, longitude: float):
        """For any invalid longitude, Location validation should fail."""
        with pytest.raises(ValidationError):
            Location(latitude=0.0, longitude=longitude)

    @given(
        name=st.text(min_size=1),
        address=st.text(min_size=1),
        distance_km=st.floats(min_value=0, allow_nan=False, allow_infinity=False),
        place_id=st.text(min_size=1),
        rating=st.one_of(
            st.none(),
            st.floats(min_value=0, max_value=5, allow_nan=False, allow_infinity=False)
        )
    )
    def test_valid_hospital_result_always_succeeds(self, name: str, address: str, distance_km: float, place_id: str, rating):
        """For any valid hospital data, HospitalResult should validate successfully."""
        hospital = HospitalResult(
            name=name,
            address=address,
            distance_km=distance_km,
            place_id=place_id,
            rating=rating
        )
        
        assert hospital.name == name
        assert hospital.address == address
        assert hospital.distance_km == distance_km
        assert hospital.place_id == place_id
        assert hospital.rating == rating

    @given(
        distance_km=st.floats(max_value=-0.1)  # Negative distances
    )
    def test_negative_distance_always_fails(self, distance_km: float):
        """For any negative distance, HospitalResult validation should fail."""
        with pytest.raises(ValidationError):
            HospitalResult(
                name="Test Hospital",
                address="123 Test St",
                distance_km=distance_km,
                place_id="test_id"
            )

    @given(
        rating=st.floats().filter(lambda x: x < 0 or x > 5 or x != x or abs(x) == float('inf'))
    )
    def test_invalid_rating_always_fails(self, rating: float):
        """For any rating outside 0-5 range, HospitalResult validation should fail."""
        with pytest.raises(ValidationError):
            HospitalResult(
                name="Test Hospital",
                address="123 Test St",
                distance_km=1.0,
                place_id="test_id",
                rating=rating
            )

    @given(
        function_name=st.text(min_size=1),
        parameters=st.dictionaries(
            keys=st.text(min_size=1),
            values=st.one_of(st.text(), st.integers(), st.floats(allow_nan=False, allow_infinity=False))
        )
    )
    def test_valid_function_call_always_succeeds(self, function_name: str, parameters: dict):
        """For any valid function name and parameters, FunctionCall should validate successfully."""
        func_call = FunctionCall(name=function_name, parameters=parameters)
        
        assert func_call.name == function_name
        assert func_call.parameters == parameters

    @given(
        empty_name=st.just("")
    )
    def test_empty_function_name_always_fails(self, empty_name: str):
        """For any empty function name, FunctionCall validation should fail."""
        with pytest.raises(ValidationError):
            FunctionCall(name=empty_name, parameters={})