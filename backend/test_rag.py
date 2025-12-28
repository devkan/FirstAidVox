#!/usr/bin/env python3
"""
Simple test script for RAG functionality
"""

import asyncio
import os
from app.services.search_service import VertexSearchClient

async def test_search():
    """Test the Vertex AI Search functionality"""
    try:
        print("🔍 Testing Vertex AI Search...")
        
        # Initialize search client
        search_client = VertexSearchClient()
        await search_client.initialize()
        
        print("✅ Search client initialized successfully")
        
        # Test search
        query = "fever and headache symptoms"
        print(f"🔎 Searching for: '{query}'")
        
        results = await search_client.search_medical_documents(
            query=query,
            max_results=3,
            include_snippets=True
        )
        
        print(f"📄 Found {len(results)} results:")
        for i, result in enumerate(results, 1):
            print(f"\n--- Result {i} ---")
            print(f"Title: {result.get('title', 'N/A')}")
            print(f"Content: {result.get('content', 'N/A')[:200]}...")
            print(f"Snippet: {result.get('snippet', 'N/A')}")
            print(f"Score: {result.get('relevance_score', 'N/A')}")
        
        # Test context formatting
        context = search_client.format_search_results_for_context(results)
        print(f"\n📝 Formatted context:\n{context[:500]}...")
        
        print("\n✅ RAG test completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during RAG test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_search())