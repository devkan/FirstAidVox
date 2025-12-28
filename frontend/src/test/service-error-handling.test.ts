import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { BackendService } from '../services/backendService';

// Mock fetch globally
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

describe('Service Error Handling Property Tests', () => {
  let backendService: BackendService;

  beforeEach(() => {
    backendService = new BackendService();
    vi.clearAllMocks();
    // Reset mock to default behavior
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * **Feature: first-aid-voice-ui, Property 19: Service error handling**
   * **Validates: Requirements 5.5**
   * 
   * Property: For any service that becomes unavailable, the system should display 
   * clear error messages and suggest alternative actions
   */
  it('should handle backend service unavailability with clear error messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          query: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          errorType: fc.oneof(
            fc.constant('network'), // Network connectivity issues
            fc.constant('server'), // Server errors (5xx)
            fc.constant('unavailable') // Service unavailable
          )
        }),
        async ({ query, errorType }) => {
          // Mock different types of service failures
          switch (errorType) {
            case 'network':
              mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
              break;
            case 'server':
              mockFetch.mockResolvedValue({
                ok: false,
                status: 503,
                statusText: 'Service Unavailable',
                json: () => Promise.resolve({ error: 'Service unavailable' })
              });
              break;
            case 'unavailable':
              mockFetch.mockResolvedValue({
                ok: false,
                status: 502,
                statusText: 'Bad Gateway',
                json: () => Promise.resolve({ error: 'Bad gateway' })
              });
              break;
          }

          // Property: Service errors should be handled gracefully
          let errorThrown = false;
          let errorMessage = '';
          
          try {
            await backendService.sendMedicalQuery(query);
          } catch (error) {
            errorThrown = true;
            errorMessage = error instanceof Error ? error.message : String(error);
          }

          // Assert: Error should be thrown and handled gracefully
          expect(errorThrown).toBe(true);
          expect(errorMessage).toBeDefined();
          expect(errorMessage.length).toBeGreaterThan(0);
          
          // Property: Error messages should be informative
          expect(
            errorMessage.includes('Network') ||
            errorMessage.includes('HTTP') ||
            errorMessage.includes('Service') ||
            errorMessage.includes('unavailable') ||
            errorMessage.includes('fetch')
          ).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should handle image upload service failures gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          transcript: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          imageSize: fc.integer({ min: 1000, max: 100000 }), // 1KB to 100KB
          errorStatus: fc.oneof(
            fc.constant(500), // Internal server error
            fc.constant(502), // Bad gateway
            fc.constant(503)  // Service unavailable
          )
        }),
        async ({ transcript, imageSize, errorStatus }) => {
          // Create mock image blob
          const imageData = new Blob(['x'.repeat(imageSize)], { type: 'image/jpeg' });
          
          // Mock service failure
          mockFetch.mockResolvedValue({
            ok: false,
            status: errorStatus,
            statusText: 'Service Error',
            json: () => Promise.resolve({ error: 'Service error' })
          });

          // Property: Upload failures should be handled gracefully
          let errorThrown = false;
          let errorMessage = '';
          
          try {
            await backendService.sendMessageToAgent(transcript, undefined, imageData);
          } catch (error) {
            errorThrown = true;
            errorMessage = error instanceof Error ? error.message : String(error);
          }

          // Assert: Error should be thrown and contain useful information
          expect(errorThrown).toBe(true);
          expect(errorMessage).toBeDefined();
          expect(errorMessage).toContain('HTTP');
          expect(errorMessage).toContain(errorStatus.toString());
        }
      ),
      { numRuns: 5 }
    );
  });

  it('should handle hospital search service failures with fallback behavior', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          latitude: fc.float({ min: -90, max: 90 }),
          longitude: fc.float({ min: -180, max: 180 }),
          radius: fc.integer({ min: 1, max: 50 }),
          failureType: fc.oneof(
            fc.constant('network'),
            fc.constant('server_error')
          )
        }),
        async ({ latitude, longitude, radius, failureType }) => {
          const location = { latitude, longitude };
          
          // Mock different failure scenarios
          switch (failureType) {
            case 'network':
              mockFetch.mockRejectedValue(new TypeError('Network error'));
              break;
            case 'server_error':
              mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: () => Promise.resolve({ error: 'Internal server error' })
              });
              break;
          }

          // Property: Hospital search failures should be handled gracefully
          // Either throw an error (if no cached data) or return cached data
          let errorThrown = false;
          let errorMessage = '';
          let result = null;
          
          try {
            result = await backendService.getHospitals(location, radius);
          } catch (error) {
            errorThrown = true;
            errorMessage = error instanceof Error ? error.message : String(error);
          }

          // Assert: Either error is handled gracefully OR cached data is returned
          if (errorThrown) {
            // If error was thrown, it should have a meaningful message
            expect(errorMessage).toBeDefined();
            expect(errorMessage.length).toBeGreaterThan(0);
          } else {
            // If no error was thrown, cached data should be returned
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  it('should provide clear error messages for invalid input data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          invalidInput: fc.oneof(
            fc.constant(''), // Empty query
            fc.constant('   ') // Whitespace only
          )
        }),
        async ({ invalidInput }) => {
          // Property: Invalid inputs should produce clear error messages
          let errorThrown = false;
          let errorMessage = '';
          
          try {
            await backendService.sendMessageToAgent(invalidInput);
          } catch (error) {
            errorThrown = true;
            errorMessage = error instanceof Error ? error.message : String(error);
          }

          // Assert: Should throw error with clear message
          expect(errorThrown).toBe(true);
          expect(errorMessage).toBeDefined();
          expect(errorMessage.toLowerCase()).toContain('empty');
        }
      ),
      { numRuns: 5 }
    );
  });

  it('should handle non-retryable errors immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          query: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          errorStatus: fc.oneof(
            fc.constant(400), // Bad request - non-retryable
            fc.constant(401), // Unauthorized - non-retryable
            fc.constant(404)  // Not found - non-retryable
          )
        }),
        async ({ query, errorStatus }) => {
          let callCount = 0;
          
          mockFetch.mockImplementation(() => {
            callCount++;
            return Promise.resolve({
              ok: false,
              status: errorStatus,
              statusText: 'Client Error',
              json: () => Promise.resolve({ error: 'Client error' })
            });
          });

          // Property: Non-retryable errors should not trigger retries
          let errorThrown = false;
          
          try {
            await backendService.sendMessageToAgent(query);
          } catch (error) {
            errorThrown = true;
          }

          // Assert: Error should be thrown and only one call should be made
          expect(errorThrown).toBe(true);
          expect(callCount).toBe(1);
        }
      ),
      { numRuns: 5 }
    );
  });
});