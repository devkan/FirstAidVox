// Voice Agent Service for ElevenLabs integration
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

// ElevenLabs Conversational AI types
interface ElevenLabsConversation {
  startSession: (config: any) => Promise<void>;
  endSession: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  on: (event: string, callback: Function) => void;
  off: (event: string, callback: Function) => void;
}

export interface VoiceAgentConfig {
  agentId: string;
  apiKey?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onMessage?: (message: string) => void;
  onUserMessage?: (message: string) => void;  // New: callback for user messages from ElevenLabs
  onStatusChange?: (status: 'connected' | 'connecting' | 'disconnected') => void;
  onModeChange?: (mode: 'listening' | 'speaking' | 'thinking') => void;
  onVolumeChange?: (volume: number) => void;
}

export interface VoiceAgentCallbacks {
  onTranscription: (text: string) => void;
  onResponse: (audioUrl: string, text: string) => void;
  onAudioLevel: (level: number) => void;
  onConnectionStatusChange: (status: 'connected' | 'connecting' | 'disconnected') => void;
  onError: (error: Error) => void;
}

// Voice request queue types
export interface VoiceRequest {
  id: string;
  text: string;
  timestamp: Date;
  priority: 'low' | 'normal' | 'high';
  retryCount: number;
  maxRetries: number;
}

export interface VoiceSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'interrupted' | 'completed' | 'failed';
  requestCount: number;
  lastActivity: Date;
}

export class VoiceAgent {
  private conversation: ElevenLabsConversation | any = null;
  private callbacks: Partial<VoiceAgentCallbacks> = {};
  private config: VoiceAgentConfig;
  private isInitialized = false;
  private connectionStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
  private currentMode: 'listening' | 'speaking' | 'thinking' = 'listening';
  private audioLevel = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;
  private isUsingElevenLabs = false;
  private lastErrorTime: number | null = null;

  // Voice request queuing and session management
  private requestQueue: VoiceRequest[] = [];
  private isProcessingRequest = false;
  private currentSession: VoiceSession | null = null;
  private sessionTimeout = 300000; // 5 minutes
  private sessionTimer: NodeJS.Timeout | null = null;
  private requestIdCounter = 0;
  private maxQueueSize = 10;

  constructor(config: VoiceAgentConfig) {
    this.config = config;
  }

  /**
   * Initialize connection (Web Speech API for STT - FREE, no ElevenLabs Conversational AI)
   * 
   * COST OPTIMIZATION: We use Web Speech API (free) for speech-to-text instead of 
   * ElevenLabs Conversational AI which charges for STT + AI + TTS.
   * Our backend handles AI responses, and we use ElevenLabs TTS API separately only for voice output.
   * 
   * Validates: Requirements 6.1
   */
  async initializeConnection(): Promise<void> {
    // If already initialized, return early
    if (this.isInitialized && this.connectionStatus === 'connected') {
      return;
    }

    try {
      this.updateConnectionStatus('connecting');
      
      // 💰 COST OPTIMIZATION: Always use Web Speech API for STT (FREE)
      // ElevenLabs Conversational AI charges for: STT + AI response + TTS
      // We only need STT, so Web Speech API is the cost-effective choice
      console.log('🎤 Initializing Web Speech API for STT (FREE - no ElevenLabs Conversational AI costs)');
      console.log('💰 Cost optimization: Using free Web Speech API instead of paid ElevenLabs Conversational AI');
      
      return this.initializeWebSpeechFallback();
      
    } catch (error) {
      this.updateConnectionStatus('disconnected');
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.handleVoiceError(errorObj);
      throw errorObj;
    }
  }

  /**
   * Initialize ElevenLabs Conversational AI
   */
  private async initializeElevenLabsConversation(agentId: string): Promise<void> {
    try {
      // Request microphone permission first with enhanced settings
      try {
        console.log('🎤 Requesting enhanced microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100,
            channelCount: 1
          } 
        });
        
        // 마이크 정보 로깅
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          const track = audioTracks[0];
          const settings = track.getSettings();
          console.log('🎤 Microphone info:', track.label);
          console.log('🎤 Audio settings:', settings);
        }
        
        console.log('🎤 Enhanced microphone access granted');
        
        // 스트림 정리 (ElevenLabs가 자체적으로 마이크에 접근할 것임)
        stream.getTracks().forEach(track => track.stop());
      } catch (micError) {
        console.warn('🎤 Enhanced microphone access denied or not available:', micError);
        console.warn('🎤 Trying basic microphone access...');
        
        // 기본 마이크 접근 시도
        try {
          const basicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('🎤 Basic microphone access granted');
          basicStream.getTracks().forEach(track => track.stop());
        } catch (basicError) {
          console.error('🎤 All microphone access attempts failed:', basicError);
          throw new Error('Microphone access is required for voice functionality');
        }
      }
      
      // Import ElevenLabs Conversation class
      const { Conversation } = await import('@elevenlabs/client');
      
      console.log('🎤 Starting ElevenLabs conversation session...');
      
      // Create conversation session using the new API with enhanced settings
      // NOTE: We disable ElevenLabs' built-in AI audio output because we use our own backend
      // ElevenLabs is used ONLY for speech-to-text (STT), not for AI responses
      const conversation = await Conversation.startSession({
        agentId: agentId,
        connectionType: 'webrtc', // WebRTC for better audio quality
        // 🔇 CRITICAL: Disable ElevenLabs AI audio output - we use our own backend TTS
        // Set volume to 0 to mute ElevenLabs' built-in AI responses
        overrides: {
          agent: {
            tts: {
              voiceId: '21m00Tcm4TlvDq8ikWAM' // Keep voice ID but we'll mute it
            }
          }
        },
        // Enhanced audio settings for better recognition (input only)
        audioSettings: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        },
        onConnect: () => {
          console.log('🎤 ElevenLabs conversation connected (STT only mode)');
          this.config.onConnect?.();
          
          // 🔇 Mute ElevenLabs audio output after connection
          // We only use ElevenLabs for speech-to-text, our backend handles AI responses
          if (conversation && typeof conversation.setVolume === 'function') {
            conversation.setVolume({ volume: 0 });
            console.log('🔇 ElevenLabs AI audio muted - using our backend for responses');
          }
        },
        onDisconnect: () => {
          console.log('🎤 ElevenLabs conversation disconnected');
          this.config.onDisconnect?.();
        },
        onError: (error: any) => {
          console.error('🎤 ElevenLabs conversation error:', error);
          this.handleVoiceError(new Error(error.message || 'ElevenLabs conversation error'));
        },
        onMessage: (message: any) => {
          console.log('🎤 ElevenLabs message received:', message);
          
          // 빈 메시지 감지 및 경고
          if (message.source === 'user' && (message.message === '...' || !message.message || message.message.trim() === '')) {
            console.warn('⚠️ Empty user message detected - possible microphone issue');
            console.warn('🎤 Please check microphone settings and permissions');
            // 빈 메시지는 처리하지 않음
            return;
          }
          
          // 메시지 내용 추출
          const messageContent = message.message || message.text || message.content || message;
          
          // 사용자 메시지와 AI 메시지 구분
          if (message.source === 'user' || message.role === 'user') {
            // 사용자 음성 메시지 - onUserMessage 콜백 호출
            // This triggers our backend processing
            console.log('🎤 User voice message (sending to our backend):', messageContent);
            this.config.onUserMessage?.(messageContent);
          } else if (message.source === 'ai' || message.role === 'agent' || message.role === 'assistant') {
            // 🔇 ElevenLabs AI 응답 - 무시 (우리 백엔드 사용)
            // We ignore ElevenLabs' built-in AI responses since we use our own backend
            console.log('🔇 ElevenLabs AI response (ignored - audio muted, using our backend):', messageContent.substring(0, 50) + '...');
            // Don't call onMessage - our backend response will be used instead
          } else {
            // 기타 메시지 - 로그만 출력
            console.log('🔇 Other ElevenLabs message (ignored):', messageContent);
          }
        },
        onModeChange: (mode: any) => {
          console.log('🎤 ElevenLabs mode change:', mode);
          const mappedMode = this.mapElevenLabsMode(mode);
          this.config.onModeChange?.(mappedMode);
        },
        onVolumeChange: (volume: any) => {
          // We control volume ourselves, ignore ElevenLabs volume changes
          console.log('🎤 ElevenLabs volume change (ignored):', volume);
        }
      });
      
      console.log('🎤 ElevenLabs conversation session created:', conversation.getId());
      
      this.conversation = conversation;
      this.updateConnectionStatus('connected');
      this.isInitialized = true;
      this.reconnectAttempts = 0;
      
    } catch (error) {
      console.error('Failed to initialize ElevenLabs conversation:', error);
      throw error;
    }
  }

  /**
   * Initialize Web Speech API as fallback
   */
  private async initializeWebSpeechFallback(): Promise<void> {
    // Check if Web Speech API is available
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      console.log('✅ Web Speech API available - voice recognition will work');
      this.updateConnectionStatus('connected');
      this.isInitialized = true;
      this.reconnectAttempts = 0;
      this.config.onConnect?.();
      return;
    } else {
      console.warn('❌ Web Speech API not supported in this browser');
      this.updateConnectionStatus('disconnected');
      const error = new Error('Voice recognition not supported in this browser');
      this.handleVoiceError(error);
      throw error;
    }
  }

  /**
   * Start listening for voice input using ElevenLabs or Web Speech API
   * Validates: Requirements 1.1
   */
  startListening(): void {
    try {
      if (this.isUsingElevenLabs && this.conversation) {
        // ElevenLabs conversation automatically handles microphone activation
        console.log('🎤 ElevenLabs conversation is listening');
        this.updateConnectionStatus('connected');
        return;
      }

      // Use Web Speech API as fallback
      if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
        this.startWebSpeechRecognition();
        return;
      }

      const error = new Error('No voice recognition method available');
      this.handleVoiceError(error);
      throw error;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.handleVoiceError(errorObj);
      throw errorObj;
    }
  }

  /**
   * Start Web Speech Recognition with language detection and selection
   */
  private startWebSpeechRecognition(): void {
    if (typeof window === 'undefined' || !('webkitSpeechRecognition' in window)) {
      console.warn('Web Speech API not supported in this browser');
      return;
    }

    try {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      
      // Get language preference from localStorage or browser settings
      let speechLang = localStorage.getItem('voiceLanguage') || 'auto';
      
      if (speechLang === 'auto') {
        // Auto-detect from browser settings
        const userLanguage = navigator.language || navigator.languages?.[0] || 'en-US';
        console.log('🌍 Browser language:', userLanguage);
        
        // Map browser language to speech recognition language
        if (userLanguage.startsWith('ko')) {
          speechLang = 'ko-KR';
        } else if (userLanguage.startsWith('ja')) {
          speechLang = 'ja-JP';
        } else if (userLanguage.startsWith('es')) {
          speechLang = 'es-ES';
        } else if (userLanguage.startsWith('en')) {
          speechLang = 'en-US';
        } else {
          speechLang = 'en-US'; // Default fallback
        }
      }
      
      recognition.lang = speechLang;
      console.log('🎤 Speech recognition language set to:', speechLang);
      
      recognition.onstart = () => {
        console.log('🎤 Web Speech Recognition started with language:', speechLang);
        this.updateConnectionStatus('connected');
        this.config.onConnect?.();
      };
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        console.log('🎤 Speech recognized:', transcript, 'Confidence:', confidence);
        
        // If confidence is low and not using English, suggest language adjustment
        if (confidence < 0.7 && speechLang !== 'en-US') {
          console.log('🎤 Low confidence, might need language adjustment');
        }
        
        // Trigger transcription callback
        this.callbacks.onTranscription?.(transcript);
      };
      
      recognition.onerror = (event: any) => {
        console.error('🎤 Speech recognition error:', event.error);
        
        // Handle 'no-speech' error gracefully (user didn't speak)
        if (event.error === 'no-speech') {
          console.log('🎤 No speech detected, stopping listening');
          this.updateConnectionStatus('disconnected');
          this.config.onDisconnect?.();
          return; // Don't treat this as a real error
        }
        
        // If language error, try with English as fallback
        if (event.error === 'language-not-supported' && speechLang !== 'en-US') {
          console.log('🎤 Language not supported, retrying with English...');
          recognition.lang = 'en-US';
          setTimeout(() => {
            try {
              recognition.start();
            } catch (retryError) {
              console.error('🎤 Retry failed:', retryError);
              this.updateConnectionStatus('disconnected');
              const error = new Error(`Speech recognition retry failed: ${retryError}`);
              this.handleVoiceError(error);
            }
          }, 100);
          return;
        }
        
        // Handle other errors
        this.updateConnectionStatus('disconnected');
        const error = new Error(`Speech recognition error: ${event.error}`);
        this.handleVoiceError(error);
      };
      
      recognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        this.updateConnectionStatus('disconnected');
        this.config.onDisconnect?.();
      };
      
      recognition.start();
      this.conversation = recognition; // Store recognition instance
      
    } catch (error) {
      console.error('Failed to start Web Speech Recognition:', error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.handleVoiceError(errorObj);
    }
  }

  /**
   * Set language preference for speech recognition
   */
  setLanguagePreference(language: string): void {
    localStorage.setItem('voiceLanguage', language);
    console.log('🌍 Voice language preference set to:', language);
    
    // If currently listening, restart with new language
    if (this.conversation && typeof this.conversation.stop === 'function') {
      this.conversation.stop();
      setTimeout(() => {
        this.startListening();
      }, 500);
    }
  }

  /**
   * Get current language preference
   */
  getLanguagePreference(): string {
    return localStorage.getItem('voiceLanguage') || 'auto';
  }

  /**
   * Stop listening for voice input
   */
  stopListening(): void {
    try {
      // Stop Web Speech Recognition if active
      if (this.conversation && typeof this.conversation.stop === 'function') {
        this.conversation.stop();
        this.conversation = null;
      }
      
      console.log('Voice agent stopped listening');
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.handleVoiceError(errorObj);
    }
  }

  /**
   * Send text message to the conversation with queuing support
   * Validates: Requirements 1.2, 1.4, 6.4
   */
  async sendMessage(text: string, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<void> {
    if (!text.trim()) {
      const error = new Error('Message text cannot be empty');
      this.handleVoiceError(error);
      throw error;
    }

    try {
      if (this.isUsingElevenLabs && this.conversation) {
        // Send message through ElevenLabs conversation using the new API
        console.log('🎤 Sending message to ElevenLabs:', text);
        await this.conversation.sendUserMessage(text.trim());
        return;
      }

      // Fallback to queue-based processing for Web Speech API
      const request: VoiceRequest = {
        id: `req-${++this.requestIdCounter}-${Date.now()}`,
        text: text.trim(),
        timestamp: new Date(),
        priority,
        retryCount: 0,
        maxRetries: 2
      };

      // Add to queue with priority handling
      this.enqueueRequest(request);

      // Start session if not active
      if (!this.currentSession) {
        this.startSession();
      }

      // Process queue
      await this.processRequestQueue();
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.handleVoiceError(errorObj);
      throw errorObj;
    }
  }

  /**
   * Enqueue voice request with priority handling
   * Validates: Requirements 6.4
   */
  private enqueueRequest(request: VoiceRequest): void {
    // Check queue size limit
    if (this.requestQueue.length >= this.maxQueueSize) {
      // Remove oldest low priority request if queue is full
      const lowPriorityIndex = this.requestQueue.findIndex(req => req.priority === 'low');
      if (lowPriorityIndex !== -1) {
        this.requestQueue.splice(lowPriorityIndex, 1);
        console.warn('Removed low priority request due to queue size limit');
      } else {
        const error = new Error('Voice request queue is full');
        this.handleVoiceError(error);
        throw error;
      }
    }

    // Insert request based on priority
    if (request.priority === 'high') {
      // High priority goes to front
      this.requestQueue.unshift(request);
    } else if (request.priority === 'normal') {
      // Normal priority goes after high priority requests
      const highPriorityCount = this.requestQueue.filter(req => req.priority === 'high').length;
      this.requestQueue.splice(highPriorityCount, 0, request);
    } else {
      // Low priority goes to end
      this.requestQueue.push(request);
    }

    console.log(`Enqueued voice request ${request.id} with priority ${request.priority}. Queue size: ${this.requestQueue.length}`);
  }

  /**
   * Process voice request queue with conflict prevention
   * Validates: Requirements 6.4
   */
  private async processRequestQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessingRequest || this.requestQueue.length === 0) {
      return;
    }

    // Check if agent is ready
    if (!this.isInitialized || !this.conversation) {
      const error = new Error('Voice agent not initialized. Call initializeConnection() first.');
      this.handleVoiceError(error);
      throw error;
    }

    if (this.connectionStatus !== 'connected') {
      console.warn('Voice agent not connected. Waiting for connection...');
      return;
    }

    this.isProcessingRequest = true;

    try {
      while (this.requestQueue.length > 0) {
        const request = this.requestQueue.shift()!;
        
        try {
          // Update session activity
          if (this.currentSession) {
            this.currentSession.requestCount++;
            this.currentSession.lastActivity = new Date();
          }

          console.log(`Processing voice request ${request.id}: "${request.text}"`);

          // Trigger transcription callback for the input text
          this.callbacks.onTranscription?.(request.text);
          
          // Simulate sending message (without ElevenLabs for now)
          // In a real implementation, this would use ElevenLabs TTS
          console.log(`Simulated voice message: ${request.text}`);
          
          // Simulate response after delay
          setTimeout(() => {
            this.config.onMessage?.(`Voice response for: ${request.text}`);
          }, 1000);

          console.log(`Successfully processed voice request ${request.id}`);

        } catch (error) {
          console.error(`Failed to process voice request ${request.id}:`, error);
          
          // Retry logic
          if (request.retryCount < request.maxRetries) {
            request.retryCount++;
            console.log(`Retrying voice request ${request.id} (attempt ${request.retryCount}/${request.maxRetries})`);
            
            // Re-enqueue with delay
            setTimeout(() => {
              this.requestQueue.unshift(request);
              this.processRequestQueue().catch(console.error);
            }, 1000 * request.retryCount);
          } else {
            console.error(`Voice request ${request.id} failed after ${request.maxRetries} retries`);
            const errorObj = error instanceof Error ? error : new Error(String(error));
            this.handleVoiceError(errorObj);
          }
        }

        // Add delay between requests to prevent audio conflicts
        if (this.requestQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } finally {
      this.isProcessingRequest = false;
    }
  }

  /**
   * Start a new voice session
   * Validates: Requirements 6.4
   */
  private startSession(): void {
    // End current session if exists
    if (this.currentSession) {
      this.endSession('interrupted');
    }

    this.currentSession = {
      id: `session-${Date.now()}`,
      startTime: new Date(),
      status: 'active',
      requestCount: 0,
      lastActivity: new Date()
    };

    // Set session timeout
    this.sessionTimer = setTimeout(() => {
      this.endSession('completed');
    }, this.sessionTimeout);

    console.log(`Started voice session ${this.currentSession.id}`);
  }

  /**
   * End current voice session with cleanup
   * Validates: Requirements 6.4
   */
  private endSession(status: 'interrupted' | 'completed' | 'failed'): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.endTime = new Date();
    this.currentSession.status = status;

    // Clear session timer
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }

    // Clear pending requests if session failed or was interrupted
    if (status === 'failed' || status === 'interrupted') {
      const clearedRequests = this.requestQueue.length;
      this.requestQueue = [];
      this.isProcessingRequest = false;
      
      if (clearedRequests > 0) {
        console.log(`Cleared ${clearedRequests} pending voice requests due to session ${status}`);
      }
    }

    console.log(`Ended voice session ${this.currentSession.id} with status: ${status}`);
    this.currentSession = null;
  }

  /**
   * Get current session information
   */
  getCurrentSession(): VoiceSession | null {
    return this.currentSession;
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): { size: number; isProcessing: boolean; requests: VoiceRequest[] } {
    return {
      size: this.requestQueue.length,
      isProcessing: this.isProcessingRequest,
      requests: [...this.requestQueue] // Return copy to prevent external modification
    };
  }

  /**
   * Clear all pending requests
   */
  clearQueue(): void {
    const clearedCount = this.requestQueue.length;
    this.requestQueue = [];
    this.isProcessingRequest = false;
    
    if (clearedCount > 0) {
      console.log(`Cleared ${clearedCount} pending voice requests`);
    }
  }

  /**
   * Force end current session and clear queue
   */
  forceEndSession(): void {
    this.endSession('interrupted');
    this.clearQueue();
  }

  /**
   * Disconnect from voice service with proper cleanup
   */
  async disconnect(): Promise<void> {
    // End current session and clear queue
    this.forceEndSession();

    if (this.conversation) {
      try {
        // End ElevenLabs conversation session using the new API
        if (this.isUsingElevenLabs && typeof this.conversation.endSession === 'function') {
          console.log('Ending ElevenLabs conversation session...');
          await this.conversation.endSession();
        } else {
          console.log('Ending voice session...');
        }
      } catch (error) {
        console.warn('Error ending conversation session:', error);
      }
      this.conversation = null;
    }
    
    this.isInitialized = false;
    this.updateConnectionStatus('disconnected');
  }

  /**
   * Attempt automatic reconnection with exponential backoff
   * Validates: Requirements 6.3, 6.5
   */
  private async attemptReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      errorHandler.handleError(
        new Error('Maximum reconnection attempts exceeded'),
        {
          type: ErrorType.VOICE_SERVICE,
          severity: ErrorSeverity.HIGH,
          component: 'VoiceAgent',
          action: 'attemptReconnection',
          timestamp: new Date(),
          additionalData: { attempts: this.reconnectAttempts }
        }
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting voice service reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.initializeConnection();
      } catch (error) {
        console.warn(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        // The next attempt will be scheduled by the onDisconnect handler if needed
      }
    }, delay);
  }

  /**
   * Handle voice service errors with comprehensive error handling
   * Validates: Requirements 6.3
   */
  private handleVoiceError(error: Error): void {
    // Prevent infinite error loops by limiting error callback frequency
    const now = Date.now();
    if (this.lastErrorTime && (now - this.lastErrorTime) < 1000) {
      console.warn('Throttling voice error callbacks to prevent infinite loops');
      return;
    }
    this.lastErrorTime = now;

    const result = errorHandler.handleVoiceServiceError(error, 'VoiceAgent', 'operation');
    
    // Trigger error callbacks (throttled)
    this.config.onError?.(error);
    this.callbacks.onError?.(error);
    
    // If error suggests reconnection, attempt it
    if (result.shouldRetry && this.connectionStatus !== 'connecting') {
      this.attemptReconnection();
    }
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    return this.connectionStatus;
  }

  /**
   * Get current audio level
   */
  getAudioLevel(): number {
    return this.audioLevel;
  }

  /**
   * Get current mode (listening/speaking/thinking)
   */
  getCurrentMode(): 'listening' | 'speaking' | 'thinking' {
    return this.currentMode;
  }

  /**
   * Check if voice agent is initialized and ready
   */
  isReady(): boolean {
    return this.isInitialized && this.connectionStatus === 'connected';
  }

  /**
   * Register callbacks for voice events
   */
  setCallbacks(callbacks: Partial<VoiceAgentCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Update callback for specific event
   */
  onTranscription(callback: (text: string) => void): void {
    this.callbacks.onTranscription = callback;
  }

  onResponse(callback: (audioUrl: string, text: string) => void): void {
    this.callbacks.onResponse = callback;
  }

  onAudioLevel(callback: (level: number) => void): void {
    this.callbacks.onAudioLevel = callback;
  }

  onConnectionStatusChange(callback: (status: 'connected' | 'connecting' | 'disconnected') => void): void {
    this.callbacks.onConnectionStatusChange = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.callbacks.onError = callback;
  }

  // Private helper methods
  private updateConnectionStatus(status: 'connected' | 'connecting' | 'disconnected'): void {
    this.connectionStatus = status;
    this.callbacks.onConnectionStatusChange?.(status);
  }

  private mapElevenLabsStatus(status: any): 'connected' | 'connecting' | 'disconnected' {
    // Handle both string and object inputs from ElevenLabs API
    let statusString: string;
    if (typeof status === 'string') {
      statusString = status;
    } else if (status && typeof status === 'object' && status.status) {
      statusString = status.status;
    } else {
      console.warn('Unknown status format:', status);
      return 'disconnected';
    }
    
    switch (statusString.toLowerCase()) {
      case 'connected':
      case 'ready':
        return 'connected';
      case 'connecting':
      case 'initializing':
        return 'connecting';
      default:
        return 'disconnected';
    }
  }

  private mapElevenLabsMode(mode: any): 'listening' | 'speaking' | 'thinking' {
    // Handle both string and object inputs from ElevenLabs API
    let modeString: string;
    if (typeof mode === 'string') {
      modeString = mode;
    } else if (mode && typeof mode === 'object') {
      // Handle various object formats from ElevenLabs API
      if (mode.mode) {
        modeString = mode.mode;
      } else if (mode.status) {
        modeString = mode.status;
      } else if (mode.state) {
        modeString = mode.state;
      } else {
        // If it's an object but no recognizable property, convert to string
        modeString = String(mode);
      }
    } else {
      console.warn('Unknown mode format:', mode);
      return 'listening';
    }
    
    // Ensure modeString is actually a string before calling toLowerCase
    if (typeof modeString !== 'string') {
      console.warn('Mode string is not a string:', modeString);
      return 'listening';
    }
    
    switch (modeString.toLowerCase()) {
      case 'listening':
        return 'listening';
      case 'speaking':
        return 'speaking';
      case 'thinking':
      case 'processing':
        return 'thinking';
      default:
        return 'listening';
    }
  }
}

// Factory function to create voice agent instance
export function createVoiceAgent(config: VoiceAgentConfig): VoiceAgent {
  return new VoiceAgent(config);
}

// Default configuration for development
export const defaultVoiceConfig: Partial<VoiceAgentConfig> = {
  agentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID || 'default-agent-id',
  apiKey: import.meta.env.VITE_ELEVENLABS_API_KEY,
};