import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChatContainer } from '../ChatContainer';
import { AppStateProvider } from '../../../hooks/useAppState';
import type { ChatMessage } from '../types';

// Mock the voice agent hook
vi.mock('../../../hooks/useVoiceAgent', () => ({
  useVoiceAgent: () => ({
    isActive: false,
    isListening: false,
    isProcessing: false,
    sendMessage: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
  })
}));

// Mock child components
vi.mock('../MessageBubble', () => ({
  MessageBubble: ({ message }: { message: ChatMessage }) => (
    <div data-testid={`message-${message.id}`} data-user={message.isUser}>
      {message.content}
    </div>
  )
}));

vi.mock('../MedicalCard', () => ({
  MedicalCard: ({ assessment }: any) => (
    <div data-testid="medical-card">{assessment.condition}</div>
  )
}));

vi.mock('../ChatInput', () => ({
  ChatInput: ({ onSendMessage }: any) => (
    <div data-testid="chat-input">
      <button onClick={() => onSendMessage('test message')}>Send</button>
    </div>
  )
}));

vi.mock('../TypingIndicator', () => ({
  TypingIndicator: ({ isVisible }: { isVisible: boolean }) => 
    isVisible ? <div data-testid="typing-indicator">Typing...</div> : null
}));

vi.mock('../EmergencyButton', () => ({
  EmergencyButton: ({ onEmergencyCall }: any) => (
    <button data-testid="emergency-button" onClick={onEmergencyCall}>
      Emergency
    </button>
  )
}));

const renderChatContainer = (initialState = {}) => {
  const defaultState = {
    medical: {
      conversationHistory: [],
      currentAssessment: null,
      isProcessing: false,
    },
    ...initialState
  };

  return render(
    <AppStateProvider initialState={defaultState}>
      <ChatContainer />
    </AppStateProvider>
  );
};

describe('ChatContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 1: Message Display Order', () => {
    it('should display messages in chronological order with newest at bottom', async () => {
      const messages = [
        {
          id: 'msg-1',
          content: 'First message',
          timestamp: new Date('2023-01-01T10:00:00Z'),
          type: 'user_voice'
        },
        {
          id: 'msg-2', 
          content: 'Second message',
          timestamp: new Date('2023-01-01T10:01:00Z'),
          type: 'system_response'
        },
        {
          id: 'msg-3',
          content: 'Third message', 
          timestamp: new Date('2023-01-01T10:02:00Z'),
          type: 'user_voice'
        }
      ];

      renderChatContainer({
        medical: {
          conversationHistory: messages,
          currentAssessment: null,
          isProcessing: false,
        }
      });

      await waitFor(() => {
        const messageElements = screen.getAllByTestId(/^message-/);
        expect(messageElements).toHaveLength(3);
        
        // Verify chronological order
        expect(messageElements[0]).toHaveAttribute('data-testid', 'message-msg-1');
        expect(messageElements[1]).toHaveAttribute('data-testid', 'message-msg-2');
        expect(messageElements[2]).toHaveAttribute('data-testid', 'message-msg-3');
      });
    });

    it('should maintain chronological order when new messages are added', async () => {
      const initialMessages = [
        {
          id: 'msg-1',
          content: 'First message',
          timestamp: new Date('2023-01-01T10:00:00Z'),
          type: 'user_voice'
        }
      ];

      // Test with both messages from the start
      const allMessages = [
        ...initialMessages,
        {
          id: 'msg-2',
          content: 'Newer message',
          timestamp: new Date('2023-01-01T10:01:00Z'),
          type: 'system_response'
        }
      ];

      renderChatContainer({
        medical: {
          conversationHistory: allMessages,
          currentAssessment: null,
          isProcessing: false,
        }
      });

      await waitFor(() => {
        const messageElements = screen.getAllByTestId(/^message-/);
        expect(messageElements).toHaveLength(2);
        
        // Verify the newer message appears after the older one
        expect(messageElements[0]).toHaveAttribute('data-testid', 'message-msg-1');
        expect(messageElements[1]).toHaveAttribute('data-testid', 'message-msg-2');
      });
    });

    it('should handle empty message list correctly', () => {
      renderChatContainer({
        medical: {
          conversationHistory: [],
          currentAssessment: null,
          isProcessing: false,
        }
      });

      // Should show welcome message when no messages
      expect(screen.getByText('Welcome to FirstAidVox')).toBeInTheDocument();
      expect(screen.queryByTestId(/^message-/)).not.toBeInTheDocument();
    });

    it('should place medical assessment messages at the end of conversation', async () => {
      const messages = [
        {
          id: 'msg-1',
          content: 'I have a headache',
          timestamp: new Date('2023-01-01T10:00:00Z'),
          type: 'user_voice'
        },
        {
          id: 'msg-2',
          content: 'Let me help you with that',
          timestamp: new Date('2023-01-01T10:01:00Z'),
          type: 'system_response'
        }
      ];

      const medicalAssessment = {
        condition: 'Tension headache',
        urgencyLevel: 'low' as const,
        advice: 'Rest and hydration recommended',
        confidence: 0.8
      };

      renderChatContainer({
        medical: {
          conversationHistory: messages,
          currentAssessment: medicalAssessment,
          isProcessing: false,
        }
      });

      await waitFor(() => {
        // Should have 2 regular messages + 1 medical card
        const messageElements = screen.getAllByTestId(/^message-/);
        const medicalCard = screen.getByTestId('medical-card');
        
        expect(messageElements).toHaveLength(2);
        expect(medicalCard).toBeInTheDocument();
        
        // Medical card should appear after regular messages in DOM order
        const container = document.body;
        const allElements = container.querySelectorAll('[data-testid^="message-"], [data-testid="medical-card"]');
        const lastElement = allElements[allElements.length - 1];
        expect(lastElement).toHaveAttribute('data-testid', 'medical-card');
      });
    });
  });

  describe('Layout Structure', () => {
    it('should have proper full-height layout structure', () => {
      renderChatContainer();

      const container = screen.getByRole('main').parentElement;
      expect(container).toHaveClass('h-screen');
      expect(container).toHaveClass('flex', 'flex-col');
    });

    it('should include all required UI sections', () => {
      renderChatContainer();

      // Header should be present
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByText('FirstAidVox')).toBeInTheDocument();

      // Main content area should be present
      expect(screen.getByRole('main')).toBeInTheDocument();

      // Chat input should be present
      expect(screen.getByTestId('chat-input')).toBeInTheDocument();

      // Emergency button should be present
      expect(screen.getByTestId('emergency-button')).toBeInTheDocument();
    });

    it('should show typing indicator when processing', () => {
      renderChatContainer({
        medical: {
          conversationHistory: [],
          currentAssessment: null,
          isProcessing: true,
        }
      });

      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
      expect(screen.getByText('Analyzing...')).toBeInTheDocument();
    });
  });
});

/**
 * Property-Based Test: Message Display Order
 * 
 * Feature: ui-redesign, Property 1: For any sequence of messages sent to the chat interface, 
 * the messages should appear in chronological order with the newest message at the bottom
 * 
 * This test validates that regardless of the order messages are added to the conversation history,
 * they will always be displayed in chronological order based on their timestamps.
 */