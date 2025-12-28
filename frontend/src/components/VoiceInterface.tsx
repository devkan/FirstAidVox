import React, { useState } from 'react';
import { useVoiceAgent } from '../hooks/useVoiceAgent';
import WaveformVisualizer from './WaveformVisualizer';

export interface VoiceInterfaceProps {
  agentId?: string;
  apiKey?: string;
  className?: string;
  pendingImage?: Blob | null;
  onImageSent?: () => void;
}

export function VoiceInterface({ 
  agentId, 
  apiKey, 
  className = '',
  pendingImage,
  onImageSent
}: VoiceInterfaceProps) {
  const [textInput, setTextInput] = useState('');
  const voiceAgent = useVoiceAgent({ 
    agentId, 
    apiKey, 
    autoConnect: false,
    pendingImage,
    onImageSent
  });

  const handleStartVoice = async () => {
    try {
      await voiceAgent.activate();
    } catch (error) {
      console.error('Failed to start voice:', error);
    }
  };

  const handleStopVoice = async () => {
    try {
      await voiceAgent.deactivate();
    } catch (error) {
      console.error('Failed to stop voice:', error);
    }
  };

  const handleSendText = async (priority: 'low' | 'normal' | 'high' = 'normal') => {
    if (!textInput.trim()) return;
    
    try {
      await voiceAgent.sendMessage(textInput.trim(), priority);
      setTextInput('');
    } catch (error) {
      console.error('Failed to send text message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText('normal');
    }
  };

  const handleClearQueue = () => {
    voiceAgent.clearQueue();
  };

  const handleForceEndSession = () => {
    voiceAgent.forceEndSession();
  };

  // Determine waveform variant based on voice state
  const getWaveformVariant = (): 'listening' | 'speaking' | 'processing' => {
    if (voiceAgent.isProcessing) return 'processing';
    if (voiceAgent.isListening) return 'listening';
    return 'speaking';
  };

  // Get status text for user feedback
  const getStatusText = (): string => {
    if (voiceAgent.connectionStatus === 'connecting') return 'Connecting...';
    if (voiceAgent.connectionStatus === 'disconnected') return 'Disconnected';
    if (voiceAgent.isProcessingQueue) return `Processing queue (${voiceAgent.queueSize} pending)...`;
    if (voiceAgent.isProcessing) return 'Processing...';
    if (voiceAgent.isListening) return 'Listening...';
    if (voiceAgent.isActive) return 'Ready to listen';
    if (voiceAgent.queueSize > 0) return `${voiceAgent.queueSize} requests queued`;
    return 'Voice assistant ready';
  };

  // Get status color class
  const getStatusColor = (): string => {
    if (voiceAgent.connectionStatus === 'connecting') return 'text-yellow-600';
    if (voiceAgent.connectionStatus === 'disconnected') return 'text-red-600';
    if (voiceAgent.isProcessingQueue) return 'text-purple-600';
    if (voiceAgent.isProcessing) return 'text-blue-600';
    if (voiceAgent.isListening) return 'text-green-600';
    if (voiceAgent.queueSize > 0) return 'text-orange-600';
    return 'text-gray-600';
  };

  // Cross-device event handling
  const handleButtonInteraction = (callback: () => void) => {
    return (event: React.MouseEvent | React.TouchEvent) => {
      event.preventDefault();
      callback();
    };
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Voice Assistant
        </h2>
        <p className={`text-sm ${getStatusColor()}`}>
          {getStatusText()}
        </p>
      </div>

      {/* Waveform Visualizer */}
      <div className="mb-6">
        <WaveformVisualizer
          audioLevel={voiceAgent.audioLevel}
          isActive={voiceAgent.isActive}
          variant={getWaveformVariant()}
          className="mx-auto"
        />
      </div>

      {/* Queue Status Display */}
      {(voiceAgent.queueSize > 0 || voiceAgent.currentSessionId) && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800">
                Voice Session Active
              </p>
              {voiceAgent.queueSize > 0 && (
                <p className="text-xs text-blue-600">
                  {voiceAgent.queueSize} request{voiceAgent.queueSize !== 1 ? 's' : ''} in queue
                </p>
              )}
              {voiceAgent.currentSessionId && (
                <p className="text-xs text-blue-500">
                  Session: {voiceAgent.currentSessionId.slice(-8)}
                </p>
              )}
            </div>
            <div className="flex space-x-2">
              {voiceAgent.queueSize > 0 && (
                <button
                  onClick={handleButtonInteraction(handleClearQueue)}
                  onTouchEnd={handleButtonInteraction(handleClearQueue)}
                  className="
                    px-2 py-1 text-xs bg-orange-600 text-white rounded
                    hover:bg-orange-700 focus:outline-none focus:ring-1 focus:ring-orange-500
                    transition-colors duration-200 active:bg-orange-800
                  "
                >
                  Clear Queue
                </button>
              )}
              {voiceAgent.currentSessionId && (
                <button
                  onClick={handleButtonInteraction(handleForceEndSession)}
                  onTouchEnd={handleButtonInteraction(handleForceEndSession)}
                  className="
                    px-2 py-1 text-xs bg-red-600 text-white rounded
                    hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500
                    transition-colors duration-200 active:bg-red-800
                  "
                >
                  End Session
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pending Image Indicator */}
      {pendingImage && (
        <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-green-800">Photo Ready</p>
              <p className="text-xs text-green-600">Your photo will be sent with the next voice message</p>
            </div>
          </div>
        </div>
      )}

      {/* Current Transcription Display */}
      {voiceAgent.currentTranscription && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-1">You said:</p>
          <p className="text-gray-800">{voiceAgent.currentTranscription}</p>
        </div>
      )}

      {/* Voice Controls */}
      <div className="flex justify-center space-x-4 mb-6">
        {!voiceAgent.isActive ? (
          <button
            onClick={handleButtonInteraction(handleStartVoice)}
            onTouchEnd={handleButtonInteraction(handleStartVoice)}
            disabled={voiceAgent.connectionStatus === 'connecting'}
            className="
              px-6 py-3 bg-blue-600 text-white rounded-lg font-medium
              hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-200 active:bg-blue-800
              min-h-[44px] touch-manipulation
            "
          >
            {voiceAgent.connectionStatus === 'connecting' ? 'Connecting...' : 'Start Voice'}
          </button>
        ) : (
          <button
            onClick={handleButtonInteraction(handleStopVoice)}
            onTouchEnd={handleButtonInteraction(handleStopVoice)}
            className="
              px-6 py-3 bg-red-600 text-white rounded-lg font-medium
              hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500
              transition-colors duration-200 active:bg-red-800
              min-h-[44px] touch-manipulation
            "
          >
            Stop Voice
          </button>
        )}
      </div>

      {/* Text Input Fallback - Responsive Layout */}
      <div className="border-t pt-4">
        <p className="text-sm text-gray-600 mb-2">Or type your message:</p>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your medical question here..."
            className="
              flex-1 p-3 border border-gray-300 rounded-lg resize-none
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              min-h-[80px] sm:min-h-[60px]
            "
            rows={2}
          />
          <div className="flex flex-row sm:flex-col space-x-2 sm:space-x-0 sm:space-y-1 justify-center sm:justify-start">
            <button
              onClick={handleButtonInteraction(() => handleSendText('high'))}
              onTouchEnd={handleButtonInteraction(() => handleSendText('high'))}
              disabled={!textInput.trim() || voiceAgent.isProcessing}
              className="
                flex-1 sm:flex-none px-4 py-2 sm:px-3 sm:py-1 text-xs bg-red-600 text-white rounded font-medium
                hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-200 active:bg-red-800
                min-h-[44px] touch-manipulation
              "
            >
              Urgent
            </button>
            <button
              onClick={handleButtonInteraction(() => handleSendText('normal'))}
              onTouchEnd={handleButtonInteraction(() => handleSendText('normal'))}
              disabled={!textInput.trim() || voiceAgent.isProcessing}
              className="
                flex-1 sm:flex-none px-4 py-2 sm:px-3 sm:py-1 text-xs bg-green-600 text-white rounded font-medium
                hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-200 active:bg-green-800
                min-h-[44px] touch-manipulation
              "
            >
              Send
            </button>
            <button
              onClick={handleButtonInteraction(() => handleSendText('low'))}
              onTouchEnd={handleButtonInteraction(() => handleSendText('low'))}
              disabled={!textInput.trim() || voiceAgent.isProcessing}
              className="
                flex-1 sm:flex-none px-4 py-2 sm:px-3 sm:py-1 text-xs bg-gray-600 text-white rounded font-medium
                hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-200 active:bg-gray-800
                min-h-[44px] touch-manipulation
              "
            >
              Low
            </button>
          </div>
        </div>
      </div>

      {/* Connection Status Indicator */}
      <div className="mt-4 flex items-center justify-center space-x-2">
        <div 
          className={`
            w-2 h-2 rounded-full
            ${voiceAgent.connectionStatus === 'connected' ? 'bg-green-500' : ''}
            ${voiceAgent.connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : ''}
            ${voiceAgent.connectionStatus === 'disconnected' ? 'bg-red-500' : ''}
          `}
        />
        <span className="text-xs text-gray-500">
          {voiceAgent.connectionStatus === 'connected' && 'Connected'}
          {voiceAgent.connectionStatus === 'connecting' && 'Connecting'}
          {voiceAgent.connectionStatus === 'disconnected' && 'Disconnected'}
        </span>
      </div>
    </div>
  );
}

export default VoiceInterface;