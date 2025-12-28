# Backend Service Integration Layer

This module provides a comprehensive HTTP client service for backend API communication with the FirstAidVox medical analysis system.

## Features

- **Medical Query Submission**: Send voice-transcribed text for medical analysis
- **Image Upload**: Upload photos for visual medical assessment
- **Hospital Data Fetching**: Get nearby hospitals based on location
- **Error Handling**: Robust error handling with retry mechanisms
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Usage

```typescript
import { backendService } from './services';

// Send a medical query
try {
  const response = await backendService.sendMedicalQuery("I have a headache and fever");
  console.log('Medical assessment:', response.condition);
  console.log('Urgency level:', response.urgencyLevel);
  console.log('Advice:', response.advice);
} catch (error) {
  console.error('Medical query failed:', error.message);
}

// Upload an image for analysis
try {
  const imageBlob = new Blob([imageData], { type: 'image/jpeg' });
  const uploadResult = await backendService.uploadImage(imageBlob);
  
  // Use the uploaded image in a medical query
  const analysisResult = await backendService.sendMedicalQuery(
    "What do you see in this image?", 
    uploadResult.id
  );
} catch (error) {
  console.error('Image upload failed:', error.message);
}

// Get nearby hospitals
try {
  const hospitals = await backendService.getHospitals(
    { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
    25 // 25km radius
  );
  console.log('Found hospitals:', hospitals.length);
} catch (error) {
  console.error('Hospital search failed:', error.message);
}
```

## Error Handling

The service implements comprehensive error handling:

- **Automatic Retries**: Exponential backoff for retryable errors (5xx, timeouts)
- **Validation**: Client-side validation for image formats, sizes, and coordinates
- **Timeouts**: 15-second timeout for all requests
- **Circuit Breaking**: Graceful degradation for service unavailability

## Configuration

Set the API base URL via environment variable:

```bash
VITE_API_BASE_URL=https://your-api-server.com/api
```

Default: `http://localhost:3001/api`

## Requirements Validation

This implementation validates the following requirements:

- **Requirements 1.3**: Backend communication integrity for voice queries
- **Requirements 2.3**: Photo upload integration with medical analysis
- **Requirements 3.1**: Hospital data fetching functionality