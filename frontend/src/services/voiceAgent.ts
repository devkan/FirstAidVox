// Voice Agent Service for ElevenLabs integration
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

// ElevenLabs Conversational AI types
interface ElevenLabsConversation {
  startSession: (config: any) => Promise<void>;
  endSession: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  setVolume: (config: { volume: number }) => void;
  getId: () => string;
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
  onUserMessage?: (message: string) => void;
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

  private requestQueue: VoiceRequest[] = [];
  private isProcessingRequest = false;
  private currentSession: VoiceSession | null = null;
  private sessionTimeout = 300000;
  private sessionTimer: NodeJS.Timeout | null = null;
  private requestIdCounter = 0;
  private maxQueueSize = 10;

  constructor(config: VoiceAgentConfig) {
    this.config = config;
  }

  async initializeConnection(): Promise<void> {
    if (this.isInitialized && this.connectionStatus === 'connected') {
      return;
    }

    try {
      this.updateConnectionStatus('connecting');
      
      const agentId = this.config.agentId || import.meta.env.VITE_ELEVENLABS_AGENT_ID;
      
      if (!agentId) {
        console.warn('ElevenLabs Agent ID not found. Using Web Speech API as fallback.');
        return this.initializeWebSpeechFallback();
      }
      
      console.log('🎤 Initializing ElevenLabs Conversational AI (STT only, AI audio muted)...');
      console.log('📋 Agent ID:', agentId);
      
      try {
        await this.initializeElevenLabsConversation(agentId);
        this.isUsingElevenLabs = true;
        console.log('✅ ElevenLabs Conversational AI initialized (AI audio muted, using our backend)');
      } catch (elevenLabsError) {
        console.warn('❌ ElevenLabs initialization failed, falling back to Web Speech API:', elevenLabsError);
        return this.initializeWebSpeechFallback();
      }
      
    } catch (error) {
      this.updateConnectionStatus('disconnected');
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.handleVoiceError(errorObj);
      throw errorObj;
    }
  }


  private async initializeElevenLabsConversation(agentId: string): Promise<void> {
    try {
      // Request microphone permission first
      try {
        console.log('🎤 Requesting microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        console.log('🎤 Microphone access granted');
        stream.getTracks().forEach(track => track.stop());
      } catch (micError) {
        console.error('🎤 Microphone access failed:', micError);
        throw new Error('Microphone access is required for voice functionality');
      }
      
      const { Conversation } = await import('@elevenlabs/client');
      
      console.log('🎤 Starting ElevenLabs conversation session...');
      
      // Store reference to this for callbacks
      const self = this;
      
      console.log('🌍 Starting ElevenLabs with auto language detection');
      
      const conversation = await Conversation.startSession({
        agentId: agentId,
        onConnect: function() {
          console.log('🎤 ElevenLabs conversation connected');
          self.config.onConnect?.();
          
          // Mute ElevenLabs AI audio after a short delay
          setTimeout(() => {
            if (self.conversation && typeof self.conversation.setVolume === 'function') {
              try {
                self.conversation.setVolume({ volume: 0 });
                console.log('🔇 ElevenLabs AI audio muted');
              } catch (e) {
                console.warn('Could not mute ElevenLabs audio:', e);
              }
            }
          }, 500);
        },
        onDisconnect: function() {
          console.log('🎤 ElevenLabs conversation disconnected');
          self.config.onDisconnect?.();
        },
        onError: function(error: any) {
          console.error('🎤 ElevenLabs conversation error:', error);
          self.handleVoiceError(new Error(error.message || 'ElevenLabs conversation error'));
        },
        onMessage: function(message: any) {
          console.log('🎤 ElevenLabs message received:', message);
          
          // Skip empty messages
          if (message.source === 'user' && (!message.message || message.message.trim() === '' || message.message === '...')) {
            console.warn('⚠️ Empty user message detected');
            return;
          }
          
          const messageContent = message.message || message.text || message.content || '';
          
          // Handle user messages (STT results) - send to our backend
          if (message.source === 'user' || message.role === 'user') {
            console.log('🎤 User voice message:', messageContent);
            self.config.onUserMessage?.(messageContent);
          } else if (message.source === 'ai' || message.role === 'agent' || message.role === 'assistant') {
            // Ignore ElevenLabs AI responses - we use our own backend
            console.log('🔇 ElevenLabs AI response (ignored):', messageContent.substring(0, 50) + '...');
          }
        },
        onModeChange: function(mode: any) {
          console.log('🎤 ElevenLabs mode change:', mode);
          const mappedMode = self.mapElevenLabsMode(mode);
          self.config.onModeChange?.(mappedMode);
        }
      });
      
      console.log('🎤 ElevenLabs conversation session created:', conversation.getId());
      
      // Store conversation reference
      this.conversation = conversation;
      this.updateConnectionStatus('connected');
      this.isInitialized = true;
      this.reconnectAttempts = 0;
      
    } catch (error) {
      console.error('Failed to initialize ElevenLabs conversation:', error);
      throw error;
    }
  }


  private async initializeWebSpeechFallback(): Promise<void> {
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

  startListening(): void {
    try {
      if (this.isUsingElevenLabs && this.conversation) {
        console.log('🎤 ElevenLabs conversation is listening');
        this.updateConnectionStatus('connected');
        return;
      }

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
      
      let speechLang = localStorage.getItem('voiceLanguage') || 'auto';
      
      if (speechLang === 'auto') {
        const userLanguage = navigator.language || navigator.languages?.[0] || 'en-US';
        console.log('🌍 Browser language:', userLanguage);
        
        if (userLanguage.startsWith('ko')) {
          speechLang = 'ko-KR';
        } else if (userLanguage.startsWith('ja')) {
          speechLang = 'ja-JP';
        } else if (userLanguage.startsWith('es')) {
          speechLang = 'es-ES';
        } else if (userLanguage.startsWith('en')) {
          speechLang = 'en-US';
        } else {
          speechLang = 'en-US';
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
        this.callbacks.onTranscription?.(transcript);
      };
      
      recognition.onerror = (event: any) => {
        console.error('🎤 Speech recognition error:', event.error);
        
        if (event.error === 'no-speech') {
          console.log('🎤 No speech detected, stopping listening');
          this.updateConnectionStatus('disconnected');
          this.config.onDisconnect?.();
          return;
        }
        
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
      this.conversation = recognition;
      
    } catch (error) {
      console.error('Failed to start Web Speech Recognition:', error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.handleVoiceError(errorObj);
    }
  }


  setLanguagePreference(language: string): void {
    localStorage.setItem('voiceLanguage', language);
    console.log('🌍 Voice language preference set to:', language);
    
    if (this.conversation && typeof this.conversation.stop === 'function') {
      this.conversation.stop();
      setTimeout(() => {
        this.startListening();
      }, 500);
    }
  }

  getLanguagePreference(): string {
    return localStorage.getItem('voiceLanguage') || 'auto';
  }

  stopListening(): void {
    try {
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

  async sendMessage(text: string, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<void> {
    if (!text.trim()) {
      const error = new Error('Message text cannot be empty');
      this.handleVoiceError(error);
      throw error;
    }

    try {
      if (this.isUsingElevenLabs && this.conversation) {
        console.log('🎤 Sending message to ElevenLabs:', text);
        await this.conversation.sendUserMessage(text.trim());
        return;
      }
      console.log(`Simulated voice message: ${text}`);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.handleVoiceError(errorObj);
      throw errorObj;
    }
  }

  getCurrentSession(): VoiceSession | null {
    return this.currentSession;
  }

  getQueueStatus(): { size: number; isProcessing: boolean; requests: VoiceRequest[] } {
    return {
      size: this.requestQueue.length,
      isProcessing: this.isProcessingRequest,
      requests: [...this.requestQueue]
    };
  }

  clearQueue(): void {
    const clearedCount = this.requestQueue.length;
    this.requestQueue = [];
    this.isProcessingRequest = false;
    if (clearedCount > 0) {
      console.log(`Cleared ${clearedCount} pending voice requests`);
    }
  }

  forceEndSession(): void {
    if (this.currentSession) {
      this.currentSession.endTime = new Date();
      this.currentSession.status = 'interrupted';
    }
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
    this.currentSession = null;
    this.clearQueue();
  }

  async disconnect(): Promise<void> {
    this.forceEndSession();

    if (this.conversation) {
      try {
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
      }
    }, delay);
  }

  private handleVoiceError(error: Error): void {
    const now = Date.now();
    if (this.lastErrorTime && (now - this.lastErrorTime) < 1000) {
      console.warn('Throttling voice error callbacks to prevent infinite loops');
      return;
    }
    this.lastErrorTime = now;

    const result = errorHandler.handleVoiceServiceError(error, 'VoiceAgent', 'operation');
    
    this.config.onError?.(error);
    this.callbacks.onError?.(error);
    
    if (result.shouldRetry && this.connectionStatus !== 'connecting') {
      this.attemptReconnection();
    }
  }

  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    return this.connectionStatus;
  }

  getAudioLevel(): number {
    return this.audioLevel;
  }

  getCurrentMode(): 'listening' | 'speaking' | 'thinking' {
    return this.currentMode;
  }

  isReady(): boolean {
    return this.isInitialized && this.connectionStatus === 'connected';
  }

  setCallbacks(callbacks: Partial<VoiceAgentCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

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

  private updateConnectionStatus(status: 'connected' | 'connecting' | 'disconnected'): void {
    this.connectionStatus = status;
    this.callbacks.onConnectionStatusChange?.(status);
  }

  private mapElevenLabsMode(mode: any): 'listening' | 'speaking' | 'thinking' {
    let modeString: string;
    if (typeof mode === 'string') {
      modeString = mode;
    } else if (mode && typeof mode === 'object') {
      if (mode.mode) {
        modeString = mode.mode;
      } else if (mode.status) {
        modeString = mode.status;
      } else if (mode.state) {
        modeString = mode.state;
      } else {
        modeString = String(mode);
      }
    } else {
      console.warn('Unknown mode format:', mode);
      return 'listening';
    }
    
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

export function createVoiceAgent(config: VoiceAgentConfig): VoiceAgent {
  return new VoiceAgent(config);
}

export const defaultVoiceConfig: Partial<VoiceAgentConfig> = {
  agentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID || 'default-agent-id',
  apiKey: import.meta.env.VITE_ELEVENLABS_API_KEY,
};
