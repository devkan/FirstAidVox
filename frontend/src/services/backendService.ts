import type { HospitalLocation, Coordinates } from '../types/index';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';
import { offlineFallbackService } from './offlineFallback';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const DEFAULT_TIMEOUT = 15000; // 15 seconds as specified in design
const MAX_RETRIES = 3;

// Request/Response type definitions for single chat endpoint
export interface AgentRequest {
  text: string; // User voice transcript (required)
  latitude?: number; // User location latitude (optional)
  longitude?: number; // User location longitude (optional)
  image?: Blob; // User uploaded image file (optional)
}

// Conversation history message type
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Conversational chat request type
export interface ConversationalRequest {
  message: string;
  conversation_history: ConversationMessage[];
  user_location?: {
    latitude: number;
    longitude: number;
  };
  image_data?: string; // Base64 encoded image
}

export interface AgentResponse {
  response?: string; // AI agent response text for TTS
  advice?: string; // Alternative field name for response
  hospital_data?: HospitalLocation[]; // Hospital data if location services needed
  hospitals?: HospitalLocation[]; // Alternative field name for hospital data
  condition?: string; // Medical condition assessment
  urgencyLevel?: 'low' | 'moderate' | 'high'; // Urgency classification
  confidence_level?: 'low' | 'moderate' | 'high'; // Alternative field name for urgency
  confidence?: number; // Assessment confidence level
  timestamp?: string; // Response timestamp
  // Conversational response fields
  brief_text?: string; // Brief summary for TTS
  detailed_text?: string; // Detailed advice for display
  assessment_stage?: 'initial' | 'clarification' | 'final' | 'completed'; // Current stage
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  retryable?: boolean;
}

// Utility function for creating API errors
function createApiError(message: string, status?: number, retryable = false): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.retryable = retryable;
  return error;
}

// Exponential backoff retry mechanism with error handling integration
async function withRetry<T>(
  operation: () => Promise<T>,
  context: { component: string; action: string },
  maxRetries = MAX_RETRIES,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  // Use shorter delays in test environment
  const isTestEnvironment = import.meta.env.MODE === 'test' || import.meta.env.VITEST === 'true';
  const actualBaseDelay = isTestEnvironment ? 10 : baseDelay; // Much shorter delay for tests
  const actualMaxRetries = isTestEnvironment ? 1 : maxRetries; // Fewer retries for tests
  
  for (let attempt = 0; attempt <= actualMaxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Handle error through error handler
      errorHandler.handleBackendError(lastError, context.component, context.action);
      
      // Don't retry on non-retryable errors
      if (error instanceof Error && 'retryable' in error && !error.retryable) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === actualMaxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = actualBaseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// HTTP client with timeout and comprehensive error handling
async function httpRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  context: { component: string; action: string } = { component: 'BackendService', action: 'httpRequest' }
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  
  try {
    // Don't set Content-Type for FormData - let browser set it with boundary
    const headers: Record<string, string> = {};
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...headers,
        ...options.headers,
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const retryable = response.status >= 500 || response.status === 429;
      const error = createApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        retryable
      );
      
      // Handle error through error handler
      errorHandler.handleBackendError(error, context.component, context.action);
      throw error;
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = createApiError('Request timeout', 408, true);
      errorHandler.handleNetworkError(timeoutError, context.component, context.action);
      throw timeoutError;
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const networkError = createApiError('Network error', 0, true);
      errorHandler.handleNetworkError(networkError, context.component, context.action);
      throw networkError;
    }
    
    throw error;
  }
}

// Backend Service Implementation with single chat endpoint
export class BackendService {
  /**
   * Send message to AI agent with all data in single request
   * Validates: Requirements 1.3, 2.3, 3.1, 5.5
   */
  async sendMessageToAgent(
    transcript: string, 
    location?: Coordinates, 
    imageFile?: Blob
  ): Promise<AgentResponse> {
    console.log('🚀 BackendService.sendMessageToAgent called with:', { transcript, location, hasImage: !!imageFile });
    
    if (!transcript.trim()) {
      const error = createApiError('Transcript cannot be empty', 400, false);
      errorHandler.handleError(error, {
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.LOW,
        component: 'BackendService',
        action: 'sendMessageToAgent',
        timestamp: new Date()
      });
      throw error;
    }
    
    // Create FormData to handle text, location, and image in single request
    const formData = new FormData();
    formData.append('text', transcript.trim());
    
    // Add location data if provided
    if (location) {
      if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        const error = createApiError('Invalid location coordinates', 400, false);
        errorHandler.handleError(error, {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          component: 'BackendService',
          action: 'sendMessageToAgent',
          timestamp: new Date()
        });
        throw error;
      }
      
      if (Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) {
        const error = createApiError('Invalid coordinate values', 400, false);
        errorHandler.handleError(error, {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          component: 'BackendService',
          action: 'sendMessageToAgent',
          timestamp: new Date()
        });
        throw error;
      }
      
      formData.append('latitude', location.latitude.toString());
      formData.append('longitude', location.longitude.toString());
    }
    
    // Add image file if provided
    if (imageFile) {
      // Validate image size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (imageFile.size > maxSize) {
        const error = createApiError('Image size exceeds 10MB limit', 413, false);
        errorHandler.handleError(error, {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          component: 'BackendService',
          action: 'sendMessageToAgent',
          timestamp: new Date()
        });
        throw error;
      }
      
      // Validate image type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(imageFile.type)) {
        const error = createApiError('Invalid image format. Supported: JPEG, PNG, WebP', 415, false);
        errorHandler.handleError(error, {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          component: 'BackendService',
          action: 'sendMessageToAgent',
          timestamp: new Date()
        });
        throw error;
      }
      
      formData.append('image', imageFile);
    }

    try {
      console.log('📡 Sending request to backend:', `${API_BASE_URL}/chat`);
      return await withRetry(
        () => httpRequest<AgentResponse>('/chat', {
          method: 'POST',
          body: formData,
          headers: {}, // Let browser set Content-Type for FormData
        }, { component: 'BackendService', action: 'sendMessageToAgent' }),
        { component: 'BackendService', action: 'sendMessageToAgent' }
      );
    } catch (error) {
      // Try offline fallback for medical advice
      const offlineAdvice = offlineFallbackService.getOfflineMedicalAdvice(transcript);
      if (offlineAdvice) {
        console.log('Using offline medical advice fallback');
        // Convert offline advice to AgentResponse format
        return {
          response: offlineAdvice.advice,
          condition: offlineAdvice.condition,
          urgencyLevel: offlineAdvice.urgencyLevel,
          confidence: offlineAdvice.confidence
        };
      }
      
      // Queue request for when connection is restored
      offlineFallbackService.queueOfflineRequest('medical_query', { 
        transcript, 
        location, 
        imageFile 
      });
      
      throw error;
    }
  }
  
  /**
   * Check service health and connectivity
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      return await httpRequest<{ status: string; timestamp: string }>('/health', {}, 
        { component: 'BackendService', action: 'healthCheck' });
    } catch (error) {
      errorHandler.handleNetworkError(error as Error, 'BackendService', 'healthCheck');
      throw error;
    }
  }

  /**
   * Get service status and error statistics
   */
  getServiceStatus(): {
    isHealthy: boolean;
    errorStats: any;
    offlineCapabilities: any;
  } {
    return {
      isHealthy: true, // This would be determined by recent health checks
      errorStats: errorHandler.getErrorStats(),
      offlineCapabilities: offlineFallbackService.getOfflineCapabilities()
    };
  }

  /**
   * Send conversational message to AI agent with conversation history
   * This enables proper multi-turn diagnosis flow with language detection
   * Validates: Requirements 1.3, 2.3, 3.1, 5.5
   */
  async sendConversationalMessage(
    message: string,
    conversationHistory: ConversationMessage[],
    location?: Coordinates,
    imageFile?: Blob
  ): Promise<AgentResponse> {
    console.log('🚀 BackendService.sendConversationalMessage called with:', { 
      message, 
      historyLength: conversationHistory.length,
      location, 
      hasImage: !!imageFile 
    });
    
    if (!message.trim()) {
      const error = createApiError('Message cannot be empty', 400, false);
      errorHandler.handleError(error, {
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.LOW,
        component: 'BackendService',
        action: 'sendConversationalMessage',
        timestamp: new Date()
      });
      throw error;
    }
    
    // Build request body
    const requestBody: ConversationalRequest = {
      message: message.trim(),
      conversation_history: conversationHistory
    };
    
    // Add location data if provided
    if (location) {
      if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        const error = createApiError('Invalid location coordinates', 400, false);
        errorHandler.handleError(error, {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          component: 'BackendService',
          action: 'sendConversationalMessage',
          timestamp: new Date()
        });
        throw error;
      }
      
      requestBody.user_location = {
        latitude: location.latitude,
        longitude: location.longitude
      };
    }
    
    // Add image data if provided (convert to base64)
    if (imageFile) {
      // Validate image size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (imageFile.size > maxSize) {
        const error = createApiError('Image size exceeds 10MB limit', 413, false);
        errorHandler.handleError(error, {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          component: 'BackendService',
          action: 'sendConversationalMessage',
          timestamp: new Date()
        });
        throw error;
      }
      
      // Validate image type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(imageFile.type)) {
        const error = createApiError('Invalid image format. Supported: JPEG, PNG, WebP', 415, false);
        errorHandler.handleError(error, {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          component: 'BackendService',
          action: 'sendConversationalMessage',
          timestamp: new Date()
        });
        throw error;
      }
      
      // Convert image to base64
      try {
        const arrayBuffer = await imageFile.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        requestBody.image_data = base64;
      } catch (e) {
        console.error('Failed to convert image to base64:', e);
      }
    }

    try {
      console.log('📡 Sending conversational request to backend:', `${API_BASE_URL}/chat/conversational`);
      return await withRetry(
        () => httpRequest<AgentResponse>('/chat/conversational', {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json'
          }
        }, { component: 'BackendService', action: 'sendConversationalMessage' }),
        { component: 'BackendService', action: 'sendConversationalMessage' }
      );
    } catch (error) {
      // Try offline fallback for medical advice
      const offlineAdvice = offlineFallbackService.getOfflineMedicalAdvice(message);
      if (offlineAdvice) {
        console.log('Using offline medical advice fallback');
        return {
          response: offlineAdvice.advice,
          condition: offlineAdvice.condition,
          urgencyLevel: offlineAdvice.urgencyLevel,
          confidence: offlineAdvice.confidence,
          assessment_stage: 'initial'
        };
      }
      
      throw error;
    }
  }
}

// Export singleton instance
export const backendService = new BackendService();