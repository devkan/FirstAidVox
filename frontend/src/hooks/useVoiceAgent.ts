import { useEffect, useRef, useCallback } from 'react';
import { VoiceAgent, createVoiceAgent, defaultVoiceConfig } from '../services/voiceAgent';
import { useVoiceState, useMedicalState, useUIState } from './useAppState';
import { backendService } from '../services/backendService';

export interface UseVoiceAgentOptions {
  agentId?: string;
  apiKey?: string;
  autoConnect?: boolean;
  pendingImage?: Blob | null;
  onImageSent?: () => void;
}

export function useVoiceAgent(options: UseVoiceAgentOptions = {}) {
  const voiceState = useVoiceState();
  const medicalState = useMedicalState();
  const uiState = useUIState();
  const voiceAgentRef = useRef<VoiceAgent | null>(null);
  const queueUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Create stable references to avoid infinite re-renders
  const stableVoiceState = useRef(voiceState);
  const stableMedicalState = useRef(medicalState);
  const stableUIState = useRef(uiState);
  
  // Update refs when state changes
  stableVoiceState.current = voiceState;
  stableMedicalState.current = medicalState;
  stableUIState.current = uiState;

  // Update queue status periodically
  const updateQueueStatus = useCallback(() => {
    if (voiceAgentRef.current) {
      const queueStatus = voiceAgentRef.current.getQueueStatus();
      stableVoiceState.current.updateQueueSize(queueStatus.size);
      stableVoiceState.current.setProcessingQueue(queueStatus.isProcessing);
      
      const currentSession = voiceAgentRef.current.getCurrentSession();
      stableVoiceState.current.setSession(currentSession?.id || null);
    }
  }, []);

  // Start queue status monitoring
  const startQueueMonitoring = useCallback(() => {
    if (queueUpdateIntervalRef.current) {
      clearInterval(queueUpdateIntervalRef.current);
    }
    
    queueUpdateIntervalRef.current = setInterval(() => {
      if (voiceAgentRef.current) {
        const queueStatus = voiceAgentRef.current.getQueueStatus();
        stableVoiceState.current.updateQueueSize(queueStatus.size);
        stableVoiceState.current.setProcessingQueue(queueStatus.isProcessing);
        
        const currentSession = voiceAgentRef.current.getCurrentSession();
        stableVoiceState.current.setSession(currentSession?.id || null);
      }
    }, 1000);
  }, []);

  // Stop queue status monitoring
  const stopQueueMonitoring = useCallback(() => {
    if (queueUpdateIntervalRef.current) {
      clearInterval(queueUpdateIntervalRef.current);
      queueUpdateIntervalRef.current = null;
    }
  }, []);

  // Initialize voice agent
  const initializeAgent = useCallback(async () => {
    if (voiceAgentRef.current) {
      return voiceAgentRef.current;
    }

    try {
      stableVoiceState.current.updateConnectionStatus('connecting');

      const agent = createVoiceAgent({
        agentId: options.agentId || defaultVoiceConfig.agentId || 'default-agent-id',
        apiKey: options.apiKey || defaultVoiceConfig.apiKey,
        onConnect: () => {
          stableVoiceState.current.updateConnectionStatus('connected');
          startQueueMonitoring();
          console.log('Voice agent connected successfully');
        },
        onDisconnect: () => {
          stableVoiceState.current.updateConnectionStatus('disconnected');
          stableVoiceState.current.deactivate();
          stopQueueMonitoring();
          console.log('Voice agent disconnected');
        },
        onError: (error: Error) => {
          console.error('Voice agent error:', error);
          stableVoiceState.current.updateConnectionStatus('disconnected');
          stableUIState.current.addNotification({
            id: `voice-error-${Date.now()}`,
            type: 'error',
            title: 'Voice Service Error',
            message: error.message,
            timestamp: new Date(),
            autoClose: true
          });
        },
        onMessage: async (message: string) => {
          try {
            // Add system response to conversation history
            stableMedicalState.current.addConversationEntry({
              id: `response-${Date.now()}`,
              timestamp: new Date(),
              type: 'system_response',
              content: message,
              metadata: {
                confidence: 0.9 // Default confidence for voice responses
              }
            });

            stableVoiceState.current.stopProcessing();
          } catch (error) {
            console.error('Error processing voice response:', error);
            stableVoiceState.current.stopProcessing();
          }
        },
        onStatusChange: (status) => {
          stableVoiceState.current.updateConnectionStatus(status);
        },
        onModeChange: (mode) => {
          switch (mode) {
            case 'listening':
              stableVoiceState.current.startListening();
              break;
            case 'speaking':
              stableVoiceState.current.stopListening();
              break;
            case 'thinking':
              stableVoiceState.current.startProcessing();
              break;
          }
        },
        onVolumeChange: (volume) => {
          stableVoiceState.current.updateAudioLevel(volume);
        }
      });

      // Set up additional callbacks
      agent.setCallbacks({
        onTranscription: async (text: string) => {
          stableVoiceState.current.updateTranscription(text);
          
          // Add user voice input to conversation history
          stableMedicalState.current.addConversationEntry({
            id: `voice-${Date.now()}`,
            timestamp: new Date(),
            type: 'user_voice',
            content: text
          });

          // Send transcription to backend agent for processing
          try {
            stableVoiceState.current.startProcessing();
            stableMedicalState.current.startProcessing();

            // Get user location if available
            let userLocation;
            try {
              const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  timeout: 5000,
                  enableHighAccuracy: false
                });
              });
              userLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              };
            } catch (error) {
              console.log('Location not available:', error);
            }

            // Send message to backend agent
            const agentResponse = await backendService.sendMessageToAgent(
              text, 
              userLocation, 
              options.pendingImage || undefined
            );
            
            // Clear the pending image after sending
            if (options.pendingImage && options.onImageSent) {
              options.onImageSent();
            }
            
            // Update medical state with response
            if (agentResponse.condition || agentResponse.urgencyLevel) {
              stableMedicalState.current.setAssessment({
                condition: agentResponse.condition || 'Assessment in progress',
                urgencyLevel: agentResponse.urgencyLevel || 'low',
                advice: agentResponse.response,
                confidence: agentResponse.confidence || 0.8,
                hospitalData: agentResponse.hospital_data,
                requiresEmergencyServices: agentResponse.urgencyLevel === 'high'
              });
            }

            // Show hospitals on map if provided
            if (agentResponse.hospital_data && agentResponse.hospital_data.length > 0) {
              // We need to access mapState from the hook context
              // This will be handled by the parent component through the response
              console.log('Hospital data received:', agentResponse.hospital_data);
            }

            // Convert response to speech (this would be handled by ElevenLabs)
            // The agent should handle TTS automatically based on the response

            stableVoiceState.current.stopProcessing();
            stableMedicalState.current.stopProcessing();
          } catch (error) {
            console.error('Error processing transcription:', error);
            stableVoiceState.current.stopProcessing();
            stableMedicalState.current.stopProcessing();
            
            stableUIState.current.addNotification({
              id: `transcription-error-${Date.now()}`,
              type: 'error',
              title: 'Processing Error',
              message: 'Failed to process your request. Please try again.',
              timestamp: new Date(),
              autoClose: true
            });
          }
        },
        onResponse: (audioUrl: string, text: string) => {
          // Response is already handled in onMessage callback above
          console.log('Voice response received:', text);
        },
        onAudioLevel: (level: number) => {
          stableVoiceState.current.updateAudioLevel(level);
        },
        onConnectionStatusChange: (status) => {
          stableVoiceState.current.updateConnectionStatus(status);
        },
        onError: (error: Error) => {
          console.error('Voice agent callback error:', error);
          stableUIState.current.addNotification({
            id: `voice-callback-error-${Date.now()}`,
            type: 'error',
            title: 'Voice Processing Error',
            message: error.message,
            timestamp: new Date(),
            autoClose: true
          });
        }
      });

      await agent.initializeConnection();
      voiceAgentRef.current = agent;
      return agent;

    } catch (error) {
      console.error('Failed to initialize voice agent:', error);
      stableVoiceState.current.updateConnectionStatus('disconnected');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      stableUIState.current.addNotification({
        id: `voice-init-error-${Date.now()}`,
        type: 'error',
        title: 'Voice Service Initialization Failed',
        message: errorMessage,
        timestamp: new Date(),
        autoClose: true
      });
      
      throw error;
    }
  }, [options.agentId, options.apiKey, options.pendingImage, options.onImageSent]);

  // Activate voice agent
  const activate = useCallback(async () => {
    try {
      stableVoiceState.current.activate();
      const agent = await initializeAgent();
      
      if (agent.isReady()) {
        agent.startListening();
        stableUIState.current.setActivePanel('voice');
      }
    } catch (error) {
      console.error('Failed to activate voice agent:', error);
      stableVoiceState.current.deactivate();
    }
  }, [initializeAgent]);

  // Deactivate voice agent with proper cleanup
  const deactivate = useCallback(async () => {
    try {
      stopQueueMonitoring();
      
      if (voiceAgentRef.current) {
        voiceAgentRef.current.stopListening();
        await voiceAgentRef.current.disconnect();
        voiceAgentRef.current = null;
      }
      stableVoiceState.current.deactivate();
    } catch (error) {
      console.error('Error deactivating voice agent:', error);
      stableVoiceState.current.deactivate();
    }
  }, [stopQueueMonitoring]);

  // Send text message through voice agent with priority support
  const sendMessage = useCallback(async (text: string, priority: 'low' | 'normal' | 'high' = 'normal') => {
    console.log('🎤 useVoiceAgent.sendMessage called with:', { text, priority });
    
    try {
      stableVoiceState.current.startProcessing();
      stableMedicalState.current.startProcessing();
      
      console.log('📍 Getting user location...');
      // Get user location if available
      let userLocation;
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: false
          });
        });
        userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } catch (error) {
        console.log('Location not available:', error);
      }

      console.log('🌍 User location:', userLocation);

      // Send message directly to backend with image if available
      console.log('📤 Calling backendService.sendMessageToAgent...');
      const agentResponse = await backendService.sendMessageToAgent(
        text, 
        userLocation, 
        options.pendingImage || undefined
      );
      
      console.log('✅ Backend response received:', agentResponse);
      
      // Clear the pending image after sending
      if (options.pendingImage && options.onImageSent) {
        options.onImageSent();
      }
      
      // Update medical state with response
      console.log('🏥 Processing medical response...');
      
      // Always set assessment since we have a response
      stableMedicalState.current.setAssessment({
        condition: agentResponse.condition || 'Medical consultation',
        urgencyLevel: agentResponse.urgencyLevel || agentResponse.confidence_level || 'low',
        advice: agentResponse.response || agentResponse.advice || 'No advice provided',
        confidence: agentResponse.confidence || 0.8,
        hospitalData: agentResponse.hospital_data || agentResponse.hospitals,
        requiresEmergencyServices: (agentResponse.urgencyLevel === 'high') || (agentResponse.confidence_level === 'high')
      });
      
      console.log('✅ Medical assessment set successfully');

      // Add conversation entries
      stableMedicalState.current.addConversationEntry({
        id: `text-${Date.now()}`,
        timestamp: new Date(),
        type: 'user_voice',
        content: text
      });

      stableMedicalState.current.addConversationEntry({
        id: `response-${Date.now()}`,
        timestamp: new Date(),
        type: 'system_response',
        content: agentResponse.response || agentResponse.advice || 'No response',
        metadata: {
          confidence: agentResponse.confidence || 0.8
        }
      });
      
      // Try to send through voice agent for TTS if available and ready
      if (voiceAgentRef.current && voiceAgentRef.current.isReady()) {
        try {
          await voiceAgentRef.current.sendMessage(agentResponse.response, priority);
        } catch (voiceError) {
          console.log('Voice TTS not available, continuing without voice:', voiceError);
        }
      }
      
      // Update queue status if voice agent is available
      if (voiceAgentRef.current) {
        const queueStatus = voiceAgentRef.current.getQueueStatus();
        stableVoiceState.current.updateQueueSize(queueStatus.size);
        stableVoiceState.current.setProcessingQueue(queueStatus.isProcessing);
        
        const currentSession = voiceAgentRef.current.getCurrentSession();
        stableVoiceState.current.setSession(currentSession?.id || null);
      }
      
      stableVoiceState.current.stopProcessing();
      stableMedicalState.current.stopProcessing();
    } catch (error) {
      console.error('Failed to send message:', error);
      stableVoiceState.current.stopProcessing();
      stableMedicalState.current.stopProcessing();
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      stableUIState.current.addNotification({
        id: `voice-send-error-${Date.now()}`,
        type: 'error',
        title: 'Message Send Failed',
        message: errorMessage,
        timestamp: new Date(),
        autoClose: true
      });
    }
  }, [options.pendingImage, options.onImageSent]);

  // Clear voice request queue
  const clearQueue = useCallback(() => {
    if (voiceAgentRef.current) {
      voiceAgentRef.current.clearQueue();
      const queueStatus = voiceAgentRef.current.getQueueStatus();
      stableVoiceState.current.updateQueueSize(queueStatus.size);
      stableVoiceState.current.setProcessingQueue(queueStatus.isProcessing);
      
      const currentSession = voiceAgentRef.current.getCurrentSession();
      stableVoiceState.current.setSession(currentSession?.id || null);
    }
  }, []);

  // Force end current session
  const forceEndSession = useCallback(() => {
    if (voiceAgentRef.current) {
      voiceAgentRef.current.forceEndSession();
      const queueStatus = voiceAgentRef.current.getQueueStatus();
      stableVoiceState.current.updateQueueSize(queueStatus.size);
      stableVoiceState.current.setProcessingQueue(queueStatus.isProcessing);
      
      const currentSession = voiceAgentRef.current.getCurrentSession();
      stableVoiceState.current.setSession(currentSession?.id || null);
    }
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (options.autoConnect) {
      initializeAgent().catch(console.error);
    }

    // Cleanup on unmount
    return () => {
      stopQueueMonitoring();
      if (voiceAgentRef.current) {
        voiceAgentRef.current.disconnect().catch(console.error);
      }
    };
  }, [options.autoConnect, initializeAgent, stopQueueMonitoring]);

  return {
    // State
    isActive: voiceState.isActive,
    isListening: voiceState.isListening,
    isProcessing: voiceState.isProcessing,
    connectionStatus: voiceState.connectionStatus,
    audioLevel: voiceState.audioLevel,
    currentTranscription: voiceState.currentTranscription,
    queueSize: voiceState.queueSize,
    isProcessingQueue: voiceState.isProcessingQueue,
    currentSessionId: voiceState.currentSessionId,
    
    // Actions
    activate,
    deactivate,
    sendMessage,
    clearQueue,
    forceEndSession,
    
    // Agent instance (for advanced usage)
    agent: voiceAgentRef.current,
    
    // Utility
    isReady: voiceAgentRef.current?.isReady() || false,
  };
}