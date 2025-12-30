// Chat Component Types
export interface ChatMessage {
  id: string;
  content: string;
  type: MessageType;
  timestamp: Date;
  isUser: boolean;
  metadata?: MessageMetadata;
}

export type MessageType = 'text' | 'medical' | 'image' | 'voice' | 'system';
export type UrgencyLevel = 'low' | 'moderate' | 'high' | 'emergency';

export interface MessageMetadata {
  confidence?: number;
  urgency?: UrgencyLevel;
  attachments?: Attachment[];
  voiceData?: VoiceMetadata;
  medicalData?: MedicalAssessment;
}

export interface Attachment {
  id: string;
  type: 'image' | 'audio' | 'document';
  url: string;
  name: string;
  size: number;
}

export interface VoiceMetadata {
  duration: number;
  audioUrl?: string;
  transcription?: string;
}

export interface MedicalAssessment {
  condition: string;
  urgencyLevel: UrgencyLevel;
  advice: string;
  confidence: number;
  hospitalData?: any[];
  requiresEmergencyServices?: boolean;
}

// Component Props
export interface ChatInputProps {
  onSendMessage: (message: string, attachments?: File[]) => void;
  onVoiceInput: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export interface MessageBubbleProps {
  message: ChatMessage;
  className?: string;
}

export interface MedicalCardProps {
  assessment: MedicalAssessment;
  timestamp: Date;
  className?: string;
}

export interface ChatContainerProps {
  className?: string;
}

export interface TypingIndicatorProps {
  isVisible: boolean;
  className?: string;
}

export interface EmergencyButtonProps {
  onEmergencyCall: () => void;
  className?: string;
}