#!/usr/bin/env python3
"""
Manual test using the reference code format
"""

from google.cloud import discoveryengine_v1 as discoveryengine
from google.api_core.client_options import ClientOptions
from google.oauth2 import service_account
import os
from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

# 환경변수 가져오기 (.env에 있는 값)
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT_ID")  # 994117812268
LOCATION = os.getenv("VERTEX_SEARCH_LOCATION", "global")
ENGINE_ID = os.getenv("SEARCH_ENGINE_ID")  # medical-search-app_1766819569993

def search_medical_manual(query_text: str):
    print(f"🔍 Manual search test...")
    print(f"PROJECT_ID: {PROJECT_ID}")
    print(f"LOCATION: {LOCATION}")
    print(f"ENGINE_ID: {ENGINE_ID}")
    
    try:
        # Load service account credentials
        credentials = service_account.Credentials.from_service_account_file(
            "service-account-key.json",
            scopes=['https://www.googleapis.com/auth/cloud-platform']
        )
        print(f"✅ Loaded credentials for project: {credentials.project_id}")
        
        # 1. 클라이언트 옵션 설정 (Global인 경우 endpoint 지정 필요 없음)
        client_options = (
            ClientOptions(api_endpoint=f"{LOCATION}-discoveryengine.googleapis.com")
            if LOCATION != "global" 
            else None
        )
        print(f"✅ Client options: {client_options}")
        
        # 2. 클라이언트 생성
        client = discoveryengine.SearchServiceClient(
            credentials=credentials,
            client_options=client_options
        )
        print(f"✅ Created client")
        
        # 3. 정확한 경로(Serving Config) 생성 - Engine 기준
        serving_config = f"projects/{PROJECT_ID}/locations/{LOCATION}/collections/default_collection/engines/{ENGINE_ID}/servingConfigs/default_search"
        print(f"✅ Generated serving config: {serving_config}")
        
        # 4. 요청 보내기
        request = discoveryengine.SearchRequest(
            serving_config=serving_config,
            query=query_text,
            page_size=3,
            content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
                snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(
                    return_snippet=True
                ),
            ),
        )
        print(f"✅ Created request")
        
        response = client.search(request)
        print(f"✅ Search successful!")
        
        # Print results
        for i, result in enumerate(response.results):
            print(f"Result {i+1}: {result.document.id}")
            
        return response
        
    except Exception as e:
        print(f"❌ Error searching: {e}")
        return None

if __name__ == "__main__":
    result = search_medical_manual("화상 응급처치")