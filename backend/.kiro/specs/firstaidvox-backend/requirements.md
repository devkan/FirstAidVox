# Requirements Document

## Introduction

FirstAidVox is an emergency medical triage system that provides real-time first-aid guidance through multimodal AI analysis. The backend orchestrates ElevenLabs for audio processing, Vertex AI for intelligent medical triage and vision analysis, and Google Maps for location-based hospital search. The system is deployed on Google Cloud Run using Python FastAPI to ensure low-latency responses during medical emergencies.

## Glossary

- **FirstAidVox Backend**: The FastAPI server that orchestrates AI services for emergency medical triage
- **Vertex AI**: Google Cloud's AI platform used for medical triage intelligence and vision analysis
- **Gemini Model**: The `gemini-1.5-flash-001` model used for low-latency medical advice generation
- **Google Maps Places API**: Service for locating nearby hospitals and pharmacies
- **Multimodal Input**: Combined text transcript and optional image data for medical analysis
- **Function Calling**: Vertex AI capability allowing the model to invoke predefined tools like hospital search
- **Medical Triage**: The process of determining the priority and appropriate response for medical situations

## Requirements

### Requirement 1

**User Story:** As a user in a medical emergency, I want to receive AI-powered first-aid guidance based on my description and optional injury photos, so that I can take appropriate immediate action.

#### Acceptance Criteria

1. WHEN a user submits a text description via the chat endpoint, THE FirstAidVox Backend SHALL send the text to the Gemini Model and return medical triage advice
2. WHEN a user submits both text and an image via the chat endpoint, THE FirstAidVox Backend SHALL send both inputs to Gemini Vision and return multimodal medical analysis
3. WHEN the Gemini Model generates advice, THE FirstAidVox Backend SHALL ensure the response follows standard first-aid protocols
4. IF the Gemini Model is uncertain about advice, THEN THE FirstAidVox Backend SHALL include a recommendation to visit a doctor immediately in the response
5. WHEN processing any medical query, THE FirstAidVox Backend SHALL return a response within 3 seconds to ensure timely emergency guidance

### Requirement 2

**User Story:** As a user seeking emergency medical care, I want to find nearby hospitals or pharmacies based on my current location, so that I can quickly access professional medical help.

#### Acceptance Criteria

1. WHEN a user provides location coordinates with their query, THE FirstAidVox Backend SHALL store the coordinates for potential hospital search
2. WHEN the Gemini Model determines hospital information is needed, THE FirstAidVox Backend SHALL invoke the search_hospitals function with the user's location
3. WHEN the search_hospitals function is invoked, THE FirstAidVox Backend SHALL query the Google Maps Places API for hospitals or pharmacies near the provided coordinates
4. WHEN hospital search results are retrieved, THE FirstAidVox Backend SHALL return structured JSON data containing hospital names, addresses, and distances
5. IF no location coordinates are provided and hospital search is needed, THEN THE FirstAidVox Backend SHALL return an error message requesting location information

### Requirement 3

**User Story:** As a system administrator, I want the backend to handle multimodal inputs reliably, so that users can submit various types of medical information without errors.

#### Acceptance Criteria

1. WHEN an image file is uploaded to the analyze endpoint, THE FirstAidVox Backend SHALL validate the image format and size before processing
2. WHEN processing multimodal input, THE FirstAidVox Backend SHALL handle missing or corrupted image data gracefully without crashing
3. WHEN text input is received, THE FirstAidVox Backend SHALL sanitize and validate the text before sending to Vertex AI
4. WHEN the chat endpoint receives a request, THE FirstAidVox Backend SHALL parse latitude and longitude coordinates from the location field
5. IF invalid input data is received, THEN THE FirstAidVox Backend SHALL return a clear error message with HTTP status code 400

### Requirement 4

**User Story:** As a developer integrating with FirstAidVox, I want clear API endpoints with consistent response formats, so that I can reliably build client applications.

#### Acceptance Criteria

1. THE FirstAidVox Backend SHALL expose a POST endpoint at /chat that accepts text, location, and optional image data
2. THE FirstAidVox Backend SHALL expose a GET endpoint at /health that returns server status information
3. WHEN the chat endpoint processes a request successfully, THE FirstAidVox Backend SHALL return JSON containing AI advice text and optional hospital data
4. WHEN any endpoint encounters an error, THE FirstAidVox Backend SHALL return JSON with an error message and appropriate HTTP status code
5. THE FirstAidVox Backend SHALL include CORS headers in all responses to support web client applications

### Requirement 5

**User Story:** As a system operator, I want the backend to integrate securely with Google Cloud services, so that user data and API credentials are protected.

#### Acceptance Criteria

1. WHEN the FirstAidVox Backend initializes, THE system SHALL authenticate with Vertex AI using Google Cloud credentials
2. WHEN the FirstAidVox Backend initializes, THE system SHALL authenticate with Google Maps Places API using a valid API key
3. WHEN making requests to Vertex AI, THE FirstAidVox Backend SHALL use secure HTTPS connections
4. WHEN making requests to Google Maps API, THE FirstAidVox Backend SHALL use secure HTTPS connections
5. THE FirstAidVox Backend SHALL store API keys and credentials in environment variables, not in source code

### Requirement 6

**User Story:** As a user, I want the AI to use function calling to intelligently determine when to search for hospitals, so that I receive location information only when relevant to my medical situation.

#### Acceptance Criteria

1. WHEN the FirstAidVox Backend initializes the Gemini Model, THE system SHALL register the search_hospitals function as an available tool
2. WHEN the Gemini Model determines hospital search is needed, THE FirstAidVox Backend SHALL receive a function call request from the model
3. WHEN a function call request is received, THE FirstAidVox Backend SHALL execute the search_hospitals function with the provided parameters
4. WHEN the search_hospitals function completes, THE FirstAidVox Backend SHALL send the results back to the Gemini Model for inclusion in the response
5. WHEN the Gemini Model does not invoke function calling, THE FirstAidVox Backend SHALL return only the text advice without hospital data

### Requirement 7

**User Story:** As a system administrator, I want the backend to provide comprehensive logging and monitoring, so that I can troubleshoot issues and monitor system health.

#### Acceptance Criteria

1. WHEN the FirstAidVox Backend receives a request, THE system SHALL log the request timestamp, endpoint, and sanitized input summary
2. WHEN the FirstAidVox Backend calls external services, THE system SHALL log the service name, request timestamp, and response time
3. WHEN an error occurs, THE FirstAidVox Backend SHALL log the error message, stack trace, and request context
4. THE FirstAidVox Backend SHALL expose metrics compatible with Google Cloud Run monitoring
5. WHEN the health endpoint is called, THE FirstAidVox Backend SHALL return status information including service availability and version number
