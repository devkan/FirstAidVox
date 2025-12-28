"""Property-based tests for API endpoints and response formats.

**Feature: firstaidvox-backend, Property 8: API response format consistency**
**Validates: Requirements 4.3**

**Feature: firstaidvox-backend, Property 9: CORS header inclusion**
**Validates: Requirements 4.5**

**Feature: firstaidvox-backend, Property 7: Error handling consistency**
**Validates: Requirements 3.2, 4.4**
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from hypothesis import given, strategies as st, settings
from hypothesis import HealthCheck
from fastapi.testclient import TestClient
from fastapi import UploadFile
import io
import json

from app.models.chat import ChatResponse
from app.models.error import ErrorResponse
from app.models.hospital import HospitalResult


@pytest.fixture
def mock_settings():
    """Mock settings for all tests."""
    mock_settings = Mock()
    mock_settings.cors_origins = ["http://localhost:3000", "http://localhost:8080"]
    mock_settings.debug = True
    mock_settings.environment = "test"
    return mock_settings


@pytest.fixture
def mock_service_manager():
    """Mock service manager for all tests."""
    mock_sm = Mock()
    mock_sm.initialize_all = AsyncMock()
    mock_sm.cleanup = AsyncMock()
    mock_sm.get_health_status.return_value = {
        "initialized": True,
        "services": {
            "vertex_ai": {"connected": True, "service": "Google Cloud Vertex AI", "model": "gemini-1.5-flash-001"},
            "google_maps": {"connected": True, "service": "Google Maps Places API", "features": ["hospital_search", "pharmacy_search"]}
        },
        "all_services_healthy": True
    }
    return mock_sm


@pytest.fixture
def mock_handler():
    """Mock multimodal handler for all tests."""
    return Mock()


@pytest.fixture
def test_app(mock_settings, mock_service_manager, mock_handler):
    """Create a test app with properly mocked dependencies."""
    with patch('config.settings.get_settings', return_value=mock_settings), \
         patch('app.main.get_service_manager', return_value=mock_service_manager), \
         patch('app.main.MultimodalHandler', return_value=mock_handler):
        
        from app.main import create_app
        app = create_app()
        
        # Manually set the app state since lifespan isn't called in tests
        app.state.service_manager = mock_service_manager
        app.state.multimodal_handler = mock_handler
        
        return app


class TestAPIResponseFormatProperty:
    """Property-based tests for API response format consistency.
    
    **Feature: firstaidvox-backend, Property 8: API response format consistency**
    **Validates: Requirements 4.3**
    """

    @given(
        text=st.text(min_size=1, max_size=500).filter(lambda x: x.strip()),
        advice_text=st.text(min_size=10, max_size=1000).filter(lambda x: x.strip()),
        confidence_level=st.sampled_from(["high", "medium", "low"]),
        has_hospitals=st.booleans(),
        num_hospitals=st.integers(min_value=0, max_value=5)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_successful_chat_response_format_consistency(
        self, text: str, advice_text: str, confidence_level: str, 
        has_hospitals: bool, num_hospitals: int, test_app, mock_handler
    ):
        """For any successful chat request, the response should contain AI advice text and optional hospital data in the specified JSON structure."""
        
        # Generate mock hospital data if needed
        hospitals = []
        if has_hospitals and num_hospitals > 0:
            for i in range(num_hospitals):
                hospitals.append(HospitalResult(
                    name=f"Hospital {i+1}",
                    address=f"{i+1}00 Hospital St",
                    distance_km=float(i + 1),
                    place_id=f"place_id_{i+1}",
                    rating=4.0 + (i * 0.1) if i % 2 == 0 else None
                ))
        
        # Mock successful response from handler
        mock_response = ChatResponse(
            advice=advice_text,
            hospitals=hospitals if hospitals else None,
            confidence_level=confidence_level
        )
        mock_handler.process_request = AsyncMock(return_value=mock_response)
        
        # Create test client
        client = TestClient(test_app)
        
        # Make request
        response = client.post(
            "/chat",
            data={"text": text}
        )
        
        # Verify response status
        assert response.status_code == 200
        
        # Verify response format
        response_data = response.json()
        
        # Verify all required fields are present
        required_fields = ["advice", "hospitals", "confidence_level", "timestamp"]
        for field in required_fields:
            assert field in response_data, f"Missing required field: {field}"
        
        # Verify field types and values
        assert isinstance(response_data["advice"], str)
        assert len(response_data["advice"]) > 0
        assert response_data["advice"] == advice_text
        
        assert response_data["confidence_level"] in ["high", "medium", "low"]
        assert response_data["confidence_level"] == confidence_level
        
        assert isinstance(response_data["timestamp"], str)
        
        # Verify hospital data structure
        if has_hospitals and num_hospitals > 0:
            assert response_data["hospitals"] is not None
            assert isinstance(response_data["hospitals"], list)
            assert len(response_data["hospitals"]) == num_hospitals
            
            for i, hospital in enumerate(response_data["hospitals"]):
                # Verify hospital structure
                hospital_fields = ["name", "address", "distance_km", "place_id", "rating"]
                for field in hospital_fields:
                    assert field in hospital, f"Missing hospital field: {field}"
                
                # Verify hospital field types
                assert isinstance(hospital["name"], str)
                assert isinstance(hospital["address"], str)
                assert isinstance(hospital["distance_km"], (int, float))
                assert isinstance(hospital["place_id"], str)
                assert hospital["rating"] is None or isinstance(hospital["rating"], (int, float))
                
                # Verify hospital field values
                assert hospital["name"] == f"Hospital {i+1}"
                assert hospital["address"] == f"{i+1}00 Hospital St"
                assert hospital["distance_km"] == float(i + 1)
                assert hospital["place_id"] == f"place_id_{i+1}"
        else:
            assert response_data["hospitals"] is None
        
        # Verify response can be parsed as valid JSON
        json_str = json.dumps(response_data)
        parsed_back = json.loads(json_str)
        assert parsed_back == response_data


class TestCORSHeaderProperty:
    """Property-based tests for CORS header inclusion.
    
    **Feature: firstaidvox-backend, Property 9: CORS header inclusion**
    **Validates: Requirements 4.5**
    """

    @given(
        text=st.text(min_size=1, max_size=500).filter(lambda x: x.strip()),
        origin=st.sampled_from([
            "http://localhost:3000",
            "http://localhost:8080"
        ])
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_cors_headers_included_in_chat_responses(
        self, text: str, origin: str, test_app, mock_handler
    ):
        """For any API endpoint response, CORS headers should be included to support web client applications."""
        
        # Mock successful response
        mock_response = ChatResponse(
            advice="Test medical advice",
            hospitals=None,
            confidence_level="high"
        )
        mock_handler.process_request = AsyncMock(return_value=mock_response)
        
        # Create test client
        client = TestClient(test_app)
        
        # Make request with Origin header
        response = client.post(
            "/chat",
            data={"text": text},
            headers={"Origin": origin}
        )
        
        # Verify response status
        assert response.status_code == 200
        
        # Verify CORS headers are present
        cors_headers = [
            "access-control-allow-origin",
            "access-control-allow-credentials"
        ]
        
        for header in cors_headers:
            assert header in response.headers, f"Missing CORS header: {header}"
        
        # Verify CORS header values
        assert response.headers["access-control-allow-credentials"] == "true"
        
        # Verify origin is allowed (should match the request origin or be *)
        allowed_origin = response.headers["access-control-allow-origin"]
        assert allowed_origin == origin or allowed_origin == "*"

    @given(
        method=st.sampled_from(["GET", "OPTIONS"]),
        origin=st.sampled_from([
            "http://localhost:3000",
            "http://localhost:8080"
        ])
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_cors_headers_included_in_health_responses(
        self, method: str, origin: str, test_app
    ):
        """For any health endpoint response, CORS headers should be included."""
        
        # Create test client
        client = TestClient(test_app)
        
        # Make request to health endpoint
        if method == "GET":
            response = client.get("/health", headers={"Origin": origin})
        else:  # OPTIONS
            response = client.options("/health", headers={"Origin": origin})
        
        # Verify CORS headers are present regardless of method or response status
        cors_headers = [
            "access-control-allow-origin",
            "access-control-allow-credentials"
        ]
        
        for header in cors_headers:
            assert header in response.headers, f"Missing CORS header: {header} for method {method}"


class TestErrorHandlingConsistencyProperty:
    """Property-based tests for error handling consistency.
    
    **Feature: firstaidvox-backend, Property 7: Error handling consistency**
    **Validates: Requirements 3.2, 4.4**
    """

    @given(
        invalid_text=st.one_of(
            st.just(""),  # Empty text
            st.just("   "),  # Whitespace only
            st.text(min_size=2001, max_size=3000)  # Too long
        ),
        error_code=st.sampled_from(["EMPTY_TEXT", "TEXT_TOO_LONG", "INVALID_TEXT"])
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_input_validation_error_format_consistency(
        self, invalid_text: str, error_code: str, test_app, mock_handler
    ):
        """For any invalid input or system error, the system should return a JSON error response with appropriate HTTP status codes and clear error messages."""
        
        # Mock validation error from handler
        from fastapi import HTTPException
        mock_handler.process_request = AsyncMock(
            side_effect=HTTPException(
                status_code=400,
                detail={
                    "code": error_code,
                    "message": "Input validation failed",
                    "details": {"field": "text"}
                }
            )
        )
        
        # Create test client
        client = TestClient(test_app)
        
        # Make request with invalid input
        response = client.post(
            "/chat",
            data={"text": invalid_text}
        )
        
        # Verify error response status
        assert response.status_code == 400
        
        # Verify error response format
        error_data = response.json()
        
        # Verify required error fields
        required_fields = ["error", "timestamp", "request_id"]
        for field in required_fields:
            assert field in error_data, f"Missing error field: {field}"
        
        # Verify error structure
        error_detail = error_data["error"]
        assert isinstance(error_detail, dict)
        
        error_required_fields = ["code", "message", "details"]
        for field in error_required_fields:
            assert field in error_detail, f"Missing error detail field: {field}"
        
        # Verify error field types
        assert isinstance(error_detail["code"], str)
        assert isinstance(error_detail["message"], str)
        assert isinstance(error_detail["details"], dict)
        
        # Verify timestamp format (should be string now due to serializer)
        assert isinstance(error_data["timestamp"], str)
        
        # Verify request ID is present
        assert isinstance(error_data["request_id"], str)
        assert len(error_data["request_id"]) > 0

    @given(
        status_code=st.sampled_from([400, 401, 403, 404, 413, 422, 500, 503]),
        error_message=st.text(min_size=1, max_size=200).filter(lambda x: x.strip())
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_various_error_status_codes_format_consistency(
        self, status_code: int, error_message: str, test_app, mock_handler
    ):
        """For any error status code, the error response format should be consistent."""
        
        # Mock different types of errors
        from fastapi import HTTPException
        mock_handler.process_request = AsyncMock(
            side_effect=HTTPException(
                status_code=status_code,
                detail={
                    "code": f"ERROR_{status_code}",
                    "message": error_message,
                    "details": {}
                }
            )
        )
        
        # Create test client
        client = TestClient(test_app)
        
        # Make request that triggers error
        response = client.post(
            "/chat",
            data={"text": "test query"}
        )
        
        # Verify error response status matches expected
        assert response.status_code == status_code
        
        # Verify consistent error format regardless of status code
        error_data = response.json()
        
        # Verify standard error structure
        required_fields = ["error", "timestamp", "request_id"]
        for field in required_fields:
            assert field in error_data
        
        error_detail = error_data["error"]
        assert error_detail["code"] == f"ERROR_{status_code}"
        assert error_detail["message"] == error_message
        assert isinstance(error_detail["details"], dict)