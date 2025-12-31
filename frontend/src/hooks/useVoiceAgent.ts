import { useEffect, useRef, useCallback } from 'react';
import { VoiceAgent, createVoiceAgent, defaultVoiceConfig } from '../services/voiceAgent';
import { useVoiceState, useMedicalState, useUIState } from './useAppState';
import { backendService } from '../services/backendService';
import { conversationalService } from '../services/conversationalService';
import type { ConversationMessage } from '../services/backendService';

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
  const queueUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNotificationTimeRef = useRef<number>(0);
  
  // Conversation history for multi-turn diagnosis
  const conversationHistoryRef = useRef<ConversationMessage[]>([]);
  
  // Ref for playTTSResponse function to use in callbacks
  const playTTSResponseRef = useRef<((text: string) => Promise<void>) | null>(null);

  // Create stable references for options to prevent infinite re-renders
  const stableOptionsRef = useRef(options);
  
  // Update options ref when they change
  useEffect(() => {
    stableOptionsRef.current = options;
  }, [options.agentId, options.apiKey, options.pendingImage, options.onImageSent]);

  // Create stable references to avoid infinite re-renders
  const stableVoiceState = useRef(voiceState);
  const stableMedicalState = useRef(medicalState);
  const stableUIState = useRef(uiState);
  
  // Update refs when state changes (wrapped in useEffect to prevent infinite loops)
  useEffect(() => {
    stableVoiceState.current = voiceState;
  }, [voiceState]);
  
  useEffect(() => {
    stableMedicalState.current = medicalState;
  }, [medicalState]);
  
  useEffect(() => {
    stableUIState.current = uiState;
  }, [uiState]);

  // Update queue status periodically
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _updateQueueStatus = useCallback(() => {
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

      // 🎤 Using ElevenLabs Conversational AI for better multilingual STT
      // AI audio is muted, we use our own backend for responses
      const agent = createVoiceAgent({
        agentId: stableOptionsRef.current.agentId || defaultVoiceConfig.agentId || 'default-agent-id',
        apiKey: stableOptionsRef.current.apiKey || defaultVoiceConfig.apiKey,
        onConnect: () => {
          stableVoiceState.current.updateConnectionStatus('connected');
          startQueueMonitoring();
          console.log('🎤 Voice agent connected (ElevenLabs STT, AI audio muted)');
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
          
          // Throttle error notifications to prevent spam
          const now = Date.now();
          if (now - lastNotificationTimeRef.current > 5000) {
            lastNotificationTimeRef.current = now;
            stableUIState.current.addNotification({
              id: `voice-error-${now}`,
              type: 'error',
              title: 'Voice Service Error',
              message: error.message,
              timestamp: new Date(),
              autoClose: true
            });
          }
        },
        // 🎤 Handle user voice messages from ElevenLabs STT - send to OUR backend
        onUserMessage: async (message: string) => {
          console.log('🎤 ElevenLabs STT received:', message);
          
          // Skip empty or placeholder messages
          if (!message || message.trim() === '' || message === '...') {
            console.log('⚠️ Skipping empty user message');
            return;
          }
          
          try {
            stableVoiceState.current.startProcessing();
            stableMedicalState.current.startProcessing();
            
            // 🔄 SYNC: Add user voice message to conversationalService for chat display
            console.log('💬 Adding user voice message to chat...');
            conversationalService.addMessage('user', message);
            
            // Add to medical state conversation history
            stableMedicalState.current.addConversationEntry({
              id: `voice-user-${Date.now()}`,
              timestamp: new Date(),
              type: 'user_voice',
              content: message
            });
            
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
            
            // 📤 Send to OUR backend for proper language detection and response
            console.log('📤 Sending voice message to our backend...');
            const agentResponse = await backendService.sendConversationalMessage(
              message,
              conversationHistoryRef.current,
              userLocation,
              stableOptionsRef.current.pendingImage || undefined
            );
            
            console.log('✅ Backend response received:', agentResponse);
            
            // Update conversation history
            conversationHistoryRef.current.push({
              role: 'user',
              content: message
            });
            
            const aiResponseText = agentResponse.brief_text || agentResponse.response || agentResponse.advice || '';
            conversationHistoryRef.current.push({
              role: 'assistant',
              content: aiResponseText
            });
            
            // Clear the pending image after sending
            if (stableOptionsRef.current.pendingImage && stableOptionsRef.current.onImageSent) {
              stableOptionsRef.current.onImageSent();
            }
            
            // Update medical state with response
            const fullResponse = agentResponse.response || agentResponse.advice || '';
            let briefSummary = fullResponse;
            let detailedAdvice = fullResponse;
            
            if (agentResponse.brief_text && agentResponse.detailed_text) {
              briefSummary = agentResponse.brief_text;
              detailedAdvice = agentResponse.detailed_text;
            }
            
            if (agentResponse.condition || agentResponse.urgencyLevel) {
              stableMedicalState.current.setAssessment({
                condition: agentResponse.condition || 'Assessment in progress',
                urgencyLevel: agentResponse.urgencyLevel || 'low',
                advice: detailedAdvice,
                confidence: agentResponse.confidence || 0.8,
                hospitalData: agentResponse.hospital_data,
                requiresEmergencyServices: agentResponse.urgencyLevel === 'high'
              });
            }
            
            // 🔄 SYNC: Add AI response to conversationalService for chat display
            console.log('💬 Adding AI response to chat...');
            conversationalService.addMessage('assistant', fullResponse, {
              confidence: agentResponse.confidence || 0.8,
              urgency_level: agentResponse.urgencyLevel,
              assessment_stage: agentResponse.assessment_stage,
              hospitalData: agentResponse.hospital_data
            });
            
            // 🔊 Play TTS response with proper language (ElevenLabs TTS API)
            console.log('🔊 Playing TTS for backend response...');
            if (playTTSResponseRef.current) {
              // For final diagnosis, use detailed_text instead of brief_text
              const isFinalDiagnosis = agentResponse.assessment_stage === 'final' || 
                                       agentResponse.assessment_stage === 'completed';
              
              let textToSpeak = briefSummary;
              
              if (isFinalDiagnosis && agentResponse.detailed_text) {
                // Use detailed_text for final diagnosis (more natural explanation)
                textToSpeak = agentResponse.detailed_text
                  .replace(/\*\*/g, '')
                  .replace(/\*/g, '')
                  .replace(/#{1,6}\s/g, '')
                  .replace(/BRIEF:|DETAILED:/g, '')
                  .replace(/\n+/g, ' ')
                  .replace(/\s+/g, ' ')
                  // Remove function call patterns
                  .replace(/search_hospitals\s*\([^)]*\)/gi, '')
                  .replace(/\w+_\w+\s*\([^)]*\)/g, '')
                  .trim();
                
                // Add closing message based on language
                const hasKorean = /[가-힣]/.test(textToSpeak);
                if (hasKorean) {
                  textToSpeak += ' 자세한 내용과 근처 병원 정보는 화면을 확인해 주세요.';
                } else {
                  textToSpeak += ' Please check the screen for nearby hospital information.';
                }
                
                console.log('🔊 Using detailed_text for voice TTS (final diagnosis)');
              }
              
              await playTTSResponseRef.current(textToSpeak);
            }
            
            stableVoiceState.current.stopProcessing();
            stableMedicalState.current.stopProcessing();
            
          } catch (error) {
            console.error('Error processing user voice message:', error);
            stableVoiceState.current.stopProcessing();
            stableMedicalState.current.stopProcessing();
            
            stableUIState.current.addNotification({
              id: `voice-user-error-${Date.now()}`,
              type: 'error',
              title: 'Processing Error',
              message: 'Failed to process your voice message. Please try again.',
              timestamp: new Date(),
              autoClose: true
            });
          }
        },
        // 🔇 ElevenLabs AI responses are muted - we use our own backend
        onMessage: async (_message: string) => {
          // AI audio is muted via setVolume(0), this callback is just for logging
          console.log('🔇 ElevenLabs AI response (audio muted, using our backend instead)');
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
          
          console.log('🎤 Voice transcription received:', text);
          
          // 🔄 SYNC: Add user voice message to conversationalService for chat display
          conversationalService.addMessage('user', text);
          
          // Add user voice input to medical state conversation history
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

            // Send message using conversational endpoint with history for proper language detection
            console.log('📤 Sending voice message via conversational endpoint...');
            const agentResponse = await backendService.sendConversationalMessage(
              text,
              conversationHistoryRef.current,
              userLocation, 
              stableOptionsRef.current.pendingImage || undefined
            );
            
            console.log('✅ Voice response received:', agentResponse);
            
            // Update conversation history
            conversationHistoryRef.current.push({
              role: 'user',
              content: text
            });
            
            const aiResponseText = agentResponse.brief_text || agentResponse.response || agentResponse.advice || '';
            conversationHistoryRef.current.push({
              role: 'assistant',
              content: aiResponseText
            });
            
            // Clear the pending image after sending
            if (stableOptionsRef.current.pendingImage && stableOptionsRef.current.onImageSent) {
              stableOptionsRef.current.onImageSent();
            }
            
            // Update medical state with response
            const fullResponse = agentResponse.response || agentResponse.advice || '';
            let briefSummary = fullResponse;
            let detailedAdvice = fullResponse;
            
            if (agentResponse.brief_text && agentResponse.detailed_text) {
              briefSummary = agentResponse.brief_text;
              detailedAdvice = agentResponse.detailed_text;
            }
            
            if (agentResponse.condition || agentResponse.urgencyLevel) {
              stableMedicalState.current.setAssessment({
                condition: agentResponse.condition || 'Assessment in progress',
                urgencyLevel: agentResponse.urgencyLevel || 'low',
                advice: detailedAdvice,
                confidence: agentResponse.confidence || 0.8,
                hospitalData: agentResponse.hospital_data,
                requiresEmergencyServices: agentResponse.urgencyLevel === 'high'
              });
            }

            // 🔄 SYNC: Add AI response to conversationalService for chat display
            console.log('💬 Adding AI response to conversationalService...');
            conversationalService.addMessage('assistant', fullResponse, {
              confidence: agentResponse.confidence || 0.8,
              urgency_level: agentResponse.urgencyLevel,
              assessment_stage: agentResponse.assessment_stage,
              hospitalData: agentResponse.hospital_data
            });

            // Show hospitals on map if provided
            if (agentResponse.hospital_data && agentResponse.hospital_data.length > 0) {
              console.log('🏥 Hospital data received:', agentResponse.hospital_data);
            }

            // 🔊 Play TTS response
            console.log('🔊 Playing TTS for voice response...');
            if (playTTSResponseRef.current) {
              await playTTSResponseRef.current(briefSummary);
            }

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
        onResponse: (_audioUrl: string, text: string) => {
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
          
          // Throttle callback error notifications
          const now = Date.now();
          if (now - lastNotificationTimeRef.current > 5000) {
            lastNotificationTimeRef.current = now;
            stableUIState.current.addNotification({
              id: `voice-callback-error-${now}`,
              type: 'error',
              title: 'Voice Processing Error',
              message: error.message,
              timestamp: new Date(),
              autoClose: true
            });
          }
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
  }, []); // Remove options dependencies since we use stableOptionsRef

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
  // This also syncs with conversationalService so voice messages appear in chat
  const sendMessage = useCallback(async (text: string, priority: 'low' | 'normal' | 'high' = 'normal', imageFile?: File | null) => {
    console.log('🎤 useVoiceAgent.sendMessage called with:', { text, priority, hasImage: !!imageFile });
    
    try {
      stableVoiceState.current.startProcessing();
      stableMedicalState.current.startProcessing();
      
      // 🔄 SYNC: Add user message to conversationalService for chat display
      // This ensures voice messages appear in the chat UI
      console.log('💬 Adding voice message to conversationalService for chat display...');
      conversationalService.addMessage('user', text);
      
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
      console.log('📜 Conversation history length:', conversationHistoryRef.current.length);

      // Use the provided imageFile or fallback to pendingImage
      const imageToSend = imageFile || stableOptionsRef.current.pendingImage || undefined;
      
      // Send message using conversational endpoint with history
      console.log('📤 Calling backendService.sendConversationalMessage...');
      const agentResponse = await backendService.sendConversationalMessage(
        text,
        conversationHistoryRef.current,
        userLocation, 
        imageToSend
      );
      
      console.log('✅ Backend response received:', agentResponse);
      console.log('📊 Assessment stage:', agentResponse.assessment_stage);
      
      // Update conversation history with user message and AI response
      conversationHistoryRef.current.push({
        role: 'user',
        content: text
      });
      
      const aiResponseText = agentResponse.brief_text || agentResponse.response || agentResponse.advice || '';
      conversationHistoryRef.current.push({
        role: 'assistant',
        content: aiResponseText
      });
      
      console.log('📜 Updated conversation history length:', conversationHistoryRef.current.length);
      
      // Clear conversation history if consultation is completed
      if (agentResponse.assessment_stage === 'completed' || agentResponse.assessment_stage === 'final') {
        console.log('🔄 Consultation completed, will reset history on next new conversation');
      }
      
      // Clear the pending image after sending
      if ((imageFile || stableOptionsRef.current.pendingImage) && stableOptionsRef.current.onImageSent) {
        stableOptionsRef.current.onImageSent();
      }
      
      // Update medical state with response
      console.log('🏥 Processing medical response...');
      
      // Always set assessment since we have a response
      const fullResponse = agentResponse.response || agentResponse.advice || 'No advice provided';
      
      // Use structured response if available, otherwise fall back to splitting
      let briefSummary = fullResponse;
      let detailedAdvice = fullResponse;
      
      if (agentResponse.brief_text && agentResponse.detailed_text) {
        briefSummary = agentResponse.brief_text;
        detailedAdvice = agentResponse.detailed_text;
      } else {
        // Fallback: Split response into brief summary and detailed advice
        const responseLines = fullResponse.split('\n').filter(line => line.trim());
        briefSummary = responseLines[0] || fullResponse;
        detailedAdvice = responseLines.length > 1 ? responseLines.slice(1).join('\n') : fullResponse;
      }
      
      stableMedicalState.current.setAssessment({
        condition: agentResponse.condition || 'Medical consultation',
        urgencyLevel: agentResponse.urgencyLevel || agentResponse.confidence_level || 'low',
        advice: detailedAdvice, // Use detailed advice for MedicalCard
        confidence: agentResponse.confidence || 0.8,
        hospitalData: agentResponse.hospital_data || agentResponse.hospitals,
        requiresEmergencyServices: (agentResponse.urgencyLevel === 'high') || (agentResponse.confidence_level === 'high')
      });
      
      console.log('✅ Medical assessment set successfully');

      // 🔄 SYNC: Add AI response to conversationalService for chat display
      // Include hospital data in metadata so it appears in chat
      console.log('💬 Adding AI response to conversationalService for chat display...');
      conversationalService.addMessage('assistant', fullResponse, {
        confidence: agentResponse.confidence || 0.8,
        urgency_level: agentResponse.urgencyLevel || agentResponse.confidence_level,
        assessment_stage: agentResponse.assessment_stage,
        hospitalData: agentResponse.hospital_data || agentResponse.hospitals
      });

      // Add conversation entries to medical state (for other UI components)
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
        content: briefSummary, // Use brief summary for MessageBubble
        metadata: {
          confidence: agentResponse.confidence || 0.8
        }
      });
      
      // 🔊 ALWAYS play TTS response (main feature)
      console.log('🔊 Playing TTS response...');
      await playTTSResponse(briefSummary);
      
      // Try to send through voice agent for additional TTS if available and ready
      if (voiceAgentRef.current && voiceAgentRef.current.isReady()) {
        try {
          await voiceAgentRef.current.sendMessage(briefSummary, priority);
        } catch (voiceError) {
          console.log('ElevenLabs TTS not available, using browser TTS:', voiceError);
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
  }, []); // Remove options dependencies since we use stableOptionsRef

  // Detect language of text
  const detectLanguage = useCallback((text: string): string => {
    // Remove punctuation and convert to lowercase for analysis
    const cleanText = text.replace(/[^\w\s]/g, '').toLowerCase();
    
    // Korean detection - look for Hangul characters
    if (/[가-힣]/.test(text)) {
      return 'ko';
    }
    
    // Japanese detection - look for Hiragana, Katakana, or Kanji
    if (/[ひらがなカタカナ一-龯]/.test(text)) {
      return 'ja';
    }
    
    // Spanish detection - look for Spanish-specific words and patterns
    const spanishIndicators = [
      'dolor', 'cabeza', 'estómago', 'fiebre', 'náuseas', 'mareo', 'sangre',
      'herida', 'corte', 'quemadura', 'fractura', 'emergencia', 'hospital',
      'médico', 'ayuda', 'duele', 'siento', 'tengo', 'estoy', 'me duele'
    ];
    
    if (spanishIndicators.some(indicator => cleanText.includes(indicator))) {
      return 'es';
    }
    
    // Default to English
    return 'en';
  }, []);

  // Play TTS response using ElevenLabs TTS API directly with language support
  const playTTSResponse = useCallback(async (text: string): Promise<void> => {
    // Detect the language of the response text
    const language = detectLanguage(text);
    console.log('🌍 Detected response language:', language);

    // First try ElevenLabs TTS API directly for highest quality
    try {
      console.log('🔊 Attempting ElevenLabs TTS API...');
      
      const apiKey = stableOptionsRef.current.apiKey || import.meta.env.VITE_ELEVENLABS_API_KEY;
      if (apiKey && apiKey !== 'your-api-key-here') {
        // Select voice based on language
        let voiceId = '21m00Tcm4TlvDq8ikWAM'; // Default English voice
        let modelId = 'eleven_monolingual_v1';
        
        if (language === 'ko') {
          // Use multilingual model for Korean
          voiceId = '21m00Tcm4TlvDq8ikWAM'; // This voice supports multiple languages
          modelId = 'eleven_multilingual_v2';
        } else if (language === 'ja') {
          // Use multilingual model for Japanese
          voiceId = '21m00Tcm4TlvDq8ikWAM';
          modelId = 'eleven_multilingual_v2';
        } else if (language === 'es') {
          // Use multilingual model for Spanish
          voiceId = '21m00Tcm4TlvDq8ikWAM';
          modelId = 'eleven_multilingual_v2';
        }
        
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
          },
          body: JSON.stringify({
            text: text,
            model_id: modelId,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
              style: 0.0,
              use_speaker_boost: true
            }
          })
        });

        if (response.ok) {
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          
          return new Promise((resolve, reject) => {
            audio.onended = () => {
              URL.revokeObjectURL(audioUrl);
              console.log('🔊 ElevenLabs TTS playback completed');
              resolve();
            };
            
            audio.onerror = (error) => {
              URL.revokeObjectURL(audioUrl);
              console.error('🔊 ElevenLabs audio playback error:', error);
              reject(error);
            };
            
            audio.onloadstart = () => {
              console.log('🔊 ElevenLabs TTS playback started');
            };
            
            audio.play().catch(reject);
          });
        } else {
          console.log('🔊 ElevenLabs API failed, status:', response.status);
        }
      }
    } catch (elevenLabsError) {
      console.log('🔊 ElevenLabs TTS API failed:', elevenLabsError);
    }

    // Fallback to browser TTS with language-specific voice selection
    console.log('🔊 Using browser TTS as fallback...');
    return new Promise((resolve, reject) => {
      try {
        // Check if Speech Synthesis is supported
        if (!('speechSynthesis' in window)) {
          console.warn('Speech Synthesis not supported in this browser');
          resolve(); // Don't fail, just skip TTS
          return;
        }

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        // Wait a bit for voices to load if needed
        const speakWithVoice = () => {
          // Create speech utterance
          const utterance = new SpeechSynthesisUtterance(text);
          
          // Configure voice settings for better quality
          utterance.rate = 0.85; // Slower for better clarity
          utterance.pitch = 1.0;
          utterance.volume = 0.9;
          
          // Get available voices
          const voices = window.speechSynthesis.getVoices();
          console.log('🔊 Available voices:', voices.length);
          
          // Try to find the best quality voice for the detected language
          let preferredVoice = null;
          
          // Language-specific voice selection
          if (language === 'ko') {
            // Korean voices
            preferredVoice = voices.find(voice => 
              voice.lang.startsWith('ko') && 
              (voice.name.toLowerCase().includes('female') || voice.localService)
            ) || voices.find(voice => voice.lang.startsWith('ko'));
            utterance.lang = 'ko-KR';
          } else if (language === 'ja') {
            // Japanese voices
            preferredVoice = voices.find(voice => 
              voice.lang.startsWith('ja') && 
              (voice.name.toLowerCase().includes('female') || voice.localService)
            ) || voices.find(voice => voice.lang.startsWith('ja'));
            utterance.lang = 'ja-JP';
          } else if (language === 'es') {
            // Spanish voices
            preferredVoice = voices.find(voice => 
              voice.lang.startsWith('es') && 
              (voice.name.toLowerCase().includes('female') || voice.localService)
            ) || voices.find(voice => voice.lang.startsWith('es'));
            utterance.lang = 'es-ES';
          } else {
            // English voices (default)
            utterance.lang = 'en-US';
            
            // Priority 1: High-quality English voices
            preferredVoice = voices.find(voice => 
              voice.lang.startsWith('en') && 
              (voice.name.toLowerCase().includes('enhanced') ||
               voice.name.toLowerCase().includes('premium') ||
               voice.name.toLowerCase().includes('neural') ||
               voice.name.toLowerCase().includes('natural'))
            );
            
            // Priority 2: Female voices for medical assistant feel
            if (!preferredVoice) {
              preferredVoice = voices.find(voice => 
                voice.lang.startsWith('en') &&
                (voice.name.toLowerCase().includes('female') || 
                 voice.name.toLowerCase().includes('samantha') ||
                 voice.name.toLowerCase().includes('karen') ||
                 voice.name.toLowerCase().includes('susan') ||
                 voice.name.toLowerCase().includes('zira') ||
                 voice.name.toLowerCase().includes('hazel'))
              );
            }
            
            // Priority 3: Any good English voice
            if (!preferredVoice) {
              preferredVoice = voices.find(voice => 
                voice.lang.startsWith('en') && voice.localService
              );
            }
            
            // Priority 4: Any English voice
            if (!preferredVoice) {
              preferredVoice = voices.find(voice => voice.lang.startsWith('en'));
            }
          }
          
          // Use the best available voice
          if (preferredVoice) {
            utterance.voice = preferredVoice;
            console.log('🔊 Using voice:', preferredVoice.name, '(' + preferredVoice.lang + ')');
          } else {
            console.log('🔊 Using default voice for language:', language);
          }

          // Set up event handlers
          utterance.onend = () => {
            console.log('🔊 TTS playback completed');
            resolve();
          };
          
          utterance.onerror = (event) => {
            console.error('🔊 TTS error:', event.error);
            reject(new Error(`TTS error: ${event.error}`));
          };

          utterance.onstart = () => {
            console.log('🔊 TTS playback started');
          };

          // Start speaking
          window.speechSynthesis.speak(utterance);
          
          // Fallback timeout in case onend doesn't fire
          setTimeout(() => {
            if (window.speechSynthesis.speaking) {
              window.speechSynthesis.cancel();
            }
            resolve();
          }, text.length * 120 + 8000); // More time for better quality
        };

        // Check if voices are loaded
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          speakWithVoice();
        } else {
          // Wait for voices to load
          console.log('🔊 Waiting for voices to load...');
          window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.onvoiceschanged = null; // Remove listener
            speakWithVoice();
          };
          
          // Fallback timeout if voices don't load
          setTimeout(() => {
            if (window.speechSynthesis.onvoiceschanged) {
              window.speechSynthesis.onvoiceschanged = null;
              speakWithVoice();
            }
          }, 2000);
        }
        
      } catch (error) {
        console.error('🔊 TTS initialization error:', error);
        reject(error);
      }
    });
  }, [detectLanguage]); // Remove options.apiKey since we use stableOptionsRef

  // Update playTTSResponseRef when playTTSResponse changes
  useEffect(() => {
    playTTSResponseRef.current = playTTSResponse;
  }, [playTTSResponse]);

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

  // Language preference methods
  const setLanguagePreference = useCallback((language: string) => {
    if (voiceAgentRef.current) {
      voiceAgentRef.current.setLanguagePreference(language);
    }
  }, []);

  const getLanguagePreference = useCallback(() => {
    return voiceAgentRef.current?.getLanguagePreference() || 'auto';
  }, []);

  // Clear conversation history for new consultation
  const clearConversationHistory = useCallback(() => {
    conversationHistoryRef.current = [];
    console.log('🔄 Conversation history cleared');
  }, []);

  // Get current conversation history length
  const getConversationHistoryLength = useCallback(() => {
    return conversationHistoryRef.current.length;
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
  }, [options.autoConnect]); // Remove initializeAgent and stopQueueMonitoring from dependencies

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
    
    // Language preferences
    setLanguagePreference,
    getLanguagePreference,
    
    // Conversation history management
    clearConversationHistory,
    getConversationHistoryLength,
    
    // Agent instance (for advanced usage)
    agent: voiceAgentRef.current,
    
    // Utility
    isReady: voiceAgentRef.current?.isReady() || false,
  };
}