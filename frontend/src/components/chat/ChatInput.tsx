import React, { useState, useRef, useEffect } from 'react';
import type { ChatInputProps } from './types';

export const ChatInput = React.memo(function ChatInput({ 
  onSendMessage, 
  onVoiceInput, 
  disabled = false, 
  placeholder = "Type your message...",
  className = '' 
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (!canSend) return;
    
    // Add image description to message if image is attached
    let messageText = message.trim();
    if (attachments.length > 0) {
      messageText += ` [Image attached: ${attachments[0].name}]`;
    }
    
    onSendMessage(messageText, attachments);
    setMessage('');
    setAttachments([]);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleVoiceToggle = () => {
    setIsRecording(!isRecording);
    onVoiceInput();
  };

  const canSend = (message.trim().length > 0 || attachments.length > 0) && !disabled;

  return (
    <div className={`chat-input-container border-t border-gray-200 ${className}`}>
      <div className="max-w-4xl mx-auto p-4 flex items-end">
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-2 flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div key={index} className="flex items-center space-x-2 bg-blue-100 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-sm text-blue-700 truncate max-w-32">
                  {file.name}
                </span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="text-blue-500 hover:text-blue-700 focus:outline-none"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Area - No wrapper div */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="w-10 h-10 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-full flex items-center justify-center transition-colors"
          title="Attach medical image (injury, symptom, etc.)"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 min-h-[48px] max-h-[120px] px-4 py-3 mx-3 bg-white border-2 border-gray-300 rounded-2xl resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50 text-base"
        />

        <button
          type="button"
          onClick={handleVoiceToggle}
          disabled={disabled}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
              : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
          } disabled:opacity-50`}
          title={isRecording ? "Stop recording" : "Start voice input"}
        >
          {isRecording ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={`w-12 h-12 ml-3 rounded-full flex items-center justify-center transition-all ${
            canSend
              ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title={canSend ? "Send message" : "Type a message to send"}
        >
          {disabled ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Hidden help text for screen readers */}
        <div id="message-help" className="sr-only">
          Type your medical question or describe your symptoms. Press Enter to send, or use voice input button.
        </div>
      </div>

      {/* Quick Actions - Outside main input area */}
      <div className="max-w-4xl mx-auto px-4 pb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMessage("I have a headache")}
          disabled={disabled}
          className="px-3 py-2 bg-blue-50 text-blue-700 rounded-full text-sm hover:bg-blue-100 transition-colors disabled:opacity-50 border border-blue-200"
        >
          💊 Headache
        </button>
        <button
          type="button"
          onClick={() => setMessage("머리가 아파요")}
          disabled={disabled}
          className="px-3 py-2 bg-blue-50 text-blue-700 rounded-full text-sm hover:bg-blue-100 transition-colors disabled:opacity-50 border border-blue-200"
        >
          💊 두통
        </button>
        <button
          type="button"
          onClick={() => setMessage("I feel dizzy")}
          disabled={disabled}
          className="px-3 py-2 bg-blue-50 text-blue-700 rounded-full text-sm hover:bg-blue-100 transition-colors disabled:opacity-50 border border-blue-200"
        >
          😵 Dizziness
        </button>
        <button
          type="button"
          onClick={() => setMessage("First aid for cuts")}
          disabled={disabled}
          className="px-3 py-2 bg-blue-50 text-blue-700 rounded-full text-sm hover:bg-blue-100 transition-colors disabled:opacity-50 border border-blue-200"
        >
          🩹 First Aid
        </button>
        <button
          type="button"
          onClick={() => setMessage("Emergency help needed")}
          disabled={disabled}
          className="px-3 py-2 bg-red-50 text-red-700 rounded-full text-sm hover:bg-red-100 transition-colors disabled:opacity-50 border border-red-200"
        >
          🚨 Emergency
        </button>
      </div>
    </div>
  );
});