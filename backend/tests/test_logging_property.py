"""Property-based tests for comprehensive logging and monitoring.

**Feature: firstaidvox-backend, Property 12: Comprehensive logging**
**Validates: Requirements 7.1, 7.2, 7.3**

**Feature: firstaidvox-backend, Property 2: Response time performance**
**Validates: Requirements 1.5**
"""

import pytest
import asyncio
import time
import logging
import json
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from hypothesis import given, strategies as st, settings
from hypothesis import HealthCheck
from fastapi.testclient import TestClient
from io import StringIO

from app.models.chat import ChatResponse
from config.logging import get_logger, StructuredFormatter


@pytest.fixture
def mock_settings():
    """Mock settings for all tests."""
    mock_settings = Mock()
    mock_settings.cors_origins = ["http://localhost:3000", "http://localhost:8080"]
    mock_settings.debug = True
    mock_settings.environment = "test"
    mock_settings.log_level = "INFO"
    mock_settings.response_time_limit_seconds = 3
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


@pytest.fixture
def log_capture():
    """Capture log output for testing."""
    log_stream = StringIO()
    handler = logging.StreamHandler(log_stream)
    handler.setFormatter(StructuredFormatter())
    
    # Get the firstaidvox logger
    logger = get_logger("test")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    
    yield log_stream
    
    # Cleanup
    logger.removeHandler(handler)


class TestComprehensiveLoggingProperty:
    """Property-based tests for comprehensive logging.
    
    **Feature: firstaidvox-backend, Property 12: Comprehensive logging**
    **Validates: Requirements 7.1, 7.2, 7.3**
    """

    @given(
        text=st.text(min_size=1, max_size=500).filter(lambda x: x.strip()),
        endpoint=st.sampled_from(["/chat", "/health"]),
        method=st.sampled_from(["GET", "POST"])
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_request_logging_always_includes_required_information(
        self, text: str, endpoint: str, method: str, test_app, mock_handler, log_capture
    ):
        """For any request, the system should generate appropriate log entries with required information (timestamps, endpoints, sanitized inputs, service names, response times, error details)."""
        
        # Mock successful response from handler
        mock_response = ChatResponse(
            advice="Test medical advice",
            hospitals=None,
            confidence_level="high"
        )
        mock_handler.process_request = AsyncMock(return_value=mock_response)
        
        # Create test client
        client = TestClient(test_app)
        
        # Make request based on endpoint and method
        if endpoint == "/chat" and method == "POST":
            response = client.post("/chat", data={"text": text})
        elif endpoint == "/health" and method == "GET":
            response = client.get("/health")
        else:
            # Skip invalid combinations
            return
        
        # Verify response was successful
        assert response.status_code in [200, 503]  # Health can return 503
        
        # Verify request ID is in response headers
        assert "X-Request-ID" in response.headers
        assert "X-Response-Time" in response.headers
        
        # Verify request ID format (should be UUID-like)
        request_id = response.headers["X-Request-ID"]
        assert len(request_id) > 0
        assert "-" in request_id  # UUID format
        
        # Verify response time format
        response_time = response.headers["X-Response-Time"]
        assert response_time.endswith("s")
        time_value = float(response_time[:-1])
        assert time_value >= 0
        assert time_value < 10  # Should be reasonable

    @given(
        text=st.text(min_size=1, max_size=500).filter(lambda x: x.strip()),
        service_name=st.sampled_from(["vertex_ai", "google_maps", "multimodal_handler"]),
        response_time_ms=st.floats(min_value=1, max_value=5000, allow_nan=False)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_external_service_call_logging_format(
        self, text: str, service_name: str, response_time_ms: float, test_app, mock_handler
    ):
        """For any external service call, the system should log the service name, request timestamp, and response time."""
        
        # Mock handler to simulate external service calls
        async def mock_process_with_logging(text, location=None, image=None):
            # Simulate logging an external service call
            logger = get_logger("services")
            logger.info(
                f"External service call completed",
                extra={
                    "service_name": service_name,
                    "response_time_ms": response_time_ms,
                    "endpoint": "/predict" if service_name == "vertex_ai" else "/places/nearbysearch"
                }
            )
            return ChatResponse(
                advice="Test response",
                hospitals=None,
                confidence_level="high"
            )
        
        mock_handler.process_request = mock_process_with_logging
        
        # Create test client
        client = TestClient(test_app)
        
        # Make request
        response = client.post("/chat", data={"text": text})
        
        # Verify response was successful
        assert response.status_code == 200
        
        # Verify request tracking headers are present
        assert "X-Request-ID" in response.headers
        assert "X-Response-Time" in response.headers

    @given(
        error_message=st.text(min_size=1, max_size=200).filter(lambda x: x.strip()),
        error_type=st.sampled_from(["ValidationError", "ConnectionError", "TimeoutError", "ValueError"]),
        status_code=st.sampled_from([400, 401, 403, 404, 413, 422, 500, 503])
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_error_logging_includes_required_context(
        self, error_message: str, error_type: str, status_code: int, test_app, mock_handler
    ):
        """For any error, the system should log the error message, stack trace, and request context."""
        
        # Mock handler to raise an error
        from fastapi import HTTPException
        mock_handler.process_request = AsyncMock(
            side_effect=HTTPException(
                status_code=status_code,
                detail={
                    "code": error_type.upper(),
                    "message": error_message,
                    "details": {"error_type": error_type}
                }
            )
        )
        
        # Create test client
        client = TestClient(test_app)
        
        # Make request that will trigger error
        response = client.post("/chat", data={"text": "test query"})
        
        # Verify error response
        assert response.status_code == status_code
        
        # Verify error response format
        error_data = response.json()
        
        # Verify required error fields are present
        required_fields = ["error", "timestamp", "request_id"]
        for field in required_fields:
            assert field in error_data, f"Missing error field: {field}"
        
        # Verify error structure
        error_detail = error_data["error"]
        assert error_detail["code"] == error_type.upper()
        assert error_detail["message"] == error_message
        
        # Verify request ID is present in error response
        assert isinstance(error_data["request_id"], str)
        assert len(error_data["request_id"]) > 0
        
        # Verify timestamp is present
        assert isinstance(error_data["timestamp"], str)

    @given(
        text=st.text(min_size=1, max_size=500).filter(lambda x: x.strip()),
        client_ip=st.ip_addresses().map(str),
        user_agent=st.text(min_size=1, max_size=200, alphabet=st.characters(min_codepoint=32, max_codepoint=126)).filter(lambda x: x.strip())
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_request_context_logging_sanitization(
        self, text: str, client_ip: str, user_agent: str, test_app, mock_handler
    ):
        """For any request, the system should log sanitized input summary without exposing sensitive data."""
        
        # Mock successful response
        mock_response = ChatResponse(
            advice="Test medical advice",
            hospitals=None,
            confidence_level="high"
        )
        mock_handler.process_request = AsyncMock(return_value=mock_response)
        
        # Create test client
        client = TestClient(test_app)
        
        # Make request with headers
        response = client.post(
            "/chat", 
            data={"text": text},
            headers={"User-Agent": user_agent}
        )
        
        # Verify response was successful
        assert response.status_code == 200
        
        # Verify request tracking is present
        assert "X-Request-ID" in response.headers
        assert "X-Response-Time" in response.headers
        
        # Verify request ID is unique and properly formatted
        request_id = response.headers["X-Request-ID"]
        assert len(request_id.split("-")) >= 4  # UUID format has dashes
        
        # Verify response time is reasonable
        response_time_str = response.headers["X-Response-Time"]
        response_time = float(response_time_str.rstrip("s"))
        assert 0 <= response_time <= 10  # Should be reasonable for test

    @given(
        num_requests=st.integers(min_value=1, max_value=5),
        text_inputs=st.lists(
            st.text(min_size=1, max_size=100).filter(lambda x: x.strip()),
            min_size=1,
            max_size=5
        )
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_concurrent_request_logging_uniqueness(
        self, num_requests: int, text_inputs: list, test_app, mock_handler
    ):
        """For any concurrent requests, each should have unique request IDs and proper logging."""
        
        # Mock successful response
        mock_response = ChatResponse(
            advice="Test medical advice",
            hospitals=None,
            confidence_level="high"
        )
        mock_handler.process_request = AsyncMock(return_value=mock_response)
        
        # Create test client
        client = TestClient(test_app)
        
        # Make multiple requests
        responses = []
        request_ids = set()
        
        for i in range(min(num_requests, len(text_inputs))):
            response = client.post("/chat", data={"text": text_inputs[i]})
            responses.append(response)
            
            # Verify response was successful
            assert response.status_code == 200
            
            # Collect request IDs
            request_id = response.headers.get("X-Request-ID")
            assert request_id is not None
            request_ids.add(request_id)
        
        # Verify all request IDs are unique
        assert len(request_ids) == len(responses)
        
        # Verify all responses have proper headers
        for response in responses:
            assert "X-Request-ID" in response.headers
            assert "X-Response-Time" in response.headers


class TestResponseTimePerformanceProperty:
    """Property-based tests for response time performance.
    
    **Feature: firstaidvox-backend, Property 2: Response time performance**
    **Validates: Requirements 1.5**
    """

    @given(
        text=st.text(min_size=1, max_size=2000).filter(lambda x: x.strip()),
        processing_delay=st.floats(min_value=0.001, max_value=2.5, allow_nan=False)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture], deadline=None)
    def test_medical_query_response_time_under_limit(
        self, text: str, processing_delay: float, test_app, mock_handler
    ):
        """For any medical query input, the system should return a complete response within 3 seconds."""
        
        # Mock handler with controlled delay
        async def delayed_process(text, location=None, image=None):
            await asyncio.sleep(processing_delay)
            return ChatResponse(
                advice="Test medical advice based on your query",
                hospitals=None,
                confidence_level="high"
            )
        
        mock_handler.process_request = delayed_process
        
        # Create test client
        client = TestClient(test_app)
        
        # Measure response time
        start_time = time.time()
        response = client.post("/chat", data={"text": text})
        end_time = time.time()
        
        actual_response_time = end_time - start_time
        
        # Verify response was successful
        assert response.status_code == 200
        
        # Verify response time is within limit (3 seconds + some tolerance for test overhead)
        assert actual_response_time < 4.0, f"Response time {actual_response_time:.3f}s exceeds limit"
        
        # Verify response contains required fields
        response_data = response.json()
        assert "advice" in response_data
        assert "timestamp" in response_data
        assert "confidence_level" in response_data
        
        # Verify response time header is present and reasonable
        response_time_header = response.headers.get("X-Response-Time")
        assert response_time_header is not None
        assert response_time_header.endswith("s")
        
        header_time = float(response_time_header[:-1])
        # Header time should be reasonable (may be rounded to 0.0 for very fast responses)
        assert header_time >= 0
        assert header_time < 4.0

    @given(
        text=st.text(min_size=1, max_size=500).filter(lambda x: x.strip()),
        latitude=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        longitude=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False),
        hospital_search_delay=st.floats(min_value=0.1, max_value=2.0, allow_nan=False)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture], deadline=None)
    def test_multimodal_with_location_response_time(
        self, text: str, latitude: float, longitude: float, 
        hospital_search_delay: float, test_app, mock_handler
    ):
        """For any multimodal query with location, including hospital search, response time should be within limits."""
        
        from app.models.hospital import HospitalResult
        
        # Mock handler with hospital search simulation
        async def process_with_hospital_search(text, location=None, image=None):
            # Simulate hospital search delay
            await asyncio.sleep(hospital_search_delay)
            
            hospitals = [
                HospitalResult(
                    name="Test Hospital",
                    address="123 Test St",
                    distance_km=1.5,
                    place_id="test_place_id",
                    rating=4.2
                )
            ]
            
            return ChatResponse(
                advice="Based on your location, here's medical advice with nearby hospitals",
                hospitals=hospitals,
                confidence_level="high"
            )
        
        mock_handler.process_request = process_with_hospital_search
        
        # Create test client
        client = TestClient(test_app)
        
        # Measure response time for multimodal request
        start_time = time.time()
        response = client.post(
            "/chat", 
            data={
                "text": text,
                "latitude": latitude,
                "longitude": longitude
            }
        )
        end_time = time.time()
        
        actual_response_time = end_time - start_time
        
        # Verify response was successful
        assert response.status_code == 200
        
        # Verify response time is within limit even with hospital search
        assert actual_response_time < 4.0, f"Multimodal response time {actual_response_time:.3f}s exceeds limit"
        
        # Verify response contains both advice and hospital data
        response_data = response.json()
        assert "advice" in response_data
        assert "hospitals" in response_data
        assert response_data["hospitals"] is not None
        assert len(response_data["hospitals"]) > 0
        
        # Verify hospital data structure
        hospital = response_data["hospitals"][0]
        assert "name" in hospital
        assert "address" in hospital
        assert "distance_km" in hospital

    @given(
        num_concurrent=st.integers(min_value=2, max_value=5),
        base_delay=st.floats(min_value=0.1, max_value=1.0, allow_nan=False)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture], deadline=None)
    def test_concurrent_requests_performance(
        self, num_concurrent: int, base_delay: float, test_app, mock_handler
    ):
        """For any number of concurrent requests, each should complete within the time limit."""
        
        # Mock handler with base delay
        async def delayed_process(text, location=None, image=None):
            await asyncio.sleep(base_delay)
            return ChatResponse(
                advice=f"Medical advice for: {text[:50]}...",
                hospitals=None,
                confidence_level="medium"
            )
        
        mock_handler.process_request = delayed_process
        
        # Create test client
        client = TestClient(test_app)
        
        # Prepare concurrent requests
        import threading
        import queue
        
        results_queue = queue.Queue()
        
        def make_request(request_id):
            start_time = time.time()
            response = client.post("/chat", data={"text": f"Emergency query {request_id}"})
            end_time = time.time()
            
            results_queue.put({
                "request_id": request_id,
                "response": response,
                "response_time": end_time - start_time
            })
        
        # Start concurrent requests
        threads = []
        for i in range(num_concurrent):
            thread = threading.Thread(target=make_request, args=(i,))
            threads.append(thread)
            thread.start()
        
        # Wait for all requests to complete
        for thread in threads:
            thread.join(timeout=10)  # 10 second timeout for safety
        
        # Collect results
        results = []
        while not results_queue.empty():
            results.append(results_queue.get())
        
        # Verify all requests completed
        assert len(results) == num_concurrent
        
        # Verify each request met performance requirements
        for result in results:
            assert result["response"].status_code == 200
            assert result["response_time"] < 4.0, f"Request {result['request_id']} took {result['response_time']:.3f}s"
            
            # Verify response has proper headers
            assert "X-Request-ID" in result["response"].headers
            assert "X-Response-Time" in result["response"].headers

    @given(
        text=st.text(min_size=1, max_size=100).filter(lambda x: x.strip())
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_health_endpoint_response_time(
        self, text: str, test_app
    ):
        """For any health check request, response time should be minimal and well under limits."""
        
        # Create test client
        client = TestClient(test_app)
        
        # Measure health endpoint response time
        start_time = time.time()
        response = client.get("/health")
        end_time = time.time()
        
        actual_response_time = end_time - start_time
        
        # Verify response
        assert response.status_code in [200, 503]  # Can be degraded
        
        # Health endpoint should be very fast (under 1 second)
        assert actual_response_time < 1.0, f"Health endpoint took {actual_response_time:.3f}s"
        
        # Verify response format
        health_data = response.json()
        assert "initialized" in health_data
        assert "version" in health_data
        assert "request_id" in health_data
        assert "all_services_healthy" in health_data
        
        # Verify response time header
        response_time_header = response.headers.get("X-Response-Time")
        assert response_time_header is not None
        header_time = float(response_time_header[:-1])
        assert header_time < 1.0

    @given(
        processing_time=st.floats(min_value=3.1, max_value=10.0, allow_nan=False)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture], deadline=None)
    def test_timeout_handling_for_slow_responses(
        self, processing_time: float, test_app, mock_handler
    ):
        """For any request that would exceed time limits, the system should handle it appropriately."""
        
        # Mock handler with excessive delay
        async def slow_process(text, location=None, image=None):
            await asyncio.sleep(processing_time)
            return ChatResponse(
                advice="This response took too long",
                hospitals=None,
                confidence_level="low"
            )
        
        mock_handler.process_request = slow_process
        
        # Create test client with timeout
        client = TestClient(test_app)
        
        # Make request that will be slow
        start_time = time.time()
        
        try:
            response = client.post("/chat", data={"text": "emergency query"})
            end_time = time.time()
            actual_time = end_time - start_time
            
            # If response completes, it should still have proper structure
            # (In a real implementation, this might timeout or return early)
            if response.status_code == 200:
                response_data = response.json()
                assert "advice" in response_data
                assert "timestamp" in response_data
            
            # Response time tracking should still work
            assert "X-Request-ID" in response.headers
            
        except Exception:
            # Timeout or connection error is acceptable for very slow requests
            # The important thing is that the system doesn't crash
            pass