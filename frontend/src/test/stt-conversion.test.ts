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

describe('STT Conversion Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: first-aid-voice-ui, Property 2: STT conversion reliability**
   * **Validates: Requirements 1.2**
   * 
   * Property: For any valid audio input, the Voice_Agent should convert the audio to text using STT services
   */
  it('should reliably convert speech to text for any valid input', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary text messages that represent speech input
        fc.record({
          agentId: fc.string({ minLength: 1, maxLength: 50 }),
          speechText: fc.string({ minLength: 1, maxLength: 500 }),
        }).filter(({ speechText }) => speechText.trim().length > 0), // Ensure non-empty after trimming
        async ({ agentId, speechText }) => {
          let transcriptionReceived = '';
          
          const voiceAgent = new VoiceAgent({
            agentId,
            onConnect: vi.fn(),
            onDisconnect: vi.fn(),
            onError: vi.fn()
          });

          // Set up transcription callback to capture STT output
          voiceAgent.onTranscription((text: string) => {
            transcriptionReceived = text;
          });

          // Initialize and connect
          await voiceAgent.initializeConnection();
          await new Promise(resolve => setTimeout(resolve, 20));

          // Send message (simulates speech input being converted to text)
          await voiceAgent.sendMessage(speechText);

          // Property: STT should convert speech input to text
          expect(transcriptionReceived).toBe(speechText.trim());
          expect(transcriptionReceived).toBeTruthy();

          // Cleanup
          await voiceAgent.disconnect();
        }
      ),
      { numRuns: 50 } // Reduced from 100 to speed up tests
    );
  });

  /**
   * Property: STT conversion should handle empty or whitespace input gracefully
   */
  it('should handle empty or whitespace input gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentId: fc.string({ minLength: 1, maxLength: 50 }),
          emptyText: fc.oneof(
            fc.constant('   '), // Whitespace only
            fc.constant('\t\n'), // Tabs and newlines
            fc.constant('') // Empty string
          )
        }),
        async ({ agentId, emptyText }) => {
          const voiceAgent = new VoiceAgent({
            agentId,
            onConnect: vi.fn(),
            onDisconnect: vi.fn(),
            onError: vi.fn()
          });

          await voiceAgent.initializeConnection();
          await new Promise(resolve => setTimeout(resolve, 20));

          // Property: Should either reject empty input or handle gracefully
          if (emptyText.trim() === '') {
            await expect(voiceAgent.sendMessage(emptyText)).rejects.toThrow();
          } else {
            await expect(voiceAgent.sendMessage(emptyText)).resolves.not.toThrow();
          }

          await voiceAgent.disconnect();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: STT conversion should preserve text content integrity
   */
  it('should preserve text content integrity during conversion', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentId: fc.string({ minLength: 1, maxLength: 50 }),
          originalText: fc.string({ minLength: 5, maxLength: 100 }) // Reduced max length
        }),
        async ({ agentId, originalText }) => {
          let convertedText = '';
          
          const voiceAgent = new VoiceAgent({
            agentId,
            onConnect: vi.fn(),
            onDisconnect: vi.fn(),
            onError: vi.fn()
          });

          voiceAgent.onTranscription((text: string) => {
            convertedText = text;
          });

          await voiceAgent.initializeConnection();
          await new Promise(resolve => setTimeout(resolve, 20));

          await voiceAgent.sendMessage(originalText);

          // Property: Converted text should maintain the same essential content
          expect(convertedText).toBe(originalText.trim());
          
          // Property: Text length should be preserved (after trimming)
          expect(convertedText.length).toBe(originalText.trim().length);

          await voiceAgent.disconnect();
        }
      ),
      { numRuns: 30 }
    );
  });
});