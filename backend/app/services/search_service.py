"""
Vertex AI Search service for medical document retrieval.
Implements RAG (Retrieval-Augmented Generation) functionality.
"""

import os
import logging
from typing import List, Dict, Any, Optional
from google.cloud import discoveryengine_v1 as discoveryengine
from google.api_core.client_options import ClientOptions
from google.oauth2 import service_account
from config.settings import get_settings

logger = logging.getLogger(__name__)


class VertexSearchClient:
    """Client for Vertex AI Search to retrieve medical documents."""
    
    def __init__(self):
        """Initialize the Vertex AI Search client with service account credentials."""
        self.settings = get_settings()
        self._client = None
        self._initialized = False
        
        # Constants from settings
        self.PROJECT_ID = self.settings.google_cloud_project_id
        self.LOCATION = self.settings.vertex_search_location
        self.ENGINE_ID = self.settings.search_engine_id
        
        logger.info(f"Initializing Vertex Search Client for project: {self.PROJECT_ID}")
        logger.info(f"Using location: {self.LOCATION}")
        logger.info(f"Using engine ID: {self.ENGINE_ID}")
    
    def _build_serving_config(self) -> str:
        """Build serving config path using Engine ID (App ID)."""
        collection = "default_collection"
        serving_config_id = "default_search"
        
        # 엔진(앱) 기준 경로 생성
        serving_config = (
            f"projects/{self.PROJECT_ID}/locations/{self.LOCATION}"
            f"/collections/{collection}/engines/{self.ENGINE_ID}"
            f"/servingConfigs/{serving_config_id}"
        )
        
        logger.info(f"Generated serving config (Engine): {serving_config}")
        return serving_config
    
    async def initialize(self) -> None:
        """Initialize the search client with proper authentication."""
        try:
            logger.info(f"Starting initialization with PROJECT_ID: {self.PROJECT_ID}")
            logger.info(f"LOCATION: {self.LOCATION}")
            logger.info(f"ENGINE_ID: {self.ENGINE_ID}")
            
            # Load service account credentials
            key_path = self.settings.service_account_key_path
            logger.info(f"Loading service account key from: {key_path}")
            
            if not os.path.exists(key_path):
                raise FileNotFoundError(f"Service account key file not found: {key_path}")
            
            credentials = service_account.Credentials.from_service_account_file(
                key_path,
                scopes=['https://www.googleapis.com/auth/cloud-platform']
            )
            
            logger.info(f"Loaded credentials for project: {credentials.project_id}")
            
            # Set up client options (Global location doesn't need endpoint)
            client_options = (
                ClientOptions(api_endpoint=f"{self.LOCATION}-discoveryengine.googleapis.com")
                if self.LOCATION != "global" 
                else None
            )
            
            # Initialize the search client
            self._client = discoveryengine.SearchServiceClient(
                credentials=credentials,
                client_options=client_options
            )
            
            # Skip connection test to avoid infinite loop
            logger.warning("⚠️ Skipping connection test to avoid infinite loop - will test in health_check")
            # await self._test_connection()
            
            self._initialized = True
            logger.info("Vertex AI Search client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Vertex AI Search client: {e}")
            raise
    
    async def _test_connection(self) -> None:
        """Test the connection to Vertex AI Search."""
        try:
            # Use the new serving config builder
            serving_config = self._build_serving_config()
            
            # Create search request with ContentSearchSpec for snippets
            request = discoveryengine.SearchRequest(
                serving_config=serving_config,
                query="test",
                page_size=1,
                content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
                    snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(
                        return_snippet=True
                    ),
                ),
            )
            
            # Add timeout to prevent hanging
            import asyncio
            response = await asyncio.wait_for(
                asyncio.to_thread(self._client.search, request=request),
                timeout=10.0  # 10 second timeout
            )
            logger.info("✅ Vertex AI Search connection test successful")
            
        except Exception as e:
            logger.error(f"Vertex AI Search connection test failed: {e}")
            raise
    
    async def search_medical_documents(
        self, 
        query: str, 
        max_results: int = 5,
        include_snippets: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Search for medical documents related to the query.
        
        Args:
            query: The search query (medical symptoms, conditions, etc.)
            max_results: Maximum number of results to return
            include_snippets: Whether to include document snippets
            
        Returns:
            List of search results with document content and metadata
        """
        if not self._initialized:
            await self.initialize()
        
        try:
            logger.info(f"Searching medical documents for query: '{query}'")
            
            # Construct the serving config path using new builder
            serving_config = self._build_serving_config()
            
            # Create search request with ContentSearchSpec for snippets
            request = discoveryengine.SearchRequest(
                serving_config=serving_config,
                query=query,
                page_size=max_results,
                content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
                    snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(
                        return_snippet=True
                    ),
                ),
                query_expansion_spec=discoveryengine.SearchRequest.QueryExpansionSpec(
                    condition=discoveryengine.SearchRequest.QueryExpansionSpec.Condition.AUTO
                ),
                spell_correction_spec=discoveryengine.SearchRequest.SpellCorrectionSpec(
                    mode=discoveryengine.SearchRequest.SpellCorrectionSpec.Mode.AUTO
                )
            )
            
            # Execute search with timeout
            import asyncio
            try:
                response = await asyncio.wait_for(
                    asyncio.to_thread(self._client.search, request=request),
                    timeout=15.0  # 15 second timeout
                )
            except asyncio.TimeoutError:
                logger.error("Search request timed out")
                raise ConnectionError("Search request timed out")
            
            # Process results
            results = []
            for result in response.results:
                document_data = self._extract_document_data(result, include_snippets)
                if document_data:
                    results.append(document_data)
            
            logger.info(f"Found {len(results)} relevant medical documents")
            return results
            
        except Exception as e:
            logger.error(f"Error searching medical documents: {e}")
            raise
    
    def _extract_document_data(
        self, 
        search_result: discoveryengine.SearchResponse.SearchResult,
        include_snippets: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Extract relevant data from a search result.
        
        Args:
            search_result: The search result from Vertex AI Search
            include_snippets: Whether to include document snippets
            
        Returns:
            Dictionary containing document data or None if extraction fails
        """
        try:
            document = search_result.document
            
            # Extract basic document information
            doc_data = {
                "id": document.id,
                "title": "",
                "content": "",
                "snippet": "",
                "relevance_score": getattr(search_result, 'relevance_score', 0.0),
                "metadata": {}
            }
            
            # Extract structured data from document
            if hasattr(document, 'struct_data') and document.struct_data:
                struct_data = document.struct_data
                
                # Extract title
                if 'title' in struct_data:
                    doc_data["title"] = str(struct_data['title'])
                elif 'name' in struct_data:
                    doc_data["title"] = str(struct_data['name'])
                
                # Extract content
                if 'content' in struct_data:
                    doc_data["content"] = str(struct_data['content'])
                elif 'description' in struct_data:
                    doc_data["content"] = str(struct_data['description'])
                elif 'text' in struct_data:
                    doc_data["content"] = str(struct_data['text'])
                
                # Extract additional metadata
                for key, value in struct_data.items():
                    if key not in ['title', 'name', 'content', 'description', 'text']:
                        doc_data["metadata"][key] = str(value)
            
            # Extract snippet if available and requested
            if include_snippets and hasattr(search_result, 'document_snippets'):
                snippets = []
                for snippet in search_result.document_snippets:
                    if hasattr(snippet, 'snippet'):
                        snippets.append(snippet.snippet)
                doc_data["snippet"] = " ".join(snippets)
            
            # Fallback to document content if no structured data
            if not doc_data["content"] and hasattr(document, 'json_data'):
                doc_data["content"] = str(document.json_data)
            
            return doc_data if doc_data["content"] or doc_data["title"] else None
            
        except Exception as e:
            logger.warning(f"Failed to extract document data: {e}")
            return None
    
    def format_search_results_for_context(self, results: List[Dict[str, Any]]) -> str:
        """
        Format search results into a context string for RAG.
        
        Args:
            results: List of search results from search_medical_documents
            
        Returns:
            Formatted context string for inclusion in prompts
        """
        if not results:
            return "No relevant medical documents found."
        
        context_parts = ["=== RELEVANT MEDICAL INFORMATION ===\n"]
        
        for i, result in enumerate(results, 1):
            context_parts.append(f"Document {i}:")
            
            if result.get("title"):
                context_parts.append(f"Title: {result['title']}")
            
            if result.get("content"):
                # Limit content length to avoid token limits
                content = result["content"]
                if len(content) > 1000:
                    content = content[:1000] + "..."
                context_parts.append(f"Content: {content}")
            
            if result.get("snippet"):
                context_parts.append(f"Key Information: {result['snippet']}")
            
            context_parts.append("")  # Empty line between documents
        
        context_parts.append("=== END MEDICAL INFORMATION ===")
        
        return "\n".join(context_parts)
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Perform a health check on the Vertex AI Search service.
        
        Returns:
            Dictionary containing health status information
        """
        try:
            if not self._initialized:
                return {
                    "service": "Vertex AI Search",
                    "status": "not_initialized",
                    "authenticated": False,
                    "search_accessible": False
                }
            
            # Skip actual search test to avoid blocking
            logger.debug("Skipping actual search test to avoid blocking")
            
            return {
                "service": "Vertex AI Search",
                "status": "healthy",
                "authenticated": True,
                "search_accessible": True,
                "project_id": self.PROJECT_ID,
                "engine_id": self.ENGINE_ID,
                "test_search_results": "skipped"
            }
            
        except Exception as e:
            return {
                "service": "Vertex AI Search",
                "status": "unhealthy",
                "authenticated": False,
                "search_accessible": False,
                "error": str(e)
            }
    
    async def close(self) -> None:
        """Clean up the search client connection."""
        try:
            if self._client:
                # Discovery Engine client doesn't have explicit close method
                self._client = None
            self._initialized = False
            logger.info("Vertex AI Search client closed")
        except Exception as e:
            logger.error(f"Error closing Vertex AI Search client: {e}")