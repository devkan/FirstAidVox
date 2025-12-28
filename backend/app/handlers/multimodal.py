"""
Multimodal input handler for processing text and image data.
Implements validation, sanitization, and coordination with AI services.
"""

import io
import logging
import re
from typing import Optional, Dict, Any, List, Tuple
from PIL import Image, UnidentifiedImageError
from fastapi import UploadFile, HTTPException
from pydantic import ValidationError

from app.models.chat import ChatRequest, ChatResponse
from app.models.location import Location
from app.models.hospital import HospitalResult
from app.models.error import ErrorResponse
from app.models.internal import AIResponse, FunctionCall
from app.services.ai_service import GeminiClient
from app.services.location_service import GoogleMapsClient


logger = logging.getLogger(__name__)


class MultimodalHandler:
    """
    Handler for processing multimodal input (text + optional image) for medical triage.
    Provides validation, sanitization, and coordination with AI services.
    """
    
    # Supported image formats
    SUPPORTED_IMAGE_FORMATS = {"jpg", "jpeg", "png", "webp"}
    
    # Maximum image size in bytes (5MB)
    MAX_IMAGE_SIZE = 5 * 1024 * 1024
    
    # Maximum image dimensions
    MAX_IMAGE_WIDTH = 4096
    MAX_IMAGE_HEIGHT = 4096
    
    # Text validation patterns
    DANGEROUS_PATTERNS = [
        r'<script[^>]*>.*?</script>',  # Script tags
        r'javascript:',                # JavaScript URLs
        r'on\w+\s*=',                 # Event handlers
        r'<iframe[^>]*>.*?</iframe>',  # Iframes
    ]
    
    def __init__(self, ai_client: GeminiClient, location_client: GoogleMapsClient):
        """
        Initialize the multimodal handler with service clients.
        
        Args:
            ai_client: Initialized Gemini AI client
            location_client: Initialized Google Maps client
        """
        self.ai_client = ai_client
        self.location_client = location_client
    
    async def validate_image(self, image_file: UploadFile) -> bytes:
        """
        Validate uploaded image file for format, size, and corruption.
        
        Args:
            image_file: FastAPI UploadFile object
            
        Returns:
            bytes: Validated image data
            
        Raises:
            HTTPException: If image validation fails
        """
        if not image_file:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "MISSING_IMAGE",
                    "message": "No image file provided",
                    "details": {}
                }
            )
        
        # Check file size
        if image_file.size and image_file.size > self.MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=413,
                detail={
                    "code": "IMAGE_TOO_LARGE",
                    "message": f"Image size exceeds maximum limit of {self.MAX_IMAGE_SIZE // (1024*1024)}MB",
                    "details": {
                        "max_size_mb": self.MAX_IMAGE_SIZE // (1024*1024),
                        "received_size_mb": round(image_file.size / (1024*1024), 2)
                    }
                }
            )
        
        # Read image data
        try:
            image_data = await image_file.read()
        except Exception as e:
            logger.error(f"Failed to read image file: {e}")
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "IMAGE_READ_ERROR",
                    "message": "Failed to read image file",
                    "details": {"error": str(e)}
                }
            )
        
        # Check actual size after reading
        if len(image_data) > self.MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=413,
                detail={
                    "code": "IMAGE_TOO_LARGE",
                    "message": f"Image size exceeds maximum limit of {self.MAX_IMAGE_SIZE // (1024*1024)}MB",
                    "details": {
                        "max_size_mb": self.MAX_IMAGE_SIZE // (1024*1024),
                        "received_size_mb": round(len(image_data) / (1024*1024), 2)
                    }
                }
            )
        
        # Validate image format and check for corruption
        try:
            with Image.open(io.BytesIO(image_data)) as img:
                # Check format
                if img.format.lower() not in self.SUPPORTED_IMAGE_FORMATS:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "code": "UNSUPPORTED_FORMAT",
                            "message": f"Image format '{img.format}' not supported",
                            "details": {
                                "supported_formats": list(self.SUPPORTED_IMAGE_FORMATS),
                                "received_format": img.format.lower()
                            }
                        }
                    )
                
                # Check dimensions
                width, height = img.size
                if width > self.MAX_IMAGE_WIDTH or height > self.MAX_IMAGE_HEIGHT:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "code": "IMAGE_DIMENSIONS_TOO_LARGE",
                            "message": f"Image dimensions exceed maximum of {self.MAX_IMAGE_WIDTH}x{self.MAX_IMAGE_HEIGHT}",
                            "details": {
                                "max_width": self.MAX_IMAGE_WIDTH,
                                "max_height": self.MAX_IMAGE_HEIGHT,
                                "received_width": width,
                                "received_height": height
                            }
                        }
                    )
                
                # Verify image integrity by attempting to load it
                img.verify()
                
        except UnidentifiedImageError:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "CORRUPTED_IMAGE",
                    "message": "Image file is corrupted or not a valid image",
                    "details": {
                        "supported_formats": list(self.SUPPORTED_IMAGE_FORMATS)
                    }
                }
            )
        except Exception as e:
            logger.error(f"Image validation failed: {e}")
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "IMAGE_VALIDATION_ERROR",
                    "message": "Image validation failed",
                    "details": {"error": str(e)}
                }
            )
        
        logger.info(f"Image validation successful: {len(image_data)} bytes, format: {img.format}")
        return image_data
    
    def sanitize_text(self, text: str) -> str:
        """
        Sanitize and validate text input for security and content.
        
        Args:
            text: Raw text input from user
            
        Returns:
            str: Sanitized text
            
        Raises:
            HTTPException: If text validation fails
        """
        if not text or not isinstance(text, str):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_TEXT",
                    "message": "Text input is required and must be a string",
                    "details": {}
                }
            )
        
        # Remove leading/trailing whitespace
        sanitized_text = text.strip()
        
        # Check for empty text after sanitization
        if not sanitized_text:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "EMPTY_TEXT",
                    "message": "Text cannot be empty or contain only whitespace",
                    "details": {}
                }
            )
        
        # Check length constraints
        if len(sanitized_text) > 2000:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "TEXT_TOO_LONG",
                    "message": "Text exceeds maximum length of 2000 characters",
                    "details": {
                        "max_length": 2000,
                        "received_length": len(sanitized_text)
                    }
                }
            )
        
        # Check for dangerous patterns (XSS prevention)
        for pattern in self.DANGEROUS_PATTERNS:
            if re.search(pattern, sanitized_text, re.IGNORECASE):
                logger.warning(f"Potentially dangerous pattern detected in text input: {pattern}")
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "UNSAFE_TEXT_CONTENT",
                        "message": "Text contains potentially unsafe content",
                        "details": {
                            "reason": "HTML/JavaScript content not allowed"
                        }
                    }
                )
        
        # Remove any remaining HTML-like tags as a precaution
        sanitized_text = re.sub(r'<[^>]+>', '', sanitized_text)
        
        # Normalize whitespace
        sanitized_text = re.sub(r'\s+', ' ', sanitized_text).strip()
        
        logger.info(f"Text sanitization successful: {len(sanitized_text)} characters")
        return sanitized_text
    
    def validate_location(self, location: Optional[Location]) -> Optional[Dict[str, float]]:
        """
        Validate location coordinates if provided.
        
        Args:
            location: Optional location object with coordinates
            
        Returns:
            Optional[Dict[str, float]]: Validated location dict or None
            
        Raises:
            HTTPException: If location validation fails
        """
        if not location:
            return None
        
        try:
            # Pydantic validation should handle basic coordinate validation
            # Additional validation for edge cases
            lat, lng = location.latitude, location.longitude
            
            # Check for NaN or infinite values
            if not (-90 <= lat <= 90):
                raise ValueError(f"Latitude {lat} is out of valid range [-90, 90]")
            
            if not (-180 <= lng <= 180):
                raise ValueError(f"Longitude {lng} is out of valid range [-180, 180]")
            
            return {"latitude": lat, "longitude": lng}
            
        except (ValueError, ValidationError) as e:
            logger.error(f"Location validation failed: {e}")
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_LOCATION",
                    "message": "Invalid location coordinates",
                    "details": {
                        "error": str(e),
                        "valid_ranges": {
                            "latitude": "[-90, 90]",
                            "longitude": "[-180, 180]"
                        }
                    }
                }
            )
    
    async def execute_function_calls(
        self, 
        function_calls: List[FunctionCall],
        location: Optional[Dict[str, float]]
    ) -> List[HospitalResult]:
        """
        Execute function calls from AI response (primarily hospital search).
        
        Args:
            function_calls: List of function calls from AI
            location: User location for hospital search
            
        Returns:
            List[HospitalResult]: Results from function execution
        """
        results = []
        
        for func_call in function_calls:
            if func_call.name == "search_hospitals":
                try:
                    # Extract parameters
                    params = func_call.parameters
                    lat = params.get("latitude")
                    lng = params.get("longitude")
                    radius = params.get("radius_km", 10)
                    
                    # Use provided location if function call doesn't have coordinates
                    if not lat or not lng:
                        if location:
                            lat = location["latitude"]
                            lng = location["longitude"]
                        else:
                            logger.warning("Hospital search requested but no location available")
                            continue
                    
                    # Execute hospital search
                    hospitals = await self.location_client.search_hospitals(
                        latitude=lat,
                        longitude=lng,
                        radius_km=radius
                    )
                    
                    results.extend(hospitals)
                    logger.info(f"Hospital search completed: {len(hospitals)} results")
                    
                except Exception as e:
                    logger.error(f"Function call execution failed for {func_call.name}: {e}")
                    # Don't raise exception - continue with other function calls
                    continue
            else:
                logger.warning(f"Unknown function call: {func_call.name}")
        
        return results
    
    async def process_request(
        self,
        text: str,
        location: Optional[Location] = None,
        image: Optional[UploadFile] = None
    ) -> ChatResponse:
        """
        Process multimodal chat request with validation and AI coordination.
        
        Args:
            text: User's text input
            location: Optional location for hospital search
            image: Optional image file
            
        Returns:
            ChatResponse: Complete response with AI advice and optional hospital data
            
        Raises:
            HTTPException: If processing fails
        """
        try:
            # Validate and sanitize inputs
            sanitized_text = self.sanitize_text(text)
            validated_location = self.validate_location(location)
            
            # Validate image if provided
            image_data = None
            if image:
                image_data = await self.validate_image(image)
            
            # Generate AI response
            try:
                ai_response = await self.ai_client.generate_response(
                    text=sanitized_text,
                    image_data=image_data,
                    location=validated_location
                )
            except Exception as e:
                logger.error(f"AI service call failed: {e}")
                raise HTTPException(
                    status_code=503,
                    detail={
                        "code": "AI_SERVICE_ERROR",
                        "message": "AI service is temporarily unavailable",
                        "details": {"error": str(e)}
                    }
                )
            
            # Execute any function calls
            hospitals = []
            if ai_response.function_calls:
                try:
                    hospitals = await self.execute_function_calls(
                        ai_response.function_calls,
                        validated_location
                    )
                except Exception as e:
                    logger.error(f"Function call execution failed: {e}")
                    # Continue without hospital data rather than failing the request
            
            # Determine confidence level based on various factors
            confidence_level = self._determine_confidence_level(
                ai_response.text,
                image_data is not None,
                len(hospitals) > 0
            )
            
            # Build response
            response = ChatResponse(
                advice=ai_response.text,
                hospitals=hospitals if hospitals else None,
                confidence_level=confidence_level
            )
            
            logger.info(f"Request processed successfully: {len(sanitized_text)} chars text, "
                       f"{'with' if image_data else 'without'} image, "
                       f"{len(hospitals)} hospitals")
            
            return response
            
        except HTTPException:
            # Re-raise HTTP exceptions as-is
            raise
        except Exception as e:
            logger.error(f"Unexpected error processing request: {e}")
            raise HTTPException(
                status_code=500,
                detail={
                    "code": "PROCESSING_ERROR",
                    "message": "An unexpected error occurred while processing your request",
                    "details": {"error": str(e)}
                }
            )
    
    def _determine_confidence_level(
        self, 
        advice_text: str, 
        has_image: bool, 
        has_hospitals: bool
    ) -> str:
        """
        Determine confidence level based on response characteristics.
        
        Args:
            advice_text: Generated advice text
            has_image: Whether image was provided for analysis
            has_hospitals: Whether hospital data was included
            
        Returns:
            str: Confidence level (high, medium, low)
        """
        # Simple heuristic-based confidence determination
        confidence_indicators = 0
        
        # Check for uncertainty keywords in advice
        uncertainty_keywords = [
            "uncertain", "unsure", "might", "could", "possibly", 
            "seek immediate", "consult doctor", "emergency"
        ]
        
        has_uncertainty = any(keyword in advice_text.lower() for keyword in uncertainty_keywords)
        
        # Factors that increase confidence
        if has_image:
            confidence_indicators += 1
        if len(advice_text) > 100:  # Detailed response
            confidence_indicators += 1
        if not has_uncertainty:
            confidence_indicators += 1
        
        # Determine level
        if confidence_indicators >= 3:
            return "high"
        elif confidence_indicators >= 2:
            return "medium"
        else:
            return "low"