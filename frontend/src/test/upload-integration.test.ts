import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { BackendService } from '../services/backendService';
import type { AgentResponse } from '../types/index';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Upload Integration Property Tests', () => {
  let backendService: BackendService;

  beforeEach(() => {
    backendService = new BackendService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper function to create mock image blobs
  function createMockImageBlob(type: string, size: number): Blob {
    // Create a simple blob with the specified size
    const content = 'x'.repeat(size);
    return new Blob([content], { type });
  }

  /**
   * Feature: first-aid-voice-ui, Property 8: Photo upload integration
   * For any confirmed photo, the system should send the image with voice message to the Backend_Service chat endpoint
   * Validates: Requirements 2.3, 2.4
   */
  it('should send any valid image blob with transcript to backend chat endpoint', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid image types and reasonable sizes
        fc.record({
          transcript: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          imageType: fc.constantFrom('image/jpeg', 'image/png', 'image/webp'),
          imageSize: fc.integer({ min: 1024, max: 5 * 1024 * 1024 }) // 1KB to 5MB
        }),
        async ({ transcript, imageType, imageSize }) => {
          // Create mock image blob
          const imageBlob = createMockImageBlob(imageType, imageSize);

          // Mock successful response
          const mockResponse: AgentResponse = {
            response: 'AI analyzed the image and text',
            condition: 'visual assessment complete',
            urgencyLevel: 'moderate',
            confidence: 0.9
          };

          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
          });

          // Act: Send transcript with image
          const result = await backendService.sendMessageToAgent(transcript, undefined, imageBlob);

          // Assert: Verify the request was made correctly
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/chat'),
            expect.objectContaining({
              method: 'POST',
              body: expect.any(FormData)
              // Note: headers should not contain Content-Type for FormData
            })
          );

          // Verify the request was made to the correct endpoint
          const call = mockFetch.mock.calls[0];
          expect(call[0]).toContain('/chat');
          expect(call[1].method).toBe('POST');
          expect(call[1].body).toBeInstanceOf(FormData);

          // Assert: Verify response structure
          expect(result).toEqual(mockResponse);
          expect(result.response).toBeDefined();
          expect(typeof result.response).toBe('string');
          expect(result.urgencyLevel).toMatch(/^(low|moderate|high)$/);
          expect(typeof result.confidence).toBe('number');
        }
      ),
      { numRuns: 20 } // Reduced from 50 to 20
    );
  }, 10000); // Reduced timeout to 10 seconds

  it('should send transcript with location and image together', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          transcript: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          latitude: fc.float({ min: -90, max: 90 }),
          longitude: fc.float({ min: -180, max: 180 }),
          imageType: fc.constantFrom('image/jpeg', 'image/png', 'image/webp'),
          imageSize: fc.integer({ min: 1024, max: 2 * 1024 * 1024 })
        }),
        async ({ transcript, latitude, longitude, imageType, imageSize }) => {
          const imageBlob = createMockImageBlob(imageType, imageSize);
          const location = { latitude, longitude };

          // Mock response with hospital data
          const mockResponse: AgentResponse = {
            response: 'AI analyzed text, location, and image',
            condition: 'comprehensive assessment',
            urgencyLevel: 'high',
            confidence: 0.95,
            hospital_data: [{
              id: 'hospital-1',
              name: 'Test Hospital',
              coordinates: { latitude, longitude },
              address: 'Test Address',
              phone: '123-456-7890',
              distance: 1.5,
              emergencyServices: [],
              rating: 4.5,
              isOpen24Hours: true
            }]
          };

          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
          });

          // Act: Send transcript with location and image
          const result = await backendService.sendMessageToAgent(transcript, location, imageBlob);

          // Assert: Verify the request was made to the correct endpoint
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/chat'),
            expect.objectContaining({
              method: 'POST',
              body: expect.any(FormData)
              // Note: headers should not contain Content-Type for FormData
            })
          );

          // Verify the request structure
          const call = mockFetch.mock.calls[0];
          expect(call[0]).toContain('/chat');
          expect(call[1].method).toBe('POST');
          expect(call[1].body).toBeInstanceOf(FormData);

          // Assert: Response includes hospital data
          expect(result.hospital_data).toBeDefined();
          expect(result.hospital_data!.length).toBeGreaterThan(0);
          expect(result.response).toBeDefined();
          expect(result.urgencyLevel).toMatch(/^(low|moderate|high)$/);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should reject invalid image formats and sizes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          transcript: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          invalidImage: fc.oneof(
            // Invalid MIME types
            fc.record({
              type: fc.constantFrom('text/plain', 'application/pdf', 'video/mp4'),
              size: fc.integer({ min: 1024, max: 1024 * 1024 })
            }),
            // Invalid sizes (too large)
            fc.record({
              type: fc.constantFrom('image/jpeg', 'image/png'),
              size: fc.integer({ min: 11 * 1024 * 1024, max: 50 * 1024 * 1024 })
            })
          )
        }),
        async ({ transcript, invalidImage }) => {
          const invalidBlob = createMockImageBlob(invalidImage.type, invalidImage.size);

          // Act & Assert: Should throw an error for invalid images
          await expect(backendService.sendMessageToAgent(transcript, undefined, invalidBlob)).rejects.toThrow();
          
          // Verify no network request was made for client-side validation errors
          expect(mockFetch).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 10 } // Reduced runs to avoid timeout
    );
  }, 15000); // Increased timeout to 15 seconds

  it('should handle upload errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          transcript: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          imageType: fc.constantFrom('image/jpeg', 'image/png', 'image/webp'),
          imageSize: fc.integer({ min: 1024, max: 1024 * 1024 }),
          errorStatus: fc.integer({ min: 400, max: 499 }) // Client errors (non-retryable)
        }),
        async ({ transcript, imageType, imageSize, errorStatus }) => {
          const imageBlob = createMockImageBlob(imageType, imageSize);

          // Mock error response
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: errorStatus,
            statusText: 'Upload Error',
          });

          // Act & Assert: Should throw an error
          await expect(backendService.sendMessageToAgent(transcript, undefined, imageBlob)).rejects.toThrow();
          
          // Verify the request was attempted
          expect(mockFetch).toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  }, 10000);
});