/**
 * Conversational Medical Service
 * Manages step-by-step medical diagnosis through systematic questioning
 */

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    confidence?: number;
    urgency_level?: string;
    assessment_stage?: 'initial' | 'clarification' | 'final';
    hospitalData?: any[]; // Hospital data for final diagnosis
  };
}

export interface ConversationHistory {
  messages: ConversationMessage[];
  sessionId: string;
  startTime: Date;
  lastActivity: Date;
  currentStage: 'initial' | 'clarification' | 'final';
  symptoms: string[];
  assessmentProgress: {
    duration?: string;
    severity?: string;
    quality?: string;
    associatedSymptoms?: string[];
    aggravatingFactors?: string[];
    relievingFactors?: string[];
    medicalHistory?: string[];
  };
}

export interface ConversationalRequest {
  message: string;
  conversation_history: Array<{
    role: string;
    content: string;
  }>;
  user_location?: {
    latitude: number;
    longitude: number;
  };
  image_data?: string; // Base64 encoded
}

export interface ConversationalResponse {
  response: string;
  brief_text: string;
  detailed_text: string;
  condition: string;
  urgency_level: string;
  confidence: number;
  hospital_data?: any[];
  assessment_stage?: 'initial' | 'clarification' | 'final';
}

class ConversationalMedicalService {
  private baseUrl: string;
  private currentConversation: ConversationHistory | null = null;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  }

  /**
   * Start a new medical conversation
   */
  startNewConversation(): ConversationHistory {
    const sessionId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentConversation = {
      messages: [],
      sessionId,
      startTime: new Date(),
      lastActivity: new Date(),
      currentStage: 'initial',
      symptoms: [],
      assessmentProgress: {}
    };

    console.log('🩺 Started new medical conversation:', sessionId);
    return this.currentConversation;
  }

  /**
   * Get current conversation
   */
  getCurrentConversation(): ConversationHistory | null {
    return this.currentConversation;
  }

  /**
   * Add message to conversation history
   */
  addMessage(role: 'user' | 'assistant', content: string, metadata?: any): ConversationMessage {
    if (!this.currentConversation) {
      this.startNewConversation();
    }

    const message: ConversationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      timestamp: new Date(),
      metadata
    };

    this.currentConversation!.messages.push(message);
    this.currentConversation!.lastActivity = new Date();

    // Update assessment stage based on AI response
    if (role === 'assistant' && metadata?.assessment_stage) {
      this.currentConversation!.currentStage = metadata.assessment_stage;
    }

    console.log(`💬 Added ${role} message to conversation:`, content.substring(0, 100) + '...');
    return message;
  }

  /**
   * Send message to conversational AI
   */
  async sendMessage(
    message: string, 
    userLocation?: { latitude: number; longitude: number },
    imageFile?: File
  ): Promise<ConversationalResponse> {
    try {
      if (!this.currentConversation) {
        this.startNewConversation();
      }

      // Add user message to history
      this.addMessage('user', message);

      // Prepare conversation history for API (last 10 messages for context)
      const conversationHistory = this.currentConversation.messages
        .slice(-10)
        .map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

      // Prepare image data if provided
      let imageData: string | undefined;
      if (imageFile) {
        imageData = await this.fileToBase64(imageFile);
      }

      // Prepare request
      const requestData: ConversationalRequest = {
        message,
        conversation_history: conversationHistory,
        user_location: userLocation,
        image_data: imageData
      };

      console.log('🔄 Sending conversational request:', {
        message: message.substring(0, 100) + '...',
        historyLength: conversationHistory.length,
        hasLocation: !!userLocation,
        hasImage: !!imageData
      });

      // Send request to conversational endpoint
      const response = await fetch(`${this.baseUrl}/chat/conversational`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorData.detail?.message || ''}`);
      }

      const result: ConversationalResponse = await response.json();

      // Add AI response to history with hospital data in metadata
      this.addMessage('assistant', result.response, {
        confidence: result.confidence,
        urgency_level: result.urgency_level,
        assessment_stage: result.assessment_stage || this.determineAssessmentStage(result.response),
        hospitalData: result.hospital_data // Store hospital data in message metadata
      });

      // Update assessment progress based on response
      this.updateAssessmentProgress(message, result.response);

      console.log('✅ Received conversational response:', {
        stage: result.assessment_stage,
        urgency: result.urgency_level,
        confidence: result.confidence,
        hasHospitals: !!result.hospital_data?.length
      });

      return result;

    } catch (error) {
      console.error('❌ Conversational service error:', error);
      
      // Add error message to conversation
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.addMessage('assistant', `I apologize, but I encountered an error: ${errorMessage}. Please try again or seek immediate medical attention if this is an emergency.`);
      
      throw error;
    }
  }

  /**
   * Determine assessment stage based on AI response content
   */
  private determineAssessmentStage(response: string): 'initial' | 'clarification' | 'final' {
    const lowerResponse = response.toLowerCase();
    
    // Final assessment indicators
    if (lowerResponse.includes('diagnosis') || 
        lowerResponse.includes('recommend') || 
        lowerResponse.includes('seek medical attention') ||
        lowerResponse.includes('hospital') ||
        lowerResponse.includes('emergency') ||
        lowerResponse.includes('진단') ||
        lowerResponse.includes('병원') ||
        lowerResponse.includes('치료') ||
        lowerResponse.includes('권합니다') ||
        lowerResponse.includes('방문')) {
      return 'final';
    }
    
    // Clarification indicators (follow-up questions)
    if (lowerResponse.includes('how severe') || 
        lowerResponse.includes('additional') ||
        lowerResponse.includes('follow-up') ||
        lowerResponse.includes('정도') ||
        lowerResponse.includes('추가로') ||
        lowerResponse.includes('더')) {
      return 'clarification';
    }
    
    // Default to initial for first interactions
    return 'initial';
  }

  /**
   * Update assessment progress based on conversation
   */
  private updateAssessmentProgress(userMessage: string, aiResponse: string): void {
    if (!this.currentConversation) return;

    const lowerUserMessage = userMessage.toLowerCase();
    const lowerAiResponse = aiResponse.toLowerCase();

    // Extract symptoms mentioned
    const symptomKeywords = [
      'pain', 'ache', 'hurt', 'sore', 'headache', 'fever', 'nausea', 'dizzy', 'tired',
      '아프', '통증', '열', '메스꺼움', '어지러움', '피곤',
      'dolor', 'fiebre', 'náuseas', 'mareo',
      '痛み', '熱', '吐き気', 'めまい'
    ];

    symptomKeywords.forEach(keyword => {
      if (lowerUserMessage.includes(keyword) && !this.currentConversation!.symptoms.includes(keyword)) {
        this.currentConversation!.symptoms.push(keyword);
      }
    });

    // Extract duration information
    if (lowerUserMessage.includes('started') || lowerUserMessage.includes('began') || lowerUserMessage.includes('since')) {
      // Try to extract duration from user message
      const durationMatch = lowerUserMessage.match(/(yesterday|today|this morning|last night|few days|week|month)/);
      if (durationMatch) {
        this.currentConversation!.assessmentProgress.duration = durationMatch[1];
      }
    }

    // Extract severity information
    const severityKeywords = ['mild', 'moderate', 'severe', 'terrible', 'unbearable', '가벼운', '심한', '견딜 수 없는'];
    severityKeywords.forEach(severity => {
      if (lowerUserMessage.includes(severity)) {
        this.currentConversation!.assessmentProgress.severity = severity;
      }
    });

    console.log('📊 Updated assessment progress:', this.currentConversation.assessmentProgress);
  }

  /**
   * Convert file to base64
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get conversation summary
   */
  getConversationSummary(): string {
    if (!this.currentConversation || this.currentConversation.messages.length === 0) {
      return 'No conversation started';
    }

    const { messages, currentStage, symptoms, assessmentProgress } = this.currentConversation;
    const messageCount = messages.length;
    const duration = Math.round((Date.now() - this.currentConversation.startTime.getTime()) / 1000 / 60);

    return `Conversation: ${messageCount} messages, ${duration} min, Stage: ${currentStage}, Symptoms: ${symptoms.join(', ') || 'none identified'}`;
  }

  /**
   * Clear current conversation
   */
  clearConversation(): void {
    this.currentConversation = null;
    console.log('🗑️ Cleared conversation history');
  }

  /**
   * Export conversation for medical records
   */
  exportConversation(): string {
    if (!this.currentConversation) {
      return 'No conversation to export';
    }

    const { messages, sessionId, startTime, symptoms, assessmentProgress } = this.currentConversation;
    
    let export_text = `Medical Consultation Export\n`;
    export_text += `Session ID: ${sessionId}\n`;
    export_text += `Date: ${startTime.toLocaleString()}\n`;
    export_text += `Symptoms Identified: ${symptoms.join(', ') || 'None'}\n`;
    export_text += `Assessment Progress: ${JSON.stringify(assessmentProgress, null, 2)}\n\n`;
    export_text += `Conversation:\n`;
    export_text += `${'='.repeat(50)}\n`;

    messages.forEach((msg, index) => {
      export_text += `${index + 1}. ${msg.role.toUpperCase()} [${msg.timestamp.toLocaleTimeString()}]:\n`;
      export_text += `${msg.content}\n\n`;
    });

    return export_text;
  }
}

// Export singleton instance
export const conversationalService = new ConversationalMedicalService();