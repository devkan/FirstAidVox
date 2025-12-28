"""
Logging configuration for FirstAidVox Backend.
Provides structured logging for requests, external service calls, and errors.
"""

import logging
import logging.config
import logging.handlers
import sys
from typing import Dict, Any
from datetime import datetime
import json
import time
import uuid
from contextvars import ContextVar

from .settings import get_settings


# Context variables for request tracking
request_id_var: ContextVar[str] = ContextVar('request_id', default='')
request_start_time_var: ContextVar[float] = ContextVar('request_start_time', default=0.0)


class StructuredFormatter(logging.Formatter):
    """Custom formatter that outputs structured JSON logs."""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured JSON."""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Add request ID from context if available
        request_id = request_id_var.get('')
        if request_id:
            log_entry["request_id"] = request_id
        
        # Add extra fields if present
        if hasattr(record, "request_id"):
            log_entry["request_id"] = record.request_id
        
        if hasattr(record, "service_name"):
            log_entry["service_name"] = record.service_name
        
        if hasattr(record, "response_time_ms"):
            log_entry["response_time_ms"] = record.response_time_ms
        
        if hasattr(record, "endpoint"):
            log_entry["endpoint"] = record.endpoint
        
        if hasattr(record, "status_code"):
            log_entry["status_code"] = record.status_code
        
        if hasattr(record, "client_ip"):
            log_entry["client_ip"] = record.client_ip
        
        if hasattr(record, "user_agent"):
            log_entry["user_agent"] = record.user_agent
        
        if hasattr(record, "method"):
            log_entry["method"] = record.method
        
        if hasattr(record, "input_summary"):
            log_entry["input_summary"] = record.input_summary
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        # Add stack trace for errors
        if record.levelno >= logging.ERROR and record.stack_info:
            log_entry["stack_trace"] = record.stack_info
        
        return json.dumps(log_entry, ensure_ascii=False)


class RequestLogger:
    """Utility class for structured request logging."""
    
    def __init__(self, logger_name: str = "firstaidvox.requests"):
        self.logger = logging.getLogger(logger_name)
    
    def log_request_start(self, request_id: str, method: str, path: str, client_ip: str = None, user_agent: str = None):
        """Log the start of a request with sanitized information."""
        # Set context variables
        request_id_var.set(request_id)
        request_start_time_var.set(time.time())
        
        # Sanitize user agent (remove non-printable characters)
        sanitized_user_agent = None
        if user_agent:
            sanitized_user_agent = ''.join(c for c in user_agent if c.isprintable())[:200]
        
        self.logger.info(
            f"Request started - {method} {path}",
            extra={
                "request_id": request_id,
                "method": method,
                "endpoint": path,
                "client_ip": client_ip or "unknown",
                "user_agent": sanitized_user_agent,
                "event_type": "request_start"
            }
        )
    
    def log_request_end(self, request_id: str, status_code: int, response_time_ms: float):
        """Log the completion of a request with timing information."""
        self.logger.info(
            f"Request completed - Status: {status_code}, Time: {response_time_ms:.1f}ms",
            extra={
                "request_id": request_id,
                "status_code": status_code,
                "response_time_ms": response_time_ms,
                "event_type": "request_end"
            }
        )
    
    def log_request_error(self, request_id: str, error: Exception, response_time_ms: float = None):
        """Log request errors with context information."""
        self.logger.error(
            f"Request failed - {type(error).__name__}: {str(error)}",
            extra={
                "request_id": request_id,
                "error_type": type(error).__name__,
                "error_message": str(error),
                "response_time_ms": response_time_ms,
                "event_type": "request_error"
            },
            exc_info=True
        )
    
    def log_input_summary(self, request_id: str, input_type: str, input_size: int, has_image: bool = False):
        """Log sanitized input summary without exposing sensitive data."""
        summary = {
            "type": input_type,
            "text_length": input_size,
            "has_image": has_image,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        self.logger.info(
            f"Input processed - Type: {input_type}, Size: {input_size} chars",
            extra={
                "request_id": request_id,
                "input_summary": summary,
                "event_type": "input_processed"
            }
        )


class ServiceLogger:
    """Utility class for structured external service logging."""
    
    def __init__(self, logger_name: str = "firstaidvox.services"):
        self.logger = logging.getLogger(logger_name)
    
    def log_service_call_start(self, service_name: str, endpoint: str, request_id: str = None):
        """Log the start of an external service call."""
        if not request_id:
            request_id = request_id_var.get('')
        
        self.logger.info(
            f"External service call started - {service_name}",
            extra={
                "request_id": request_id,
                "service_name": service_name,
                "endpoint": endpoint,
                "event_type": "service_call_start"
            }
        )
    
    def log_service_call_end(self, service_name: str, endpoint: str, response_time_ms: float, success: bool = True, request_id: str = None):
        """Log the completion of an external service call."""
        if not request_id:
            request_id = request_id_var.get('')
        
        status = "success" if success else "failure"
        self.logger.info(
            f"External service call completed - {service_name} ({status}), Time: {response_time_ms:.1f}ms",
            extra={
                "request_id": request_id,
                "service_name": service_name,
                "endpoint": endpoint,
                "response_time_ms": response_time_ms,
                "success": success,
                "event_type": "service_call_end"
            }
        )
    
    def log_service_error(self, service_name: str, endpoint: str, error: Exception, response_time_ms: float = None, request_id: str = None):
        """Log external service errors with context."""
        if not request_id:
            request_id = request_id_var.get('')
        
        self.logger.error(
            f"External service call failed - {service_name}: {str(error)}",
            extra={
                "request_id": request_id,
                "service_name": service_name,
                "endpoint": endpoint,
                "error_type": type(error).__name__,
                "error_message": str(error),
                "response_time_ms": response_time_ms,
                "event_type": "service_call_error"
            },
            exc_info=True
        )


class MetricsCollector:
    """Collects and exposes metrics for Google Cloud Run monitoring."""
    
    def __init__(self):
        self.logger = logging.getLogger("firstaidvox.metrics")
        self._request_count = 0
        self._error_count = 0
        self._total_response_time = 0.0
        self._service_call_count = {}
        self._service_error_count = {}
    
    def increment_request_count(self):
        """Increment total request count."""
        self._request_count += 1
    
    def increment_error_count(self):
        """Increment total error count."""
        self._error_count += 1
    
    def record_response_time(self, response_time_ms: float):
        """Record response time for averaging."""
        self._total_response_time += response_time_ms
    
    def increment_service_call(self, service_name: str):
        """Increment service call count for a specific service."""
        self._service_call_count[service_name] = self._service_call_count.get(service_name, 0) + 1
    
    def increment_service_error(self, service_name: str):
        """Increment service error count for a specific service."""
        self._service_error_count[service_name] = self._service_error_count.get(service_name, 0) + 1
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics for monitoring."""
        avg_response_time = 0.0
        if self._request_count > 0:
            avg_response_time = self._total_response_time / self._request_count
        
        error_rate = 0.0
        if self._request_count > 0:
            error_rate = (self._error_count / self._request_count) * 100
        
        return {
            "request_count": self._request_count,
            "error_count": self._error_count,
            "error_rate_percent": round(error_rate, 2),
            "average_response_time_ms": round(avg_response_time, 2),
            "service_calls": self._service_call_count.copy(),
            "service_errors": self._service_error_count.copy(),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    
    def log_metrics(self):
        """Log current metrics for monitoring systems."""
        metrics = self.get_metrics()
        self.logger.info(
            "Application metrics",
            extra={
                "metrics": metrics,
                "event_type": "metrics_snapshot"
            }
        )


# Global instances
_metrics_collector = None
_request_logger = None
_service_logger = None


def get_metrics_collector() -> MetricsCollector:
    """Get the global metrics collector instance."""
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector()
    return _metrics_collector


def get_request_logger() -> RequestLogger:
    """Get the global request logger instance."""
    global _request_logger
    if _request_logger is None:
        _request_logger = RequestLogger()
    return _request_logger


def get_service_logger() -> ServiceLogger:
    """Get the global service logger instance."""
    global _service_logger
    if _service_logger is None:
        _service_logger = ServiceLogger()
    return _service_logger


def get_logging_config() -> Dict[str, Any]:
    """Get logging configuration based on environment settings."""
    
    settings = get_settings()
    
    # Use structured JSON logging for production, simple format for development
    if settings.environment == "production":
        formatter_class = "config.logging.StructuredFormatter"
        format_string = None
        log_level = "INFO"  # Force INFO level in production for Google Cloud Logging
    else:
        formatter_class = "logging.Formatter"
        format_string = (
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        log_level = settings.log_level
    
    handlers = {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
            "stream": sys.stdout,
        },
    }
    
    # Add file handler for production environments
    if settings.environment == "production":
        handlers["file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "formatter": "default",
            "filename": "/app/logs/firstaidvox.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
            "encoding": "utf-8",
        }
    
    config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "class": formatter_class,
            },
        },
        "handlers": handlers,
        "loggers": {
            "firstaidvox": {
                "level": log_level,
                "handlers": list(handlers.keys()),
                "propagate": False,
            },
            "uvicorn": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False,
            },
            "uvicorn.access": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False,
            },
            # Add Google Cloud specific loggers
            "google.cloud": {
                "level": "WARNING",
                "handlers": ["console"],
                "propagate": False,
            },
            "google.auth": {
                "level": "WARNING", 
                "handlers": ["console"],
                "propagate": False,
            },
            "urllib3": {
                "level": "WARNING",
                "handlers": ["console"],
                "propagate": False,
            },
        },
        "root": {
            "level": log_level,
            "handlers": list(handlers.keys()),
        },
    }
    
    # Add format string for simple formatter
    if format_string:
        config["formatters"]["default"]["format"] = format_string
    
    return config


def setup_logging() -> None:
    """Configure logging for the application."""
    config = get_logging_config()
    logging.config.dictConfig(config)
    
    # Create application logger
    logger = logging.getLogger("firstaidvox")
    settings = get_settings()
    logger.info(
        "Logging configured",
        extra={
            "log_level": settings.log_level,
            "environment": settings.environment,
        }
    )


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance for the given name."""
    return logging.getLogger(f"firstaidvox.{name}")