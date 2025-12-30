#!/usr/bin/env python3
"""Test Korean input directly with Gemini"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.services.ai_service_conversational import ConversationalGeminiClient

async def test_korean():
    client = ConversationalGeminiClient()
    await client.initialize()
    
    # Test Korean input
    korean_text = "머리가 아파요"
    print(f"Testing Korean input: '{korean_text}'")
    
    response = await client.generate_conversational_response(
        text=korean_text,
        conversation_history=[]
    )
    
    print(f"Response: {response.text}")
    print(f"Brief: {response.brief_text}")
    print(f"Detailed: {response.detailed_text}")
    print(f"Metadata: {response.metadata}")

if __name__ == "__main__":
    asyncio.run(test_korean())