"""Unit tests for application startup configuration and service initialization.

Tests service initialization, credential validation, configuration loading, 
and environment variable handling.

Requirements: 5.1, 5.2, 5.5, 6.1
"""

import pytest
import asyncio
import os
from unittest.mock import Mock, patch, AsyncMock
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.testclient import TestClient

# Set required environment variables before importing app modules
os.environ.setdefault('GOOGLE_CLOUD_PROJECT', 'test-project')
os.environ.setdefault('GOOGLE_MAPS_API_KEY', 'test-api-key')

from app.main import create_app, lifespan
from app.services.service_manager import ServiceManager, get_service_manager
from config.settings import Settings, get_settings


class TestApplicationStartupConfiguration:
    """Unit tests for application startup and configuration."""

    def test_create_app_returns_fastapi_instance(self):
        """Test that create_app returns a properly configured FastAPI instance."""
        with patch('app.main.get_settings') as mock_get_settings:
            # Mock settings
            mock_settings = Mock()
            mock_settings.debug = False
            mock_settings.cors_origins = ["http://localhost:3000"]
            mock_get_settings.return_value = mock_settings
            
            # Create app
            app = create_app()
            
            # Verify it's a FastAPI instance
            assert isinstance(app, FastAPI)
            assert app.title == "FirstAidVox Backend"
            assert app.description == "Emergency medical triage system with AI-powered multimodal analysis"
            assert app.version == "1.0.0"

    def test_create_app_configures_cors_middleware(self):
        """Test that CORS middleware is properly configured."""
        with patch('app.main.get_settings') as mock_get_settings:
            # Mock settings with specific CORS origins
            mock_settings = Mock()
            mock_settings.debug = False
            mock_settings.cors_origins = ["http://localhost:3000", "https://example.com"]
            mock_get_settings.return_value = mock_settings
            
            # Create app
            app = create_app()
            
            # Verify CORS middleware is added (check middleware stack)
            # FastAPI stores middleware differently, check if CORSMiddleware was added
            middleware_found = False
            for middleware in app.user_middleware:
                if hasattr(middleware, 'cls'):
                    from fastapi.middleware.cors import CORSMiddleware
                    if middleware.cls == CORSMiddleware:
                        middleware_found = True
                        break
            
            assert middleware_found, "CORS middleware not found in app middleware stack"

    def test_create_app_debug_mode_enables_docs(self):
        """Test that debug mode enables API documentation endpoints."""
        with patch('app.main.get_settings') as mock_get_settings:
            # Mock settings with debug enabled
            mock_settings = Mock()
            mock_settings.debug = True
            mock_settings.cors_origins = ["http://localhost:3000"]
            mock_get_settings.return_value = mock_settings
            
            # Create app
            app = create_app()
            
            # Verify docs are enabled in debug mode
            assert app.docs_url == "/docs"
            assert app.redoc_url == "/redoc"

    def test_create_app_production_mode_disables_docs(self):
        """Test that production mode disables API documentation endpoints."""
        with patch('app.main.get_settings') as mock_get_settings:
            # Mock settings with debug disabled
            mock_settings = Mock()
            mock_settings.debug = False
            mock_settings.cors_origins = ["http://localhost:3000"]
            mock_get_settings.return_value = mock_settings
            
            # Create app
            app = create_app()
            
            # Verify docs are disabled in production mode
            assert app.docs_url is None
            assert app.redoc_url is None

    @pytest.mark.asyncio
    async def test_lifespan_startup_initializes_services(self):
        """Test that lifespan startup properly initializes all services."""
        with patch('app.main.get_service_manager') as mock_get_service_manager, \
             patch('app.main.MultimodalHandler') as mock_multimodal_handler:
            
            # Mock service manager
            mock_service_manager = Mock()
            mock_service_manager.initialize_all = AsyncMock()
            mock_service_manager.cleanup = AsyncMock()
            mock_service_manager.gemini_client = Mock()
            mock_service_manager.maps_client = Mock()
            mock_get_service_manager.return_value = mock_service_manager
            
            # Mock multimodal handler
            mock_handler = Mock()
            mock_multimodal_handler.return_value = mock_handler
            
            # Create a test app
            app = FastAPI()
            
            # Test lifespan startup
            async with lifespan(app):
                # Verify service manager initialization was called
                mock_service_manager.initialize_all.assert_called_once()
                
                # Verify service manager is stored in app state
                assert hasattr(app.state, 'service_manager')
                assert app.state.service_manager == mock_service_manager
                
                # Verify multimodal handler is created and stored
                assert hasattr(app.state, 'multimodal_handler')
                assert app.state.multimodal_handler == mock_handler
                
                # Verify multimodal handler was created with correct clients
                mock_multimodal_handler.assert_called_once_with(
                    ai_client=mock_service_manager.gemini_client,
                    location_client=mock_service_manager.maps_client
                )
            
            # Verify cleanup was called during shutdown
            mock_service_manager.cleanup.assert_called_once()

    @pytest.mark.asyncio
    async def test_lifespan_startup_handles_initialization_failure(self):
        """Test that lifespan startup handles service initialization failures."""
        with patch('app.main.get_service_manager') as mock_get_service_manager:
            
            # Mock service manager that fails initialization
            mock_service_manager = Mock()
            mock_service_manager.initialize_all = AsyncMock(side_effect=Exception("Service init failed"))
            mock_service_manager.cleanup = AsyncMock()
            mock_get_service_manager.return_value = mock_service_manager
            
            # Create a test app
            app = FastAPI()
            
            # Test that initialization failure raises exception
            with pytest.raises(Exception, match="Service init failed"):
                async with lifespan(app):
                    pass
            
            # In the current implementation, cleanup is NOT called during startup failure
            # Only during shutdown. This is actually correct behavior - if startup fails,
            # there's nothing to clean up yet.
            mock_service_manager.cleanup.assert_not_called()

    @pytest.mark.asyncio
    async def test_lifespan_shutdown_handles_cleanup_errors(self):
        """Test that lifespan shutdown handles cleanup errors gracefully."""
        with patch('app.main.get_service_manager') as mock_get_service_manager, \
             patch('app.main.MultimodalHandler') as mock_multimodal_handler:
            
            # Mock service manager
            mock_service_manager = Mock()
            mock_service_manager.initialize_all = AsyncMock()
            mock_service_manager.cleanup = AsyncMock(side_effect=Exception("Cleanup failed"))
            mock_service_manager.gemini_client = Mock()
            mock_service_manager.maps_client = Mock()
            mock_get_service_manager.return_value = mock_service_manager
            
            # Mock multimodal handler
            mock_handler = Mock()
            mock_multimodal_handler.return_value = mock_handler
            
            # Create a test app
            app = FastAPI()
            
            # Test that cleanup errors don't prevent shutdown
            async with lifespan(app):
                pass  # Startup should succeed
            
            # Verify cleanup was attempted
            mock_service_manager.cleanup.assert_called_once()


class TestServiceManagerInitialization:
    """Unit tests for service manager initialization and validation."""

    @pytest.mark.asyncio
    async def test_service_manager_initialize_all_success(self):
        """Test successful initialization of all services."""
        with patch('app.services.service_manager.GeminiClient') as mock_gemini_client, \
             patch('app.services.service_manager.GoogleMapsClient') as mock_maps_client:
            
            # Mock clients
            mock_gemini = Mock()
            mock_gemini.initialize = AsyncMock()
            mock_gemini_client.return_value = mock_gemini
            
            mock_maps = Mock()
            mock_maps.initialize = AsyncMock()
            mock_maps_client.return_value = mock_maps
            
            # Create service manager
            service_manager = ServiceManager()
            
            # Test initialization
            await service_manager.initialize_all()
            
            # Verify both clients were initialized
            mock_gemini.initialize.assert_called_once()
            mock_maps.initialize.assert_called_once()
            
            # Verify initialization flag is set
            assert service_manager._initialized is True

    @pytest.mark.asyncio
    async def test_service_manager_initialize_handles_gemini_failure(self):
        """Test that service manager handles Gemini client initialization failure."""
        with patch('app.services.service_manager.GeminiClient') as mock_gemini_client, \
             patch('app.services.service_manager.GoogleMapsClient') as mock_maps_client:
            
            # Mock Gemini client that fails
            mock_gemini = Mock()
            mock_gemini.initialize = AsyncMock(side_effect=Exception("Gemini init failed"))
            mock_gemini_client.return_value = mock_gemini
            
            # Mock Maps client
            mock_maps = Mock()
            mock_maps.initialize = AsyncMock()
            mock_maps_client.return_value = mock_maps
            
            # Create service manager
            service_manager = ServiceManager()
            
            # Test that initialization failure raises ConnectionError
            with pytest.raises(ConnectionError, match="Service initialization failed"):
                await service_manager.initialize_all()
            
            # Verify initialization flag is not set
            assert service_manager._initialized is False

    @pytest.mark.asyncio
    async def test_service_manager_initialize_handles_maps_failure(self):
        """Test that service manager handles Google Maps client initialization failure."""
        with patch('app.services.service_manager.GeminiClient') as mock_gemini_client, \
             patch('app.services.service_manager.GoogleMapsClient') as mock_maps_client:
            
            # Mock Gemini client
            mock_gemini = Mock()
            mock_gemini.initialize = AsyncMock()
            mock_gemini_client.return_value = mock_gemini
            
            # Mock Maps client that fails
            mock_maps = Mock()
            mock_maps.initialize = AsyncMock(side_effect=Exception("Maps init failed"))
            mock_maps_client.return_value = mock_maps
            
            # Create service manager
            service_manager = ServiceManager()
            
            # Test that initialization failure raises ConnectionError
            with pytest.raises(ConnectionError, match="Service initialization failed"):
                await service_manager.initialize_all()
            
            # Verify initialization flag is not set
            assert service_manager._initialized is False

    def test_service_manager_validate_connections_when_not_initialized(self):
        """Test connection validation when services are not initialized."""
        with patch('app.services.service_manager.GeminiClient') as mock_gemini_client, \
             patch('app.services.service_manager.GoogleMapsClient') as mock_maps_client:
            
            # Create service manager (not initialized)
            service_manager = ServiceManager()
            
            # Test validation
            status = service_manager.validate_all_connections()
            
            # Verify all services report as disconnected
            assert status == {
                "vertex_ai": False,
                "google_maps": False
            }

    def test_service_manager_validate_connections_when_initialized(self):
        """Test connection validation when services are initialized."""
        with patch('app.services.service_manager.GeminiClient') as mock_gemini_client, \
             patch('app.services.service_manager.GoogleMapsClient') as mock_maps_client:
            
            # Mock clients with validation methods
            mock_gemini = Mock()
            mock_gemini.validate_connection.return_value = True
            mock_gemini_client.return_value = mock_gemini
            
            mock_maps = Mock()
            mock_maps.validate_connection.return_value = True
            mock_maps_client.return_value = mock_maps
            
            # Create service manager and mark as initialized
            service_manager = ServiceManager()
            service_manager._initialized = True
            
            # Test validation
            status = service_manager.validate_all_connections()
            
            # Verify validation methods were called
            mock_gemini.validate_connection.assert_called_once()
            mock_maps.validate_connection.assert_called_once()
            
            # Verify all services report as connected
            assert status == {
                "vertex_ai": True,
                "google_maps": True
            }

    def test_service_manager_get_health_status(self):
        """Test health status reporting."""
        with patch('app.services.service_manager.GeminiClient') as mock_gemini_client, \
             patch('app.services.service_manager.GoogleMapsClient') as mock_maps_client:
            
            # Mock clients with validation methods
            mock_gemini = Mock()
            mock_gemini.validate_connection.return_value = True
            mock_gemini_client.return_value = mock_gemini
            
            mock_maps = Mock()
            mock_maps.validate_connection.return_value = False  # Simulate Maps failure
            mock_maps_client.return_value = mock_maps
            
            # Create service manager and mark as initialized
            service_manager = ServiceManager()
            service_manager._initialized = True
            
            # Test health status
            health = service_manager.get_health_status()
            
            # Verify health status structure
            assert "initialized" in health
            assert "services" in health
            assert "all_services_healthy" in health
            
            # Verify initialization status
            assert health["initialized"] is True
            
            # Verify service details
            assert "vertex_ai" in health["services"]
            assert "google_maps" in health["services"]
            
            # Verify Vertex AI service details
            vertex_ai_service = health["services"]["vertex_ai"]
            assert vertex_ai_service["connected"] is True
            assert vertex_ai_service["service"] == "Google Cloud Vertex AI"
            assert vertex_ai_service["model"] == "gemini-1.5-flash-001"
            
            # Verify Google Maps service details
            maps_service = health["services"]["google_maps"]
            assert maps_service["connected"] is False
            assert maps_service["service"] == "Google Maps Places API"
            assert "features" in maps_service
            
            # Verify overall health (should be False due to Maps failure)
            assert health["all_services_healthy"] is False

    @pytest.mark.asyncio
    async def test_service_manager_cleanup(self):
        """Test service manager cleanup."""
        with patch('app.services.service_manager.GeminiClient') as mock_gemini_client, \
             patch('app.services.service_manager.GoogleMapsClient') as mock_maps_client:
            
            # Mock clients with close methods
            mock_gemini = Mock()
            mock_gemini.close = AsyncMock()
            mock_gemini_client.return_value = mock_gemini
            
            mock_maps = Mock()
            mock_maps.close = AsyncMock()
            mock_maps_client.return_value = mock_maps
            
            # Create service manager and mark as initialized
            service_manager = ServiceManager()
            service_manager._initialized = True
            
            # Test cleanup
            await service_manager.cleanup()
            
            # Verify close methods were called
            mock_gemini.close.assert_called_once()
            mock_maps.close.assert_called_once()
            
            # Verify initialization flag is reset
            assert service_manager._initialized is False

    def test_get_service_manager_singleton(self):
        """Test that get_service_manager returns the same instance."""
        # Clear any existing instance
        import app.services.service_manager
        app.services.service_manager.service_manager = None
        
        # Get service manager instances
        manager1 = get_service_manager()
        manager2 = get_service_manager()
        
        # Verify they are the same instance
        assert manager1 is manager2
        assert isinstance(manager1, ServiceManager)


class TestConfigurationValidation:
    """Unit tests for configuration loading and environment variable handling."""

    def test_settings_loads_from_environment_variables(self):
        """Test that settings properly load from environment variables."""
        with patch.dict('os.environ', {
            'GOOGLE_CLOUD_PROJECT': 'test-project',
            'GOOGLE_MAPS_API_KEY': 'test-api-key',
            'VERTEX_AI_LOCATION': 'us-west1',
            'GEMINI_MODEL_NAME': 'gemini-1.5-pro-001',
            'LOG_LEVEL': 'DEBUG',
            'ENVIRONMENT': 'staging',
            'DEBUG': 'true',
            'MAX_IMAGE_SIZE_MB': '15',
            'REQUEST_TIMEOUT_SECONDS': '25',
            'RESPONSE_TIME_LIMIT_SECONDS': '5'
        }):
            # Create settings instance
            settings = Settings()
            
            # Verify environment variables are loaded correctly
            assert settings.google_cloud_project == 'test-project'
            assert settings.google_maps_api_key == 'test-api-key'
            assert settings.vertex_ai_location == 'us-west1'
            assert settings.gemini_model_name == 'gemini-1.5-pro-001'
            assert settings.log_level == 'DEBUG'
            assert settings.environment == 'staging'
            assert settings.debug is True
            assert settings.max_image_size_mb == 15
            assert settings.request_timeout_seconds == 25
            assert settings.response_time_limit_seconds == 5

    def test_settings_uses_default_values(self):
        """Test that settings use default values when environment variables are not set."""
        with patch.dict('os.environ', {
            'GOOGLE_CLOUD_PROJECT': 'test-project',
            'GOOGLE_MAPS_API_KEY': 'test-api-key'
        }, clear=True):
            # Create settings instance with minimal required env vars
            settings = Settings()
            
            # Verify default values are used
            assert settings.vertex_ai_location == 'us-central1'
            assert settings.gemini_model_name == 'gemini-1.5-flash-001'
            assert settings.log_level == 'INFO'
            assert settings.environment == 'development'
            assert settings.debug is False
            assert settings.max_image_size_mb == 10
            assert settings.request_timeout_seconds == 30
            assert settings.response_time_limit_seconds == 3

    def test_settings_validates_log_level(self):
        """Test that settings validate log level values."""
        with patch.dict('os.environ', {
            'GOOGLE_CLOUD_PROJECT': 'test-project',
            'GOOGLE_MAPS_API_KEY': 'test-api-key',
            'LOG_LEVEL': 'INVALID'
        }):
            # Test that invalid log level raises ValueError
            with pytest.raises(ValueError, match="Log level must be one of"):
                Settings()

    def test_settings_validates_environment(self):
        """Test that settings validate environment values."""
        with patch.dict('os.environ', {
            'GOOGLE_CLOUD_PROJECT': 'test-project',
            'GOOGLE_MAPS_API_KEY': 'test-api-key',
            'ENVIRONMENT': 'invalid'
        }):
            # Test that invalid environment raises ValueError
            with pytest.raises(ValueError, match="Environment must be one of"):
                Settings()

    def test_settings_validates_image_size_limits(self):
        """Test that settings validate image size limits."""
        with patch.dict('os.environ', {
            'GOOGLE_CLOUD_PROJECT': 'test-project',
            'GOOGLE_MAPS_API_KEY': 'test-api-key',
            'MAX_IMAGE_SIZE_MB': '100'  # Too large
        }):
            # Test that oversized limit raises ValueError
            with pytest.raises(ValueError, match="Max image size must be between 1 and 50 MB"):
                Settings()

    def test_settings_validates_response_time_limits(self):
        """Test that settings validate response time limits."""
        with patch.dict('os.environ', {
            'GOOGLE_CLOUD_PROJECT': 'test-project',
            'GOOGLE_MAPS_API_KEY': 'test-api-key',
            'RESPONSE_TIME_LIMIT_SECONDS': '15'  # Too large for emergency use
        }):
            # Test that excessive response time raises ValueError
            with pytest.raises(ValueError, match="Response time limit must be between 1 and 10 seconds"):
                Settings()

    def test_get_settings_singleton(self):
        """Test that get_settings returns the same instance."""
        # Clear any existing instance
        import config.settings
        config.settings.settings = None
        
        with patch.dict('os.environ', {
            'GOOGLE_CLOUD_PROJECT': 'test-project',
            'GOOGLE_MAPS_API_KEY': 'test-api-key'
        }):
            # Get settings instances
            settings1 = get_settings()
            settings2 = get_settings()
            
            # Verify they are the same instance
            assert settings1 is settings2
            assert isinstance(settings1, Settings)

    def test_settings_requires_google_cloud_project(self):
        """Test that settings require GOOGLE_CLOUD_PROJECT environment variable."""
        with patch.dict('os.environ', {
            'GOOGLE_MAPS_API_KEY': 'test-api-key'
        }, clear=True):
            # Test that missing project raises ValidationError
            with pytest.raises(Exception):  # Pydantic ValidationError
                Settings()

    def test_settings_requires_google_maps_api_key(self):
        """Test that settings require GOOGLE_MAPS_API_KEY environment variable."""
        with patch.dict('os.environ', {
            'GOOGLE_CLOUD_PROJECT': 'test-project'
        }, clear=True):
            # Test that missing API key raises ValidationError
            with pytest.raises(Exception):  # Pydantic ValidationError
                Settings()

    def test_settings_cors_origins_parsing(self):
        """Test that CORS origins are properly parsed from environment."""
        with patch.dict('os.environ', {
            'GOOGLE_CLOUD_PROJECT': 'test-project',
            'GOOGLE_MAPS_API_KEY': 'test-api-key',
            'CORS_ORIGINS': '["https://example.com", "https://app.example.com"]'
        }):
            # Create settings instance
            settings = Settings()
            
            # Verify CORS origins are parsed correctly
            assert settings.cors_origins == ["https://example.com", "https://app.example.com"]


class TestCredentialValidation:
    """Unit tests for credential validation during startup."""

    @pytest.mark.asyncio
    async def test_gemini_client_credential_validation(self):
        """Test Vertex AI credential validation during initialization."""
        with patch('app.services.ai_service.get_settings') as mock_get_settings, \
             patch('app.services.ai_service.default') as mock_default, \
             patch('app.services.ai_service.aiplatform') as mock_aiplatform, \
             patch('app.services.ai_service.gapic') as mock_gapic:
            
            # Mock settings
            mock_settings = Mock()
            mock_settings.google_cloud_project = "test-project"
            mock_settings.vertex_ai_location = "us-central1"
            mock_settings.gemini_model_name = "gemini-1.5-flash-001"
            mock_get_settings.return_value = mock_settings
            
            # Mock successful credential validation
            mock_credentials = Mock()
            mock_default.return_value = (mock_credentials, "test-project")
            
            # Mock Vertex AI client
            mock_client = Mock()
            mock_gapic.PredictionServiceClient.return_value = mock_client
            
            # Import and test
            from app.services.ai_service import GeminiClient
            client = GeminiClient()
            
            # Test initialization (should validate credentials)
            await client.initialize()
            
            # Verify credential validation was performed
            mock_default.assert_called_once()
            mock_aiplatform.init.assert_called_once()
            
            # Verify client was created with credentials
            mock_gapic.PredictionServiceClient.assert_called_once_with(
                credentials=mock_credentials
            )

    @pytest.mark.asyncio
    async def test_gemini_client_handles_credential_failure(self):
        """Test Vertex AI client handles credential validation failure."""
        with patch('app.services.ai_service.get_settings') as mock_get_settings, \
             patch('app.services.ai_service.default') as mock_default:
            
            # Mock settings
            mock_settings = Mock()
            mock_settings.google_cloud_project = "test-project"
            mock_settings.vertex_ai_location = "us-central1"
            mock_settings.gemini_model_name = "gemini-1.5-flash-001"
            mock_get_settings.return_value = mock_settings
            
            # Mock credential validation failure
            mock_default.side_effect = Exception("Invalid credentials")
            
            # Import and test
            from app.services.ai_service import GeminiClient
            client = GeminiClient()
            
            # Test that initialization fails with credential error
            with pytest.raises(Exception, match="Invalid credentials"):
                await client.initialize()

    @pytest.mark.asyncio
    async def test_maps_client_credential_validation(self):
        """Test Google Maps API key validation during initialization."""
        with patch('app.services.location_service.get_settings') as mock_get_settings, \
             patch('app.services.location_service.googlemaps') as mock_googlemaps:
            
            # Mock settings
            mock_settings = Mock()
            mock_settings.google_maps_api_key = "valid-api-key"
            mock_settings.request_timeout_seconds = 30
            mock_get_settings.return_value = mock_settings
            
            # Mock Google Maps client
            mock_client = Mock()
            mock_googlemaps.Client.return_value = mock_client
            
            # Import and test
            from app.services.location_service import GoogleMapsClient
            client = GoogleMapsClient()
            
            # Test initialization (should create client with API key)
            await client.initialize()
            
            # Verify client was created with API key
            mock_googlemaps.Client.assert_called_once_with(
                key="valid-api-key",
                timeout=30
            )
            
            # Verify client is stored
            assert client._client == mock_client

    @pytest.mark.asyncio
    async def test_maps_client_handles_invalid_api_key(self):
        """Test Google Maps client handles invalid API key."""
        with patch('app.services.location_service.get_settings') as mock_get_settings, \
             patch('app.services.location_service.googlemaps') as mock_googlemaps:
            
            # Mock settings
            mock_settings = Mock()
            mock_settings.google_maps_api_key = ""  # Empty API key
            mock_settings.request_timeout_seconds = 30
            mock_get_settings.return_value = mock_settings
            
            # Import and test
            from app.services.location_service import GoogleMapsClient
            client = GoogleMapsClient()
            
            # Test that initialization fails with empty API key (wrapped in ConnectionError)
            with pytest.raises(ConnectionError, match="Google Maps initialization failed"):
                await client.initialize()