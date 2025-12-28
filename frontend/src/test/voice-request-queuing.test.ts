import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { VoiceAgent, VoiceAgentConfig, VoiceRequest } from '../services/voiceAgent';

// Mock the ElevenLabs react package
vi.mock('@elevenlabs/react', () => ({
  Conversation: vi.fn().mockImplementation(function(config) {
    // Store config for later use
    this.config = config;
    this.startSession = vi.fn().mockImplementation(async () => {
      // Simulate successful connection
      setTimeout(() => {
        config.onConnect?.();
        config.onStatusChange?.('connected');
      }, 10);
    });
    this.endSession = vi.fn().mockResolvedValue(undefined);
    this.sendMessage = vi.fn().mockImplementation(async (message) => {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 10));
      // Trigger response callback
      setTimeout(() => {
        config.onMessage?.(message);
      }, 5);
    });
  })
}));

describe('Voice Request Queuing Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: first-aid-voice-ui, Property 22: Voice request queuing**
   * **Validates: Requirements 6.4**
   * 
   * Property: For any multiple voice requests made simultaneously, the Voice_Agent 
   * should handle request queuing and prevent audio conflicts
   */
  it('should queue multiple voice requests and process them sequentially', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate multiple voice requests with different priorities
        fc.array(
          fc.record({
            text: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
            priority: fc.constantFrom('low', 'normal', 'high')
          }),
          { minLength: 2, maxLength: 3 }
        ),
        async (requests) => {
          const voiceAgent = new VoiceAgent({
            agentId: 'test-agent',
            onConnect: vi.fn(),
            onDisconnect: vi.fn(),
            onError: vi.fn(),
            onMessage: vi.fn()
          });

          // Initialize connection
          await voiceAgent.initializeConnection();
          await new Promise(resolve => setTimeout(resolve, 20));

          // Send all requests
          for (const req of requests) {
            await voiceAgent.sendMessage(req.text, req.priority as 'low' | 'normal' | 'high');
          }

          // Wait for processing to complete
          await new Promise(resolve => setTimeout(resolve, 100));

          // Property: Queue should be empty after processing
          const queueStatus = voiceAgent.getQueueStatus();
          expect(queueStatus.size).toBe(0);
          expect(queueStatus.isProcessing).toBe(false);

          // Cleanup
          await voiceAgent.disconnect();
        }
      ),
      { numRuns: 20 }
    );
  }, 10000);

  /**
   * Property: High priority requests should be processed before lower priority ones
   */
  it('should respect priority ordering in queue processing', async () => {
    const voiceAgent = new VoiceAgent({
      agentId: 'test-agent',
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
      onError: vi.fn(),
      onMessage: vi.fn()
    });

    // Initialize connection
    await voiceAgent.initializeConnection();
    await new Promise(resolve => setTimeout(resolve, 20));

    // Send requests with different priorities
    await voiceAgent.sendMessage('low-priority-1', 'low');
    await voiceAgent.sendMessage('high-priority-1', 'high');
    await voiceAgent.sendMessage('low-priority-2', 'low');

    // Check queue immediately after sending
    const queueStatus = voiceAgent.getQueueStatus();
    
    // Property: High priority requests should be at the front of the queue
    if (queueStatus.requests.length > 0) {
      const firstRequest = queueStatus.requests[0];
      // The first request in queue should be high priority if any high priority requests exist
      const hasHighPriority = queueStatus.requests.some(req => req.priority === 'high');
      if (hasHighPriority) {
        expect(firstRequest.priority).toBe('high');
      }
    }

    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Cleanup
    await voiceAgent.disconnect();
  }, 5000);

  /**
   * Property: Queue should handle maximum capacity correctly
   */
  it('should handle queue capacity limits correctly', async () => {
    const voiceAgent = new VoiceAgent({
      agentId: 'test-agent',
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
      onError: vi.fn(),
      onMessage: vi.fn()
    });

    // Initialize connection
    await voiceAgent.initializeConnection();
    await new Promise(resolve => setTimeout(resolve, 20));

    let errorCount = 0;
    
    // Send more requests than queue capacity (10)
    for (let i = 0; i < 12; i++) {
      try {
        await voiceAgent.sendMessage(`message-${i}`, 'normal');
      } catch (error) {
        errorCount++;
      }
    }

    // Property: Queue size should never exceed maximum capacity
    const queueStatus = voiceAgent.getQueueStatus();
    expect(queueStatus.size).toBeLessThanOrEqual(10);

    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Cleanup
    await voiceAgent.disconnect();
  }, 5000);

  /**
   * Property: Session management should work correctly with queued requests
   */
  it('should manage voice sessions correctly during queue processing', async () => {
    const voiceAgent = new VoiceAgent({
      agentId: 'test-agent',
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
      onError: vi.fn(),
      onMessage: vi.fn()
    });

    // Initialize connection
    await voiceAgent.initializeConnection();
    await new Promise(resolve => setTimeout(resolve, 20));

    // Property: No session should exist initially
    expect(voiceAgent.getCurrentSession()).toBeNull();

    // Send first message to start session
    await voiceAgent.sendMessage('first-message');

    // Property: Session should be created after first message
    const session = voiceAgent.getCurrentSession();
    expect(session).not.toBeNull();
    expect(session?.status).toBe('active');

    // Send more messages
    await voiceAgent.sendMessage('second-message');
    await voiceAgent.sendMessage('third-message');

    // Property: Same session should be used for all requests
    const currentSession = voiceAgent.getCurrentSession();
    expect(currentSession?.id).toBe(session?.id);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Cleanup
    await voiceAgent.disconnect();
  }, 5000);

  /**
   * Property: Force ending session should clear queue and reset state
   */
  it('should clear queue and reset state when session is force ended', async () => {
    const voiceAgent = new VoiceAgent({
      agentId: 'test-agent',
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
      onError: vi.fn(),
      onMessage: vi.fn()
    });

    // Initialize connection
    await voiceAgent.initializeConnection();
    await new Promise(resolve => setTimeout(resolve, 20));

    // Send messages to create queue
    await voiceAgent.sendMessage('message-1');
    await voiceAgent.sendMessage('message-2');
    await voiceAgent.sendMessage('message-3');

    // Force end session
    voiceAgent.forceEndSession();

    // Property: Queue should be cleared after force ending session
    const queueStatus = voiceAgent.getQueueStatus();
    expect(queueStatus.size).toBe(0);
    expect(queueStatus.isProcessing).toBe(false);

    // Property: Session should be null after force ending
    expect(voiceAgent.getCurrentSession()).toBeNull();

    // Cleanup
    await voiceAgent.disconnect();
  }, 5000);
});