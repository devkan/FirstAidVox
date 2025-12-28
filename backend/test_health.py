#!/usr/bin/env python3
"""
Test health check for all services
"""

import asyncio
from app.services.search_service import VertexSearchClient
from app.services.ai_service import GeminiClient
from app.services.location_service import GoogleMapsClient

async def test_all_services():
    """Test all service health checks"""
    
    print("🏥 Testing all service health checks...\n")
    
    # Test Search Service
    print("1. Testing Vertex AI Search...")
    try:
        search_client = VertexSearchClient()
        await search_client.initialize()
        health = await search_client.health_check()
        print(f"   Status: {health}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print()
    
    # Test AI Service
    print("2. Testing Vertex AI Gemini...")
    try:
        ai_client = GeminiClient()
        await ai_client.initialize()
        health = await ai_client.health_check()
        print(f"   Status: {health}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print()
    
    # Test Maps Service
    print("3. Testing Google Maps...")
    try:
        maps_client = GoogleMapsClient()
        await maps_client.initialize()
        health = await maps_client.health_check()
        print(f"   Status: {health}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_all_services())