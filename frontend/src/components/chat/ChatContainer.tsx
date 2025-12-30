import React, { useEffect, useRef, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { MedicalCard } from './MedicalCard';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { EmergencyButton } from './EmergencyButton';
import { useMedicalState } from '../../hooks/useAppState';
import { useVoiceAgent } from '../../hooks/useVoiceAgent';
import type { ChatMessage, ChatContainerProps } from './types';

export const ChatContainer = React.memo(function ChatContainer({ className = '' }: ChatContainerProps) {
  const medicalState = useMedicalState();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingImage, setPendingImage] = useState<Blob | null>(null);

  const voiceAgent = useVoiceAgent({
    autoConnect: false,
    pendingImage,
    onImageSent: () => setPendingImage(null)
  });

  // Convert conversation history to chat messages
  useEffect(() => {
    const chatMessages: ChatMessage[] = medicalState.conversationHistory.map((entry, index) => ({
      id: entry.id || `msg-${index}`,
      content: entry.content,
      type: entry.type === 'system_response' ? 'text' : 'text',
      timestamp: entry.timestamp,
      isUser: entry.type === 'user_voice',
      metadata: entry.metadata
    }));

    // Add medical assessment as special message if available
    if (medicalState.currentAssessment) {
      const medicalMessage: ChatMessage = {
        id: `medical-assessment`, // Use static ID to prevent re-renders
        content: medicalState.currentAssessment.advice,
        type: 'medical',
        timestamp: new Date(),
        isUser: false,
        metadata: {
          medicalData: medicalState.currentAssessment,
          urgency: medicalState.currentAssessment.urgencyLevel,
          confidence: medicalState.currentAssessment.confidence
        }
      };
      chatMessages.push(medicalMessage);
    }

    setMessages(chatMessages);
  }, [medicalState.conversationHistory, medicalState.currentAssessment]);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'end'
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle message sending
  const handleSendMessage = async (message: string, attachments?: File[]) => {
    if (!message.trim() && !attachments?.length) return;

    try {
      setIsTyping(true);
      
      // Get the image file if provided
      const imageFile = attachments?.length ? attachments[0] : null;
      
      // Handle image attachment
      if (imageFile) {
        setPendingImage(imageFile);
      }

      // Send message through voice agent with image
      await voiceAgent.sendMessage(message.trim(), 'normal', imageFile);
      
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsTyping(false);
    }
  };

  // Handle voice input
  const handleVoiceInput = async () => {
    try {
      if (voiceAgent.isActive) {
        await voiceAgent.deactivate();
      } else {
        await voiceAgent.activate();
      }
    } catch (error) {
      console.error('Voice input error:', error);
    }
  };

  // Handle emergency call
  const handleEmergencyCall = () => {
    // Emergency contacts logic would go here
    window.open('tel:911', '_self');
  };

  return (
    <div className={`flex flex-col h-screen bg-gradient-to-br from-medical-50 to-chat-background ${className}`}>
      {/* Header */}
      <header className="flex-shrink-0 bg-white/80 backdrop-blur-md border-b border-chat-border safe-area-top">
        <div className="px-3 py-2 sm:px-4 sm:py-3 lg:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-medical-500 to-medical-600 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-semibold text-gray-900">FirstAidVox</h1>
                <p className="text-xs sm:text-sm text-gray-500 hidden xs:block">AI Medical Assistant</p>
              </div>
            </div>
            
            {/* Status and Language Selection */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Language Selection */}
              <select
                value={voiceAgent.getLanguagePreference()}
                onChange={(e) => voiceAgent.setLanguagePreference(e.target.value)}
                className="text-xs sm:text-sm bg-white border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent"
                title="Select voice recognition language"
              >
                <option value="auto">🌍 Auto</option>
                <option value="en-US">🇺🇸 English</option>
                <option value="ko-KR">🇰🇷 한국어</option>
                <option value="ja-JP">🇯🇵 日本語</option>
                <option value="es-ES">🇪🇸 Español</option>
              </select>
              
              {/* Status indicators */}
              {medicalState.isProcessing && (
                <div className="flex items-center space-x-1 sm:space-x-2 text-medical-600">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-medical-500 rounded-full animate-pulse"></div>
                  <span className="text-xs sm:text-sm font-medium hidden xs:inline">Analyzing...</span>
                </div>
              )}
              
              {voiceAgent.isActive && (
                <div className="flex items-center space-x-1 sm:space-x-2 text-safe-600">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-safe-500 rounded-full animate-pulse"></div>
                  <span className="text-xs sm:text-sm font-medium hidden xs:inline">
                    {voiceAgent.isListening ? 'Listening...' : 'Voice Ready'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto chat-scrollbar px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
          <div className="max-w-2xl sm:max-w-3xl lg:max-w-4xl mx-auto space-y-3 sm:space-y-4">
            {messages.length === 0 ? (
              // Welcome message
              <div className="text-center py-8 sm:py-12">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-medical-500 to-medical-600 rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Welcome to FirstAidVox</h2>
                <p className="text-sm sm:text-base text-gray-600 max-w-xs sm:max-w-md mx-auto px-4">
                  I'm your AI medical assistant. Describe your symptoms or ask any health-related questions to get started. I can respond in English, 한국어, 日本語, or Español.
                </p>
                <div className="mt-4 sm:mt-6 flex flex-wrap justify-center gap-1.5 sm:gap-2 px-4">
                  <button 
                    onClick={() => handleSendMessage("I have a headache")}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-medical-100 text-medical-700 rounded-full text-xs sm:text-sm hover:bg-medical-200 transition-colors"
                  >
                    "I have a headache"
                  </button>
                  <button 
                    onClick={() => handleSendMessage("머리가 아파요")}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-medical-100 text-medical-700 rounded-full text-xs sm:text-sm hover:bg-medical-200 transition-colors"
                  >
                    "머리가 아파요"
                  </button>
                  <button 
                    onClick={() => handleSendMessage("I feel dizzy")}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-medical-100 text-medical-700 rounded-full text-xs sm:text-sm hover:bg-medical-200 transition-colors"
                  >
                    "I feel dizzy"
                  </button>
                  <button 
                    onClick={() => handleSendMessage("First aid for cuts")}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-medical-100 text-medical-700 rounded-full text-xs sm:text-sm hover:bg-medical-200 transition-colors"
                  >
                    "First aid for cuts"
                  </button>
                </div>
              </div>
            ) : (
              // Messages list
              messages.map((message) => (
                <div key={message.id} className="message-enter">
                  {message.type === 'medical' && message.metadata?.medicalData ? (
                    <MedicalCard
                      assessment={message.metadata.medicalData}
                      timestamp={message.timestamp}
                      className="mb-3 sm:mb-4"
                    />
                  ) : (
                    <MessageBubble message={message} />
                  )}
                </div>
              ))
            )}

            {/* Typing indicator */}
            <TypingIndicator isVisible={isTyping || medicalState.isProcessing} />

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      {/* Chat Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onVoiceInput={handleVoiceInput}
        disabled={medicalState.isProcessing}
        placeholder="Describe your symptoms or ask a medical question... (English, 한국어, 日본語, Español)"
        className="flex-shrink-0 safe-area-bottom"
      />

      {/* Emergency Button */}
      <EmergencyButton
        onEmergencyCall={handleEmergencyCall}
        className="fixed bottom-16 right-3 sm:bottom-20 sm:right-4 lg:bottom-24 lg:right-6 z-50"
      />
    </div>
  );
});