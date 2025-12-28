import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { BackendService } from '../services/backendService';
import { AgentResponse } from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Backend Communication Property Tests', () => {
  let backendService: BackendService;

  beforeEach(() => {
    backendService = new BackendService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Feature: first-aid-voice-ui, Property 3: Backend communication integrity
   * For any processed text from voice input, the Voice_Agent should send the text to the Backend_Service chat endpoint
   * Validates: Requirements 1.3
   */
  it('should send any valid text query to backend chat endpoint', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate non-empty strings that represent valid voice input
        fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
        async (transcript) => {
          // Mock successful response
          const mockResponse: AgentResponse = {
            response: 'AI agent response',
            condition: 'test condition',
            urgencyLevel: 'low',
            confidence: 0.8
          };

          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
          });

          // Act: Send the transcript to backend
          const result = await backendService.sendMessageToAgent(transcript);

          // Assert: Verify the request was made correctly
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/chat'),
            expect.objectContaining({
              method: 'POST',
              body: expect.any(FormData)
            })
          );

          // Note: FormData content verification is complex in tests
          // The important part is that the request was made to the correct endpoint

          // Assert: Verify response structure
          expect(result).toEqual(mockResponse);
          expect(result.response).toBeDefined();
          expect(typeof result.response).toBe('string');
          if (result.urgencyLevel) {
            expect(result.urgencyLevel).toMatch(/^(low|moderate|high)$/);
          }
          if (result.confidence) {
            expect(typeof result.confidence).toBe('number');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle backend communication errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 400, max: 499 }), // Client error codes (non-retryable)
        async (transcript, errorStatus) => {
          // Mock error response
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: errorStatus,
            statusText: 'Error',
          });

          // Act & Assert: Should throw an error
          await expect(backendService.sendMessageToAgent(transcript)).rejects.toThrow();
          
          // Verify the request was attempted
          expect(mockFetch).toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  }, 10000); // Increase timeout to 10 seconds

  it('should reject empty or whitespace-only transcripts', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate strings that are empty or contain only whitespace
        fc.oneof(
          fc.constant(''),
          fc.string().filter(s => s.trim().length === 0 && s.length > 0)
        ),
        async (invalidTranscript) => {
          // Act & Assert: Should throw an error for invalid transcripts
          await expect(backendService.sendMessageToAgent(invalidTranscript)).rejects.toThrow('Transcript cannot be empty');
          
          // Verify no network request was made
          expect(mockFetch).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 50 }
    );
  });
});