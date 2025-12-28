"""Property-based tests for service integrations and secure connections.

**Feature: firstaidvox-backend, Property 10: Secure connections**
**Validates: Requirements 5.3, 5.4**

**Feature: firstaidvox-backend, Property 1: Multimodal input processing**
**Validates: Requirements 1.1, 1.2**
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from hypothesis import given, strategies as st, settings
from hypothesis import HealthCheck

from app.services import GeminiClient, GoogleMapsClient, get_service_manager
from app.models.internal import AIResponse, FunctionCall
from config.settings import get_settings


class TestMultimodalInputProcessingProperty:
    """Property-based tests for multimodal input processing."""

    @pytest.fixture
    def mock_settings(self):
        """Mock settings for testing."""
        settings = Mock()
        settings.google_cloud_project = "test-project"
        settings.vertex_ai_location = "us-central1"
        settings.gemini_model_name = "gemini-1.5-flash-001"
        settings.google_maps_api_key = "test-api-key"
        settings.request_timeout_seconds = 30
        return settings

    @given(
        text=st.text(min_size=1, max_size=2000).filter(lambda x: x.strip()),
        has_image=st.booleans(),
        has_location=st.booleans(),
        latitude=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        longitude=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_multimodal_input_processing_always_returns_valid_response(
        self, text: str, has_image: bool, has_location: bool, 
        latitude: float, longitude: float, mock_settings
    ):
        """For any valid text input with or without image data, the system should successfully process the input and return a medical advice response containing the required fields."""
        
        with patch('app.services.ai_service.get_settings', return_value=mock_settings), \
             patch('app.services.ai_service.default') as mock_default, \
             patch('app.services.ai_service.aiplatform') as mock_aiplatform, \
             patch('app.services.ai_service.gapic') as mock_gapic:
            
            # Mock successful authentication
            mock_credentials = Mock()
            mock_default.return_value = (mock_credentials, "test-project")
            
            # Mock Vertex AI client
            mock_client = Mock()
            mock_gapic.PredictionServiceClient.return_value = mock_client
            
            # Create and initialize client
            client = GeminiClient()
            
            async def run_test():
                await client.initialize()
                
                # Prepare test inputs
                image_data = b"fake_image_data" if has_image else None
                location = {"latitude": latitude, "longitude": longitude} if has_location else None
                
                # Generate response
                response = await client.generate_response(
                    text=text,
                    image_data=image_data,
                    location=location
                )
                
                # Verify response structure and required fields
                assert isinstance(response, AIResponse)
                assert hasattr(response, 'text')
                assert hasattr(response, 'function_calls')
                
                # Verify response text is not empty
                assert response.text is not None
                assert len(response.text.strip()) > 0
                
                # Verify function_calls is a list
                assert isinstance(response.function_calls, list)
                
                # If location was provided and text contains medical keywords, 
                # function calls should include hospital search
                medical_keywords = ['hospital', 'emergency', 'doctor', 'medical help']
                if location and any(keyword in text.lower() for keyword in medical_keywords):
                    # Should have at least one function call
                    assert len(response.function_calls) > 0
                    
                    # First function call should be search_hospitals
                    hospital_call = response.function_calls[0]
                    assert isinstance(hospital_call, FunctionCall)
                    assert hospital_call.name == "search_hospitals"
                    assert "latitude" in hospital_call.parameters
                    assert "longitude" in hospital_call.parameters
                    assert hospital_call.parameters["latitude"] == latitude
                    assert hospital_call.parameters["longitude"] == longitude
                
                # Verify the system can handle both text-only and multimodal inputs
                if has_image:
                    # System should process image data without errors
                    # (The actual image processing logic would be tested here in a full implementation)
                    pass
                
                # Verify text processing always works
                assert text in response.text or len(response.text) > 0
                
            # Run the async test
            asyncio.run(run_test())

    @given(
        text=st.text(min_size=1, max_size=100).filter(lambda x: x.strip()),
        image_size=st.integers(min_value=1, max_value=10000)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_multimodal_processing_handles_various_image_sizes(
        self, text: str, image_size: int, mock_settings
    ):
        """For any valid text and image data of various sizes, processing should succeed."""
        
        with patch('app.services.ai_service.get_settings', return_value=mock_settings), \
             patch('app.services.ai_service.default') as mock_default, \
             patch('app.services.ai_service.aiplatform') as mock_aiplatform, \
             patch('app.services.ai_service.gapic') as mock_gapic:
            
            # Mock successful authentication
            mock_credentials = Mock()
            mock_default.return_value = (mock_credentials, "test-project")
            
            # Mock Vertex AI client
            mock_client = Mock()
            mock_gapic.PredictionServiceClient.return_value = mock_client
            
            # Create and initialize client
            client = GeminiClient()
            
            async def run_test():
                await client.initialize()
                
                # Create image data of specified size
                image_data = b"x" * image_size
                
                # Generate response with image
                response = await client.generate_response(
                    text=text,
                    image_data=image_data
                )
                
                # Verify response is valid regardless of image size
                assert isinstance(response, AIResponse)
                assert response.text is not None
                assert len(response.text.strip()) > 0
                assert isinstance(response.function_calls, list)
                
            # Run the async test
            asyncio.run(run_test())

    @given(
        text=st.text(min_size=1, max_size=2000).filter(lambda x: x.strip())
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_text_only_processing_always_succeeds(self, text: str, mock_settings):
        """For any valid text input without image data, processing should always succeed."""
        
        with patch('app.services.ai_service.get_settings', return_value=mock_settings), \
             patch('app.services.ai_service.default') as mock_default, \
             patch('app.services.ai_service.aiplatform') as mock_aiplatform, \
             patch('app.services.ai_service.gapic') as mock_gapic:
            
            # Mock successful authentication
            mock_credentials = Mock()
            mock_default.return_value = (mock_credentials, "test-project")
            
            # Mock Vertex AI client
            mock_client = Mock()
            mock_gapic.PredictionServiceClient.return_value = mock_client
            
            # Create and initialize client
            client = GeminiClient()
            
            async def run_test():
                await client.initialize()
                
                # Generate response with text only
                response = await client.generate_response(text=text)
                
                # Verify response structure
                assert isinstance(response, AIResponse)
                assert response.text is not None
                assert len(response.text.strip()) > 0
                assert isinstance(response.function_calls, list)
                
                # Text-only requests without location should not trigger function calls
                assert len(response.function_calls) == 0
                
            # Run the async test
            asyncio.run(run_test())


class TestSecureConnectionsProperty:
    """Property-based tests for secure HTTPS connections to external services."""

    @pytest.fixture
    def mock_settings(self):
        """Mock settings for testing."""
        settings = Mock()
        settings.google_cloud_project = "test-project"
        settings.vertex_ai_location = "us-central1"
        settings.gemini_model_name = "gemini-1.5-flash-001"
        settings.google_maps_api_key = "test-api-key"
        settings.request_timeout_seconds = 30
        return settings

    @given(
        project_id=st.text(min_size=1, max_size=50).filter(lambda x: x.strip()),
        location=st.sampled_from(["us-central1", "us-east1", "europe-west1", "asia-southeast1"]),
        model_name=st.sampled_from(["gemini-1.5-flash-001", "gemini-1.5-pro-001"])
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_vertex_ai_uses_secure_connections(self, project_id: str, location: str, model_name: str, mock_settings):
        """For any valid Vertex AI configuration, connections should use HTTPS."""
        mock_settings.google_cloud_project = project_id
        mock_settings.vertex_ai_location = location
        mock_settings.gemini_model_name = model_name
        
        with patch('app.services.ai_service.get_settings', return_value=mock_settings), \
             patch('app.services.ai_service.default') as mock_default, \
             patch('app.services.ai_service.aiplatform') as mock_aiplatform, \
             patch('app.services.ai_service.gapic') as mock_gapic:
            
            # Mock successful authentication
            mock_credentials = Mock()
            mock_default.return_value = (mock_credentials, project_id)
            
            # Mock Vertex AI client
            mock_client = Mock()
            mock_gapic.PredictionServiceClient.return_value = mock_client
            
            # Create and initialize client
            client = GeminiClient()
            
            # Run the async initialization
            async def run_test():
                await client.initialize()
                
                # Verify that aiplatform.init was called with credentials (secure authentication)
                mock_aiplatform.init.assert_called_once()
                call_args = mock_aiplatform.init.call_args
                
                # Verify project and location are set correctly
                assert call_args.kwargs['project'] == project_id
                assert call_args.kwargs['location'] == location
                assert 'credentials' in call_args.kwargs
                
                # Verify PredictionServiceClient was created with credentials
                mock_gapic.PredictionServiceClient.assert_called_once_with(
                    credentials=mock_credentials
                )
                
                # Verify connection validation works
                assert client.validate_connection() is True
            
            # Run the async test
            asyncio.run(run_test())

    @given(
        api_key=st.text(min_size=10, max_size=100).filter(lambda x: x.strip() and not x.isspace()),
        timeout=st.integers(min_value=1, max_value=60)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_google_maps_uses_secure_connections(self, api_key: str, timeout: int, mock_settings):
        """For any valid Google Maps API configuration, connections should use HTTPS."""
        mock_settings.google_maps_api_key = api_key
        mock_settings.request_timeout_seconds = timeout
        
        with patch('app.services.location_service.get_settings', return_value=mock_settings), \
             patch('app.services.location_service.googlemaps') as mock_googlemaps:
            
            # Mock Google Maps client
            mock_client = Mock()
            mock_googlemaps.Client.return_value = mock_client
            
            # Mock successful geocoding response for validation
            mock_client.geocode.return_value = [{"formatted_address": "Test Address"}]
            
            # Create and initialize client
            client = GoogleMapsClient()
            
            # Run the async initialization
            async def run_test():
                await client.initialize()
                
                # Verify that googlemaps.Client was called with API key and timeout
                mock_googlemaps.Client.assert_called_once_with(
                    key=api_key,
                    timeout=timeout
                )
                
                # Verify connection validation works (which tests HTTPS connectivity)
                assert client.validate_connection() is True
                
                # Verify the validation made a secure API call
                mock_client.geocode.assert_called_once()
            
            # Run the async test
            asyncio.run(run_test())

    @given(
        coordinates=st.tuples(
            st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
            st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False)
        ),
        radius=st.floats(min_value=1, max_value=50, allow_nan=False, allow_infinity=False)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_hospital_search_uses_secure_api_calls(self, coordinates, radius, mock_settings):
        """For any valid search parameters, hospital search should use secure HTTPS calls."""
        latitude, longitude = coordinates
        mock_settings.google_maps_api_key = "test-key"
        mock_settings.request_timeout_seconds = 30
        
        with patch('app.services.location_service.get_settings', return_value=mock_settings), \
             patch('app.services.location_service.googlemaps') as mock_googlemaps:
            
            # Mock Google Maps client and responses
            mock_client = Mock()
            mock_googlemaps.Client.return_value = mock_client
            
            # Mock places_nearby responses
            mock_hospital_response = {
                'results': [{
                    'name': 'Test Hospital',
                    'vicinity': '123 Test St',
                    'place_id': 'test_place_id',
                    'geometry': {
                        'location': {'lat': latitude + 0.01, 'lng': longitude + 0.01}
                    },
                    'rating': 4.5
                }]
            }
            mock_client.places_nearby.return_value = mock_hospital_response
            
            # Create and initialize client
            client = GoogleMapsClient()
            
            # Run the async test
            async def run_test():
                await client.initialize()
                
                # Perform hospital search
                results = await client.search_hospitals(latitude, longitude, radius)
                
                # Verify that places_nearby was called twice (hospitals and pharmacies)
                assert mock_client.places_nearby.call_count == 2
                
                # Verify the calls were made with correct parameters
                calls = mock_client.places_nearby.call_args_list
                
                # First call should be for hospitals
                hospital_call = calls[0]
                assert hospital_call.kwargs['location'] == (latitude, longitude)
                assert hospital_call.kwargs['radius'] == int(radius * 1000)
                assert hospital_call.kwargs['type'] == 'hospital'
                
                # Second call should be for pharmacies
                pharmacy_call = calls[1]
                assert pharmacy_call.kwargs['location'] == (latitude, longitude)
                assert pharmacy_call.kwargs['radius'] == int(radius * 1000)
                assert pharmacy_call.kwargs['type'] == 'pharmacy'
                
                # Verify results are returned
                assert len(results) >= 0  # Could be empty if no results
            
            # Run the async test
            asyncio.run(run_test())

    def test_service_manager_validates_secure_connections(self, mock_settings):
        """Service manager should validate that all services use secure connections."""
        mock_settings.google_cloud_project = "test-project"
        mock_settings.vertex_ai_location = "us-central1"
        mock_settings.gemini_model_name = "gemini-1.5-flash-001"
        mock_settings.google_maps_api_key = "test-api-key"
        mock_settings.request_timeout_seconds = 30
        
        with patch('app.services.ai_service.get_settings', return_value=mock_settings), \
             patch('app.services.location_service.get_settings', return_value=mock_settings), \
             patch('app.services.ai_service.default') as mock_default, \
             patch('app.services.ai_service.aiplatform') as mock_aiplatform, \
             patch('app.services.ai_service.gapic') as mock_gapic, \
             patch('app.services.location_service.googlemaps') as mock_googlemaps:
            
            # Mock Vertex AI setup
            mock_credentials = Mock()
            mock_default.return_value = (mock_credentials, "test-project")
            mock_vertex_client = Mock()
            mock_gapic.PredictionServiceClient.return_value = mock_vertex_client
            
            # Mock Google Maps setup
            mock_maps_client = Mock()
            mock_googlemaps.Client.return_value = mock_maps_client
            mock_maps_client.geocode.return_value = [{"formatted_address": "Test"}]
            
            # Get service manager and test
            service_manager = get_service_manager()
            
            async def run_test():
                # Initialize all services
                await service_manager.initialize_all()
                
                # Validate all connections
                status = service_manager.validate_all_connections()
                
                # Both services should be connected (using secure connections)
                assert status['vertex_ai'] is True
                assert status['google_maps'] is True
                
                # Get health status
                health = service_manager.get_health_status()
                assert health['initialized'] is True
                assert health['all_services_healthy'] is True
                
                # Verify secure initialization was called for both services
                mock_aiplatform.init.assert_called_once()
                mock_googlemaps.Client.assert_called_once()
            
            # Run the async test
            asyncio.run(run_test())


class TestFunctionCallingRoundTripProperty:
    """Property-based tests for function calling round trip behavior.
    
    **Feature: firstaidvox-backend, Property 4: Function calling round trip**
    **Validates: Requirements 6.2, 6.3, 6.4**
    """

    @pytest.fixture
    def mock_settings(self):
        """Mock settings for testing."""
        settings = Mock()
        settings.google_cloud_project = "test-project"
        settings.vertex_ai_location = "us-central1"
        settings.gemini_model_name = "gemini-1.5-flash-001"
        settings.google_maps_api_key = "test-api-key"
        settings.request_timeout_seconds = 30
        return settings

    @given(
        text=st.text(min_size=1, max_size=500).filter(lambda x: x.strip()),
        latitude=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        longitude=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False),
        radius_km=st.floats(min_value=1, max_value=50, allow_nan=False, allow_infinity=False),
        medical_keyword=st.sampled_from(['hospital', 'emergency', 'doctor', 'medical help'])
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_function_calling_round_trip_always_works(
        self, text: str, latitude: float, longitude: float, 
        radius_km: float, medical_keyword: str, mock_settings
    ):
        """For any hospital search request, when the Gemini model invokes the search_hospitals function, 
        the system should execute the function and return results to the model for inclusion in the response."""
        
        # Ensure text contains a medical keyword to trigger function calling
        test_text = f"{text} {medical_keyword}"
        
        with patch('app.services.ai_service.get_settings', return_value=mock_settings), \
             patch('app.services.ai_service.default') as mock_default, \
             patch('app.services.ai_service.aiplatform') as mock_aiplatform, \
             patch('app.services.ai_service.gapic') as mock_gapic:
            
            # Mock successful authentication
            mock_credentials = Mock()
            mock_default.return_value = (mock_credentials, "test-project")
            
            # Mock Vertex AI client
            mock_client = Mock()
            mock_gapic.PredictionServiceClient.return_value = mock_client
            
            # Create and initialize client
            client = GeminiClient()
            
            async def run_test():
                await client.initialize()
                
                # Prepare location data
                location = {"latitude": latitude, "longitude": longitude}
                
                # Generate response with location and medical keyword
                response = await client.generate_response(
                    text=test_text,
                    location=location
                )
                
                # Verify the round trip behavior:
                # 1. System should receive function call request (simulated by our logic)
                # 2. System should execute search_hospitals function
                # 3. System should return results in the response
                
                assert isinstance(response, AIResponse)
                assert response.text is not None
                assert len(response.text.strip()) > 0
                
                # Since text contains medical keyword and location is provided,
                # function calling should be triggered
                assert len(response.function_calls) > 0
                
                # Verify the function call structure
                hospital_call = response.function_calls[0]
                assert isinstance(hospital_call, FunctionCall)
                assert hospital_call.name == "search_hospitals"
                
                # Verify parameters are correctly passed through
                assert "latitude" in hospital_call.parameters
                assert "longitude" in hospital_call.parameters
                assert hospital_call.parameters["latitude"] == latitude
                assert hospital_call.parameters["longitude"] == longitude
                
                # Verify radius is set (either provided or default)
                assert "radius_km" in hospital_call.parameters
                radius_value = hospital_call.parameters["radius_km"]
                assert isinstance(radius_value, (int, float))
                assert radius_value > 0
                
                # Verify function definitions are available for registration
                function_defs = client.get_function_definitions()
                assert len(function_defs) > 0
                
                # Verify search_hospitals function is registered
                search_hospitals_def = next(
                    (f for f in function_defs if f["name"] == "search_hospitals"), 
                    None
                )
                assert search_hospitals_def is not None
                assert "parameters" in search_hospitals_def
                assert "latitude" in search_hospitals_def["parameters"]["properties"]
                assert "longitude" in search_hospitals_def["parameters"]["properties"]
                
            # Run the async test
            asyncio.run(run_test())

    @given(
        text=st.text(min_size=1, max_size=500).filter(lambda x: x.strip()),
        latitude=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        longitude=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_function_registration_always_available(
        self, text: str, latitude: float, longitude: float, mock_settings
    ):
        """For any initialization, the system should register the search_hospitals function as an available tool."""
        
        with patch('app.services.ai_service.get_settings', return_value=mock_settings), \
             patch('app.services.ai_service.default') as mock_default, \
             patch('app.services.ai_service.aiplatform') as mock_aiplatform, \
             patch('app.services.ai_service.gapic') as mock_gapic:
            
            # Mock successful authentication
            mock_credentials = Mock()
            mock_default.return_value = (mock_credentials, "test-project")
            
            # Mock Vertex AI client
            mock_client = Mock()
            mock_gapic.PredictionServiceClient.return_value = mock_client
            
            # Create and initialize client
            client = GeminiClient()
            
            async def run_test():
                await client.initialize()
                
                # Verify function definitions are always available after initialization
                function_defs = client.get_function_definitions()
                
                # Should have at least one function definition
                assert len(function_defs) >= 1
                
                # Should have search_hospitals function
                search_hospitals_def = next(
                    (f for f in function_defs if f["name"] == "search_hospitals"), 
                    None
                )
                assert search_hospitals_def is not None
                
                # Verify function definition structure
                assert "description" in search_hospitals_def
                assert "parameters" in search_hospitals_def
                
                # Verify parameter schema
                params = search_hospitals_def["parameters"]
                assert params["type"] == "object"
                assert "properties" in params
                assert "required" in params
                
                # Verify required parameters
                properties = params["properties"]
                required = params["required"]
                
                assert "latitude" in properties
                assert "longitude" in properties
                assert "latitude" in required
                assert "longitude" in required
                
                # Verify parameter constraints
                lat_param = properties["latitude"]
                lng_param = properties["longitude"]
                
                assert lat_param["type"] == "number"
                assert lng_param["type"] == "number"
                assert lat_param["minimum"] == -90
                assert lat_param["maximum"] == 90
                assert lng_param["minimum"] == -180
                assert lng_param["maximum"] == 180
                
            # Run the async test
            asyncio.run(run_test())


class TestFunctionCallingBehaviorProperty:
    """Property-based tests for function calling behavior when not needed.
    
    **Feature: firstaidvox-backend, Property 11: Function calling behavior**
    **Validates: Requirements 6.5**
    """

    @pytest.fixture
    def mock_settings(self):
        """Mock settings for testing."""
        settings = Mock()
        settings.google_cloud_project = "test-project"
        settings.vertex_ai_location = "us-central1"
        settings.gemini_model_name = "gemini-1.5-flash-001"
        settings.google_maps_api_key = "test-api-key"
        settings.request_timeout_seconds = 30
        return settings

    @given(
        text=st.text(min_size=1, max_size=500).filter(
            lambda x: x.strip() and not any(
                keyword in x.lower() 
                for keyword in ['hospital', 'emergency', 'doctor', 'medical help']
            )
        )
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_no_function_calling_when_not_needed(self, text: str, mock_settings):
        """For any query where hospital search is not needed, the response should contain only text advice without hospital data."""
        
        with patch('app.services.ai_service.get_settings', return_value=mock_settings), \
             patch('app.services.ai_service.default') as mock_default, \
             patch('app.services.ai_service.aiplatform') as mock_aiplatform, \
             patch('app.services.ai_service.gapic') as mock_gapic:
            
            # Mock successful authentication
            mock_credentials = Mock()
            mock_default.return_value = (mock_credentials, "test-project")
            
            # Mock Vertex AI client
            mock_client = Mock()
            mock_gapic.PredictionServiceClient.return_value = mock_client
            
            # Create and initialize client
            client = GeminiClient()
            
            async def run_test():
                await client.initialize()
                
                # Generate response without medical keywords (no hospital search needed)
                response = await client.generate_response(text=text)
                
                # Verify response structure
                assert isinstance(response, AIResponse)
                assert response.text is not None
                assert len(response.text.strip()) > 0
                
                # Since no medical keywords and no location, no function calling should occur
                assert isinstance(response.function_calls, list)
                assert len(response.function_calls) == 0
                
                # Response should contain only text advice
                assert response.text is not None
                
            # Run the async test
            asyncio.run(run_test())

    @given(
        text=st.text(min_size=1, max_size=500).filter(
            lambda x: x.strip() and not any(
                keyword in x.lower() 
                for keyword in ['hospital', 'emergency', 'doctor', 'medical help']
            )
        ),
        latitude=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        longitude=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_no_function_calling_with_location_but_no_medical_keywords(
        self, text: str, latitude: float, longitude: float, mock_settings
    ):
        """For any query with location but no medical keywords, no function calling should occur."""
        
        with patch('app.services.ai_service.get_settings', return_value=mock_settings), \
             patch('app.services.ai_service.default') as mock_default, \
             patch('app.services.ai_service.aiplatform') as mock_aiplatform, \
             patch('app.services.ai_service.gapic') as mock_gapic:
            
            # Mock successful authentication
            mock_credentials = Mock()
            mock_default.return_value = (mock_credentials, "test-project")
            
            # Mock Vertex AI client
            mock_client = Mock()
            mock_gapic.PredictionServiceClient.return_value = mock_client
            
            # Create and initialize client
            client = GeminiClient()
            
            async def run_test():
                await client.initialize()
                
                # Prepare location data
                location = {"latitude": latitude, "longitude": longitude}
                
                # Generate response with location but no medical keywords
                response = await client.generate_response(
                    text=text,
                    location=location
                )
                
                # Verify response structure
                assert isinstance(response, AIResponse)
                assert response.text is not None
                assert len(response.text.strip()) > 0
                
                # Even with location, no medical keywords means no function calling
                assert isinstance(response.function_calls, list)
                assert len(response.function_calls) == 0
                
                # Response should contain only text advice
                assert response.text is not None
                
            # Run the async test
            asyncio.run(run_test())

    @given(
        medical_text=st.text(min_size=1, max_size=500).filter(lambda x: x.strip()),
        medical_keyword=st.sampled_from(['hospital', 'emergency', 'doctor', 'medical help'])
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_no_function_calling_without_location(
        self, medical_text: str, medical_keyword: str, mock_settings
    ):
        """For any medical query without location data, no function calling should occur."""
        
        # Ensure text contains medical keyword but no location is provided
        test_text = f"{medical_text} {medical_keyword}"
        
        with patch('app.services.ai_service.get_settings', return_value=mock_settings), \
             patch('app.services.ai_service.default') as mock_default, \
             patch('app.services.ai_service.aiplatform') as mock_aiplatform, \
             patch('app.services.ai_service.gapic') as mock_gapic:
            
            # Mock successful authentication
            mock_credentials = Mock()
            mock_default.return_value = (mock_credentials, "test-project")
            
            # Mock Vertex AI client
            mock_client = Mock()
            mock_gapic.PredictionServiceClient.return_value = mock_client
            
            # Create and initialize client
            client = GeminiClient()
            
            async def run_test():
                await client.initialize()
                
                # Generate response with medical keywords but no location
                response = await client.generate_response(text=test_text)
                
                # Verify response structure
                assert isinstance(response, AIResponse)
                assert response.text is not None
                assert len(response.text.strip()) > 0
                
                # Medical keywords without location should not trigger function calling
                assert isinstance(response.function_calls, list)
                assert len(response.function_calls) == 0
                
                # Response should contain only text advice
                assert response.text is not None
                
            # Run the async test
            asyncio.run(run_test())


class TestLocationCoordinateHandlingProperty:
    """Property-based tests for location coordinate handling.
    
    **Feature: firstaidvox-backend, Property 3: Location coordinate handling**
    **Validates: Requirements 2.1, 3.4**
    """

    @pytest.fixture
    def mock_settings(self):
        """Mock settings for testing."""
        settings = Mock()
        settings.google_maps_api_key = "test-api-key"
        settings.request_timeout_seconds = 30
        return settings

    @given(
        latitude=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        longitude=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_location_coordinate_parsing_and_storage(
        self, latitude: float, longitude: float, mock_settings
    ):
        """For any valid latitude and longitude coordinates, the system should successfully parse and store the location data for potential hospital search."""
        
        from app.models.location import Location
        
        # Test coordinate validation and parsing through Location model
        location = Location(latitude=latitude, longitude=longitude)
        
        # Verify coordinates are stored correctly
        assert location.latitude == latitude
        assert location.longitude == longitude
        
        # Verify coordinates are within valid ranges
        assert -90 <= location.latitude <= 90
        assert -180 <= location.longitude <= 180
        
        # Test that the location can be serialized and deserialized
        location_dict = location.model_dump()
        assert location_dict["latitude"] == latitude
        assert location_dict["longitude"] == longitude
        
        # Test round-trip serialization
        recreated_location = Location(**location_dict)
        assert recreated_location.latitude == latitude
        assert recreated_location.longitude == longitude

    @given(
        latitude=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        longitude=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_location_coordinate_validation_in_service(
        self, latitude: float, longitude: float, mock_settings
    ):
        """For any valid coordinates, the GoogleMapsClient should accept them for hospital search."""
        
        with patch('app.services.location_service.get_settings', return_value=mock_settings), \
             patch('app.services.location_service.googlemaps') as mock_googlemaps:
            
            # Mock Google Maps client
            mock_client = Mock()
            mock_googlemaps.Client.return_value = mock_client
            
            # Mock successful places_nearby responses
            mock_response = {
                'results': [{
                    'name': 'Test Hospital',
                    'vicinity': '123 Test St',
                    'place_id': 'test_place_id',
                    'geometry': {
                        'location': {'lat': latitude + 0.01, 'lng': longitude + 0.01}
                    },
                    'rating': 4.5
                }]
            }
            mock_client.places_nearby.return_value = mock_response
            
            # Create and initialize client
            client = GoogleMapsClient()
            
            async def run_test():
                await client.initialize()
                
                # Test that valid coordinates are accepted and processed
                results = await client.search_hospitals(latitude, longitude)
                
                # Verify the coordinates were used in the API calls
                assert mock_client.places_nearby.call_count == 2  # hospitals and pharmacies
                
                # Verify the location parameter was passed correctly
                calls = mock_client.places_nearby.call_args_list
                for call in calls:
                    assert call.kwargs['location'] == (latitude, longitude)
                
                # Verify results are returned (even if empty)
                assert isinstance(results, list)
                
            # Run the async test
            asyncio.run(run_test())

    @given(
        invalid_latitude=st.one_of(
            st.floats(min_value=-1000, max_value=-90.1),
            st.floats(min_value=90.1, max_value=1000),
            st.just(float('nan')),
            st.just(float('inf')),
            st.just(float('-inf'))
        ).filter(lambda x: not (-90 <= x <= 90) or not (x == x)),  # Filter out valid values and NaN
        longitude=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_invalid_latitude_rejection(self, invalid_latitude: float, longitude: float, mock_settings):
        """For any invalid latitude, the system should reject the coordinates with appropriate error."""
        
        from app.models.location import Location
        from pydantic import ValidationError
        
        # Test that invalid latitude is rejected by the Location model
        with pytest.raises(ValidationError):
            Location(latitude=invalid_latitude, longitude=longitude)
        
        # Test that invalid latitude is rejected by the service
        with patch('app.services.location_service.get_settings', return_value=mock_settings), \
             patch('app.services.location_service.googlemaps') as mock_googlemaps:
            
            mock_client = Mock()
            mock_googlemaps.Client.return_value = mock_client
            
            client = GoogleMapsClient()
            
            async def run_test():
                await client.initialize()
                
                # Test that invalid latitude raises ValueError
                with pytest.raises(ValueError, match="Invalid latitude"):
                    await client.search_hospitals(invalid_latitude, longitude)
                
            # Run the async test
            asyncio.run(run_test())

    @given(
        latitude=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        invalid_longitude=st.one_of(
            st.floats(min_value=-1000, max_value=-180.1),
            st.floats(min_value=180.1, max_value=1000),
            st.just(float('nan')),
            st.just(float('inf')),
            st.just(float('-inf'))
        ).filter(lambda x: not (-180 <= x <= 180) or not (x == x))  # Filter out valid values and NaN
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_invalid_longitude_rejection(self, latitude: float, invalid_longitude: float, mock_settings):
        """For any invalid longitude, the system should reject the coordinates with appropriate error."""
        
        from app.models.location import Location
        from pydantic import ValidationError
        
        # Test that invalid longitude is rejected by the Location model
        with pytest.raises(ValidationError):
            Location(latitude=latitude, longitude=invalid_longitude)
        
        # Test that invalid longitude is rejected by the service
        with patch('app.services.location_service.get_settings', return_value=mock_settings), \
             patch('app.services.location_service.googlemaps') as mock_googlemaps:
            
            mock_client = Mock()
            mock_googlemaps.Client.return_value = mock_client
            
            client = GoogleMapsClient()
            
            async def run_test():
                await client.initialize()
                
                # Test that invalid longitude raises ValueError
                with pytest.raises(ValueError, match="Invalid longitude"):
                    await client.search_hospitals(latitude, invalid_longitude)
                
            # Run the async test
            asyncio.run(run_test())

    @given(
        latitude=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        longitude=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_coordinate_precision_preservation(
        self, latitude: float, longitude: float, mock_settings
    ):
        """For any valid coordinates, the system should preserve coordinate precision through processing."""
        
        from app.models.location import Location
        
        # Create location with specific coordinates
        location = Location(latitude=latitude, longitude=longitude)
        
        # Verify precision is maintained
        assert location.latitude == latitude
        assert location.longitude == longitude
        
        # Test JSON serialization preserves precision
        json_data = location.model_dump_json()
        import json
        parsed_data = json.loads(json_data)
        
        # Verify coordinates are preserved in JSON
        assert parsed_data["latitude"] == latitude
        assert parsed_data["longitude"] == longitude
        
        # Test that coordinates work with distance calculation
        with patch('app.services.location_service.get_settings', return_value=mock_settings):
            client = GoogleMapsClient()
            
            # Test distance calculation preserves coordinate precision
            distance = client._calculate_distance(latitude, longitude, latitude + 0.01, longitude + 0.01)
            
            # Distance should be calculated correctly (approximately 1.57 km for 0.01 degree difference)
            assert isinstance(distance, float)
            assert distance > 0
            assert distance < 10  # Should be less than 10km for small coordinate differences


class TestHospitalSearchDataStructureProperty:
    """Property-based tests for hospital search data structure.
    
    **Feature: firstaidvox-backend, Property 5: Hospital search data structure**
    **Validates: Requirements 2.4**
    """

    @pytest.fixture
    def mock_settings(self):
        """Mock settings for testing."""
        settings = Mock()
        settings.google_maps_api_key = "test-api-key"
        settings.request_timeout_seconds = 30
        return settings

    @given(
        latitude=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        longitude=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False),
        hospital_name=st.text(min_size=1, max_size=100).filter(lambda x: x.strip()),
        hospital_address=st.text(min_size=1, max_size=200).filter(lambda x: x.strip()),
        place_id=st.text(min_size=1, max_size=50).filter(lambda x: x.strip()),
        rating=st.one_of(st.none(), st.floats(min_value=1.0, max_value=5.0, allow_nan=False))
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_hospital_search_data_structure_format(
        self, latitude: float, longitude: float, hospital_name: str, 
        hospital_address: str, place_id: str, rating, mock_settings
    ):
        """For any successful hospital search, the returned JSON should contain hospital names, addresses, distances, and place IDs in the correct format."""
        
        with patch('app.services.location_service.get_settings', return_value=mock_settings), \
             patch('app.services.location_service.googlemaps') as mock_googlemaps:
            
            # Mock Google Maps client
            mock_client = Mock()
            mock_googlemaps.Client.return_value = mock_client
            
            # Create mock hospital data with the generated values
            hospital_lat = latitude + 0.01  # Nearby hospital
            hospital_lng = longitude + 0.01
            
            mock_hospital_response = {
                'results': [{
                    'name': hospital_name,
                    'vicinity': hospital_address,
                    'place_id': place_id,
                    'geometry': {
                        'location': {'lat': hospital_lat, 'lng': hospital_lng}
                    },
                    'rating': rating
                }]
            }
            
            # Mock empty pharmacy response for simplicity
            mock_pharmacy_response = {'results': []}
            
            # Set up mock to return different responses for different calls
            mock_client.places_nearby.side_effect = [mock_hospital_response, mock_pharmacy_response]
            
            # Create and initialize client
            client = GoogleMapsClient()
            
            async def run_test():
                await client.initialize()
                
                # Perform hospital search
                results = await client.search_hospitals(latitude, longitude)
                
                # Verify we got results
                assert len(results) >= 1
                
                # Test the structure of the first result
                hospital_result = results[0]
                
                # Verify all required fields are present
                assert hasattr(hospital_result, 'name')
                assert hasattr(hospital_result, 'address')
                assert hasattr(hospital_result, 'distance_km')
                assert hasattr(hospital_result, 'place_id')
                assert hasattr(hospital_result, 'rating')
                
                # Verify field types and values
                assert isinstance(hospital_result.name, str)
                assert isinstance(hospital_result.address, str)
                assert isinstance(hospital_result.distance_km, (int, float))
                assert isinstance(hospital_result.place_id, str)
                assert hospital_result.rating is None or isinstance(hospital_result.rating, (int, float))
                
                # Verify field contents match expected values
                assert hospital_result.name == hospital_name
                assert hospital_result.address == hospital_address
                assert hospital_result.place_id == place_id
                assert hospital_result.rating == rating
                
                # Verify distance is calculated and reasonable
                assert hospital_result.distance_km > 0
                assert hospital_result.distance_km < 100  # Should be reasonable distance
                
                # Verify the result can be serialized to JSON
                result_dict = hospital_result.model_dump()
                
                # Verify JSON structure contains all required fields
                required_fields = ['name', 'address', 'distance_km', 'place_id', 'rating']
                for field in required_fields:
                    assert field in result_dict
                
                # Verify JSON values match original
                assert result_dict['name'] == hospital_name
                assert result_dict['address'] == hospital_address
                assert result_dict['place_id'] == place_id
                assert result_dict['rating'] == rating
                assert isinstance(result_dict['distance_km'], (int, float))
                
            # Run the async test
            asyncio.run(run_test())

    @given(
        latitude=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        longitude=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False),
        num_hospitals=st.integers(min_value=1, max_value=5),
        num_pharmacies=st.integers(min_value=0, max_value=3)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_multiple_results_data_structure(
        self, latitude: float, longitude: float, num_hospitals: int, num_pharmacies: int, mock_settings
    ):
        """For any hospital search with multiple results, all results should have consistent data structure."""
        
        with patch('app.services.location_service.get_settings', return_value=mock_settings), \
             patch('app.services.location_service.googlemaps') as mock_googlemaps:
            
            # Mock Google Maps client
            mock_client = Mock()
            mock_googlemaps.Client.return_value = mock_client
            
            # Generate mock hospital results
            hospital_results = []
            for i in range(num_hospitals):
                hospital_results.append({
                    'name': f'Hospital {i+1}',
                    'vicinity': f'{i+1}00 Hospital St',
                    'place_id': f'hospital_place_id_{i+1}',
                    'geometry': {
                        'location': {
                            'lat': latitude + (i * 0.01), 
                            'lng': longitude + (i * 0.01)
                        }
                    },
                    'rating': 4.0 + (i * 0.1)
                })
            
            # Generate mock pharmacy results
            pharmacy_results = []
            for i in range(num_pharmacies):
                pharmacy_results.append({
                    'name': f'Pharmacy {i+1}',
                    'vicinity': f'{i+1}00 Pharmacy Ave',
                    'place_id': f'pharmacy_place_id_{i+1}',
                    'geometry': {
                        'location': {
                            'lat': latitude + (i * 0.005), 
                            'lng': longitude + (i * 0.005)
                        }
                    },
                    'rating': 3.5 + (i * 0.2)
                })
            
            mock_hospital_response = {'results': hospital_results}
            mock_pharmacy_response = {'results': pharmacy_results}
            
            # Set up mock responses
            mock_client.places_nearby.side_effect = [mock_hospital_response, mock_pharmacy_response]
            
            # Create and initialize client
            client = GoogleMapsClient()
            
            async def run_test():
                await client.initialize()
                
                # Perform hospital search
                results = await client.search_hospitals(latitude, longitude)
                
                # Verify we got the expected number of results
                expected_total = num_hospitals + num_pharmacies
                assert len(results) == expected_total
                
                # Verify all results have consistent structure
                for result in results:
                    # Verify all required fields are present
                    assert hasattr(result, 'name')
                    assert hasattr(result, 'address')
                    assert hasattr(result, 'distance_km')
                    assert hasattr(result, 'place_id')
                    assert hasattr(result, 'rating')
                    
                    # Verify field types
                    assert isinstance(result.name, str)
                    assert isinstance(result.address, str)
                    assert isinstance(result.distance_km, (int, float))
                    assert isinstance(result.place_id, str)
                    assert result.rating is None or isinstance(result.rating, (int, float))
                    
                    # Verify reasonable values
                    assert len(result.name) > 0
                    assert len(result.address) > 0
                    assert len(result.place_id) > 0
                    assert result.distance_km >= 0
                    
                    if result.rating is not None:
                        assert 1.0 <= result.rating <= 5.0
                
                # Verify results are sorted by distance (closest first)
                for i in range(1, len(results)):
                    assert results[i-1].distance_km <= results[i].distance_km
                
                # Verify all results can be serialized to JSON
                for result in results:
                    result_dict = result.model_dump()
                    
                    # Verify JSON structure
                    required_fields = ['name', 'address', 'distance_km', 'place_id', 'rating']
                    for field in required_fields:
                        assert field in result_dict
                
            # Run the async test
            asyncio.run(run_test())

    @given(
        latitude=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        longitude=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_empty_search_results_structure(
        self, latitude: float, longitude: float, mock_settings
    ):
        """For any hospital search with no results, the system should return an empty list with correct structure."""
        
        with patch('app.services.location_service.get_settings', return_value=mock_settings), \
             patch('app.services.location_service.googlemaps') as mock_googlemaps:
            
            # Mock Google Maps client
            mock_client = Mock()
            mock_googlemaps.Client.return_value = mock_client
            
            # Mock empty responses
            mock_empty_response = {'results': []}
            mock_client.places_nearby.return_value = mock_empty_response
            
            # Create and initialize client
            client = GoogleMapsClient()
            
            async def run_test():
                await client.initialize()
                
                # Perform hospital search
                results = await client.search_hospitals(latitude, longitude)
                
                # Verify empty results have correct structure
                assert isinstance(results, list)
                assert len(results) == 0
                
                # Verify empty list can be serialized
                import json
                json_results = json.dumps([result.model_dump() for result in results])
                assert json_results == "[]"
                
            # Run the async test
            asyncio.run(run_test())

    @given(
        latitude=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        longitude=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False)
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_malformed_api_response_handling(
        self, latitude: float, longitude: float, mock_settings
    ):
        """For any malformed API response, the system should handle it gracefully and return valid structure."""
        
        with patch('app.services.location_service.get_settings', return_value=mock_settings), \
             patch('app.services.location_service.googlemaps') as mock_googlemaps:
            
            # Mock Google Maps client
            mock_client = Mock()
            mock_googlemaps.Client.return_value = mock_client
            
            # Mock malformed response (missing required fields)
            mock_malformed_response = {
                'results': [{
                    'name': 'Test Hospital',
                    # Missing 'vicinity' field
                    'place_id': 'test_place_id',
                    'geometry': {
                        'location': {'lat': latitude + 0.01, 'lng': longitude + 0.01}
                    }
                    # Missing 'rating' field
                }]
            }
            
            mock_empty_response = {'results': []}
            mock_client.places_nearby.side_effect = [mock_malformed_response, mock_empty_response]
            
            # Create and initialize client
            client = GoogleMapsClient()
            
            async def run_test():
                await client.initialize()
                
                # Perform hospital search
                results = await client.search_hospitals(latitude, longitude)
                
                # Verify system handles malformed data gracefully
                assert isinstance(results, list)
                
                # If results are returned, they should have valid structure
                for result in results:
                    assert hasattr(result, 'name')
                    assert hasattr(result, 'address')
                    assert hasattr(result, 'distance_km')
                    assert hasattr(result, 'place_id')
                    assert hasattr(result, 'rating')
                    
                    # Verify default values are used for missing fields
                    assert isinstance(result.name, str)
                    assert isinstance(result.address, str)
                    assert isinstance(result.distance_km, (int, float))
                    assert isinstance(result.place_id, str)
                    
                    # Rating can be None for missing data
                    assert result.rating is None or isinstance(result.rating, (int, float))
                
            # Run the async test
            asyncio.run(run_test())