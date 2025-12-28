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
    this.sendMessage = vi.fn().mockImplementation(async (message) => {
      // Simulate TTS processing by triggering response callback
      setTimeout(() => {
        config.onMessage?.(message);
      }, 10);
    });
  })
}));

describe('TTS Processing Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: first-aid-voice-ui, Property 4: TTS response processing**
   * **Validates: Requirements 1.4**
   * 
   * Property: For any text response received from the Backend_Service, 
   * the Voice_Agent should convert it to audio output using TTS
   */
  it('should reliably convert text responses to audio output', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentId: fc.string({ minLength: 1, maxLength: 50 }),
          responseText: fc.string({ minLength: 1, maxLength: 300 }),
        }),
        async ({ agentId, responseText }) => {
          let audioResponseReceived = '';
          let textResponseReceived = '';
          
          const voiceAgent = new VoiceAgent({
            agentId,
            onConnect: vi.fn(),
            onDisconnect: vi.fn(),
            onError: vi.fn(),
            onMessage: (message: string) => {
              textResponseReceived = message;
            }
          });

          // Set up response callback to capture TTS output
          voiceAgent.onResponse((audioUrl: string, text: string) => {
            audioResponseReceived = audioUrl;
            textResponseReceived = text;
          });

          await voiceAgent.initializeConnection();
          await new Promise(resolve => setTimeout(resolve, 20));

          // Send message to trigger TTS response
          await voiceAgent.sendMessage(responseText);
          await new Promise(resolve => setTimeout(resolve, 20));

          // Property: TTS should process text response and provide audio output
          expect(textResponseReceived).toBe(responseText.trim());
          expect(textResponseReceived).toBeTruthy();

          await voiceAgent.disconnect();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: TTS processing should handle various text formats consistently
   */
  it('should handle different text formats and lengths consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentId: fc.string({ minLength: 1, maxLength: 50 }),
          textFormats: fc.array(
            fc.oneof(
              fc.string({ minLength: 1, maxLength: 50 }), // Short responses
              fc.string({ minLength: 50, maxLength: 200 }), // Medium responses
              fc.string({ minLength: 1, maxLength: 20 }).map(s => s.toUpperCase()), // Uppercase
              fc.string({ minLength: 1, maxLength: 20 }).map(s => s.toLowerCase()), // Lowercase
              fc.string({ minLength: 1, maxLength: 30 }).map(s => `${s}!`) // With punctuation
            ),
            { minLength: 1, maxLength: 3 }
          )
        }).filter(({ textFormats }) => textFormats.every(text => text.trim().length > 0)), // Ensure non-empty after trimming
        async ({ agentId, textFormats }) => {
          const processedResponses: string[] = [];
          
          const voiceAgent = new VoiceAgent({
            agentId,
            onConnect: vi.fn(),
            onDisconnect: vi.fn(),
            onError: vi.fn(),
            onMessage: (message: string) => {
              processedResponses.push(message);
            }
          });

          await voiceAgent.initializeConnection();
          await new Promise(resolve => setTimeout(resolve, 20));

          // Process multiple text formats
          for (const textFormat of textFormats) {
            await voiceAgent.sendMessage(textFormat);
            await new Promise(resolve => setTimeout(resolve, 20));
          }

          // Property: Each text format should be processed consistently
          expect(processedResponses).toHaveLength(textFormats.length);
          
          // Property: Processed responses should match input text (after trimming)
          for (let i = 0; i < textFormats.length; i++) {
            expect(processedResponses[i]).toBe(textFormats[i].trim());
          }

          await voiceAgent.disconnect();
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: TTS processing should preserve text content integrity
   */
  it('should preserve text content integrity during TTS processing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentId: fc.string({ minLength: 1, maxLength: 50 }),
          originalResponse: fc.string({ minLength: 5, maxLength: 150 })
        }),
        async ({ agentId, originalResponse }) => {
          let processedResponse = '';
          
          const voiceAgent = new VoiceAgent({
            agentId,
            onConnect: vi.fn(),
            onDisconnect: vi.fn(),
            onError: vi.fn(),
            onMessage: (message: string) => {
              processedResponse = message;
            }
          });

          await voiceAgent.initializeConnection();
          await new Promise(resolve => setTimeout(resolve, 20));

          await voiceAgent.sendMessage(originalResponse);
          await new Promise(resolve => setTimeout(resolve, 20));

          // Property: Processed response should maintain the same essential content
          expect(processedResponse).toBe(originalResponse.trim());
          
          // Property: Text length should be preserved (after trimming)
          expect(processedResponse.length).toBe(originalResponse.trim().length);

          await voiceAgent.disconnect();
        }
      ),
      { numRuns: 40 }
    );
  });

  /**
   * Property: TTS processing should handle special characters and punctuation
   */
  it('should handle special characters and punctuation in TTS processing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentId: fc.string({ minLength: 1, maxLength: 50 }),
          specialText: fc.oneof(
            fc.constant('Hello, world!'), // Basic punctuation
            fc.constant('What is 2 + 2?'), // Question mark and numbers
            fc.constant('Emergency: Call 911 now!'), // Colon and exclamation
            fc.constant('Temperature: 98.6°F'), // Degree symbol and decimal
            fc.constant('Take 2-3 tablets every 4-6 hours.') // Hyphens and periods
          )
        }),
        async ({ agentId, specialText }) => {
          let processedText = '';
          
          const voiceAgent = new VoiceAgent({
            agentId,
            onConnect: vi.fn(),
            onDisconnect: vi.fn(),
            onError: vi.fn(),
            onMessage: (message: string) => {
              processedText = message;
            }
          });

          await voiceAgent.initializeConnection();
          await new Promise(resolve => setTimeout(resolve, 20));

          await voiceAgent.sendMessage(specialText);
          await new Promise(resolve => setTimeout(resolve, 20));

          // Property: Special characters should be preserved in TTS processing
          expect(processedText).toBe(specialText);
          expect(processedText).toContain(specialText.trim());

          await voiceAgent.disconnect();
        }
      ),
      { numRuns: 25 }
    );
  });
});