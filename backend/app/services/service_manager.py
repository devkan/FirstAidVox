"""
Service manager for coordinating Google Cloud service integrations.
Handles initialization, validation, and lifecycle management of external services.
"""

import logging
import time
from typing import Dict, Any
from .ai_service import GeminiClient
from .location_service import GoogleMapsClient


logger = logging.getLogger(__name__)


class ServiceManager:
    """
    Manages initialization and lifecycle of all external service clients.
    Provides centralized service validation and error handling.
    """
    
    def __init__(self):
        """Initialize the service manager."""
        self.gemini_client = GeminiClient()
        self.maps_client = GoogleMapsClient()
        self._initialized = False
    
    async def initialize_all(self) -> None:
        """
        Initialize all external service clients.
        Validates credentials and establishes secure connections.
        
        Raises:
            ConnectionError: If any service fails to initialize
        """
        try:
            logger.info("Initializing external service clients...")
            
            # Initialize Vertex AI Gemini client
            await self.gemini_client.initialize()
            
            # Initialize Google Maps client
            await self.maps_client.initialize()
            
            self._initialized = True
            logger.info("All external service clients initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize service clients: {e}")
            await self.cleanup()
            raise ConnectionError(f"Service initialization failed: {e}") from e
    
    def validate_all_connections(self) -> Dict[str, bool]:
        """
        Validate all service connections.
        
        Returns:
            Dictionary mapping service names to their connection status
        """
        if not self._initialized:
            return {
                "vertex_ai": False,
                "google_maps": False
            }
        
        try:
            vertex_ai_status = self.gemini_client.validate_connection()
            maps_status = self.maps_client.validate_connection()
            
            status = {
                "vertex_ai": vertex_ai_status,
                "google_maps": maps_status
            }
            
            logger.info(f"Service connection validation: {status}")
            return status
            
        except Exception as e:
            logger.error(f"Service validation failed: {e}")
            return {
                "vertex_ai": False,
                "google_maps": False
            }
    
    def get_health_status(self) -> Dict[str, Any]:
        """
        Get comprehensive health status of all services.
        
        Returns:
            Dictionary containing service health information
        """
        connection_status = self.validate_all_connections()
        
        return {
            "initialized": self._initialized,
            "services": {
                "vertex_ai": {
                    "connected": connection_status.get("vertex_ai", False),
                    "service": "Google Cloud Vertex AI",
                    "model": "gemini-1.5-flash-001"
                },
                "google_maps": {
                    "connected": connection_status.get("google_maps", False),
                    "service": "Google Maps Places API",
                    "features": ["hospital_search", "pharmacy_search"]
                }
            },
            "all_services_healthy": all(connection_status.values())
        }
    
    async def get_detailed_health_status(self) -> Dict[str, Any]:
        """
        Get detailed health status with comprehensive service checks.
        
        Returns:
            Dictionary containing detailed service health information
        """
        try:
            # Get detailed health checks from each service
            vertex_ai_health = await self.gemini_client.health_check()
            maps_health = await self.maps_client.health_check()
            
            # Determine overall health
            vertex_healthy = vertex_ai_health.get("authenticated", False) and vertex_ai_health.get("model_accessible", False)
            maps_healthy = maps_health.get("authenticated", False) and maps_health.get("api_accessible", False)
            all_healthy = vertex_healthy and maps_healthy
            
            return {
                "status": "healthy" if all_healthy else "degraded",
                "initialized": self._initialized,
                "timestamp": time.time(),
                "services": {
                    "vertex_ai": {
                        **vertex_ai_health,
                        "healthy": vertex_healthy
                    },
                    "google_maps": {
                        **maps_health,
                        "healthy": maps_healthy
                    }
                },
                "all_services_healthy": all_healthy,
                "summary": {
                    "total_services": 2,
                    "healthy_services": sum([vertex_healthy, maps_healthy]),
                    "degraded_services": 2 - sum([vertex_healthy, maps_healthy])
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get detailed health status: {e}")
            return {
                "status": "unhealthy",
                "initialized": self._initialized,
                "timestamp": time.time(),
                "error": str(e),
                "all_services_healthy": False
            }
    
    async def cleanup(self) -> None:
        """Clean up all service connections and resources."""
        try:
            logger.info("Cleaning up service connections...")
            
            if hasattr(self, 'gemini_client'):
                await self.gemini_client.close()
            
            if hasattr(self, 'maps_client'):
                await self.maps_client.close()
            
            self._initialized = False
            logger.info("Service cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during service cleanup: {e}")


# Global service manager instance
service_manager = None


def get_service_manager() -> ServiceManager:
    """Get the global service manager instance, creating it if needed."""
    global service_manager
    if service_manager is None:
        service_manager = ServiceManager()
    return service_manager