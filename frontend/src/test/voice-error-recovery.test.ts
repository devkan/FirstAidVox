import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { VoiceAgent } from '../services/voiceAgent';

// Mock the ElevenLabs react package
const mockConversation = {
  startSession: vi.fn(),
  endSession: vi.fn().mockResolvedValue(undefined),
  sendMessage: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@elevenlabs/react', () => ({
  Conversation: vi.fn().mockImplementation(function(config) {
    this.config = config;
    this.startSession = mockConversation.startSession;
    this.endSession = mockConversation.endSession;
    this.sendMessage = mockConversation.sendMessage;
    
    // Store config for later access
    mockConversation.config = config;
    return this;
  })
}));

describe('Voice Error Recovery Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: first-aid-voice-ui, Property 21: Voice service error recovery**
   * **Validates: Requirements 6.3**
   * 
   * Property: For any voice service error encountered, the Voice_Agent should implement 
   * fallback mechanisms and attempt recovery
   */
  it('should implement fallback mechanisms when voice service errors occur', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentId: fc.string({ minLength: 1, maxLength: 50 }),
          errorType: fc.oneof(
            fc.constant('connection_failed'),
            fc.constant('session_error'),
            fc.constant('message_error')
          ),
          errorMessage: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async ({ agentId, errorType, errorMessage }) => {
          let errorHandlerCalled = false;
          let disconnectHandlerCalled = false;
          let recoveryAttempted = false;
          
          const voiceAgent = new VoiceAgent({
            agentId,
            onConnect: vi.fn(),
            onDisconnect: () => {
              disconnectHandlerCalled = true;
            },
            onError: (error) => {
              errorHandlerCalled = true;
              expect(error).toBeInstanceOf(Error);
              expect(error.message).toBeDefined();
            }
          });

          // Mock different error scenarios
          switch (errorType) {
            case 'connection_failed':
              mockConversation.startSession.mockRejectedValueOnce(new Error(errorMessage));
              break;
            case 'session_error':
              mockConversation.startSession.mockImplementationOnce(() => {
                setTimeout(() => {
                  mockConversation.config?.onError?.(errorMessage);
                }, 10);
                return Promise.resolve();
              });
              break;
            case 'message_error':
              mockConversation.startSession.mockResolvedValueOnce(undefined);
              mockConversation.sendMessage.mockRejectedValueOnce(new Error(errorMessage));
              break;
          }

          // Property: Error recovery should be attempted
          try {
            await voiceAgent.initializeConnection();
            
            if (errorType === 'message_error') {
              // Test message error recovery
              try {
                await voiceAgent.sendMessage('test message');
              } catch (error) {
                recoveryAttempted = true;
                expect(error).toBeInstanceOf(Error);
              }
            }
            
            await new Promise(resolve => setTimeout(resolve, 20));
            
          } catch (error) {
            recoveryAttempted = true;
            expect(error).toBeInstanceOf(Error);
          }

          // Property: Error handling should be implemented
          if (errorType === 'connection_failed' || errorType === 'message_error') {
            expect(recoveryAttempted).toBe(true);
          }
          
          if (errorType === 'session_error') {
            expect(errorHandlerCalled).toBe(true);
          }

          await voiceAgent.disconnect();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should maintain connection status consistency during error recovery', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentId: fc.string({ minLength: 1, maxLength: 50 }),
          shouldRecover: fc.boolean()
        }),
        async ({ agentId, shouldRecover }) => {
          const statusChanges: string[] = [];
          
          const voiceAgent = new VoiceAgent({
            agentId,
            onConnect: vi.fn(),
            onDisconnect: vi.fn(),
            onError: vi.fn(),
            onStatusChange: (status) => {
              statusChanges.push(status);
            }
          });

          // Property: Initial status should be disconnected
          expect(voiceAgent.getConnectionStatus()).toBe('disconnected');

          if (shouldRecover) {
            // Mock successful connection after error
            mockConversation.startSession.mockImplementationOnce(() => {
              setTimeout(() => {
                mockConversation.config?.onConnect?.();
                mockConversation.config?.onStatusChange?.('connected');
              }, 10);
              return Promise.resolve();
            });
          } else {
            // Mock persistent error
            mockConversation.startSession.mockRejectedValueOnce(new Error('Connection failed'));
          }

          try {
            await voiceAgent.initializeConnection();
            await new Promise(resolve => setTimeout(resolve, 20));
            
            if (shouldRecover) {
              // Property: Should recover to connected state
              expect(voiceAgent.getConnectionStatus()).toBe('connected');
              expect(voiceAgent.isReady()).toBe(true);
            }
          } catch (error) {
            if (!shouldRecover) {
              // Property: Should remain in disconnected state on failure
              expect(voiceAgent.getConnectionStatus()).toBe('disconnected');
              expect(voiceAgent.isReady()).toBe(false);
            }
          }

          await voiceAgent.disconnect();
          
          // Property: Should always end in disconnected state
          expect(voiceAgent.getConnectionStatus()).toBe('disconnected');
          expect(voiceAgent.isReady()).toBe(false);
        }
      ),
      { numRuns: 15 }
    );
  });

  it('should handle multiple consecutive errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentId: fc.string({ minLength: 1, maxLength: 50 }),
          errorCount: fc.integer({ min: 1, max: 3 })
        }),
        async ({ agentId, errorCount }) => {
          let totalErrorsHandled = 0;
          
          const voiceAgent = new VoiceAgent({
            agentId,
            onConnect: vi.fn(),
            onDisconnect: vi.fn(),
            onError: (error) => {
              totalErrorsHandled++;
              expect(error).toBeInstanceOf(Error);
            }
          });

          // Mock multiple consecutive errors
          for (let i = 0; i < errorCount; i++) {
            mockConversation.startSession.mockRejectedValueOnce(new Error(`Error ${i + 1}`));
            
            try {
              await voiceAgent.initializeConnection();
            } catch (error) {
              // Property: Each error should be handled individually
              expect(error).toBeInstanceOf(Error);
            }
          }

          // Property: Agent should remain in consistent state after multiple errors
          expect(voiceAgent.getConnectionStatus()).toBe('disconnected');
          expect(voiceAgent.isReady()).toBe(false);

          await voiceAgent.disconnect();
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should recover from temporary service interruptions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentId: fc.string({ minLength: 1, maxLength: 50 }),
          interruptionDuration: fc.integer({ min: 10, max: 100 })
        }),
        async ({ agentId, interruptionDuration }) => {
          let connectionLost = false;
          let connectionRestored = false;
          
          const voiceAgent = new VoiceAgent({
            agentId,
            onConnect: () => {
              connectionRestored = true;
            },
            onDisconnect: () => {
              connectionLost = true;
            },
            onError: vi.fn()
          });

          // Mock initial successful connection
          mockConversation.startSession.mockImplementationOnce(() => {
            setTimeout(() => {
              mockConversation.config?.onConnect?.();
              mockConversation.config?.onStatusChange?.('connected');
            }, 10);
            return Promise.resolve();
          });

          await voiceAgent.initializeConnection();
          await new Promise(resolve => setTimeout(resolve, 20));

          // Property: Should be connected initially
          expect(voiceAgent.isReady()).toBe(true);
          expect(connectionRestored).toBe(true);

          // Simulate temporary disconnection
          mockConversation.config?.onDisconnect?.();
          
          // Property: Should handle disconnection
          expect(connectionLost).toBe(true);

          await voiceAgent.disconnect();
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should provide meaningful error information for debugging', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentId: fc.string({ minLength: 1, maxLength: 50 }),
          errorDetails: fc.record({
            code: fc.string({ minLength: 1, maxLength: 20 }),
            message: fc.string({ minLength: 1, maxLength: 100 })
          })
        }),
        async ({ agentId, errorDetails }) => {
          let capturedError: Error | null = null;
          
          const voiceAgent = new VoiceAgent({
            agentId,
            onConnect: vi.fn(),
            onDisconnect: vi.fn(),
            onError: (error) => {
              capturedError = error;
            }
          });

          // Mock error with specific details
          const errorMessage = `${errorDetails.code}: ${errorDetails.message}`;
          mockConversation.startSession.mockRejectedValueOnce(new Error(errorMessage));

          try {
            await voiceAgent.initializeConnection();
          } catch (error) {
            // Property: Error should contain meaningful information
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain(errorDetails.message);
          }

          // Property: Error handler should receive detailed error information
          if (capturedError) {
            expect(capturedError.message).toBeDefined();
            expect(capturedError.message.length).toBeGreaterThan(0);
          }

          await voiceAgent.disconnect();
        }
      ),
      { numRuns: 10 }
    );
  });
});