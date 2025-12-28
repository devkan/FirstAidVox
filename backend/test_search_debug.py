#!/usr/bin/env python3
"""
Debug test for search service
"""

import logging
import asyncio
from app.services.search_service import VertexSearchClient

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

async def test_search_debug():
    """Debug test for search service"""
    
    print("🔍 Debug testing Vertex AI Search...\n")
    
    try:
        search_client = VertexSearchClient()
        print(f"Created client with PROJECT_ID: {search_client.PROJECT_ID}")
        print(f"LOCATION: {search_client.LOCATION}")
        print(f"DATA_STORE_ID: {search_client.DATA_STORE_ID}")
        
        await search_client.initialize()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        logger.exception("Full error details:")

if __name__ == "__main__":
    asyncio.run(test_search_debug())