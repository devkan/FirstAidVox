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

  // Update queue status periodically
  const updateQueueStatus = useCallback(() => {
    if (voiceAgentRef.current) {
      const queueStatus = voiceAgentRef.current.getQueueStatus();
      voiceState.updateQueueSize(queueStatus.size);
      voiceState.setProcessingQueue(queueStatus.isProcessing);
      
      const currentSession = voiceAgentRef.current.getCurrentSession();
      voiceState.setSession(currentSession?.id || null);
    }
  }, [voiceState]);

  // Start queue status monitoring
  const startQueueMonitoring = useCallback(() => {
    if (queueUpdateIntervalRef.current) {
      clearInterval(queueUpdateIntervalRef.current);
    }
    
    queueUpdateIntervalRef.current = setInterval(updateQueueStatus, 1000);
  }, [updateQueueStatus]);

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
      voiceState.updateConnectionStatus('connecting');

      const agent = createVoiceAgent({
        agentId: options.agentId || defaultVoiceConfig.agentId || 'default-agent-id',
        apiKey: options.apiKey || defaultVoiceConfig.apiKey,
        onConnect: () => {
          voiceState.updateConnectionStatus('connected');
          startQueueMonitoring();
          console.log('Voice agent connected successfully');
        },
        onDisconnect: () => {
          voiceState.updateConnectionStatus('disconnected');
          voiceState.deactivate();
          stopQueueMonitoring();
          console.log('Voice agent disconnected');
        },
        onError: (error: Error) => {
          console.error('Voice agent error:', error);
          voiceState.updateConnectionStatus('disconnected');
          uiState.addNotification({
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
            medicalState.addConversationEntry({
              id: `response-${Date.now()}`,
              timestamp: new Date(),
              type: 'system_response',
              content: message,
              metadata: {
                confidence: 0.9 // Default confidence for voice responses
              }
            });

            voiceState.stopProcessing();
          } catch (error) {
            console.error('Error processing voice response:', error);
            voiceState.stopProcessing();
          }
        },
        onStatusChange: (status) => {
          voiceState.updateConnectionStatus(status);
        },
        onModeChange: (mode) => {
          switch (mode) {
            case 'listening':
              voiceState.startListening();
              break;
            case 'speaking':
              voiceState.stopListening();
              break;
            case 'thinking':
              voiceState.startProcessing();
              break;
          }
        },
        onVolumeChange: (volume) => {
          voiceState.updateAudioLevel(volume);
        }
      });

      // Set up additional callbacks
      agent.setCallbacks({
        onTranscription: async (text: string) => {
          voiceState.updateTranscription(text);
          
          // Add user voice input to conversation history
          medicalState.addConversationEntry({
            id: `voice-${Date.now()}`,
            timestamp: new Date(),
            type: 'user_voice',
            content: text
          });

          // Send transcription to backend agent for processing
          try {
            voiceState.startProcessing();
            medicalState.startProcessing();

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
              medicalState.setAssessment({
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

            voiceState.stopProcessing();
            medicalState.stopProcessing();
          } catch (error) {
            console.error('Error processing transcription:', error);
            voiceState.stopProcessing();
            medicalState.stopProcessing();
            
            uiState.addNotification({
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
          voiceState.updateAudioLevel(level);
        },
        onConnectionStatusChange: (status) => {
          voiceState.updateConnectionStatus(status);
        },
        onError: (error: Error) => {
          console.error('Voice agent callback error:', error);
          uiState.addNotification({
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
      voiceState.updateConnectionStatus('disconnected');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      uiState.addNotification({
        id: `voice-init-error-${Date.now()}`,
        type: 'error',
        title: 'Voice Service Initialization Failed',
        message: errorMessage,
        timestamp: new Date(),
        autoClose: true
      });
      
      throw error;
    }
  }, [options.agentId, options.apiKey, voiceState, medicalState, uiState]);

  // Activate voice agent
  const activate = useCallback(async () => {
    try {
      voiceState.activate();
      const agent = await initializeAgent();
      
      if (agent.isReady()) {
        agent.startListening();
        uiState.setActivePanel('voice');
      }
    } catch (error) {
      console.error('Failed to activate voice agent:', error);
      voiceState.deactivate();
    }
  }, [initializeAgent, voiceState, uiState]);

  // Deactivate voice agent with proper cleanup
  const deactivate = useCallback(async () => {
    try {
      stopQueueMonitoring();
      
      if (voiceAgentRef.current) {
        voiceAgentRef.current.stopListening();
        await voiceAgentRef.current.disconnect();
        voiceAgentRef.current = null;
      }
      voiceState.deactivate();
    } catch (error) {
      console.error('Error deactivating voice agent:', error);
      voiceState.deactivate();
    }
  }, [voiceState, stopQueueMonitoring]);

  // Send text message through voice agent with priority support
  const sendMessage = useCallback(async (text: string, priority: 'low' | 'normal' | 'high' = 'normal') => {
    try {
      if (!voiceAgentRef.current) {
        await initializeAgent();
      }

      const agent = voiceAgentRef.current;
      if (!agent || !agent.isReady()) {
        throw new Error('Voice agent is not ready');
      }

      voiceState.startProcessing();
      medicalState.startProcessing();
      
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

      // Send message directly to backend with image if available
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
        medicalState.setAssessment({
          condition: agentResponse.condition || 'Assessment in progress',
          urgencyLevel: agentResponse.urgencyLevel || 'low',
          advice: agentResponse.response,
          confidence: agentResponse.confidence || 0.8,
          hospitalData: agentResponse.hospital_data,
          requiresEmergencyServices: agentResponse.urgencyLevel === 'high'
        });
      }

      // Add conversation entries
      medicalState.addConversationEntry({
        id: `text-${Date.now()}`,
        timestamp: new Date(),
        type: 'user_voice',
        content: text
      });

      medicalState.addConversationEntry({
        id: `response-${Date.now()}`,
        timestamp: new Date(),
        type: 'system_response',
        content: agentResponse.response,
        metadata: {
          confidence: agentResponse.confidence || 0.8
        }
      });
      
      // Also send through voice agent for TTS if available
      await agent.sendMessage(agentResponse.response, priority);
      
      // Update queue status immediately after sending
      updateQueueStatus();
      
      voiceState.stopProcessing();
      medicalState.stopProcessing();
    } catch (error) {
      console.error('Failed to send message:', error);
      voiceState.stopProcessing();
      medicalState.stopProcessing();
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      uiState.addNotification({
        id: `voice-send-error-${Date.now()}`,
        type: 'error',
        title: 'Message Send Failed',
        message: errorMessage,
        timestamp: new Date(),
        autoClose: true
      });
    }
  }, [initializeAgent, voiceState, medicalState, uiState, updateQueueStatus, options.pendingImage, options.onImageSent]);

  // Clear voice request queue
  const clearQueue = useCallback(() => {
    if (voiceAgentRef.current) {
      voiceAgentRef.current.clearQueue();
      updateQueueStatus();
    }
  }, [updateQueueStatus]);

  // Force end current session
  const forceEndSession = useCallback(() => {
    if (voiceAgentRef.current) {
      voiceAgentRef.current.forceEndSession();
      updateQueueStatus();
    }
  }, [updateQueueStatus]);

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