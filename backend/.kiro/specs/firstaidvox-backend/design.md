# FirstAidVox Backend Design Document

## Overview

The FirstAidVox backend is a FastAPI-based microservice deployed on Google Cloud Run that provides emergency medical triage through AI-powered analysis. The system integrates three core services: Vertex AI for intelligent medical advice and vision analysis, Google Maps Places API for location-based hospital search, and supports multimodal input processing for comprehensive emergency response.

The architecture prioritizes low-latency responses (sub-3 second) critical for emergency situations while maintaining reliability and security through proper error handling and Google Cloud service integration.

## Architecture

The system follows a service-oriented architecture with clear separation of concerns:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │───▶│  FirstAidVox     │───▶│   Vertex AI     │
│                 │    │    Backend       │    │   (Gemini)      │
└─────────────────┘    │                  │    └─────────────────┘
                       │                  │
                       │                  │    ┌─────────────────┐
                       │                  │───▶│  Google Maps    │
                       │                  │    │  Places API     │
                       └──────────────────┘    └─────────────────┘
```

### Core Components:
- **API Layer**: FastAPI endpoints for client communication
- **AI Service**: Vertex AI integration with Gemini model
- **Location Service**: Google Maps Places API integration
- **Multimodal Handler**: Image and text processing coordination
- **Function Calling Engine**: Tool invocation management for hospital search

## Components and Interfaces

### 1. API Layer (`app/api/`)
- **ChatEndpoint**: Handles POST /chat requests with multimodal input
- **HealthEndpoint**: Provides GET /health system status
- **Middleware**: CORS, logging, error handling

### 2. AI Service (`app/services/ai_service.py`)
- **GeminiClient**: Manages Vertex AI Gemini model interactions
- **PromptManager**: Handles system prompt configuration and RAG concepts
- **FunctionRegistry**: Manages available tools for function calling

### 3. Location Service (`app/services/location_service.py`)
- **GoogleMapsClient**: Interfaces with Places API
- **HospitalSearcher**: Implements search_hospitals function
- **LocationValidator**: Validates coordinate inputs

### 4. Multimodal Handler (`app/handlers/multimodal.py`)
- **InputProcessor**: Validates and processes text/image inputs
- **ImageHandler**: Manages image upload, validation, and encoding
- **RequestCoordinator**: Orchestrates AI service calls

### 5. Models (`app/models/`)
- **ChatRequest**: Input validation schema
- **ChatResponse**: Response format definition
- **HospitalResult**: Hospital search result structure
- **ErrorResponse**: Standardized error format

## Data Models

### Request Models
```python
class ChatRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    location: Optional[Location] = None
    image: Optional[UploadFile] = None

class Location(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
```

### Response Models
```python
class ChatResponse(BaseModel):
    advice: str
    hospitals: Optional[List[HospitalResult]] = None
    confidence_level: str
    timestamp: datetime

class HospitalResult(BaseModel):
    name: str
    address: str
    distance_km: float
    place_id: str
    rating: Optional[float] = None
```

### Internal Models
```python
class FunctionCall(BaseModel):
    name: str
    parameters: Dict[str, Any]

class AIResponse(BaseModel):
    text: str
    function_calls: List[FunctionCall] = []
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several properties can be consolidated to eliminate redundancy:
- Properties 5.3 and 5.4 (HTTPS connections) can be combined into one comprehensive security property
- Properties 7.1, 7.2, and 7.3 (logging behaviors) can be combined into one comprehensive logging property
- Properties 4.4 and 3.5 (error responses) overlap and can be consolidated

### Core Properties

**Property 1: Multimodal input processing**
*For any* valid text input with or without image data, the system should successfully process the input and return a medical advice response containing the required fields
**Validates: Requirements 1.1, 1.2**

**Property 2: Response time performance**
*For any* medical query input, the system should return a complete response within 3 seconds
**Validates: Requirements 1.5**

**Property 3: Location coordinate handling**
*For any* valid latitude and longitude coordinates, the system should successfully parse and store the location data for potential hospital search
**Validates: Requirements 2.1, 3.4**

**Property 4: Function calling round trip**
*For any* hospital search request, when the Gemini model invokes the search_hospitals function, the system should execute the function and return results to the model for inclusion in the response
**Validates: Requirements 6.2, 6.3, 6.4**

**Property 5: Hospital search data structure**
*For any* successful hospital search, the returned JSON should contain hospital names, addresses, distances, and place IDs in the correct format
**Validates: Requirements 2.4**

**Property 6: Input validation and sanitization**
*For any* text or image input, the system should validate format and content before processing, rejecting invalid inputs with appropriate error messages
**Validates: Requirements 3.1, 3.3, 3.5**

**Property 7: Error handling consistency**
*For any* invalid input or system error, the system should return a JSON error response with appropriate HTTP status codes and clear error messages
**Validates: Requirements 3.2, 4.4**

**Property 8: API response format consistency**
*For any* successful chat request, the response should contain AI advice text and optional hospital data in the specified JSON structure
**Validates: Requirements 4.3**

**Property 9: CORS header inclusion**
*For any* API endpoint response, CORS headers should be included to support web client applications
**Validates: Requirements 4.5**

**Property 10: Secure connections**
*For any* external API call to Vertex AI or Google Maps, the system should use HTTPS connections
**Validates: Requirements 5.3, 5.4**

**Property 11: Function calling behavior**
*For any* query where hospital search is not needed, the response should contain only text advice without hospital data
**Validates: Requirements 6.5**

**Property 12: Comprehensive logging**
*For any* request, external service call, or error, the system should generate appropriate log entries with required information (timestamps, endpoints, sanitized inputs, service names, response times, error details)
**Validates: Requirements 7.1, 7.2, 7.3**

## Error Handling

### Input Validation Errors
- **Invalid coordinates**: Return 400 with clear message about coordinate format
- **Unsupported image formats**: Return 400 with supported format list
- **Oversized images**: Return 413 with size limit information
- **Missing required fields**: Return 400 with field validation details

### External Service Errors
- **Vertex AI failures**: Retry with exponential backoff, fallback to generic advice
- **Google Maps API failures**: Return response without hospital data, log error
- **Network timeouts**: Return 504 with retry suggestion
- **Authentication failures**: Return 503 with service unavailable message

### System Errors
- **Memory exhaustion**: Return 503 with resource limitation message
- **Unexpected exceptions**: Return 500 with generic error, log full details
- **Configuration errors**: Fail fast on startup with clear error messages

### Error Response Format
```python
{
    "error": {
        "code": "INVALID_INPUT",
        "message": "Image format not supported",
        "details": {
            "supported_formats": ["jpg", "png", "webp"],
            "received_format": "gif"
        }
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_123456"
}
```

## Testing Strategy

### Unit Testing Approach
The system will use **pytest** for unit testing with the following focus areas:
- Input validation functions with specific examples
- Error handling edge cases
- API endpoint parameter parsing
- Response format validation
- Configuration loading and validation

### Property-Based Testing Approach
The system will use **Hypothesis** for property-based testing with a minimum of 100 iterations per test:
- Each property-based test will run 100+ random test cases
- Tests will be tagged with comments referencing design document properties
- Tag format: `**Feature: firstaidvox-backend, Property {number}: {property_text}**`
- Generators will create realistic medical query inputs, coordinate ranges, and image data
- Properties will verify system behavior across the full input space

### Integration Testing
- End-to-end API testing with real Google Cloud services in staging environment
- Mock external services for isolated testing
- Performance testing to verify sub-3-second response times
- Security testing for input sanitization and credential handling

### Test Data Generation
- Medical query generators with various emergency scenarios
- Coordinate generators covering global latitude/longitude ranges
- Image generators with different formats, sizes, and corruption patterns
- Error condition generators for comprehensive failure testing

The dual testing approach ensures both specific edge cases (unit tests) and general correctness across all inputs (property tests) are validated, providing comprehensive coverage for this critical emergency response system.