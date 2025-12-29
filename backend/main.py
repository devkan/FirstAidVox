"""
Main entry point for FirstAidVox Backend.
Runs the FastAPI application with uvicorn server.
"""

import uvicorn
from config.logging import setup_logging, get_logger
from config.settings import get_settings


def main():
    """Main application entry point."""
    # Initialize logging
    setup_logging()
    logger = get_logger("main")
    
    # Load settings
    settings = get_settings()
    logger.info(f"Starting FirstAidVox Backend in {settings.environment} mode")
    
    # Run FastAPI application with uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=3001,
        log_level=settings.log_level.lower(),
        reload=settings.debug,
        access_log=True
    )


if __name__ == "__main__":
    main()