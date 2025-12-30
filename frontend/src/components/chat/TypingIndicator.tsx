import React from 'react';
import type { TypingIndicatorProps } from './types';

export function TypingIndicator({ isVisible, className = '' }: TypingIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className={`flex justify-start mb-4 ${className}`}>
      <div className="message-bubble-ai max-w-[85%] sm:max-w-[70%] md:max-w-[60%] rounded-2xl px-4 py-3 shadow-message mr-auto rounded-bl-md">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
          </div>
          <span className="text-sm text-gray-600">AI is thinking...</span>
        </div>
      </div>
    </div>
  );
}