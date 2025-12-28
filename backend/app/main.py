"""
FastAPI application for FirstAidVox Backend.
Implements multimodal medical triage endpoints with middleware for CORS, logging, and error handling.
"""

import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from app.models.chat import ChatRequest, ChatResponse
from app.models.location import Location
from app.models.error import ErrorResponse
from app.handlers.multimodal import MultimodalHandler
from app.services.service_manager import get_service_manager
from config.settings import get_settings
from config.logging import get_logger, get_request_logger, get_service_logger, get_metrics_collector


logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    # Startup
    logger.info("Starting FirstAidVox Backend...")
    
    try:
        # Initialize service manager and all external services
        service_manager = get_service_manager()
        await service_manager.initialize_all()
        
        # Store service manager in app state
        app.state.service_manager = service_manager
        
        # Initialize multimodal handler
        app.state.multimodal_handler = MultimodalHandler(
            ai_client=service_manager.gemini_client,
            location_client=service_manager.maps_client
        )
        
        logger.info("FirstAidVox Backend startup completed successfully")
        
    except Exception as e:
        logger.error(f"Failed to start FirstAidVox Backend: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down FirstAidVox Backend...")
    
    try:
        if hasattr(app.state, 'service_manager'):
            await app.state.service_manager.cleanup()
        logger.info("FirstAidVox Backend shutdown completed")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title="FirstAidVox Backend",
        description="Emergency medical triage system with AI-powered multimodal analysis",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
    
    # Add request logging middleware
    @app.middleware("http")
    async def logging_middleware(request: Request, call_next):
        """Log all requests and responses with timing information."""
        # Generate request ID for tracking
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Get logging utilities
        request_logger = get_request_logger()
        metrics_collector = get_metrics_collector()
        
        # Log request start
        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent")
        
        # Sanitize URL for logging (remove sensitive query params)
        url_path = str(request.url.path)
        method = request.method
        
        request_logger.log_request_start(
            request_id=request_id,
            method=method,
            path=url_path,
            client_ip=client_ip,
            user_agent=user_agent
        )
        
        # Increment request count
        metrics_collector.increment_request_count()
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate response time
            process_time = time.time() - start_time
            response_time_ms = process_time * 1000
            
            # Record metrics
            metrics_collector.record_response_time(response_time_ms)
            
            # Log successful response
            request_logger.log_request_end(
                request_id=request_id,
                status_code=response.status_code,
                response_time_ms=response_time_ms
            )
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{process_time:.3f}s"
            
            return response
            
        except Exception as e:
            # Calculate response time for errors
            process_time = time.time() - start_time
            response_time_ms = process_time * 1000
            
            # Record error metrics
            metrics_collector.increment_error_count()
            
            # Log error
            request_logger.log_request_error(
                request_id=request_id,
                error=e,
                response_time_ms=response_time_ms
            )
            
            # Re-raise to let error handlers deal with it
            raise
    
    # Add global exception handler
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Handle HTTP exceptions with standardized error format."""
        request_id = getattr(request.state, 'request_id', 'unknown')
        
        # Log the error
        logger.warning(
            f"HTTP Exception - ID: {request_id}, Status: {exc.status_code}, "
            f"Detail: {exc.detail}"
        )
        
        # Format error response
        if isinstance(exc.detail, dict):
            error_detail = exc.detail
        else:
            error_detail = {
                "code": "HTTP_ERROR",
                "message": str(exc.detail),
                "details": {}
            }
        
        error_response = ErrorResponse(
            error=error_detail,
            request_id=request_id
        )
        
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response.model_dump(),
            headers={"X-Request-ID": request_id}
        )
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handle request validation errors."""
        request_id = getattr(request.state, 'request_id', 'unknown')
        
        logger.warning(f"Validation Error - ID: {request_id}, Errors: {exc.errors()}")
        
        error_response = ErrorResponse(
            error={
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": {
                    "errors": exc.errors()
                }
            },
            request_id=request_id
        )
        
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=error_response.model_dump(),
            headers={"X-Request-ID": request_id}
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle unexpected exceptions."""
        request_id = getattr(request.state, 'request_id', 'unknown')
        
        logger.error(
            f"Unexpected Error - ID: {request_id}, Type: {type(exc).__name__}, "
            f"Message: {str(exc)}", 
            exc_info=True
        )
        
        error_response = ErrorResponse(
            error={
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {}
            },
            request_id=request_id
        )
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_response.model_dump(),
            headers={"X-Request-ID": request_id}
        )
    
    # Health endpoint
    @app.get("/health", response_model=dict)
    async def health_check(request: Request):
        """
        Get system health status including service availability.
        
        Returns comprehensive health information for monitoring and debugging.
        """
        try:
            service_manager = app.state.service_manager
            
            # Get detailed health status for production monitoring
            if get_settings().environment == "production":
                health_status = await service_manager.get_detailed_health_status()
            else:
                # Use simpler health check for development
                health_status = service_manager.get_health_status()
            
            # Add application-level health info
            health_status.update({
                "version": "1.0.0",
                "environment": get_settings().environment,
                "request_id": getattr(request.state, 'request_id', 'unknown')
            })
            
            # Return appropriate status code
            status_code = 200 if health_status.get("all_services_healthy", False) else 503
            
            return JSONResponse(
                status_code=status_code,
                content=health_status
            )
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            
            error_health = {
                "status": "unhealthy",
                "version": "1.0.0",
                "environment": get_settings().environment,
                "error": str(e),
                "all_services_healthy": False,
                "request_id": getattr(request.state, 'request_id', 'unknown')
            }
            
            return JSONResponse(
                status_code=503,
                content=error_health
            )
    
    # Metrics endpoint for monitoring
    @app.get("/metrics", response_model=dict)
    async def metrics_endpoint(request: Request):
        """
        Get application metrics for Google Cloud Run monitoring.
        
        Returns performance metrics, request counts, and service health data.
        """
        try:
            metrics_collector = get_metrics_collector()
            service_manager = app.state.service_manager
            
            # Get application metrics
            app_metrics = metrics_collector.get_metrics()
            
            # Get service health status
            health_status = service_manager.get_health_status()
            
            # Combine metrics and health data
            metrics_data = {
                "application": app_metrics,
                "services": health_status.get("services", {}),
                "system": {
                    "version": "1.0.0",
                    "environment": get_settings().environment,
                    "uptime_check": health_status.get("all_services_healthy", False)
                },
                "request_id": getattr(request.state, 'request_id', 'unknown')
            }
            
            # Log metrics snapshot
            metrics_collector.log_metrics()
            
            return JSONResponse(
                status_code=200,
                content=metrics_data
            )
            
        except Exception as e:
            logger.error(f"Metrics endpoint failed: {e}")
            
            error_metrics = {
                "error": "Failed to collect metrics",
                "message": str(e),
                "request_id": getattr(request.state, 'request_id', 'unknown')
            }
            
            return JSONResponse(
                status_code=500,
                content=error_metrics
            )
    
    # Chat endpoint
    @app.post("/chat", response_model=ChatResponse)
    async def chat_endpoint(
        request: Request,
        text: str = Form(..., description="Medical query or emergency description"),
        latitude: Optional[float] = Form(None, description="User latitude for hospital search"),
        longitude: Optional[float] = Form(None, description="User longitude for hospital search"),
        image: Optional[UploadFile] = File(None, description="Optional injury photo")
    ):
        """
        Process multimodal medical triage request.
        
        Accepts text description and optional image for AI-powered medical analysis.
        Can include location coordinates for nearby hospital search.
        """
        try:
            # Get logging utilities
            request_logger = get_request_logger()
            request_id = getattr(request.state, 'request_id', 'unknown')
            
            # Log input summary (sanitized)
            has_image = image is not None
            request_logger.log_input_summary(
                request_id=request_id,
                input_type="medical_query",
                input_size=len(text),
                has_image=has_image
            )
            
            # Build location object if coordinates provided
            location = None
            if latitude is not None and longitude is not None:
                try:
                    location = Location(latitude=latitude, longitude=longitude)
                except ValidationError as e:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "code": "INVALID_LOCATION",
                            "message": "Invalid location coordinates",
                            "details": {"validation_errors": e.errors()}
                        }
                    )
            
            # Get multimodal handler from app state
            handler = app.state.multimodal_handler
            
            # Process the request
            response = await handler.process_request(
                text=text,
                location=location,
                image=image
            )
            
            return response
            
        except HTTPException:
            # Re-raise HTTP exceptions (they'll be handled by the exception handler)
            raise
        except Exception as e:
            logger.error(f"Chat endpoint error: {e}")
            raise HTTPException(
                status_code=500,
                detail={
                    "code": "PROCESSING_ERROR",
                    "message": "Failed to process chat request",
                    "details": {"error": str(e)}
                }
            )
    
    return app


# Create the application instance
app = create_app()