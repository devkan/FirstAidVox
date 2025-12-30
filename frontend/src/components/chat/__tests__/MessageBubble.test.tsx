import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { MessageBubble } from '../MessageBubble';
import type { ChatMessage } from '../types';

describe('MessageBubble', () => {
  const createMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
    id: 'test-message',
    content: 'Test message content',
    type: 'text',
    timestamp: new Date('2023-01-01T10:00:00Z'),
    isUser: false,
    ...overrides
  });

  describe('Property 3: Message Bubble Alignment', () => {
    it('should right-align user messages consistently', () => {
      const userMessage = createMessage({ isUser: true, content: 'User message' });
      
      render(<MessageBubble message={userMessage} />);
      
      // Find the outermost container with justify-end class
      const container = screen.getByText('User message').closest('.justify-end');
      expect(container).toHaveClass('justify-end');
      
      const bubble = screen.getByText('User message').closest('.rounded-2xl');
      expect(bubble).toHaveClass('message-bubble-user');
    });

    it('should left-align AI messages consistently', () => {
      const aiMessage = createMessage({ isUser: false, content: 'AI response' });
      
      render(<MessageBubble message={aiMessage} />);
      
      // Find the outermost container with justify-start class
      const container = screen.getByText('AI response').closest('.justify-start');
      expect(container).toHaveClass('justify-start');
      
      const bubble = screen.getByText('AI response').closest('.rounded-2xl');
      expect(bubble).toHaveClass('message-bubble-ai');
    });

    it('should maintain alignment for different message types', () => {
      const messageTypes: Array<{ type: any; isUser: boolean }> = [
        { type: 'text', isUser: true },
        { type: 'text', isUser: false },
        { type: 'voice', isUser: true },
        { type: 'voice', isUser: false },
        { type: 'image', isUser: true },
        { type: 'image', isUser: false },
        { type: 'system', isUser: false }
      ];

      messageTypes.forEach(({ type, isUser }, index) => {
        const message = createMessage({ 
          id: `test-${index}`,
          type, 
          isUser, 
          content: `${type} message from ${isUser ? 'user' : 'AI'}` 
        });
        
        const { container } = render(<MessageBubble message={message} />);
        
        const flexContainer = container.querySelector('.flex');
        if (isUser) {
          expect(flexContainer).toHaveClass('justify-end');
        } else {
          expect(flexContainer).toHaveClass('justify-start');
        }
        
        // Clean up for next iteration
        container.remove();
      });
    });

    it('should apply correct styling classes for user vs AI messages', () => {
      // Test user message styling
      const userMessage = createMessage({ isUser: true, content: 'User message' });
      const { container: userContainer } = render(<MessageBubble message={userMessage} />);
      
      const userBubble = userContainer.querySelector('.message-bubble-user');
      expect(userBubble).toBeInTheDocument();
      expect(userBubble).toHaveClass('text-white', 'rounded-br-md');
      
      userContainer.remove();

      // Test AI message styling  
      const aiMessage = createMessage({ isUser: false, content: 'AI message' });
      const { container: aiContainer } = render(<MessageBubble message={aiMessage} />);
      
      const aiBubble = aiContainer.querySelector('.message-bubble-ai');
      expect(aiBubble).toBeInTheDocument();
      expect(aiBubble).toHaveClass('text-gray-800', 'rounded-bl-md');
    });

    it('should position timestamps correctly based on message alignment', () => {
      // User message timestamp should be right-aligned
      const userMessage = createMessage({ isUser: true });
      const { container: userContainer } = render(<MessageBubble message={userMessage} />);
      
      const userTimestamp = userContainer.querySelector('.text-xs.text-gray-500');
      expect(userTimestamp).toHaveClass('text-right');
      
      userContainer.remove();

      // AI message timestamp should be left-aligned
      const aiMessage = createMessage({ isUser: false });
      const { container: aiContainer } = render(<MessageBubble message={aiMessage} />);
      
      const aiTimestamp = aiContainer.querySelector('.text-xs.text-gray-500');
      expect(aiTimestamp).toHaveClass('text-left');
    });

    it('should maintain consistent max-width for both user and AI messages', () => {
      const userMessage = createMessage({ isUser: true });
      const aiMessage = createMessage({ isUser: false });
      
      const { container: userContainer } = render(<MessageBubble message={userMessage} />);
      const { container: aiContainer } = render(<MessageBubble message={aiMessage} />);
      
      const userBubble = userContainer.querySelector('.rounded-2xl');
      const aiBubble = aiContainer.querySelector('.rounded-2xl');
      
      // Both should have the same max-width classes
      expect(userBubble).toHaveClass('max-w-[85%]', 'sm:max-w-[70%]', 'md:max-w-[60%]');
      expect(aiBubble).toHaveClass('max-w-[85%]', 'sm:max-w-[70%]', 'md:max-w-[60%]');
    });
  });

  describe('Message Content Rendering', () => {
    it('should render text messages correctly', () => {
      const message = createMessage({ content: 'Simple text message' });
      render(<MessageBubble message={message} />);
      
      expect(screen.getByText('Simple text message')).toBeInTheDocument();
    });

    it('should render voice messages with audio indicator', () => {
      const voiceMessage = createMessage({ 
        type: 'voice',
        content: 'Transcribed voice content',
        metadata: {
          voiceData: {
            duration: 5.5,
            audioUrl: 'test-audio.mp3'
          }
        }
      });
      
      render(<MessageBubble message={voiceMessage} />);
      
      expect(screen.getByText('Voice message')).toBeInTheDocument();
      expect(screen.getByText('"Transcribed voice content"')).toBeInTheDocument();
      expect(screen.getByText('6s')).toBeInTheDocument(); // Rounded duration
    });

    it('should render system messages with appropriate styling', () => {
      const systemMessage = createMessage({ 
        type: 'system',
        content: 'System notification message'
      });
      
      render(<MessageBubble message={systemMessage} />);
      
      expect(screen.getByText('System notification message')).toBeInTheDocument();
      
      // Should have system message styling
      const container = screen.getByText('System notification message').closest('.flex');
      expect(container).toHaveClass('items-center', 'space-x-2', 'text-sm', 'text-gray-600');
    });

    it('should show confidence indicator for AI messages', () => {
      const aiMessage = createMessage({ 
        isUser: false,
        metadata: {
          confidence: 0.85
        }
      });
      
      render(<MessageBubble message={aiMessage} />);
      
      expect(screen.getByText('85% confident')).toBeInTheDocument();
    });

    it('should not show confidence indicator for user messages', () => {
      const userMessage = createMessage({ 
        isUser: true,
        metadata: {
          confidence: 0.85
        }
      });
      
      render(<MessageBubble message={userMessage} />);
      
      expect(screen.queryByText('85% confident')).not.toBeInTheDocument();
    });
  });

  describe('Timestamp Formatting', () => {
    it('should format timestamps correctly', () => {
      const message = createMessage({ 
        timestamp: new Date('2023-01-01T14:30:00Z')
      });
      
      const { container } = render(<MessageBubble message={message} />);
      
      // The time will be displayed in local timezone, so we need to check for the actual displayed time
      // Since the test environment might have different timezone, let's check for the pattern
      const timeElement = container.querySelector('.text-xs.text-gray-500');
      expect(timeElement).toBeInTheDocument();
      expect(timeElement?.textContent).toMatch(/^\d{2}:\d{2}$/);
    });
  });
});

/**
 * Property-Based Test: Message Bubble Alignment
 * 
 * Feature: ui-redesign, Property 3: For any message in the conversation, 
 * user messages should be right-aligned and AI messages should be left-aligned consistently
 * 
 * This test validates that message alignment is consistent regardless of message type,
 * content length, or other properties. User messages always appear on the right side
 * with appropriate styling, while AI messages always appear on the left side.
 */