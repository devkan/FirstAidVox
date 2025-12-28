import { Conversation } from '@elevenlabs/react';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

// Voice Agent Service for ElevenLabs integration
export interface VoiceAgentConfig {
  agentId: string;
  apiKey?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onMessage?: (message: string) => void;
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
  private conversation: Conversation | null = null;
  private callbacks: Partial<VoiceAgentCallbacks> = {};
  private config: VoiceAgentConfig;
  private isInitialized = false;
  private connectionStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
  private currentMode: 'listening' | 'speaking' | 'thinking' = 'listening';
  private audioLevel = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;

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
   * Initialize connection with ElevenLabs
   * Validates: Requirements 6.1
   */
  async initializeConnection(): Promise<void> {
    // If already initialized, return early
    if (this.isInitialized && this.connectionStatus === 'connected') {
      return;
    }

    try {
      this.updateConnectionStatus('connecting');
      
      // Create conversation instance with ElevenLabs
      this.conversation = new Conversation({
        agentId: this.config.agentId,
        ...(this.config.apiKey && { apiKey: this.config.apiKey }),
        onConnect: () => {
          this.updateConnectionStatus('connected');
          this.isInitialized = true;
          this.reconnectAttempts = 0; // Reset on successful connection
          this.config.onConnect?.();
        },
        onDisconnect: () => {
          this.updateConnectionStatus('disconnected');
          this.isInitialized = false;
          this.config.onDisconnect?.();
          
          // Attempt automatic reconnection
          this.attemptReconnection();
        },
        onError: (error: string) => {
          const errorObj = new Error(error);
          this.handleVoiceError(errorObj);
        },
        onMessage: (message: string) => {
          this.config.onMessage?.(message);
          // Trigger TTS response callback
          this.callbacks.onResponse?.('', message);
        },
        onStatusChange: (status: string) => {
          const mappedStatus = this.mapElevenLabsStatus(status);
          this.updateConnectionStatus(mappedStatus);
          this.config.onStatusChange?.(mappedStatus);
        },
        onModeChange: (mode: string) => {
          const mappedMode = this.mapElevenLabsMode(mode);
          this.currentMode = mappedMode;
          this.config.onModeChange?.(mappedMode);
        },
        onVolumeChange: (volume: number) => {
          this.audioLevel = volume;
          this.config.onVolumeChange?.(volume);
          this.callbacks.onAudioLevel?.(volume);
        }
      });

      // Start the conversation
      await this.conversation.startSession();
      
    } catch (error) {
      this.updateConnectionStatus('disconnected');
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.handleVoiceError(errorObj);
      throw errorObj;
    }
  }

  /**
   * Start listening for voice input
   * Validates: Requirements 1.1
   */
  startListening(): void {
    if (!this.isInitialized || !this.conversation) {
      const error = new Error('Voice agent not initialized. Call initializeConnection() first.');
      this.handleVoiceError(error);
      throw error;
    }

    try {
      // ElevenLabs conversation automatically handles microphone activation
      // The conversation is already listening when connected
      if (this.connectionStatus === 'connected') {
        // Conversation is ready to receive audio input
        console.log('Voice agent is now listening');
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.handleVoiceError(errorObj);
      throw errorObj;
    }
  }

  /**
   * Stop listening for voice input
   */
  stopListening(): void {
    if (!this.isInitialized || !this.conversation) {
      return;
    }

    try {
      // ElevenLabs handles this automatically based on conversation flow
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

    // Create voice request
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
          
          // Send message through ElevenLabs conversation
          await this.conversation.sendMessage(request.text);

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
   * Disconnect from ElevenLabs service with proper cleanup
   */
  async disconnect(): Promise<void> {
    // End current session and clear queue
    this.forceEndSession();

    if (this.conversation) {
      try {
        await this.conversation.endSession();
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
    const result = errorHandler.handleVoiceServiceError(error, 'VoiceAgent', 'operation');
    
    // Trigger error callbacks
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

  private mapElevenLabsStatus(status: string): 'connected' | 'connecting' | 'disconnected' {
    switch (status.toLowerCase()) {
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

  private mapElevenLabsMode(mode: string): 'listening' | 'speaking' | 'thinking' {
    switch (mode.toLowerCase()) {
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
  agentId: process.env.VITE_ELEVENLABS_AGENT_ID || 'default-agent-id',
  apiKey: process.env.VITE_ELEVENLABS_API_KEY,
};