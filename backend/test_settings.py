#!/usr/bin/env python3
"""
Test settings loading
"""

from config.settings import get_settings

def test_settings():
    """Test settings loading"""
    
    print("🔧 Testing settings loading...\n")
    
    try:
        settings = get_settings()
        
        print(f"Google Cloud Project ID: {settings.google_cloud_project_id}")
        print(f"Google Cloud Location: {settings.google_cloud_location}")
        print(f"Data Store ID: {settings.data_store_id}")
        print(f"Service Account Key Path: {settings.service_account_key_path}")
        
    except Exception as e:
        print(f"❌ Error loading settings: {e}")

if __name__ == "__main__":
    test_settings()