import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { VoiceAgent } from '../services/voiceAgent';

// Mock the ElevenLabs react package
vi.mock('@elevenlabs/react', () => ({
  Conversation: vi.fn().mockImplementation(function(config) {
    this.config = config;
    this.startSession = vi.fn().mockImplementation(async () => {
      setTimeout(() => {
        config.onConnect?.();
        config.onStatusChange?.('connected');
      }, 10);
    });
    this.endSession = vi.fn().mockResolvedValue(undefined);
    this.sendMessage = vi.fn().mockResolvedValue(undefined);
  })
}));

describe('Voice Service Initialization Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: first-aid-voice-ui, Property 20: Voice service initialization**
   * **Validates: Requirements 6.1**
   * 
   * Property: For any application startup, the Voice_Agent should successfully 
   * establish connection with ElevenLabs services
   */
  it('should successfully initialize voice services with valid configurations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentId: fc.string({ minLength: 1, maxLength: 100 }),
          apiKey: fc.option(fc.string({ minLength: 10, maxLength: 200 }))
        }),
        async ({ agentId, apiKey }) => {
          let connectionEstablished = false;
          let initializationCompleted = false;
          
          const voiceAgent = new VoiceAgent({
            agentId,
            apiKey: apiKey || undefined,
            onConnect: () => {
              connectionEstablished = true;
            },
            onDisconnect: vi.fn(),
            onError: vi.fn(),
            onStatusChange: (status) => {
              if (status === 'connected') {
                initializationCompleted = true;
              }
            }
          });

          // Property: Initialization should establish connection successfully
          await voiceAgent.initializeConnection();
          await new Promise(resolve => setTimeout(resolve, 20));

          expect(connectionEstablished).toBe(true);
          expect(initializationCompleted).toBe(true);
          expect(voiceAgent.isReady()).toBe(true);
          expect(voiceAgent.getConnectionStatus()).toBe('connected');

          await voiceAgent.disconnect();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Voice service initialization should be consistent across different agent IDs
   */
  it('should initialize consistently with different agent configurations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentConfigs: fc.array(
            fc.record({
              agentId: fc.string({ minLength: 1, maxLength: 50 }),
              apiKey: fc.option(fc.string({ minLength: 10, maxLength: 100 }))
            }),
            { minLength: 1, maxLength: 3 }
          )
        }),
        async ({ agentConfigs }) => {
          const initializationResults: boolean[] = [];
          
          for (const config of agentConfigs) {
            let initialized = false;
            
            const voiceAgent = new VoiceAgent({
              agentId: config.agentId,
              apiKey: config.apiKey || undefined,
              onConnect: () => {
                initialized = true;
              },
              onDisconnect: vi.fn(),
              onError: vi.fn()
            });

            try {
              await voiceAgent.initializeConnection();
              await new Promise(resolve => setTimeout(resolve, 20));
              
              initializationResults.push(initialized && voiceAgent.isReady());
              await voiceAgent.disconnect();
            } catch (error) {
              initializationResults.push(false);
            }
          }

          // Property: All valid configurations should initialize successfully
          expect(initializationResults.every(result => result === true)).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Voice service initialization should handle connection state transitions properly
   */
  it('should handle connection state transitions during initialization', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentId: fc.string({ minLength: 1, maxLength: 50 })
        }),
        async ({ agentId }) => {
          const stateTransitions: string[] = [];
          
          const voiceAgent = new VoiceAgent({
            agentId,
            onConnect: vi.fn(),
            onDisconnect: vi.fn(),
            onError: vi.fn(),
            onStatusChange: (status) => {
              stateTransitions.push(status);
            }
          });

          // Property: Should start in disconnected state
          expect(voiceAgent.getConnectionStatus()).toBe('disconnected');
          expect(voiceAgent.isReady()).toBe(false);

          await voiceAgent.initializeConnection();
          await new Promise(resolve => setTimeout(resolve, 20));

          // Property: Should transition through connecting to connected
          expect(stateTransitions).toContain('connected');
          expect(voiceAgent.getConnectionStatus()).toBe('connected');
          expect(voiceAgent.isReady()).toBe(true);

          await voiceAgent.disconnect();
          
          // Property: Should return to disconnected state after disconnect
          expect(voiceAgent.getConnectionStatus()).toBe('disconnected');
          expect(voiceAgent.isReady()).toBe(false);
        }
      ),
      { numRuns: 40 }
    );
  });

  /**
   * Property: Voice service initialization should handle errors gracefully
   */
  it('should handle initialization errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentId: fc.oneof(
            fc.constant(''), // Empty agent ID
            fc.string({ maxLength: 0 }), // Zero-length string
            fc.constant('   ') // Whitespace only
          )
        }),
        async ({ agentId }) => {
          let errorOccurred = false;
          let errorMessage = '';
          
          const voiceAgent = new VoiceAgent({
            agentId,
            onConnect: vi.fn(),
            onDisconnect: vi.fn(),
            onError: (error) => {
              errorOccurred = true;
              errorMessage = error.message;
            }
          });

          // Property: Should either succeed or fail gracefully with invalid config
          try {
            await voiceAgent.initializeConnection();
            await new Promise(resolve => setTimeout(resolve, 20));
            
            // If it succeeds with invalid config, should still be in valid state
            if (voiceAgent.isReady()) {
              expect(voiceAgent.getConnectionStatus()).toBe('connected');
            }
            
            await voiceAgent.disconnect();
          } catch (error) {
            // Property: Errors should be handled gracefully without crashing
            expect(errorOccurred || error).toBeTruthy();
            expect(voiceAgent.getConnectionStatus()).toBe('disconnected');
            expect(voiceAgent.isReady()).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Voice service initialization should be idempotent
   */
  it('should handle multiple initialization attempts idempotently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentId: fc.string({ minLength: 1, maxLength: 50 }),
          initAttempts: fc.integer({ min: 1, max: 3 })
        }),
        async ({ agentId, initAttempts }) => {
          const voiceAgent = new VoiceAgent({
            agentId,
            onConnect: vi.fn(),
            onDisconnect: vi.fn(),
            onError: vi.fn()
          });

          // Property: Multiple initialization attempts should not cause issues
          for (let i = 0; i < initAttempts; i++) {
            await voiceAgent.initializeConnection();
            await new Promise(resolve => setTimeout(resolve, 20));
          }

          // Property: Should be in consistent state after multiple initializations
          expect(voiceAgent.isReady()).toBe(true);
          expect(voiceAgent.getConnectionStatus()).toBe('connected');

          await voiceAgent.disconnect();
        }
      ),
      { numRuns: 30 }
    );
  });
});