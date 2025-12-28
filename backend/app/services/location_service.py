"""
Google Maps Places API service integration for hospital and pharmacy search.
Implements secure authentication and location-based search functionality.
"""

import logging
import math
import time
from typing import List, Optional, Dict, Any
import googlemaps
from googlemaps.exceptions import ApiError, Timeout, TransportError

from config.settings import get_settings
from config.logging import get_service_logger, get_metrics_collector
from app.models.hospital import HospitalResult
from app.models.location import Location


logger = logging.getLogger(__name__)


class GoogleMapsClient:
    """
    Client for Google Maps Places API with hospital search capabilities.
    Handles authentication, search functionality, and distance calculations.
    """
    
    def __init__(self):
        """Initialize the Google Maps client with API key authentication."""
        self.settings = get_settings()
        self._client = None
        self._api_key = self.settings.google_maps_api_key
    
    async def initialize(self) -> None:
        """
        Initialize the Google Maps client with authentication.
        Validates API key and establishes secure connection.
        """
        try:
            if not self._api_key:
                raise ValueError("Google Maps API key not configured")
            
            # Initialize the Google Maps client
            self._client = googlemaps.Client(
                key=self._api_key,
                timeout=self.settings.request_timeout_seconds
            )
            
            logger.info("Initialized Google Maps Places API client")
            
        except Exception as e:
            logger.error(f"Failed to initialize Google Maps client: {e}")
            raise ConnectionError(f"Google Maps initialization failed: {e}") from e
    
    def validate_connection(self) -> bool:
        """
        Validate that the Google Maps API connection is working.
        Returns True if connection is valid, False otherwise.
        """
        try:
            if not self._client:
                return False
            
            # Test connection with a simple geocoding request
            # Using a well-known location to test API access
            test_result = self._client.geocode("1600 Amphitheatre Parkway, Mountain View, CA")
            
            if test_result and len(test_result) > 0:
                logger.debug("Google Maps API connection validation successful")
                return True
            
            return False
            
        except (ApiError, Timeout, TransportError) as e:
            logger.error(f"Google Maps API connection validation failed: {e}")
            if "The provided API key is invalid" in str(e):
                logger.error("❌ Invalid API Key. Please check GOOGLE_MAPS_API_KEY in .env")
            elif "API keys with referer restrictions cannot be used with this API" in str(e):
                logger.error("❌ API Key has referer restrictions. Please use a server-side key or configure restrictions.")
            elif "This API project is not authorized to use this API" in str(e) or "API not enabled" in str(e):
                logger.error("❌ Geocoding API is not enabled. Please enable it in Google Cloud Console.")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during Google Maps validation: {e}")
            return False
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Perform comprehensive health check of Google Maps service.
        
        Returns:
            Dictionary containing detailed health information
        """
        health_info = {
            "service": "Google Maps Places API",
            "initialized": self._client is not None,
            "authenticated": False,
            "api_accessible": False,
            "response_time_ms": None,
            "last_check": time.time()
        }
        
        try:
            start_time = time.time()
            
            # Check API access
            if self.validate_connection():
                health_info["authenticated"] = True
                health_info["api_accessible"] = True
            
            # Calculate response time
            response_time = (time.time() - start_time) * 1000
            health_info["response_time_ms"] = round(response_time, 2)
            
        except Exception as e:
            logger.error(f"Google Maps health check failed: {e}")
            health_info["error"] = str(e)
        
        return health_info
    
    async def search_hospitals(
        self, 
        latitude: float, 
        longitude: float, 
        radius_km: float = 10.0
    ) -> List[HospitalResult]:
        """
        Search for nearby hospitals and pharmacies using Google Maps Places API.
        
        Args:
            latitude: Latitude coordinate in decimal degrees
            longitude: Longitude coordinate in decimal degrees
            radius_km: Search radius in kilometers (default: 10km)
            
        Returns:
            List of HospitalResult objects sorted by distance
            
        Raises:
            ConnectionError: If Google Maps API is unavailable
            ValueError: If coordinates are invalid
        """
        if not self._client:
            raise ConnectionError("Google Maps client not initialized")
        
        # Validate coordinates
        if not (-90 <= latitude <= 90):
            raise ValueError(f"Invalid latitude: {latitude}. Must be between -90 and 90")
        
        if not (-180 <= longitude <= 180):
            raise ValueError(f"Invalid longitude: {longitude}. Must be between -180 and 180")
        
        if radius_km <= 0 or radius_km > 50:
            raise ValueError(f"Invalid radius: {radius_km}. Must be between 1 and 50 km")
        
        # Get logging utilities
        service_logger = get_service_logger()
        metrics_collector = get_metrics_collector()
        
        start_time = time.time()
        
        try:
            # Log service call start
            service_logger.log_service_call_start(
                service_name="google_maps",
                endpoint="/places/nearbysearch"
            )
            
            # Increment service call count
            metrics_collector.increment_service_call("google_maps")
            
            user_location = (latitude, longitude)
            radius_meters = int(radius_km * 1000)  # Convert km to meters
            
            results = []
            
            # Search for hospitals
            hospital_results = self._client.places_nearby(
                location=user_location,
                radius=radius_meters,
                type='hospital'
            )
            
            # Search for pharmacies
            pharmacy_results = self._client.places_nearby(
                location=user_location,
                radius=radius_meters,
                type='pharmacy'
            )
            
            # Combine and process results
            all_places = hospital_results.get('results', []) + pharmacy_results.get('results', [])
            
            for place in all_places:
                try:
                    # Extract place details
                    place_location = place.get('geometry', {}).get('location', {})
                    place_lat = place_location.get('lat')
                    place_lng = place_location.get('lng')
                    
                    if place_lat is None or place_lng is None:
                        continue
                    
                    # Calculate distance
                    distance_km = self._calculate_distance(
                        latitude, longitude, place_lat, place_lng
                    )
                    
                    # Create hospital result
                    hospital_result = HospitalResult(
                        name=place.get('name', 'Unknown'),
                        address=place.get('vicinity', 'Address not available'),
                        distance_km=round(distance_km, 2),
                        place_id=place.get('place_id', ''),
                        rating=place.get('rating')
                    )
                    
                    results.append(hospital_result)
                    
                except Exception as e:
                    logger.warning(f"Failed to process place result: {e}")
                    continue
            
            # Sort by distance and limit results
            results.sort(key=lambda x: x.distance_km)
            results = results[:10]  # Limit to top 10 results
            
            # Calculate response time
            response_time_ms = (time.time() - start_time) * 1000
            
            # Log successful service call
            service_logger.log_service_call_end(
                service_name="google_maps",
                endpoint="/places/nearbysearch",
                response_time_ms=response_time_ms,
                success=True
            )
            
            logger.info(f"Found {len(results)} hospitals/pharmacies within {radius_km}km")
            return results
            
        except (ApiError, Timeout, TransportError) as e:
            # Calculate response time for errors
            response_time_ms = (time.time() - start_time) * 1000
            
            # Log service error
            service_logger.log_service_error(
                service_name="google_maps",
                endpoint="/places/nearbysearch",
                error=e,
                response_time_ms=response_time_ms
            )
            
            # Increment service error count
            metrics_collector.increment_service_error("google_maps")
            
            logger.error(f"Google Maps API error during hospital search: {e}")
            raise ConnectionError(f"Hospital search failed: {e}") from e
        except Exception as e:
            # Calculate response time for errors
            response_time_ms = (time.time() - start_time) * 1000
            
            # Log service error
            service_logger.log_service_error(
                service_name="google_maps",
                endpoint="/places/nearbysearch",
                error=e,
                response_time_ms=response_time_ms
            )
            
            # Increment service error count
            metrics_collector.increment_service_error("google_maps")
            
            logger.error(f"Unexpected error during hospital search: {e}")
            raise ConnectionError(f"Hospital search failed: {e}") from e
    
    def _calculate_distance(
        self, 
        lat1: float, 
        lon1: float, 
        lat2: float, 
        lon2: float
    ) -> float:
        """
        Calculate the great circle distance between two points on Earth.
        Uses the Haversine formula for accurate distance calculation.
        
        Args:
            lat1, lon1: Latitude and longitude of first point
            lat2, lon2: Latitude and longitude of second point
            
        Returns:
            Distance in kilometers
        """
        # Convert latitude and longitude from degrees to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Radius of Earth in kilometers
        r = 6371
        
        return c * r
    
    async def close(self) -> None:
        """Clean up resources and close connections."""
        if self._client:
            # Google Maps client doesn't require explicit cleanup
            self._client = None
            logger.info("Google Maps client connection closed")